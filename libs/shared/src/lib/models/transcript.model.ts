import { IsString, IsOptional, IsEnum, IsDate, IsNumber, IsUUID, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export class Speaker {
  @IsUUID()
  id!: string;

  @IsUUID()
  meetingId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  voiceProfile!: string; // voice fingerprint/characteristics

  @IsOptional()
  @IsUUID()
  participantId?: string;

  @IsDate()
  createdAt!: Date;

  constructor(partial: Partial<Speaker>) {
    Object.assign(this, partial);
  }
}

export class TranscriptSegment {
  @IsUUID()
  id!: string;

  @IsUUID()
  transcriptId!: string;

  @IsOptional()
  @IsUUID()
  speakerId?: string;

  @IsString()
  text!: string;

  @IsNumber()
  @Min(0)
  startTime!: number; // milliseconds from meeting start

  @IsNumber()
  @Min(0)
  endTime!: number; // milliseconds from meeting start

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @IsNumber()
  @Min(0)
  wordCount!: number;

  @IsDate()
  createdAt!: Date;

  constructor(partial: Partial<TranscriptSegment>) {
    Object.assign(this, partial);
  }
}

export class Transcript {
  @IsUUID()
  id!: string;

  @IsUUID()
  meetingId!: string;

  @IsString()
  language!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @IsEnum(ProcessingStatus)
  processingStatus!: ProcessingStatus;

  @IsNumber()
  @Min(0)
  wordCount!: number;

  @IsNumber()
  @Min(0)
  duration!: number; // in seconds

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptSegment)
  segments!: TranscriptSegment[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Speaker)
  speakers!: Speaker[];

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  constructor(partial: Partial<Transcript>) {
    Object.assign(this, partial);
  }
}

export interface CreateTranscriptDto {
  meetingId: string;
  language?: string;
}

export interface CreateTranscriptSegmentDto {
  transcriptId: string;
  speakerId?: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface CreateSpeakerDto {
  meetingId: string;
  name?: string;
  voiceProfile: string;
  participantId?: string;
}

export interface UpdateTranscriptDto {
  language?: string;
  confidence?: number;
  processingStatus?: ProcessingStatus;
  wordCount?: number;
  duration?: number;
}

export interface TranscriptResponse {
  id: string;
  meetingId: string;
  language: string;
  confidence: number;
  processingStatus: ProcessingStatus;
  wordCount: number;
  duration: number;
  segments: TranscriptSegment[];
  speakers: Speaker[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FullTranscript {
  meetingId: string;
  segments: TranscriptSegment[];
  speakers: Speaker[];
  duration: number;
  language: string;
  confidence: number;
}

export interface TranscriptionSession {
  sessionId: string;
  meetingId: string;
  transcriptId: string;
  status: ProcessingStatus;
  language: string;
}

export interface AudioStream {
  meetingId: string;
  format: string;
  sampleRate: number;
  channels: number;
}

export interface SpeakerIdentification {
  speakerId: string;
  confidence: number;
  voiceProfile: string;
}