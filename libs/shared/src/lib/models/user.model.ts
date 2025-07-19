import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsDate,
  IsUUID,
} from 'class-validator';
import { SyncStatus } from '../interfaces/clerk.interface';

export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum TonePreference {
  PROFESSIONAL = 'professional',
  CASUAL = 'casual',
  DETAILED = 'detailed',
  CONCISE = 'concise',
}

export enum SummaryFormat {
  BULLET_POINTS = 'bullet_points',
  PARAGRAPHS = 'paragraphs',
  STRUCTURED = 'structured',
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  meetingReminders: boolean;
  summaryReady: boolean;
  actionItemUpdates: boolean;
}

export interface UserPreferences {
  language: string;
  summaryFormat: SummaryFormat;
  tone: TonePreference;
  focusAreas: string[];
  notifications: NotificationSettings;
}

export class User {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsString()
  clerkUserId!: string;

  @IsEnum(SubscriptionTier)
  @IsOptional()
  subscriptionTier?: SubscriptionTier;

  @IsObject()
  @IsOptional()
  preferences?: UserPreferences;

  @IsDate()
  @IsOptional()
  createdAt?: Date;

  @IsDate()
  @IsOptional()
  updatedAt?: Date;

  @IsDate()
  @IsOptional()
  lastActive?: Date;

  @IsEnum(SyncStatus)
  @IsOptional()
  clerkSyncStatus?: SyncStatus;

  @IsDate()
  @IsOptional()
  lastClerkSyncAt?: Date;

  constructor(partial: Partial<User> = {}) {
    Object.assign(this, partial);
  }
}

export interface CreateUserDto {
  email: string;
  name: string;
  clerkUserId: string;
  preferences?: Partial<UserPreferences>;
}

export interface UpdateUserDto {
  name?: string;
  preferences?: Partial<UserPreferences>;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  subscriptionTier: SubscriptionTier;
  preferences: UserPreferences;
  createdAt: Date;
  lastActive: Date;
}
