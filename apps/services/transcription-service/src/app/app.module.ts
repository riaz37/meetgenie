import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MulterModule } from '@nestjs/platform-express';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TranscriptionController } from './transcription.controller';

import { 
  SharedModule,
  TranscriptionServiceImpl,
  HuggingFaceService,
  AudioPreprocessingServiceImpl,
  SpeakerDiarizationServiceImpl,
  WebSocketTranscriptionServiceImpl,
  InngestFunctionsService,
  environmentConfig
} from '@meetgenie/shared';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [environmentConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    EventEmitterModule.forRoot(),
    MulterModule.register({
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit for audio files
      },
    }),
    SharedModule,
  ],
  controllers: [
    AppController,
    TranscriptionController
  ],
  providers: [
    AppService,
    TranscriptionServiceImpl,
    HuggingFaceService,
    AudioPreprocessingServiceImpl,
    SpeakerDiarizationServiceImpl,
    WebSocketTranscriptionServiceImpl,
    InngestFunctionsService
  ],
})
export class AppModule {}
