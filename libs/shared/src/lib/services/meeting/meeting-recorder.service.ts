import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MeetingPlatform,
  MeetingPlatformAdapter,
  MeetingJoinInfo,
  MeetingSession,
  MeetingRecording,
  RecordingConfig,
  MeetingPlatformEvent,
  ConnectionStatus,
} from '../../interfaces/meeting-platform.interface';

@Injectable()
export class MeetingRecorderService {
  private readonly logger = new Logger(MeetingRecorderService.name);
  private platformAdapters = new Map<MeetingPlatform, MeetingPlatformAdapter>();
  private activeSessions = new Map<string, MeetingSession>();
  private activeRecordings = new Map<string, MeetingRecording>();

  constructor(private eventEmitter: EventEmitter2) {}

  // Platform adapter management
  registerPlatformAdapter(adapter: MeetingPlatformAdapter): void {
    this.platformAdapters.set(adapter.platform, adapter);

    // Set up event forwarding from platform adapter
    adapter.onMeetingEvent((event: MeetingPlatformEvent) => {
      this.handlePlatformEvent(event);
    });

    this.logger.log(`Registered platform adapter for ${adapter.platform}`);
  }

  getPlatformAdapter(
    platform: MeetingPlatform,
  ): MeetingPlatformAdapter | undefined {
    return this.platformAdapters.get(platform);
  }

  getSupportedPlatforms(): MeetingPlatform[] {
    return Array.from(this.platformAdapters.keys());
  }

  // Meeting session management
  async joinMeeting(joinInfo: MeetingJoinInfo): Promise<MeetingSession> {
    const adapter = this.getPlatformAdapter(joinInfo.platform);
    if (!adapter) {
      throw new Error(
        `No adapter registered for platform: ${joinInfo.platform}`,
      );
    }

    try {
      this.logger.log(
        `Joining meeting ${joinInfo.meetingId} on ${joinInfo.platform}`,
      );

      const session = await adapter.joinMeeting(joinInfo);
      this.activeSessions.set(session.sessionId, session);

      // Emit meeting joined event
      this.eventEmitter.emit('meeting.joined', {
        sessionId: session.sessionId,
        meetingId: session.meetingId,
        platform: session.platform,
        timestamp: new Date(),
      });

      this.logger.log(
        `Successfully joined meeting ${joinInfo.meetingId}, session: ${session.sessionId}`,
      );
      return session;
    } catch (error) {
      this.logger.error(`Failed to join meeting ${joinInfo.meetingId}:`, error);
      throw error;
    }
  }

  async leaveMeeting(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`No active session found: ${sessionId}`);
    }

    const adapter = this.getPlatformAdapter(session.platform);
    if (!adapter) {
      throw new Error(`No adapter found for platform: ${session.platform}`);
    }

    try {
      this.logger.log(`Leaving meeting session ${sessionId}`);

      await adapter.leaveMeeting(sessionId);
      this.activeSessions.delete(sessionId);

      // Stop any active recordings for this session
      const recording = Array.from(this.activeRecordings.values()).find(
        (r) => r.sessionId === sessionId,
      );
      if (recording) {
        await this.stopRecording(recording.id);
      }

      // Emit meeting left event
      this.eventEmitter.emit('meeting.left', {
        sessionId,
        meetingId: session.meetingId,
        platform: session.platform,
        timestamp: new Date(),
      });

      this.logger.log(`Successfully left meeting session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to leave meeting session ${sessionId}:`, error);
      throw error;
    }
  }

  // Recording management
  async startRecording(
    sessionId: string,
    config: RecordingConfig,
  ): Promise<MeetingRecording> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`No active session found: ${sessionId}`);
    }

    const adapter = this.getPlatformAdapter(session.platform);
    if (!adapter) {
      throw new Error(`No adapter found for platform: ${session.platform}`);
    }

    try {
      this.logger.log(`Starting recording for session ${sessionId}`);

      const recording = await adapter.startRecording(sessionId, config);
      this.activeRecordings.set(recording.id, recording);

      // Emit recording started event
      this.eventEmitter.emit('recording.started', {
        recordingId: recording.id,
        sessionId,
        meetingId: session.meetingId,
        platform: session.platform,
        timestamp: new Date(),
      });

      this.logger.log(
        `Successfully started recording ${recording.id} for session ${sessionId}`,
      );
      return recording;
    } catch (error) {
      this.logger.error(
        `Failed to start recording for session ${sessionId}:`,
        error,
      );
      throw error;
    }
  }

  async stopRecording(recordingId: string): Promise<MeetingRecording> {
    const recording = this.activeRecordings.get(recordingId);
    if (!recording) {
      throw new Error(`No active recording found: ${recordingId}`);
    }

    const adapter = this.getPlatformAdapter(recording.platform);
    if (!adapter) {
      throw new Error(`No adapter found for platform: ${recording.platform}`);
    }

    try {
      this.logger.log(`Stopping recording ${recordingId}`);

      const finalRecording = await adapter.stopRecording(recordingId);
      this.activeRecordings.delete(recordingId);

      // Emit recording stopped event
      this.eventEmitter.emit('recording.stopped', {
        recordingId,
        sessionId: recording.sessionId,
        meetingId: recording.meetingId,
        platform: recording.platform,
        timestamp: new Date(),
        duration: finalRecording.duration,
      });

      this.logger.log(`Successfully stopped recording ${recordingId}`);
      return finalRecording;
    } catch (error) {
      this.logger.error(`Failed to stop recording ${recordingId}:`, error);
      throw error;
    }
  }

  // Audio stream management
  async getAudioStream(sessionId: string): Promise<NodeJS.ReadableStream> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`No active session found: ${sessionId}`);
    }

    const adapter = this.getPlatformAdapter(session.platform);
    if (!adapter) {
      throw new Error(`No adapter found for platform: ${session.platform}`);
    }

    return adapter.getAudioStream(sessionId);
  }

  // Session information
  getActiveSession(sessionId: string): MeetingSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  getActiveSessions(): MeetingSession[] {
    return Array.from(this.activeSessions.values());
  }

  getActiveRecording(recordingId: string): MeetingRecording | undefined {
    return this.activeRecordings.get(recordingId);
  }

  getActiveRecordings(): MeetingRecording[] {
    return Array.from(this.activeRecordings.values());
  }

  // Health monitoring
  async getConnectionStatus(
    platform: MeetingPlatform,
  ): Promise<ConnectionStatus> {
    const adapter = this.getPlatformAdapter(platform);
    if (!adapter) {
      throw new Error(`No adapter found for platform: ${platform}`);
    }

    return adapter.getConnectionStatus();
  }

  async getAllConnectionStatuses(): Promise<
    Map<MeetingPlatform, ConnectionStatus>
  > {
    const statuses = new Map<MeetingPlatform, ConnectionStatus>();

    for (const [platform, adapter] of this.platformAdapters) {
      try {
        const status = await adapter.getConnectionStatus();
        statuses.set(platform, status);
      } catch (error) {
        this.logger.error(
          `Failed to get connection status for ${platform}:`,
          error,
        );
        statuses.set(platform, {
          isConnected: false,
          lastError: {
            code: 'CONNECTION_CHECK_FAILED',
            message: error instanceof Error ? error.message : String(error),
            platform,
            timestamp: new Date(),
          },
          retryCount: 0,
        });
      }
    }

    return statuses;
  }

  // Event handling
  private handlePlatformEvent(event: MeetingPlatformEvent): void {
    this.logger.debug(
      `Received platform event: ${event.type} for session ${event.sessionId}`,
    );

    // Update local state based on event
    switch (event.type) {
      case 'meeting_ended':
        this.activeSessions.delete(event.sessionId);
        break;
      case 'recording_stopped':
        const recording = Array.from(this.activeRecordings.values()).find(
          (r) => r.sessionId === event.sessionId,
        );
        if (recording) {
          this.activeRecordings.delete(recording.id);
        }
        break;
    }

    // Forward event to application event bus
    this.eventEmitter.emit(`platform.${event.type}`, event);
  }

  // Cleanup and shutdown
  async shutdown(): Promise<void> {
    this.logger.log('Shutting down meeting recorder service...');

    // Stop all active recordings
    const recordingPromises = Array.from(this.activeRecordings.keys()).map(
      (recordingId) =>
        this.stopRecording(recordingId).catch((error) =>
          this.logger.error(
            `Failed to stop recording ${recordingId} during shutdown:`,
            error,
          ),
        ),
    );

    // Leave all active meetings
    const sessionPromises = Array.from(this.activeSessions.keys()).map(
      (sessionId) =>
        this.leaveMeeting(sessionId).catch((error) =>
          this.logger.error(
            `Failed to leave session ${sessionId} during shutdown:`,
            error,
          ),
        ),
    );

    await Promise.all([...recordingPromises, ...sessionPromises]);

    this.logger.log('Meeting recorder service shutdown complete');
  }
}
