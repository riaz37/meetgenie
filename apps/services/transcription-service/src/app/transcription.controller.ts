import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  HttpException,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import {
  TranscriptionServiceImpl,
  TranscriptionConfig,
  HuggingFaceModelStatus,
  TranscriptionQualityMetrics,
  SpeakerDiarizationResult,
  RealTimeTranscriptionIntegrationService,
  RealTimeTranscriptionConfig,
  RealTimeTranscriptionSession as TranscriptionSession,
  TranscriptionSegment as TranscriptSegment,
  TranscriptionFullTranscript as FullTranscript,
} from '@meetgenie/shared';
import { Readable } from 'stream';

@Controller('transcription')
export class TranscriptionController {
  private readonly logger = new Logger(TranscriptionController.name);

  constructor(
    private transcriptionService: TranscriptionServiceImpl,
    private realTimeTranscriptionService: RealTimeTranscriptionIntegrationService,
  ) {}

  @Post('sessions')
  async startTranscription(
    @Body() body: { config?: Partial<TranscriptionConfig>; meetingId?: string },
  ): Promise<TranscriptionSession> {
    try {
      this.logger.log('Starting new transcription session');

      // Create a dummy audio stream for now - in real implementation, this would come from meeting recorder
      const audioStream = new Readable({
        read() {
          // This would be replaced with actual audio data from meeting platforms
          this.push(null); // End stream for now
        },
      });

      const config: TranscriptionConfig = {
        modelName: 'facebook/wav2vec2-large-960h-lv60-self',
        language: 'en',
        enableSpeakerDiarization: true,
        chunkSize: 1024 * 16,
        overlapSize: 1024 * 2,
        confidenceThreshold: 0.7,
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        ...body.config,
      };

      const session = await this.transcriptionService.startTranscription(
        audioStream,
        config,
      );

      if (body.meetingId) {
        session.meetingId = body.meetingId;
      }

      return session;
    } catch (error) {
      this.logger.error('Failed to start transcription session:', error);
      throw new HttpException(
        'Failed to start transcription session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sessions/:sessionId/audio')
  @UseInterceptors(FileInterceptor('audio'))
  async processAudioChunk(
    @Param('sessionId') sessionId: string,
    @UploadedFile() audioFile: Express.Multer.File,
  ): Promise<TranscriptSegment> {
    try {
      if (!audioFile) {
        throw new HttpException(
          'No audio file provided',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.debug(`Processing audio chunk for session: ${sessionId}`);

      const segment = await this.transcriptionService.processAudioChunk(
        sessionId,
        audioFile.buffer,
      );

      return segment;
    } catch (error) {
      this.logger.error(
        `Failed to process audio chunk for session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Failed to process audio chunk',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sessions/:sessionId/audio/raw')
  async processRawAudioChunk(
    @Param('sessionId') sessionId: string,
    @Body() body: { audioData: string }, // Base64 encoded audio data
  ): Promise<TranscriptSegment> {
    try {
      if (!body.audioData) {
        throw new HttpException(
          'No audio data provided',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.debug(`Processing raw audio chunk for session: ${sessionId}`);

      const audioBuffer = Buffer.from(body.audioData, 'base64');
      const segment = await this.transcriptionService.processAudioChunk(
        sessionId,
        audioBuffer,
      );

      return segment;
    } catch (error) {
      this.logger.error(
        `Failed to process raw audio chunk for session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Failed to process audio chunk',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sessions/:sessionId')
  async getTranscriptionSession(
    @Param('sessionId') sessionId: string,
  ): Promise<TranscriptionSession> {
    try {
      return await this.transcriptionService.getTranscriptionSession(sessionId);
    } catch (error) {
      this.logger.error(
        `Failed to get transcription session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Transcription session not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Put('sessions/:sessionId/pause')
  async pauseTranscription(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.transcriptionService.pauseTranscription(sessionId);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to pause transcription session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Failed to pause transcription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('sessions/:sessionId/resume')
  async resumeTranscription(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.transcriptionService.resumeTranscription(sessionId);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to resume transcription session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Failed to resume transcription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('sessions/:sessionId')
  async cancelTranscription(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.transcriptionService.cancelTranscription(sessionId);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to cancel transcription session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Failed to cancel transcription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sessions/:sessionId/finalize')
  async finalizeTranscript(
    @Param('sessionId') sessionId: string,
  ): Promise<FullTranscript> {
    try {
      this.logger.log(`Finalizing transcript for session: ${sessionId}`);
      return await this.transcriptionService.finalizeTranscript(sessionId);
    } catch (error) {
      this.logger.error(
        `Failed to finalize transcript for session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Failed to finalize transcript',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('sessions/:sessionId/model')
  async switchModel(
    @Param('sessionId') sessionId: string,
    @Body() body: { modelName: string },
  ): Promise<{ success: boolean }> {
    try {
      if (!body.modelName) {
        throw new HttpException(
          'Model name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.transcriptionService.switchModel(sessionId, body.modelName);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to switch model for session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Failed to switch model',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('models')
  async getModelStatus(
    @Query('modelName') modelName?: string,
  ): Promise<HuggingFaceModelStatus[]> {
    try {
      return await this.transcriptionService.getModelStatus(modelName);
    } catch (error) {
      this.logger.error('Failed to get model status:', error);
      throw new HttpException(
        'Failed to get model status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sessions/:sessionId/metrics')
  async getQualityMetrics(
    @Param('sessionId') sessionId: string,
  ): Promise<TranscriptionQualityMetrics> {
    try {
      return await this.transcriptionService.getQualityMetrics(sessionId);
    } catch (error) {
      this.logger.error(
        `Failed to get quality metrics for session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Failed to get quality metrics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('diarization')
  @UseInterceptors(FileInterceptor('audio'))
  async performSpeakerDiarization(
    @UploadedFile() audioFile: Express.Multer.File,
    @Body()
    body: {
      minSpeakers?: number;
      maxSpeakers?: number;
      minSegmentLength?: number;
      similarityThreshold?: number;
    },
  ): Promise<SpeakerDiarizationResult> {
    try {
      if (!audioFile) {
        throw new HttpException(
          'No audio file provided',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.debug('Performing speaker diarization');

      return await this.transcriptionService.identifySpeakers(audioFile.buffer);
    } catch (error) {
      this.logger.error('Failed to perform speaker diarization:', error);
      throw new HttpException(
        'Failed to perform speaker diarization',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('diarization/raw')
  async performSpeakerDiarizationRaw(
    @Body()
    body: {
      audioData: string; // Base64 encoded
      minSpeakers?: number;
      maxSpeakers?: number;
      minSegmentLength?: number;
      similarityThreshold?: number;
    },
  ): Promise<SpeakerDiarizationResult> {
    try {
      if (!body.audioData) {
        throw new HttpException(
          'No audio data provided',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.debug('Performing speaker diarization on raw audio');

      const audioBuffer = Buffer.from(body.audioData, 'base64');
      return await this.transcriptionService.identifySpeakers(audioBuffer);
    } catch (error) {
      this.logger.error(
        'Failed to perform speaker diarization on raw audio:',
        error,
      );
      throw new HttpException(
        'Failed to perform speaker diarization',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Real-time transcription endpoints
  @Post('realtime/sessions')
  async startRealTimeTranscription(
    @Body()
    body: {
      config: RealTimeTranscriptionConfig;
      audioSource: 'microphone' | 'websocket' | 'buffer';
      sourceData?: unknown;
    },
  ) {
    try {
      this.logger.log('Starting real-time transcription session');

      const session =
        await this.realTimeTranscriptionService.startRealTimeTranscription(
          body.config,
          body.audioSource,
          body.sourceData,
        );

      return session;
    } catch (error) {
      this.logger.error(
        'Failed to start real-time transcription session:',
        error,
      );
      throw new HttpException(
        'Failed to start real-time transcription session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('realtime/sessions/:sessionId/pause')
  async pauseRealTimeTranscription(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.realTimeTranscriptionService.pauseRealTimeTranscription(
        sessionId,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to pause real-time transcription session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Failed to pause real-time transcription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('realtime/sessions/:sessionId/resume')
  async resumeRealTimeTranscription(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.realTimeTranscriptionService.resumeRealTimeTranscription(
        sessionId,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to resume real-time transcription session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Failed to resume real-time transcription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('realtime/sessions/:sessionId/finalize')
  async finalizeRealTimeTranscription(
    @Param('sessionId') sessionId: string,
  ): Promise<FullTranscript> {
    try {
      this.logger.log(
        `Finalizing real-time transcription session: ${sessionId}`,
      );
      return await this.realTimeTranscriptionService.finalizeRealTimeTranscription(
        sessionId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to finalize real-time transcription session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Failed to finalize real-time transcription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('realtime/sessions/:sessionId')
  async cancelRealTimeTranscription(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.realTimeTranscriptionService.cancelRealTimeTranscription(
        sessionId,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to cancel real-time transcription session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Failed to cancel real-time transcription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('realtime/sessions/:sessionId')
  async getRealTimeSession(@Param('sessionId') sessionId: string) {
    try {
      return this.realTimeTranscriptionService.getRealTimeSession(sessionId);
    } catch (error) {
      this.logger.error(
        `Failed to get real-time transcription session ${sessionId}:`,
        error,
      );
      throw new HttpException(
        'Real-time transcription session not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get('realtime/sessions')
  async getAllActiveRealTimeSessions() {
    try {
      return this.realTimeTranscriptionService.getAllActiveSessions();
    } catch (error) {
      this.logger.error(
        'Failed to get active real-time transcription sessions:',
        error,
      );
      throw new HttpException(
        'Failed to get active sessions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  async getHealthStatus() {
    try {
      const modelStatuses = await this.transcriptionService.getModelStatus();
      const healthyModels = modelStatuses.filter(
        (model) => model.status === 'ready',
      ).length;
      const totalModels = modelStatuses.length;

      return {
        status: healthyModels > 0 ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        models: {
          total: totalModels,
          healthy: healthyModels,
          unhealthy: totalModels - healthyModels,
        },
        details: modelStatuses,
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
