export * from './lib/shared';

// Meeting Platform Interfaces
export * from './lib/interfaces/meeting-platform.interface';

// Meeting Platform Services
export * from './lib/services/meeting/meeting-recorder.service';
export * from './lib/services/platform-adapters/base-platform.adapter';
export * from './lib/services/platform-adapters/zoom.adapter';
export * from './lib/services/platform-adapters/teams.adapter';
export * from './lib/services/platform-adapters/google-meet.adapter';
export * from './lib/services/platform-adapters/webex.adapter';
export * from './lib/services/platform-adapters/platform-adapter.factory';

// Configuration
export * from './lib/config/environment.config';
export * from './lib/config/inngest.config';
export * from './lib/config/kafka.config';
export * from './lib/config/redis.config';
export * from './lib/config/supabase.config';

// Database Services
export * from './lib/services/database/redis.service';
export * from './lib/services/database/supabase.service';
export * from './lib/services/database/prisma.service';
export * from './lib/services/database/prisma.module';

// Authentication Services
export * from './lib/services/auth/clerk-sync.service';

// Infrastructure Services
export * from './lib/services/infrastructure/kafka.service';
export * from './lib/services/infrastructure/inngest-functions.service';

// Guards
export * from './lib/guards/auth.guard';

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
  VoiceProfile,
} from './lib/interfaces/transcription.interface';

// Export transcription interfaces with different names to avoid conflicts
export {
  FullTranscript as TranscriptionFullTranscript,
  TranscriptSegment as TranscriptionSegment,
  Speaker as TranscriptionSpeaker,
  TranscriptionSession as RealTimeTranscriptionSession,
} from './lib/interfaces/transcription.interface';

// Transcription Services
export * from './lib/services/transcription/transcription.service';
export * from './lib/services/transcription/audio-preprocessing.service';
export * from './lib/services/transcription/speaker-diarization.service';
export * from './lib/services/transcription/websocket-transcription.service';
export * from './lib/services/transcription/real-time-audio-stream.service';
export * from './lib/services/transcription/real-time-transcription-integration.service';

// AI Services and Interfaces
export * from './lib/interfaces/langchain.interface';
export * from './lib/services/ai/huggingface.service';
export { LangChainOrchestratorService as LangChainOrchestratorServiceImpl } from './lib/services/ai/langchain-orchestrator.service';
export { LangChainPromptsService as LangChainPromptsServiceImpl } from './lib/services/ai/langchain-prompts.service';
export { AICostMonitorService as AICostMonitorServiceImpl } from './lib/services/ai/ai-cost-monitor.service';
export { AIRetryHandlerService as AIRetryHandlerServiceImpl } from './lib/services/ai/ai-retry-handler.service';
export * from './lib/services/ai/langchain-example.service';
export * from './lib/config/langchain.config';

// Shared Module
export * from './lib/shared.module';
