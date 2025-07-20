import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '../generated/prisma';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
      errorFormat: 'pretty',
    });

    this.setupQueryLogging();
  }

  /**
   * Initialize the Prisma connection when the module starts
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Clean up the Prisma connection when the module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log('Successfully disconnected from database');
    } catch (error) {
      this.logger.error('Error during database disconnection', error);
    }
  }

  /**
   * Health check to verify database connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  /**
   * Get detailed health information about the database connection
   */
  async getHealthInfo(): Promise<{
    isHealthy: boolean;
    connectionStatus: string;
    lastChecked: Date;
    error?: string;
  }> {
    const lastChecked = new Date();

    try {
      await this.$queryRaw<
        [{ version: string }]
      >`SELECT version() as version`;

      return {
        isHealthy: true,
        connectionStatus: 'connected',
        lastChecked,
      };
    } catch (error) {
      return {
        isHealthy: false,
        connectionStatus: 'disconnected',
        lastChecked,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Setup query logging based on environment configuration
   */
  private setupQueryLogging(): void {
    // Type assertion to handle the event listener types properly
    (this as any).$on('query', (event: Prisma.QueryEvent) => {
      this.logger.debug(`Query: ${event.query}`);
      this.logger.debug(`Params: ${event.params}`);
      this.logger.debug(`Duration: ${event.duration}ms`);
    });

    (this as any).$on('info', (event: Prisma.LogEvent) => {
      this.logger.log(`Info: ${event.message}`);
    });

    (this as any).$on('warn', (event: Prisma.LogEvent) => {
      this.logger.warn(`Warning: ${event.message}`);
    });

    (this as unknown).$on('error', (event: Prisma.LogEvent) => {
      this.logger.error(`Error: ${event.message}`);
    });
  }



  /**
   * Execute a transaction with proper error handling
   */
  async executeTransaction<T>(
    fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.$transaction(fn);
    } catch (error) {
      this.logger.error('Transaction failed', error);
      throw error;
    }
  }

  /**
   * Get connection pool status (if available)
   */
  async getConnectionPoolStatus(): Promise<{
    activeConnections?: number;
    idleConnections?: number;
    totalConnections?: number;
  }> {
    try {
      // Query PostgreSQL connection stats
      const result = await this.$queryRaw<
        Array<{
          active: number;
          idle: number;
          total: number;
        }>
      >`
        SELECT 
          count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE state = 'idle') as idle,
          count(*) as total
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      if (result.length > 0) {
        return {
          activeConnections: Number(result[0].active),
          idleConnections: Number(result[0].idle),
          totalConnections: Number(result[0].total),
        };
      }
    } catch (error) {
      this.logger.warn('Could not retrieve connection pool status', error);
    }

    return {};
  }
}
