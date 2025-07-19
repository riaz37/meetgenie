import { IsString, IsOptional, IsDate, IsUUID, IsObject } from 'class-validator';

export class AuditLog {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  action!: string;

  @IsString()
  resourceType!: string;

  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @IsOptional()
  @IsObject()
  oldValues?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  newValues?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsDate()
  createdAt!: Date;

  constructor(partial: Partial<AuditLog>) {
    Object.assign(this, partial);
  }
}

export interface CreateAuditLogDto {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditFilters {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}