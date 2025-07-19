import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateAuditLogDto } from '../models/audit.model';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Generic method to validate data using class-validator
   */
  async validateData<T extends object>(
    data: any,
    targetClass: new () => T
  ): Promise<T> {
    const instance = plainToClass(targetClass, data);
    const errors = await validate(instance);

    if (errors.length > 0) {
      const errorMessages = this.formatValidationErrors(errors);
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }

    return instance;
  }

  /**
   * Format validation errors into readable messages
   */
  private formatValidationErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    for (const error of errors) {
      if (error.constraints) {
        messages.push(...Object.values(error.constraints));
      }
      if (error.children && error.children.length > 0) {
        messages.push(...this.formatValidationErrors(error.children));
      }
    }

    return messages;
  }

  /**
   * Generic method to create a record with validation
   */
  async create<T extends object>(
    table: string,
    data: any,
    targetClass: new () => T,
    userId?: string
  ): Promise<T> {
    try {
      // Validate data
      const validatedData = await this.validateData(data, targetClass);

      // Insert into database
      const { data: result, error } = await this.supabaseService
        .getAdminClient()
        .from(table)
        .insert(validatedData)
        .select()
        .single();

      if (error) {
        this.logger.error(`Failed to create record in ${table}:`, error);
        throw new Error(`Database error: ${error.message}`);
      }

      // Log audit trail
      if (userId) {
        await this.createAuditLog({
          userId,
          action: 'CREATE',
          resourceType: table,
          resourceId: result.id,
          newValues: validatedData as Record<string, any>,
        });
      }

      return plainToClass(targetClass, result);
    } catch (error) {
      this.logger.error(`Error creating record in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Generic method to update a record with validation
   */
  async update<T extends object>(
    table: string,
    id: string,
    data: any,
    targetClass: new () => T,
    userId?: string
  ): Promise<T> {
    try {
      // Get existing record for audit trail
      const { data: existingRecord } = await this.supabaseService
        .getAdminClient()
        .from(table)
        .select()
        .eq('id', id)
        .single();

      // Update record
      const { data: result, error } = await this.supabaseService
        .getAdminClient()
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error(`Failed to update record in ${table}:`, error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (!result) {
        throw new Error(`Record not found in ${table} with id: ${id}`);
      }

      // Log audit trail
      if (userId && existingRecord) {
        await this.createAuditLog({
          userId,
          action: 'UPDATE',
          resourceType: table,
          resourceId: id,
          oldValues: existingRecord,
          newValues: data,
        });
      }

      return plainToClass(targetClass, result);
    } catch (error) {
      this.logger.error(`Error updating record in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Generic method to delete a record
   */
  async delete(table: string, id: string, userId?: string): Promise<void> {
    try {
      // Get existing record for audit trail
      const { data: existingRecord } = await this.supabaseService
        .getAdminClient()
        .from(table)
        .select()
        .eq('id', id)
        .single();

      // Delete record
      const { error } = await this.supabaseService
        .getAdminClient()
        .from(table)
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error(`Failed to delete record from ${table}:`, error);
        throw new Error(`Database error: ${error.message}`);
      }

      // Log audit trail
      if (userId && existingRecord) {
        await this.createAuditLog({
          userId,
          action: 'DELETE',
          resourceType: table,
          resourceId: id,
          oldValues: existingRecord,
        });
      }
    } catch (error) {
      this.logger.error(`Error deleting record from ${table}:`, error);
      throw error;
    }
  }

  /**
   * Generic method to find a record by ID
   */
  async findById<T extends object>(
    table: string,
    id: string,
    targetClass: new () => T
  ): Promise<T | null> {
    try {
      const { data, error } = await this.supabaseService
        .getAdminClient()
        .from(table)
        .select()
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Record not found
          return null;
        }
        this.logger.error(`Failed to find record in ${table}:`, error);
        throw new Error(`Database error: ${error.message}`);
      }

      return plainToClass(targetClass, data);
    } catch (error) {
      this.logger.error(`Error finding record in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Generic method to find records with filters
   */
  async findMany<T extends object>(
    table: string,
    filters: Record<string, any>,
    targetClass: new () => T,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
    }
  ): Promise<T[]> {
    try {
      let query = this.supabaseService.getAdminClient().from(table).select();

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      });

      // Apply options
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }
      if (options?.orderBy) {
        query = query.order(options.orderBy, {
          ascending: options.orderDirection !== 'desc',
        });
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error(`Failed to find records in ${table}:`, error);
        throw new Error(`Database error: ${error.message}`);
      }

      return data.map((item) => plainToClass(targetClass, item));
    } catch (error) {
      this.logger.error(`Error finding records in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(auditData: CreateAuditLogDto): Promise<void> {
    try {
      await this.supabaseService
        .getAdminClient()
        .from('audit_logs')
        .insert(auditData);
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
      // Don't throw error for audit log failures to avoid breaking main operations
    }
  }

  /**
   * Execute raw SQL query (use with caution)
   */
  async executeRawQuery(query: string, params?: any[]): Promise<any> {
    try {
      const { data, error } = await this.supabaseService
        .getAdminClient()
        .rpc('execute_sql', { query, params });

      if (error) {
        this.logger.error('Failed to execute raw query:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    } catch (error) {
      this.logger.error('Error executing raw query:', error);
      throw error;
    }
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<boolean> {
    return this.supabaseService.healthCheck();
  }

  /**
   * Sanitize input to prevent SQL injection
   */
  sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return input;
    }

    // Remove potentially dangerous characters
    return input
      .replace(/['"\\;]/g, '') // Remove quotes, backslashes, semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove block comment start
      .replace(/\*\//g, '') // Remove block comment end
      .trim();
  }

  /**
   * Validate UUID format
   */
  isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}