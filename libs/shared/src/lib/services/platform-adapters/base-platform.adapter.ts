import { Logger } from '@nestjs/common';
import {
  MeetingPlatform,
  MeetingPlatformAdapter,
  MeetingCredentials,
  MeetingJoinInfo,
  MeetingSession,
  MeetingRecording,
  RecordingConfig,
  MeetingParticipant,
  MeetingPlatformEvent,
  ConnectionStatus,
  MeetingStatus,
  PlatformError
} from '../../interfaces/meeting-platform.interface';

export abstract class BasePlatformAdapter implements MeetingPlatformAdapter {
  protected readonly logger: Logger;
  protected credentials?: MeetingCredentials;
  protected isAuthenticated = false;
  protected connectionStatus: ConnectionStatus = {
    isConnected: false,
    retryCount: 0
  };
  protected eventCallbacks: Array<(event: MeetingPlatformEvent) => void> = [];

  constructor(
    public readonly platform: MeetingPlatform
  ) {
    this.logger = new Logger(`${platform.toUpperCase()}Adapter`);
  }

  // Abstract methods that must be implemented by platform-specific adapters
  abstract authenticate(credentials: MeetingCredentials): Promise<boolean>;
  abstract validateCredentials(credentials: MeetingCredentials): Promise<boolean>;
  abstract joinMeeting(joinInfo: MeetingJoinInfo): Promise<MeetingSession>;
  abstract leaveMeeting(sessionId: string): Promise<void>;
  abstract getMeetingInfo(meetingId: string): Promise<MeetingJoinInfo>;
  abstract startRecording(sessionId: string, config: RecordingConfig): Promise<MeetingRecording>;
  abstract stopRecording(recordingId: string): Promise<MeetingRecording>;
  abstract getRecording(recordingId: string): Promise<MeetingRecording>;
  abstract getAudioStream(sessionId: string): Promise<NodeJS.ReadableStream>;
  abstract getParticipants(sessionId: string): Promise<MeetingParticipant[]>;

  // Common implementation for event handling
  onMeetingEvent(callback: (event: MeetingPlatformEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  protected emitEvent(event: Omit<MeetingPlatformEvent, 'platform' | 'timestamp'>): void {
    const fullEvent: MeetingPlatformEvent = {
      ...event,
      platform: this.platform,
      timestamp: new Date()
    };

    this.eventCallbacks.forEach(callback => {
      try {
        callback(fullEvent);
      } catch (error) {
        this.logger.error('Error in event callback:', error);
      }
    });
  }

  // Common connection status management
  isConnected(): boolean {
    return this.connectionStatus.isConnected;
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    return { ...this.connectionStatus };
  }

  protected updateConnectionStatus(status: Partial<ConnectionStatus>): void {
    this.connectionStatus = {
      ...this.connectionStatus,
      ...status,
      lastConnected: status.isConnected ? new Date() : this.connectionStatus.lastConnected
    };
  }

  protected handleError(error: any, context: string): PlatformError {
    const platformError: PlatformError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      platform: this.platform,
      details: error,
      timestamp: new Date()
    };

    this.logger.error(`${context}: ${platformError.message}`, error);
    
    this.updateConnectionStatus({
      lastError: platformError,
      retryCount: this.connectionStatus.retryCount + 1
    });

    return platformError;
  }

  // Retry logic with exponential backoff
  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        this.logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Unknown error occurred');
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Common validation helpers
  protected validateSessionId(sessionId: string): void {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Invalid session ID');
    }
  }

  protected validateMeetingId(meetingId: string): void {
    if (!meetingId || typeof meetingId !== 'string') {
      throw new Error('Invalid meeting ID');
    }
  }

  protected validateRecordingId(recordingId: string): void {
    if (!recordingId || typeof recordingId !== 'string') {
      throw new Error('Invalid recording ID');
    }
  }

  // Common session management
  protected generateSessionId(): string {
    return `${this.platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected generateRecordingId(): string {
    return `rec_${this.platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    this.logger.log(`Cleaning up ${this.platform} adapter...`);
    this.eventCallbacks = [];
    this.isAuthenticated = false;
    this.updateConnectionStatus({ isConnected: false });
  }
}