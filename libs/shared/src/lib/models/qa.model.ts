import { IsString, IsOptional, IsDate, IsNumber, IsUUID, IsArray, Min, Max } from 'class-validator';

export interface SourceReference {
  type: 'transcript' | 'summary' | 'action_item' | 'decision';
  id: string;
  timestamp?: number; // milliseconds from meeting start
  speaker?: string;
  text: string;
  confidence: number;
}

export interface SearchResult {
  meetingId: string;
  meetingTitle: string;
  relevanceScore: number;
  matchedContent: string;
  timestamp?: number;
  speaker?: string;
}

export class QAInteraction {
  @IsUUID()
  id!: string;

  @IsUUID()
  meetingId!: string;

  @IsUUID()
  userId!: string;

  @IsString()
  question!: string;

  @IsString()
  answer!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @IsArray()
  sources!: SourceReference[];

  @IsOptional()
  @IsArray()
  relatedMeetings?: string[];

  @IsDate()
  createdAt!: Date;

  constructor(partial: Partial<QAInteraction>) {
    Object.assign(this, partial);
  }
}

export interface CreateQAInteractionDto {
  meetingId: string;
  userId: string;
  question: string;
  answer: string;
  confidence: number;
  sources: SourceReference[];
  relatedMeetings?: string[];
}

export interface QAResponse {
  answer: string;
  confidence: number;
  sources: SourceReference[];
  relatedMeetings?: string[];
  processingTime?: number; // milliseconds
}

export interface QAQuery {
  question: string;
  meetingId?: string; // if specified, search only in this meeting
  userId: string;
  includeRelatedMeetings?: boolean;
  maxResults?: number;
}

export interface QAHistoryFilters {
  meetingId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  minConfidence?: number;
  search?: string;
}

export interface QAHistoryResponse {
  interactions: QAInteraction[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchQuery {
  query: string;
  userId: string;
  filters?: {
    meetingIds?: string[];
    startDate?: Date;
    endDate?: Date;
    participants?: string[];
    platforms?: string[];
  };
  maxResults?: number;
  includeTranscripts?: boolean;
  includeSummaries?: boolean;
  includeActionItems?: boolean;
  includeDecisions?: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  processingTime: number; // milliseconds
  query: string;
}