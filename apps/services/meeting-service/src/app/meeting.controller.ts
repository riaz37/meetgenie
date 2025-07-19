import { Controller, Post, Get, Delete, Body, Param, Query, Logger } from '@nestjs/common';
import { MeetingService } from './meeting.service';
import {
  MeetingPlatform,
  MeetingJoinInfo,
  MeetingSession,
  MeetingRecording,
  RecordingConfig,
  MeetingParticipant
} from '@meetgenie/shared';

@Controller('meetings')
export class MeetingController {
  private readonly logger = new Logger(MeetingController.name);

  constructor(private readonly meetingService: MeetingService) {}

  @Post('join')
  async joinMeeting(@Body() joinInfo: MeetingJoinInfo): Promise<MeetingSession> {
    this.logger.log(`Joining meeting: ${joinInfo.meetingId} on ${joinInfo.platform}`);
    return this.meetingService.joinMeeting(joinInfo);
  }

  @Delete('sessions/:sessionId')
  async leaveMeeting(@Param('sessionId') sessionId: string): Promise<void> {
    this.logger.log(`Leaving meeting session: ${sessionId}`);
    return this.meetingService.leaveMeeting(sessionId);
  }

  @Get('info/:meetingId')
  async getMeetingInfo(
    @Param('meetingId') meetingId: string,
    @Query('platform') platform: MeetingPlatform
  ): Promise<MeetingJoinInfo> {
    this.logger.log(`Getting meeting info: ${meetingId} on ${platform}`);
    return this.meetingService.getMeetingInfo(meetingId, platform);
  }

  @Post('sessions/:sessionId/recording')
  async startRecording(
    @Param('sessionId') sessionId: string,
    @Body() config: RecordingConfig
  ): Promise<MeetingRecording> {
    this.logger.log(`Starting recording for session: ${sessionId}`);
    return this.meetingService.startRecording(sessionId, config);
  }

  @Delete('recordings/:recordingId')
  async stopRecording(@Param('recordingId') recordingId: string): Promise<MeetingRecording> {
    this.logger.log(`Stopping recording: ${recordingId}`);
    return this.meetingService.stopRecording(recordingId);
  }

  @Get('recordings/:recordingId')
  async getRecording(@Param('recordingId') recordingId: string): Promise<MeetingRecording> {
    return this.meetingService.getRecording(recordingId);
  }

  @Get('sessions/:sessionId/participants')
  async getParticipants(@Param('sessionId') sessionId: string): Promise<MeetingParticipant[]> {
    return this.meetingService.getParticipants(sessionId);
  }

  @Get('sessions')
  async getActiveSessions(): Promise<MeetingSession[]> {
    return this.meetingService.getActiveSessions();
  }

  @Get('recordings')
  async getActiveRecordings(): Promise<MeetingRecording[]> {
    return this.meetingService.getActiveRecordings();
  }

  @Get('platforms/status')
  async getPlatformStatuses(): Promise<any> {
    return this.meetingService.getPlatformStatuses();
  }

  @Get('platforms/supported')
  async getSupportedPlatforms(): Promise<MeetingPlatform[]> {
    return this.meetingService.getSupportedPlatforms();
  }

  @Get('health')
  async getHealth(): Promise<any> {
    return this.meetingService.getHealthStatus();
  }
}