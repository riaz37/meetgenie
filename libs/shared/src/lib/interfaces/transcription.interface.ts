export interface TranscriptionConfig {
  modelName: string; // Default: "facebook/wav2vec2-large-960h-lv60-self"
  language: string;
  enableSpeakerDiarization: boolean;
  chunkSize: number;
  overlapSize: number;
  confidenceThreshold: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

export interface HuggingFaceModelStatus {
  modelName: string;
  status: 'loading' | 'ready' | 'error';
  loadTime?: number;
  lastUsed?: Date;
  errorMessage?: string;
  apiEndpoint?: string;
  isLocal: boolean;
}

export interface TranscriptSegment {
  id: string;
  timestamp: number;
  endTimestamp: number;
  speakerId: string;
  text: string;
  confidence: number;
  modelUsed: string;
  processingTime: number;
  audioChunkId?: string;
  language?: string;
}

export interface FullTranscript {
  id: string;
  meetingId: string;
  sessionId: string;
  segments: TranscriptSegment[];
  speakers: Speaker[];
  duration: number;
  language: string;
  modelMetadata: TranscriptionModelMetadata;
  createdAt: Date;
  updatedAt: Date;
  status: TranscriptionStatus;
}

export interface TranscriptionModelMetadata {
  primaryModel: string;
  fallbackModelsUsed: string[];
  averageConfidence: number;
  processingStats: ProcessingStats;
  totalTokensProcessed: number;
  apiCalls: number;
  totalCost?: number;
}

export interface ProcessingStats {
  totalChunks: number;
  averageProcessingTime: number;
  modelSwitches: number;
  errorCount: number;
  retryCount: number;
  peakMemoryUsage?: number;
}

export interface Speaker {
  id: string;
  name?: string;
  voiceProfile: VoiceProfile;
  segments: string[]; // segment IDs
  totalSpeakingTime: number;
  averageConfidence: number;
  detectedAt: Date;
}

export interface VoiceProfile {
  id: string;
  features: number[]; // voice embedding features
  confidence: number;
  sampleCount: number;
  lastUpdated: Date;
}

export interface TranscriptionSession {
  id: string;
  meetingId: string;
  sessionId: string;
  config: TranscriptionConfig;
  status: TranscriptionSessionStatus;
  startTime: Date;
  endTime?: Date;
  currentModel: string;
  fallbackModels: string[];
  audioStreamId?: string;
  websocketId?: string;
  segments: TranscriptSegment[];
  speakers: Speaker[];
  errorCount: number;
  lastError?: TranscriptionError;
}

export interface AudioChunk {
  id: string;
  sessionId: string;
  data: Buffer;
  timestamp: number;
  duration: number;
  sampleRate: number;
  channels: number;
  processed: boolean;
  transcriptSegmentId?: string;
}

export interface AudioPreprocessingResult {
  processedAudio: Buffer;
  originalSize: number;
  processedSize: number;
  sampleRate: number;
  channels: number;
  duration: number;
  qualityScore: number;
  enhancements: AudioEnhancement[];
}

export interface AudioEnhancement {
  type: 'noise_reduction' | 'volume_normalization' | 'echo_cancellation' | 'frequency_filtering';
  applied: boolean;
  parameters: Record<string, any>;
  improvement: number; // 0-1 score
}

export interface SpeakerDiarizationResult {
  speakers: DetectedSpeaker[];
  segments: SpeakerSegment[];
  confidence: number;
  processingTime: number;
  modelUsed: string;
}

export interface DetectedSpeaker {
  id: string;
  voiceEmbedding: number[];
  confidence: number;
  firstDetectedAt: number;
  lastDetectedAt: number;
  totalSpeakingTime: number;
}

export interface SpeakerSegment {
  speakerId: string;
  startTime: number;
  endTime: number;
  confidence: number;
  audioChunkIds: string[];
}

export interface TranscriptionError {
  code: TranscriptionErrorCode;
  message: string;
  timestamp: Date;
  sessionId: string;
  audioChunkId?: string;
  modelName?: string;
  retryable: boolean;
  details?: Record<string, any>;
}

export interface WebSocketTranscriptionMessage {
  type: 'segment' | 'speaker_update' | 'status' | 'error' | 'complete';
  sessionId: string;
  timestamp: Date;
  data: TranscriptSegment | Speaker | TranscriptionStatus | TranscriptionError | FullTranscript;
}

export interface TranscriptionQualityMetrics {
  sessionId: string;
  averageConfidence: number;
  wordErrorRate?: number;
  speakerAccuracy?: number;
  latency: number;
  throughput: number;
  modelPerformance: ModelPerformanceMetrics[];
}

export interface ModelPerformanceMetrics {
  modelName: string;
  averageLatency: number;
  successRate: number;
  errorRate: number;
  averageConfidence: number;
  usageCount: number;
  totalProcessingTime: number;
}

// Enums
export enum TranscriptionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum TranscriptionSessionStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled'
}

export enum TranscriptionErrorCode {
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  AUDIO_PROCESSING_FAILED = 'AUDIO_PROCESSING_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_AUDIO_FORMAT = 'INVALID_AUDIO_FORMAT',
  SPEAKER_DIARIZATION_FAILED = 'SPEAKER_DIARIZATION_FAILED',
  WEBSOCKET_CONNECTION_LOST = 'WEBSOCKET_CONNECTION_LOST',
  INSUFFICIENT_AUDIO_QUALITY = 'INSUFFICIENT_AUDIO_QUALITY',
  MODEL_TIMEOUT = 'MODEL_TIMEOUT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum AudioFormat {
  WAV = 'wav',
  MP3 = 'mp3',
  FLAC = 'flac',
  OGG = 'ogg',
  M4A = 'm4a'
}

// Service interfaces
export interface TranscriptionService {
  startTranscription(audioStream: NodeJS.ReadableStream, config: TranscriptionConfig): Promise<TranscriptionSession>;
  processAudioChunk(sessionId: string, audioChunk: Buffer): Promise<TranscriptSegment>;
  identifySpeakers(audioData: Buffer): Promise<SpeakerDiarizationResult>;
  finalizeTranscript(sessionId: string): Promise<FullTranscript>;
  getModelStatus(modelName?: string): Promise<HuggingFaceModelStatus[]>;
  switchModel(sessionId: string, modelName: string): Promise<void>;
  pauseTranscription(sessionId: string): Promise<void>;
  resumeTranscription(sessionId: string): Promise<void>;
  cancelTranscription(sessionId: string): Promise<void>;
  getTranscriptionSession(sessionId: string): Promise<TranscriptionSession>;
  getQualityMetrics(sessionId: string): Promise<TranscriptionQualityMetrics>;
}

export interface AudioPreprocessingService {
  preprocessAudio(audioData: Buffer, config: AudioPreprocessingConfig): Promise<AudioPreprocessingResult>;
  enhanceAudioQuality(audioData: Buffer): Promise<Buffer>;
  normalizeVolume(audioData: Buffer): Promise<Buffer>;
  reduceNoise(audioData: Buffer): Promise<Buffer>;
  detectAudioQuality(audioData: Buffer): Promise<AudioQualityMetrics>;
}

export interface AudioPreprocessingConfig {
  enableNoiseReduction: boolean;
  enableVolumeNormalization: boolean;
  enableEchoCancellation: boolean;
  targetSampleRate: number;
  targetChannels: number;
  qualityThreshold: number;
}

export interface AudioQualityMetrics {
  signalToNoiseRatio: number;
  volumeLevel: number;
  clarity: number;
  overallQuality: number;
  recommendations: string[];
}

export interface SpeakerDiarizationService {
  diarizeAudio(audioData: Buffer, config: DiarizationConfig): Promise<SpeakerDiarizationResult>;
  identifySpeaker(voiceEmbedding: number[], knownSpeakers: Speaker[]): Promise<string | null>;
  createVoiceProfile(audioSamples: Buffer[]): Promise<VoiceProfile>;
  updateVoiceProfile(speakerId: string, audioSample: Buffer): Promise<VoiceProfile>;
  mergeSpeakers(speaker1Id: string, speaker2Id: string): Promise<Speaker>;
}

export interface DiarizationConfig {
  minSpeakers: number;
  maxSpeakers: number;
  minSegmentLength: number;
  similarityThreshold: number;
  modelName?: string;
}

export interface WebSocketTranscriptionService {
  createConnection(sessionId: string): Promise<string>; // returns websocket connection ID
  sendTranscriptionUpdate(connectionId: string, message: WebSocketTranscriptionMessage): Promise<void>;
  closeConnection(connectionId: string): Promise<void>;
  getActiveConnections(): string[];
  broadcastToSession(sessionId: string, message: WebSocketTranscriptionMessage): Promise<void>;
}