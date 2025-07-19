import { IsString, IsOptional, IsEnum, IsDate, IsNumber, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MeetingPlatform, MeetingStatus, ParticipantRole } from '../interfaces/meeting-platform.interface';

export class MeetingParticipant {
  @IsUUID()
  id!: string;

  @IsUUID()
  meetingId!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsEnum(ParticipantRole)
  role!: ParticipantRole;

  @IsOptional()
  @IsDate()
  joinTime?: Date;

  @IsOptional()
  @IsDate()
  leaveTime?: Date;

  @IsNumber()
  speakingTime!: number; // in seconds

  @IsDate()
  createdAt!: Date;

  constructor(partial: Partial<MeetingParticipant>) {
    Object.assign(this, partial);
  }
}

export class Meeting {
  @IsUUID()
  id!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDate()
  scheduledTime!: Date;

  @IsOptional()
  @IsDate()
  actualStartTime?: Date;

  @IsOptional()
  @IsDate()
  actualEndTime?: Date;

  @IsNumber()
  duration!: number; // in seconds

  @IsEnum(MeetingPlatform)
  platform!: MeetingPlatform;

  @IsString()
  platformMeetingId!: string;

  @IsUUID()
  organizerId!: string;

  @IsEnum(MeetingStatus)
  status!: MeetingStatus;

  @IsOptional()
  @IsString()
  recordingUrl?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeetingParticipant)
  participants!: MeetingParticipant[];

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  constructor(partial: Partial<Meeting>) {
    Object.assign(this, partial);
  }
}

export interface CreateMeetingDto {
  title: string;
  description?: string;
  scheduledTime: Date;
  platform: MeetingPlatform;
  platformMeetingId: string;
  organizerId: string;
  participants?: CreateParticipantDto[];
}

export interface CreateParticipantDto {
  userId?: string;
  name: string;
  email?: string;
  role: ParticipantRole;
}

export interface UpdateMeetingDto {
  title?: string;
  description?: string;
  scheduledTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  duration?: number;
  status?: MeetingStatus;
  recordingUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface MeetingFilters {
  organizerId?: string;
  status?: MeetingStatus;
  platform?: MeetingPlatform;
  startDate?: Date;
  endDate?: Date;
  participantId?: string;
  search?: string;
}

export interface MeetingResponse {
  id: string;
  title: string;
  description?: string;
  scheduledTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  duration: number;
  platform: MeetingPlatform;
  status: MeetingStatus;
  recordingUrl?: string;
  participants: MeetingParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingSession {
  meetingId: string;
  sessionId: string;
  recordingUrl?: string;
  transcriptStream?: WebSocket;
  status: MeetingStatus;
}

export interface MeetingSchedule {
  title: string;
  description?: string;
  scheduledTime: Date;
  platform: MeetingPlatform;
  platformMeetingId: string;
  participants: CreateParticipantDto[];
}