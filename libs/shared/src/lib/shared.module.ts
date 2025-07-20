import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Database services
import { KafkaService } from './services/infrastructure/kafka.service';
import { RedisService } from './services/database/redis.service';
import { SupabaseService } from './services/database/supabase.service';
import { PrismaModule } from './services/database/prisma.module';

// Authentication services
import { ClerkSyncService } from './services/auth/clerk-sync.service';

// Infrastructure services
import { InngestFunctionsService } from './services/infrastructure/inngest-functions.service';

// Meeting services
import { MeetingRecorderService } from './services/meeting/meeting-recorder.service';
import { ZoomAdapter } from './services/platform-adapters/zoom.adapter';
import { TeamsAdapter } from './services/platform-adapters/teams.adapter';
import { GoogleMeetAdapter } from './services/platform-adapters/google-meet.adapter';
import { WebExAdapter } from './services/platform-adapters/webex.adapter';
import { PlatformAdapterFactory } from './services/platform-adapters/platform-adapter.factory';

// Guards
import { AuthGuard } from './guards/auth.guard';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';

// Transcription services
import { TranscriptionServiceImpl } from './services/transcription/transcription.service';
import { HuggingFaceService } from './services/ai/huggingface.service';
import { AudioPreprocessingServiceImpl } from './services/transcription/audio-preprocessing.service';
import { SpeakerDiarizationServiceImpl } from './services/transcription/speaker-diarization.service';
import { WebSocketTranscriptionServiceImpl } from './services/transcription/websocket-transcription.service';
import { RealTimeAudioStreamService } from './services/transcription/real-time-audio-stream.service';
import { RealTimeTranscriptionIntegrationService } from './services/transcription/real-time-transcription-integration.service';

// AI services
import { LangChainOrchestratorService } from './services/ai/langchain-orchestrator.service';
import { LangChainPromptsService } from './services/ai/langchain-prompts.service';
import { AICostMonitorService } from './services/ai/ai-cost-monitor.service';
import { AIRetryHandlerService } from './services/ai/ai-retry-handler.service';
import { LangChainExampleService } from './services/ai/langchain-example.service';
import { LangChainConfigService } from './config/langchain.config';
import kafkaConfig from './config/kafka.config';
import redisConfig from './config/redis.config';

import environmentConfig from './config/environment.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [kafkaConfig, redisConfig, environmentConfig],
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
  ],
  providers: [
    KafkaService,
    RedisService,
    SupabaseService,
    ClerkSyncService,
    InngestFunctionsService,
    MeetingRecorderService,
    ZoomAdapter,
    TeamsAdapter,
    GoogleMeetAdapter,
    WebExAdapter,
    PlatformAdapterFactory,
    AuthGuard,
    ClerkAuthGuard,
    // Transcription services
    TranscriptionServiceImpl,
    HuggingFaceService,
    AudioPreprocessingServiceImpl,
    SpeakerDiarizationServiceImpl,
    WebSocketTranscriptionServiceImpl,
    RealTimeAudioStreamService,
    RealTimeTranscriptionIntegrationService,
    // LangChain AI services
    LangChainConfigService,
    LangChainPromptsService,
    AICostMonitorService,
    AIRetryHandlerService,
    LangChainExampleService,
  ],
  exports: [
    KafkaService,
    RedisService,
    SupabaseService,
    ClerkSyncService,
    InngestFunctionsService,
    MeetingRecorderService,
    ZoomAdapter,
    TeamsAdapter,
    GoogleMeetAdapter,
    WebExAdapter,
    PlatformAdapterFactory,
    AuthGuard,
    ClerkAuthGuard,
    ConfigModule,
    // Transcription services
    TranscriptionServiceImpl,
    HuggingFaceService,
    AudioPreprocessingServiceImpl,
    SpeakerDiarizationServiceImpl,
    WebSocketTranscriptionServiceImpl,
    RealTimeAudioStreamService,
    RealTimeTranscriptionIntegrationService,
    // LangChain AI services
    LangChainConfigService,
    LangChainPromptsService,
    AICostMonitorService,
    AIRetryHandlerService,
    LangChainExampleService,
  ],
})
export class SharedModule {}
