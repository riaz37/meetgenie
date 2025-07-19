import { IsString, IsOptional, IsEnum, IsDate, IsNumber, IsUUID, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum ActionItemStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum ImportanceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum ImpactLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum SummaryType {
  STANDARD = 'standard',
  DETAILED = 'detailed',
  BRIEF = 'brief',
  CUSTOM = 'custom'
}

export class ActionItem {
  @IsUUID()
  id!: string;

  @IsUUID()
  summaryId!: string;

  @IsUUID()
  meetingId!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @IsDate()
  dueDate?: Date;

  @IsEnum(Priority)
  priority!: Priority;

  @IsEnum(ActionItemStatus)
  status!: ActionItemStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  timestampMs?: number; // milliseconds from meeting start

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  constructor(partial: Partial<ActionItem>) {
    Object.assign(this, partial);
  }
}

export class Decision {
  @IsUUID()
  id!: string;

  @IsUUID()
  summaryId!: string;

  @IsUUID()
  meetingId!: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  decisionMaker?: string;

  @IsOptional()
  @IsUUID()
  decisionMakerUserId?: string;

  @IsEnum(ImpactLevel)
  impactLevel!: ImpactLevel;

  @IsOptional()
  @IsNumber()
  @Min(0)
  timestampMs?: number; // milliseconds from meeting start

  @IsDate()
  createdAt!: Date;

  constructor(partial: Partial<Decision>) {
    Object.assign(this, partial);
  }
}

export interface DiscussionPoint {
  topic: string;
  description: string;
  participants: string[];
  timestamp: number; // milliseconds from meeting start
  importance: ImportanceLevel;
}

export interface ParticipantInsight {
  participantId: string;
  name: string;
  speakingTime: number; // in seconds
  contributionLevel: ImportanceLevel;
  keyContributions: string[];
}

export interface SummaryContent {
  keyPoints: DiscussionPoint[];
  actionItems: ActionItem[];
  decisions: Decision[];
  participantInsights: ParticipantInsight[];
}

export class Summary {
  @IsUUID()
  id!: string;

  @IsUUID()
  meetingId!: string;

  @IsNumber()
  @Min(1)
  version!: number;

  content!: SummaryContent;

  @IsEnum(SummaryType)
  summaryType!: SummaryType;

  @IsDate()
  generatedAt!: Date;

  @IsDate()
  createdAt!: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionItem)
  actionItems!: ActionItem[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Decision)
  decisions!: Decision[];

  constructor(partial: Partial<Summary>) {
    Object.assign(this, partial);
  }
}

export interface CreateSummaryDto {
  meetingId: string;
  content: SummaryContent;
  summaryType?: SummaryType;
}

export interface UpdateSummaryDto {
  content?: Partial<SummaryContent>;
  summaryType?: SummaryType;
}

export interface CreateActionItemDto {
  summaryId: string;
  meetingId: string;
  description: string;
  assignee?: string;
  assigneeUserId?: string;
  dueDate?: Date;
  priority?: Priority;
  timestampMs?: number;
}

export interface UpdateActionItemDto {
  description?: string;
  assignee?: string;
  assigneeUserId?: string;
  dueDate?: Date;
  priority?: Priority;
  status?: ActionItemStatus;
}

export interface CreateDecisionDto {
  summaryId: string;
  meetingId: string;
  title: string;
  description: string;
  decisionMaker?: string;
  decisionMakerUserId?: string;
  impactLevel?: ImpactLevel;
  timestampMs?: number;
}

export interface MeetingSummary {
  meetingId: string;
  keyPoints: DiscussionPoint[];
  actionItems: ActionItem[];
  decisions: Decision[];
  participants: ParticipantInsight[];
  generatedAt: Date;
}

export interface SummaryResponse {
  id: string;
  meetingId: string;
  version: number;
  content: SummaryContent;
  summaryType: SummaryType;
  generatedAt: Date;
  createdAt: Date;
}