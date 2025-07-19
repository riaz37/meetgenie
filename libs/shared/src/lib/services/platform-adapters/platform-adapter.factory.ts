import { Injectable, Logger } from '@nestjs/common';
import {
  MeetingPlatform,
  MeetingPlatformAdapter,
  MeetingCredentials
} from '../../interfaces/meeting-platform.interface';
import { ZoomAdapter } from './zoom.adapter';
import { TeamsAdapter } from './teams.adapter';
import { GoogleMeetAdapter } from './google-meet.adapter';
import { WebExAdapter } from './webex.adapter';

@Injectable()
export class PlatformAdapterFactory {
  private readonly logger = new Logger(PlatformAdapterFactory.name);
  private adapters = new Map<MeetingPlatform, MeetingPlatformAdapter>();

  constructor(
    private zoomAdapter: ZoomAdapter,
    private teamsAdapter: TeamsAdapter,
    private googleMeetAdapter: GoogleMeetAdapter,
    private webexAdapter: WebExAdapter
  ) {
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    this.adapters.set(MeetingPlatform.ZOOM, this.zoomAdapter);
    this.adapters.set(MeetingPlatform.TEAMS, this.teamsAdapter);
    this.adapters.set(MeetingPlatform.GOOGLE_MEET, this.googleMeetAdapter);
    this.adapters.set(MeetingPlatform.WEBEX, this.webexAdapter);
    
    this.logger.log(`Initialized ${this.adapters.size} platform adapters`);
  }

  getAdapter(platform: MeetingPlatform): MeetingPlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`No adapter found for platform: ${platform}`);
    }
    return adapter;
  }

  getAllAdapters(): Map<MeetingPlatform, MeetingPlatformAdapter> {
    return new Map(this.adapters);
  }

  getSupportedPlatforms(): MeetingPlatform[] {
    return Array.from(this.adapters.keys());
  }

  async authenticateAdapter(
    platform: MeetingPlatform, 
    credentials: MeetingCredentials
  ): Promise<boolean> {
    const adapter = this.getAdapter(platform);
    
    try {
      this.logger.log(`Authenticating ${platform} adapter...`);
      const result = await adapter.authenticate(credentials);
      
      if (result) {
        this.logger.log(`Successfully authenticated ${platform} adapter`);
      } else {
        this.logger.warn(`Failed to authenticate ${platform} adapter`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error authenticating ${platform} adapter:`, error);
      return false;
    }
  }

  async validateCredentials(
    platform: MeetingPlatform,
    credentials: MeetingCredentials
  ): Promise<boolean> {
    const adapter = this.getAdapter(platform);
    
    try {
      return await adapter.validateCredentials(credentials);
    } catch (error) {
      this.logger.error(`Error validating credentials for ${platform}:`, error);
      return false;
    }
  }

  async getConnectionStatuses(): Promise<Map<MeetingPlatform, any>> {
    const statuses = new Map();
    
    for (const [platform, adapter] of this.adapters) {
      try {
        const status = await adapter.getConnectionStatus();
        statuses.set(platform, status);
      } catch (error) {
        this.logger.error(`Failed to get connection status for ${platform}:`, error);
        statuses.set(platform, {
          isConnected: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return statuses;
  }

  async shutdownAllAdapters(): Promise<void> {
    this.logger.log('Shutting down all platform adapters...');
    
    const shutdownPromises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        if (typeof adapter.cleanup === 'function') {
          await adapter.cleanup();
        }
      } catch (error) {
        this.logger.error(`Error shutting down ${adapter.platform} adapter:`, error);
      }
    });
    
    await Promise.all(shutdownPromises);
    this.logger.log('All platform adapters shut down');
  }
}