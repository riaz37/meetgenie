export enum MeetingPlatform {
  ZOOM = 'zoom',
  TEAMS = 'teams',
  GOOGLE_MEET = 'google_meet',
  WEBEX = 'webex'
}

export enum MeetingStatus {
  SCHEDULED = 'scheduled',
  STARTING = 'starting',
  IN_PROGRESS = 'in_progress',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}

export enum ParticipantRole {
  HOST = 'host',
  CO_HOST = 'co_host',
  PARTICIPANT = 'participant',
  ATTENDEE = 'attendee'
}

export interface MeetingCredentials {
  platform: MeetingPlatform;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  botEmail?: string;
  botPassword?: string;
}

export interface MeetingJoinInfo {
  meetingId: string;
  meetingUrl: string;
  password?: string;
  platform: MeetingPlatform;
  scheduledTime: Date;
  hostEmail?: string;
}

export interface MeetingSession {
  sessionId: string;
  meetingId: string;
  platform: MeetingPlatform;
  status: MeetingStatus;
  startTime?: Date;
  endTime?: Date;
  recordingUrl?: string;
  audioStreamUrl?: string;
  participants: MeetingParticipant[];
}

export interface MeetingParticipant {
  id: string;
  name: string;
  email?: string;
  role: ParticipantRole;
  joinTime?: Date;
  leaveTime?: Date;
  isRecording?: boolean;
  isMuted?: boolean;
  isVideoOn?: boolean;
}

export interface RecordingConfig {
  audioOnly: boolean;
  videoQuality?: 'low' | 'medium' | 'high';
  autoStart: boolean;
  autoStop: boolean;
  cloudStorage: boolean;
  localStorage: boolean;
}

export interface MeetingRecording {
  id: string;
  meetingId: string;
  sessionId: string;
  platform: MeetingPlatform;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  audioUrl?: string;
  videoUrl?: string;
  size?: number;
  status: 'recording' | 'processing' | 'completed' | 'failed';
}

export interface PlatformError {
  code: string;
  message: string;
  platform: MeetingPlatform;
  details?: unknown;
  timestamp: Date;
}

// Base interface for all meeting platform integrations
export interface MeetingPlatformAdapter {
  platform: MeetingPlatform;
  
  // Authentication and setup
  authenticate(credentials: MeetingCredentials): Promise<boolean>;
  validateCredentials(credentials: MeetingCredentials): Promise<boolean>;
  
  // Meeting management
  joinMeeting(joinInfo: MeetingJoinInfo): Promise<MeetingSession>;
  leaveMeeting(sessionId: string): Promise<void>;
  getMeetingInfo(meetingId: string): Promise<MeetingJoinInfo>;
  
  // Recording management
  startRecording(sessionId: string, config: RecordingConfig): Promise<MeetingRecording>;
  stopRecording(recordingId: string): Promise<MeetingRecording>;
  getRecording(recordingId: string): Promise<MeetingRecording>;
  
  // Real-time data
  getAudioStream(sessionId: string): Promise<NodeJS.ReadableStream>;
  getParticipants(sessionId: string): Promise<MeetingParticipant[]>;
  
  // Event handling
  onMeetingEvent(callback: (event: MeetingPlatformEvent) => void): void;
  
  // Health and status
  isConnected(): boolean;
  getConnectionStatus(): Promise<ConnectionStatus>;
  
  // Cleanup
  cleanup?(): Promise<void>;
}

export interface MeetingPlatformEvent {
  type: MeetingEventType;
  sessionId: string;
  meetingId: string;
  platform: MeetingPlatform;
  timestamp: Date;
  data: unknown;
}

export enum MeetingEventType {
  MEETING_STARTED = 'meeting_started',
  MEETING_ENDED = 'meeting_ended',
  PARTICIPANT_JOINED = 'participant_joined',
  PARTICIPANT_LEFT = 'participant_left',
  RECORDING_STARTED = 'recording_started',
  RECORDING_STOPPED = 'recording_stopped',
  AUDIO_STREAM_STARTED = 'audio_stream_started',
  AUDIO_STREAM_ENDED = 'audio_stream_ended',
  CONNECTION_LOST = 'connection_lost',
  CONNECTION_RESTORED = 'connection_restored',
  ERROR = 'error'
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastConnected?: Date;
  lastError?: PlatformError;
  retryCount: number;
  nextRetryAt?: Date;
}