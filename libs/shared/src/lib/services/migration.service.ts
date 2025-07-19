import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import * as fs from 'fs';
import * as path from 'path';

interface Migration {
  id: string;
  filename: string;
  executed_at: Date;
}

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);
  private readonly migrationsPath = path.join(__dirname, '../database/migrations');
  private readonly seedsPath = path.join(__dirname, '../database/seeds');

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Initialize migration tracking table
   */
  private async initializeMigrationTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    try {
      await this.supabaseService.getAdminClient().rpc('execute_sql', {
        query: createTableQuery,
      });
      this.logger.log('Migration table initialized');
    } catch (error) {
      this.logger.error('Failed to initialize migration table:', error);
      throw error;
    }
  }

  /**
   * Get list of executed migrations
   */
  private async getExecutedMigrations(): Promise<Migration[]> {
    try {
      const { data, error } = await this.supabaseService
        .getAdminClient()
        .from('schema_migrations')
        .select('*')
        .order('executed_at', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get executed migrations:', error);
      return [];
    }
  }

  /**
   * Get list of migration files
   */
  private getMigrationFiles(): string[] {
    try {
      if (!fs.existsSync(this.migrationsPath)) {
        this.logger.warn(`Migrations directory not found: ${this.migrationsPath}`);
        return [];
      }

      return fs
        .readdirSync(this.migrationsPath)
        .filter((file) => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      this.logger.error('Failed to read migration files:', error);
      return [];
    }
  }

  /**
   * Get list of seed files
   */
  private getSeedFiles(): string[] {
    try {
      if (!fs.existsSync(this.seedsPath)) {
        this.logger.warn(`Seeds directory not found: ${this.seedsPath}`);
        return [];
      }

      return fs
        .readdirSync(this.seedsPath)
        .filter((file) => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      this.logger.error('Failed to read seed files:', error);
      return [];
    }
  }

  /**
   * Execute a SQL file
   */
  private async executeSqlFile(filePath: string): Promise<void> {
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Split SQL file into individual statements
      const statements = sql
        .split(';')
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

      // Execute each statement
      for (const statement of statements) {
        if (statement.trim()) {
          await this.supabaseService.getAdminClient().rpc('execute_sql', {
            query: statement,
          });
        }
      }

      this.logger.log(`Successfully executed SQL file: ${path.basename(filePath)}`);
    } catch (error) {
      this.logger.error(`Failed to execute SQL file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Record migration as executed
   */
  private async recordMigration(filename: string): Promise<void> {
    try {
      const migrationId = filename.replace('.sql', '');
      
      await this.supabaseService
        .getAdminClient()
        .from('schema_migrations')
        .insert({
          id: migrationId,
          filename,
          executed_at: new Date().toISOString(),
        });

      this.logger.log(`Recorded migration: ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to record migration ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      this.logger.log('Starting database migrations...');

      // Initialize migration table
      await this.initializeMigrationTable();

      // Get executed migrations and available migration files
      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = this.getMigrationFiles();

      const executedFilenames = executedMigrations.map((m) => m.filename);
      const pendingMigrations = migrationFiles.filter(
        (file) => !executedFilenames.includes(file)
      );

      if (pendingMigrations.length === 0) {
        this.logger.log('No pending migrations found');
        return;
      }

      this.logger.log(`Found ${pendingMigrations.length} pending migrations`);

      // Execute pending migrations
      for (const migrationFile of pendingMigrations) {
        const filePath = path.join(this.migrationsPath, migrationFile);
        
        this.logger.log(`Executing migration: ${migrationFile}`);
        await this.executeSqlFile(filePath);
        await this.recordMigration(migrationFile);
      }

      this.logger.log('All migrations completed successfully');
    } catch (error) {
      this.logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Run database seeds
   */
  async runSeeds(): Promise<void> {
    try {
      this.logger.log('Starting database seeding...');

      const seedFiles = this.getSeedFiles();

      if (seedFiles.length === 0) {
        this.logger.log('No seed files found');
        return;
      }

      this.logger.log(`Found ${seedFiles.length} seed files`);

      // Execute seed files
      for (const seedFile of seedFiles) {
        const filePath = path.join(this.seedsPath, seedFile);
        
        this.logger.log(`Executing seed: ${seedFile}`);
        await this.executeSqlFile(filePath);
      }

      this.logger.log('All seeds completed successfully');
    } catch (error) {
      this.logger.error('Seeding failed:', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    executed: Migration[];
    pending: string[];
    total: number;
  }> {
    try {
      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = this.getMigrationFiles();
      const executedFilenames = executedMigrations.map((m) => m.filename);
      const pendingMigrations = migrationFiles.filter(
        (file) => !executedFilenames.includes(file)
      );

      return {
        executed: executedMigrations,
        pending: pendingMigrations,
        total: migrationFiles.length,
      };
    } catch (error) {
      this.logger.error('Failed to get migration status:', error);
      throw error;
    }
  }

  /**
   * Reset database (WARNING: This will drop all data)
   */
  async resetDatabase(): Promise<void> {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('Database reset is not allowed in production');
    }

    try {
      this.logger.warn('RESETTING DATABASE - ALL DATA WILL BE LOST');

      // Drop all tables
      const dropTablesQuery = `
        DO $$ DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
        END $$;
      `;

      await this.supabaseService.getAdminClient().rpc('execute_sql', {
        query: dropTablesQuery,
      });

      this.logger.log('Database reset completed');
    } catch (error) {
      this.logger.error('Database reset failed:', error);
      throw error;
    }
  }
}