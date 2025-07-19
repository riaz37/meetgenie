import { Injectable, Logger } from '@nestjs/common';
import { 
  TranscriptionServiceImpl,
  HuggingFaceService,
  AudioPreprocessingServiceImpl,
  SpeakerDiarizationServiceImpl,
  WebSocketTranscriptionServiceImpl,
  InngestFunctionsService
} from '@meetgenie/shared';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private transcriptionService: TranscriptionServiceImpl,
    private huggingFaceService: HuggingFaceService,
    private websocketService: WebSocketTranscriptionServiceImpl
  ) {}

  getData(): { message: string } {
    return { message: 'Transcription Service API' };
  }

  async getHealthStatus() {
    try {
      const huggingFaceHealth = await this.huggingFaceService.healthCheck();
      const activeConnections = this.websocketService.getActiveConnections();

      return {
        status: 'healthy',
        timestamp: new Date(),
        services: {
          huggingFace: huggingFaceHealth,
          websocket: {
            status: 'healthy',
            activeConnections: activeConnections.length
          }
        }
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
