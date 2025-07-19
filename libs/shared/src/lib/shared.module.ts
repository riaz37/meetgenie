import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { KafkaService } from './services/kafka.service';
import { RedisService } from './services/redis.service';
import { SupabaseService } from './services/supabase.service';
import { DatabaseService } from './services/database.service';
import { MigrationService } from './services/migration.service';
import { ClerkSyncService } from './services/clerk-sync.service';
import { InngestFunctionsService } from './services/inngest-functions.service';
import { MeetingRecorderService } from './services/meeting-recorder.service';
import { ZoomAdapter } from './services/platform-adapters/zoom.adapter';
import { TeamsAdapter } from './services/platform-adapters/teams.adapter';
import { GoogleMeetAdapter } from './services/platform-adapters/google-meet.adapter';
import { WebExAdapter } from './services/platform-adapters/webex.adapter';
import { PlatformAdapterFactory } from './services/platform-adapters/platform-adapter.factory';
import { AuthGuard } from './guards/auth.guard';
// Transcription services
import { TranscriptionServiceImpl } from './services/transcription.service';
import { HuggingFaceService } from './services/huggingface.service';
import { AudioPreprocessingServiceImpl } from './services/audio-preprocessing.service';
import { SpeakerDiarizationServiceImpl } from './services/speaker-diarization.service';
import { WebSocketTranscriptionServiceImpl } from './services/websocket-transcription.service';
import kafkaConfig from './config/kafka.config';
import redisConfig from './config/redis.config';
import databaseConfig from './config/database.config';
import environmentConfig from './config/environment.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [kafkaConfig, redisConfig, databaseConfig, environmentConfig],
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),
    EventEmitterModule.forRoot()
  ],
  providers: [
    KafkaService, 
    RedisService, 
    SupabaseService, 
    DatabaseService, 
    MigrationService,
    ClerkSyncService,
    InngestFunctionsService,
    MeetingRecorderService,
    ZoomAdapter,
    TeamsAdapter,
    GoogleMeetAdapter,
    WebExAdapter,
    PlatformAdapterFactory,
    AuthGuard,
    // Transcription services
    TranscriptionServiceImpl,
    HuggingFaceService,
    AudioPreprocessingServiceImpl,
    SpeakerDiarizationServiceImpl,
    WebSocketTranscriptionServiceImpl
  ],
  exports: [
    KafkaService, 
    RedisService, 
    SupabaseService, 
    DatabaseService, 
    MigrationService,
    ClerkSyncService,
    InngestFunctionsService,
    MeetingRecorderService,
    ZoomAdapter,
    TeamsAdapter,
    GoogleMeetAdapter,
    WebExAdapter,
    PlatformAdapterFactory,
    AuthGuard,
    ConfigModule,
    // Transcription services
    TranscriptionServiceImpl,
    HuggingFaceService,
    AudioPreprocessingServiceImpl,
    SpeakerDiarizationServiceImpl,
    WebSocketTranscriptionServiceImpl
  ],
})
export class SharedModule {}