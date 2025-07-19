import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  MeetingRecorderService,
  PlatformAdapterFactory,
  MeetingPlatform,
  MeetingJoinInfo,
  MeetingSession,
  MeetingRecording,
  RecordingConfig,
  MeetingParticipant,
  MeetingCredentials,
  ConnectionStatus
} from '@meetgenie/shared';

@Injectable()
export class MeetingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MeetingService.name);

  constructor(
    private readonly meetingRecorder: MeetingRecorderService,
    private readonly platformFactory: PlatformAdapterFactory
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Meeting Service...');
    await this.initializePlatformAdapters();
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Meeting Service...');
    await this.meetingRecorder.shutdown();
    await this.platformFactory.shutdownAllAdapters();
  }

  private async initializePlatformAdapters(): Promise<void> {
    try {
      // Register all platform adapters with the meeting recorder
      const adapters = this.platformFactory.getAllAdapters();
      
      for (const [platform, adapter] of adapters) {
        this.meetingRecorder.registerPlatformAdapter(adapter);
        this.logger.log(`Registered ${platform} adapter`);
      }

      // Initialize platform credentials from environment variables
      await this.authenticatePlatforms();
      
      this.logger.log('Platform adapters initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize platform adapters:', error);
      throw error;
    }
  }

  private async authenticatePlatforms(): Promise<void> {
    const platforms = this.platformFactory.getSupportedPlatforms();
    
    for (const platform of platforms) {
      try {
        const credentials = this.getPlatformCredentials(platform);
        if (credentials) {
          const success = await this.platformFactory.authenticateAdapter(platform, credentials);
          if (success) {
            this.logger.log(`Successfully authenticated ${platform}`);
          } else {
            this.logger.warn(`Failed to authenticate ${platform}`);
          }
        } else {
          this.logger.warn(`No credentials found for ${platform}`);
        }
      } catch (error) {
        this.logger.error(`Error authenticating ${platform}:`, error);
      }
    }
  }

  private getPlatformCredentials(platform: MeetingPlatform): MeetingCredentials | null {
    // Get credentials from environment variables based on platform
    switch (platform) {
      case MeetingPlatform.ZOOM:
        return {
          platform: MeetingPlatform.ZOOM,
          apiKey: process.env.ZOOM_API_KEY,
          apiSecret: process.env.ZOOM_API_SECRET
        };
      
      case MeetingPlatform.TEAMS:
        return {
          platform: MeetingPlatform.TEAMS,
          clientId: process.env.TEAMS_CLIENT_ID,
          clientSecret: process.env.TEAMS_CLIENT_SECRET
        };
      
      case MeetingPlatform.GOOGLE_MEET:
        return {
          platform: MeetingPlatform.GOOGLE_MEET,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET
        };
      
      case MeetingPlatform.WEBEX:
        return {
          platform: MeetingPlatform.WEBEX,
          accessToken: process.env.WEBEX_ACCESS_TOKEN,
          clientId: process.env.WEBEX_CLIENT_ID,
          clientSecret: process.env.WEBEX_CLIENT_SECRET
        };
      
      default:
        return null;
    }
  }

  // Meeting session management
  async joinMeeting(joinInfo: MeetingJoinInfo): Promise<MeetingSession> {
    try {
      this.logger.log(`Joining meeting ${joinInfo.meetingId} on ${joinInfo.platform}`);
      return await this.meetingRecorder.joinMeeting(joinInfo);
    } catch (error) {
      this.logger.error(`Failed to join meeting ${joinInfo.meetingId}:`, error);
      throw error;
    }
  }

  async leaveMeeting(sessionId: string): Promise<void> {
    try {
      this.logger.log(`Leaving meeting session ${sessionId}`);
      await this.meetingRecorder.leaveMeeting(sessionId);
    } catch (error) {
      this.logger.error(`Failed to leave meeting session ${sessionId}:`, error);
      throw error;
    }
  }

  async getMeetingInfo(meetingId: string, platform: MeetingPlatform): Promise<MeetingJoinInfo> {
    try {
      const adapter = this.platformFactory.getAdapter(platform);
      return await adapter.getMeetingInfo(meetingId);
    } catch (error) {
      this.logger.error(`Failed to get meeting info for ${meetingId}:`, error);
      throw error;
    }
  }

  // Recording management
  async startRecording(sessionId: string, config: RecordingConfig): Promise<MeetingRecording> {
    try {
      this.logger.log(`Starting recording for session ${sessionId}`);
      return await this.meetingRecorder.startRecording(sessionId, config);
    } catch (error) {
      this.logger.error(`Failed to start recording for session ${sessionId}:`, error);
      throw error;
    }
  }

  async stopRecording(recordingId: string): Promise<MeetingRecording> {
    try {
      this.logger.log(`Stopping recording ${recordingId}`);
      return await this.meetingRecorder.stopRecording(recordingId);
    } catch (error) {
      this.logger.error(`Failed to stop recording ${recordingId}:`, error);
      throw error;
    }
  }

  async getRecording(recordingId: string): Promise<MeetingRecording> {
    try {
      const recording = this.meetingRecorder.getActiveRecording(recordingId);
      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }
      return recording;
    } catch (error) {
      this.logger.error(`Failed to get recording ${recordingId}:`, error);
      throw error;
    }
  }

  // Participant management
  async getParticipants(sessionId: string): Promise<MeetingParticipant[]> {
    try {
      const session = this.meetingRecorder.getActiveSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const adapter = this.platformFactory.getAdapter(session.platform);
      return await adapter.getParticipants(sessionId);
    } catch (error) {
      this.logger.error(`Failed to get participants for session ${sessionId}:`, error);
      throw error;
    }
  }

  // Audio stream management
  async getAudioStream(sessionId: string): Promise<NodeJS.ReadableStream> {
    try {
      return await this.meetingRecorder.getAudioStream(sessionId);
    } catch (error) {
      this.logger.error(`Failed to get audio stream for session ${sessionId}:`, error);
      throw error;
    }
  }

  // Status and monitoring
  getActiveSessions(): MeetingSession[] {
    return this.meetingRecorder.getActiveSessions();
  }

  getActiveRecordings(): MeetingRecording[] {
    return this.meetingRecorder.getActiveRecordings();
  }

  getSupportedPlatforms(): MeetingPlatform[] {
    return this.platformFactory.getSupportedPlatforms();
  }

  async getPlatformStatuses(): Promise<Map<MeetingPlatform, ConnectionStatus>> {
    try {
      return await this.platformFactory.getConnectionStatuses();
    } catch (error) {
      this.logger.error('Failed to get platform statuses:', error);
      throw error;
    }
  }

  // Health check
  async getHealthStatus(): Promise<{
    status: string;
    platforms: Record<string, any>;
    activeSessions: number;
    activeRecordings: number;
  }> {
    try {
      const platformStatuses = await this.getPlatformStatuses();
      const activeSessions = this.getActiveSessions();
      const activeRecordings = this.getActiveRecordings();

      const platforms: Record<string, any> = {};
      for (const [platform, status] of platformStatuses) {
        platforms[platform] = {
          connected: status.isConnected,
          lastConnected: status.lastConnected,
          error: status.lastError?.message
        };
      }

      return {
        status: 'healthy',
        platforms,
        activeSessions: activeSessions.length,
        activeRecordings: activeRecordings.length
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        platforms: {},
        activeSessions: 0,
        activeRecordings: 0
      };
    }
  }
}