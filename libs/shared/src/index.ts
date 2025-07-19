export * from './lib/shared';

// Meeting Platform Interfaces
export * from './lib/interfaces/meeting-platform.interface';

// Meeting Platform Services
export * from './lib/services/meeting-recorder.service';
export * from './lib/services/platform-adapters/base-platform.adapter';
export * from './lib/services/platform-adapters/zoom.adapter';
export * from './lib/services/platform-adapters/teams.adapter';
export * from './lib/services/platform-adapters/google-meet.adapter';
export * from './lib/services/platform-adapters/webex.adapter';
export * from './lib/services/platform-adapters/platform-adapter.factory';

// Re-export specific models to avoid conflicts
export { 
  User, 
  SubscriptionTier,
  TonePreference,
  SummaryFormat,
  UserPreferences
} from './lib/models/user.model';

// Export meeting models with different names to avoid conflicts
export { 
  Meeting as MeetingDataModel,
  MeetingParticipant as MeetingParticipantModel,
  MeetingSession as MeetingSessionModel
} from './lib/models/meeting.model';

// Configuration
export * from './lib/config/database.config';
export * from './lib/config/environment.config';
export * from './lib/config/inngest.config';
export * from './lib/config/kafka.config';
export * from './lib/config/redis.config';
export * from './lib/config/supabase.config';

// Services
export * from './lib/services/database.service';
export * from './lib/services/kafka.service';
export * from './lib/services/migration.service';
export * from './lib/services/redis.service';
export * from './lib/services/supabase.service';
export * from './lib/services/clerk-sync.service';
export * from './lib/services/inngest-functions.service';

// Guards
export * from './lib/guards/auth.guard';

// Models (specific exports to avoid conflicts)
export * from './lib/models/audit.model';
export * from './lib/models/payment.model';
export * from './lib/models/qa.model';
export * from './lib/models/summary.model';
export * from './lib/models/transcript.model';
// User model exports are handled above
// Meeting model exports are handled above to avoid conflicts

// Interfaces
export * from './lib/interfaces/events.interface';
export * from './lib/interfaces/clerk.interface';

// Transcription interfaces (with specific exports to avoid conflicts)
export {
  TranscriptionConfig,
  HuggingFaceModelStatus,
  AudioPreprocessingResult,
  AudioQualityMetrics,
  AudioEnhancement,
  SpeakerDiarizationResult,
  DetectedSpeaker,
  SpeakerSegment,
  TranscriptionError,
  WebSocketTranscriptionMessage,
  TranscriptionQualityMetrics,
  ModelPerformanceMetrics,
  TranscriptionStatus,
  TranscriptionSessionStatus,
  TranscriptionErrorCode,
  AudioFormat,
  TranscriptionService,
  AudioPreprocessingService,
  SpeakerDiarizationService,
  WebSocketTranscriptionService,
  AudioPreprocessingConfig,
  DiarizationConfig,
  AudioChunk,
  VoiceProfile
} from './lib/interfaces/transcription.interface';

// Export transcription interfaces with different names to avoid conflicts
export {
  FullTranscript as TranscriptionFullTranscript,
  TranscriptSegment as TranscriptionSegment,
  Speaker as TranscriptionSpeaker,
  TranscriptionSession as RealTimeTranscriptionSession
} from './lib/interfaces/transcription.interface';

// Transcription Services
export * from './lib/services/transcription.service';
export * from './lib/services/huggingface.service';
export * from './lib/services/audio-preprocessing.service';
export * from './lib/services/speaker-diarization.service';
export * from './lib/services/websocket-transcription.service';

// Shared Module
export * from './lib/shared.module';
