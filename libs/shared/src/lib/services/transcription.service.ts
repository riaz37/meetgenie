import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  TranscriptionService, 
  TranscriptionConfig, 
  TranscriptionSession, 
  TranscriptSegment, 
  FullTranscript, 
  HuggingFaceModelStatus, 
  SpeakerDiarizationResult, 
  TranscriptionQualityMetrics, 
  AudioChunk, 
  TranscriptionSessionStatus, 
  TranscriptionStatus, 
  TranscriptionError, 
  TranscriptionErrorCode,
  AudioPreprocessingResult
} from '../interfaces/transcription.interface';
import { HuggingFaceService } from './huggingface.service';
import { AudioPreprocessingServiceImpl } from './audio-preprocessing.service';
import { SpeakerDiarizationServiceImpl } from './speaker-diarization.service';
import { WebSocketTranscriptionServiceImpl } from './websocket-transcription.service';
import { InngestFunctionsService } from './inngest-functions.service';

@Injectable()
export class TranscriptionServiceImpl implements TranscriptionService {
  private readonly logger = new Logger(TranscriptionServiceImpl.name);
  private activeSessions = new Map<string, TranscriptionSession>();
  private audioChunks = new Map<string, AudioChunk[]>(); // sessionId -> chunks
  private processingQueue = new Map<string, AudioChunk[]>(); // sessionId -> pending chunks
  private sessionMetrics = new Map<string, TranscriptionQualityMetrics>();

  private readonly defaultConfig: TranscriptionConfig = {
    modelName: 'facebook/wav2vec2-large-960h-lv60-self',
    language: 'en',
    enableSpeakerDiarization: true,
    chunkSize: 1024 * 16, // 16KB chunks
    overlapSize: 1024 * 2, // 2KB overlap
    confidenceThreshold: 0.7,
    sampleRate: 16000,
    channels: 1,
    bitDepth: 16
  };

  constructor(
    private huggingFaceService: HuggingFaceService,
    private audioPreprocessingService: AudioPreprocessingServiceImpl,
    private speakerDiarizationService: SpeakerDiarizationServiceImpl,
    private websocketService: WebSocketTranscriptionServiceImpl,
    private inngestService: InngestFunctionsService,
    private eventEmitter: EventEmitter2
  ) {}

  async startTranscription(audioStream: NodeJS.ReadableStream, config: TranscriptionConfig = this.defaultConfig): Promise<TranscriptionSession> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();
    
    this.logger.log(`Starting transcription session: ${sessionId}`);
    
    try {
      // Validate and prepare configuration
      const finalConfig = { ...this.defaultConfig, ...config };
      
      // Check model availability
      const modelStatus = await this.huggingFaceService.getModelStatus(finalConfig.modelName);
      if (modelStatus.status !== 'ready') {
        await this.huggingFaceService.loadModel(finalConfig.modelName);
      }

      // Create transcription session
      const session: TranscriptionSession = {
        id: sessionId,
        meetingId: '', // Will be set by caller
        sessionId,
        config: finalConfig,
        status: TranscriptionSessionStatus.INITIALIZING,
        startTime: new Date(),
        currentModel: finalConfig.modelName,
        fallbackModels: this.getFallbackModels(finalConfig.modelName),
        segments: [],
        speakers: [],
        errorCount: 0
      };

      this.activeSessions.set(sessionId, session);
      this.audioChunks.set(sessionId, []);
      this.processingQueue.set(sessionId, []);
      this.initializeSessionMetrics(sessionId);

      // Create WebSocket connection for real-time updates
      const websocketId = await this.websocketService.createConnection(sessionId);
      session.websocketId = websocketId;

      // Set up audio stream processing
      await this.setupAudioStreamProcessing(audioStream, session);

      // Update session status
      session.status = TranscriptionSessionStatus.ACTIVE;
      this.activeSessions.set(sessionId, session);

      // Emit session started event
      this.eventEmitter.emit('transcription.session.started', {
        sessionId,
        config: finalConfig,
        timestamp: new Date()
      });

      // Send status update via WebSocket
      await this.websocketService.sendTranscriptionUpdate(
        websocketId,
        this.websocketService.createStatusMessage(sessionId, TranscriptionStatus.PROCESSING)
      );

      this.logger.log(`Transcription session ${sessionId} started successfully`);
      return session;

    } catch (error) {
      this.logger.error(`Failed to start transcription session ${sessionId}:`, error);
      
      // Clean up on failure
      this.activeSessions.delete(sessionId);
      this.audioChunks.delete(sessionId);
      this.processingQueue.delete(sessionId);
      
      throw error;
    }
  }

  async processAudioChunk(sessionId: string, audioChunk: Buffer): Promise<TranscriptSegment> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Transcription session not found: ${sessionId}`);
    }

    const chunkStartTime = Date.now();
    
    try {
      // Create audio chunk record
      const chunk: AudioChunk = {
        id: this.generateChunkId(),
        sessionId,
        data: audioChunk,
        timestamp: Date.now(),
        duration: this.estimateAudioDuration(audioChunk, session.config),
        sampleRate: session.config.sampleRate,
        channels: session.config.channels,
        processed: false
      };

      // Store chunk
      const chunks = this.audioChunks.get(sessionId) || [];
      chunks.push(chunk);
      this.audioChunks.set(sessionId, chunks);

      // Add to processing queue
      const queue = this.processingQueue.get(sessionId) || [];
      queue.push(chunk);
      this.processingQueue.set(sessionId, queue);

      // Process chunk
      const segment = await this.processChunk(session, chunk);
      
      // Update session
      session.segments.push(segment);
      this.activeSessions.set(sessionId, session);

      // Update metrics
      this.updateSessionMetrics(sessionId, chunkStartTime, true, segment.confidence);

      // Send real-time update
      if (session.websocketId) {
        await this.websocketService.sendTranscriptionUpdate(
          session.websocketId,
          this.websocketService.createSegmentMessage(sessionId, segment)
        );
      }

      // Emit segment processed event
      this.eventEmitter.emit('transcription.segment.processed', {
        sessionId,
        segment,
        timestamp: new Date()
      });

      return segment;

    } catch (error) {
      this.logger.error(`Failed to process audio chunk for session ${sessionId}:`, error);
      
      // Update error count and metrics
      session.errorCount++;
      session.lastError = this.createTranscriptionError(error, sessionId);
      this.activeSessions.set(sessionId, session);
      this.updateSessionMetrics(sessionId, chunkStartTime, false, 0);

      // Try fallback model if available
      if (session.fallbackModels.length > 0 && session.errorCount < 3) {
        const fallbackModel = session.fallbackModels[0];
        this.logger.log(`Switching to fallback model: ${fallbackModel}`);
        
        try {
          await this.switchModel(sessionId, fallbackModel);
          return this.processAudioChunk(sessionId, audioChunk);
        } catch (fallbackError) {
          this.logger.error(`Fallback model also failed:`, fallbackError);
        }
      }

      throw error;
    }
  }

  private async processChunk(session: TranscriptionSession, chunk: AudioChunk): Promise<TranscriptSegment> {
    // Preprocess audio
    const preprocessingResult = await this.audioPreprocessingService.preprocessAudio(
      chunk.data,
      {
        enableNoiseReduction: true,
        enableVolumeNormalization: true,
        enableEchoCancellation: false,
        targetSampleRate: session.config.sampleRate,
        targetChannels: session.config.channels,
        qualityThreshold: session.config.confidenceThreshold
      }
    );

    // Transcribe audio
    const transcriptionResult = await this.huggingFaceService.transcribeAudio(
      preprocessingResult.processedAudio,
      session.config
    );

    // Identify speaker if diarization is enabled
    let speakerId = 'unknown';
    if (session.config.enableSpeakerDiarization) {
      speakerId = await this.identifySpeakerForChunk(session, preprocessingResult.processedAudio);
    }

    // Create transcript segment
    const segment: TranscriptSegment = {
      id: this.generateSegmentId(),
      timestamp: chunk.timestamp,
      endTimestamp: chunk.timestamp + chunk.duration,
      speakerId,
      text: transcriptionResult.text,
      confidence: transcriptionResult.confidence,
      modelUsed: session.currentModel,
      processingTime: transcriptionResult.processingTime,
      audioChunkId: chunk.id,
      language: session.config.language
    };

    // Mark chunk as processed
    chunk.processed = true;
    chunk.transcriptSegmentId = segment.id;

    return segment;
  }

  private async identifySpeakerForChunk(session: TranscriptionSession, audioData: Buffer): Promise<string> {
    try {
      // If we don't have speakers yet, perform initial diarization
      if (session.speakers.length === 0) {
        const diarizationResult = await this.speakerDiarizationService.diarizeAudio(audioData);
        
        // Convert detected speakers to session speakers
        for (const detectedSpeaker of diarizationResult.speakers) {
          const speaker = {
            id: detectedSpeaker.id,
            voiceProfile: {
              id: detectedSpeaker.id,
              features: detectedSpeaker.voiceEmbedding,
              confidence: detectedSpeaker.confidence,
              sampleCount: 1,
              lastUpdated: new Date()
            },
            segments: [],
            totalSpeakingTime: detectedSpeaker.totalSpeakingTime,
            averageConfidence: detectedSpeaker.confidence,
            detectedAt: new Date()
          };
          
          session.speakers.push(speaker);
        }
        
        return diarizationResult.speakers[0]?.id || 'speaker_1';
      }

      // Identify speaker from existing profiles
      const speakerId = await this.speakerDiarizationService.identifySpeaker(
        await this.extractVoiceEmbedding(audioData),
        session.speakers
      );

      return speakerId || 'unknown';

    } catch (error) {
      this.logger.warn(`Speaker identification failed:`, error);
      return 'unknown';
    }
  }

  private async extractVoiceEmbedding(audioData: Buffer): Promise<number[]> {
    // This would typically use the same embedding extraction as the diarization service
    // For now, return a placeholder
    return new Array(128).fill(0).map(() => Math.random());
  }

  async identifySpeakers(audioData: Buffer): Promise<SpeakerDiarizationResult> {
    return this.speakerDiarizationService.diarizeAudio(audioData);
  }

  async finalizeTranscript(sessionId: string): Promise<FullTranscript> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Transcription session not found: ${sessionId}`);
    }

    this.logger.log(`Finalizing transcript for session: ${sessionId}`);

    try {
      // Update session status
      session.status = TranscriptionSessionStatus.COMPLETED;
      session.endTime = new Date();
      this.activeSessions.set(sessionId, session);

      // Create full transcript
      const transcript: FullTranscript = {
        id: this.generateTranscriptId(),
        meetingId: session.meetingId,
        sessionId,
        segments: session.segments,
        speakers: session.speakers,
        duration: this.calculateSessionDuration(session),
        language: session.config.language,
        modelMetadata: {
          primaryModel: session.currentModel,
          fallbackModelsUsed: this.getFallbackModelsUsed(session),
          averageConfidence: this.calculateAverageConfidence(session.segments),
          processingStats: {
            totalChunks: this.audioChunks.get(sessionId)?.length || 0,
            averageProcessingTime: this.calculateAverageProcessingTime(session.segments),
            modelSwitches: this.countModelSwitches(session),
            errorCount: session.errorCount,
            retryCount: 0 // TODO: Track retries
          },
          totalTokensProcessed: this.calculateTotalTokens(session.segments),
          apiCalls: session.segments.length,
          totalCost: this.estimateCost(session.segments)
        },
        createdAt: session.startTime,
        updatedAt: new Date(),
        status: TranscriptionStatus.COMPLETED
      };

      // Send completion update via WebSocket
      if (session.websocketId) {
        await this.websocketService.sendTranscriptionUpdate(
          session.websocketId,
          {
            type: 'complete',
            sessionId,
            timestamp: new Date(),
            data: transcript
          }
        );
      }

      // Schedule post-processing job
      await this.schedulePostProcessing(sessionId, transcript);

      // Emit completion event
      this.eventEmitter.emit('transcription.session.completed', {
        sessionId,
        transcript,
        timestamp: new Date()
      });

      this.logger.log(`Transcript finalized for session: ${sessionId}`);
      return transcript;

    } catch (error) {
      this.logger.error(`Failed to finalize transcript for session ${sessionId}:`, error);
      
      // Update session status to error
      session.status = TranscriptionSessionStatus.ERROR;
      session.lastError = this.createTranscriptionError(error, sessionId);
      this.activeSessions.set(sessionId, session);
      
      throw error;
    }
  }

  async getModelStatus(modelName?: string): Promise<HuggingFaceModelStatus[]> {
    if (modelName) {
      const status = await this.huggingFaceService.getModelStatus(modelName);
      return [status];
    }
    
    return this.huggingFaceService.getAllModelStatuses();
  }

  async switchModel(sessionId: string, modelName: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Transcription session not found: ${sessionId}`);
    }

    this.logger.log(`Switching model for session ${sessionId} from ${session.currentModel} to ${modelName}`);

    try {
      // Ensure new model is ready
      await this.huggingFaceService.switchModel(session.currentModel, modelName);
      
      // Update session
      session.currentModel = modelName;
      this.activeSessions.set(sessionId, session);

      this.logger.log(`Successfully switched to model ${modelName} for session ${sessionId}`);

    } catch (error) {
      this.logger.error(`Failed to switch model for session ${sessionId}:`, error);
      throw error;
    }
  }

  async pauseTranscription(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Transcription session not found: ${sessionId}`);
    }

    session.status = TranscriptionSessionStatus.PAUSED;
    this.activeSessions.set(sessionId, session);

    this.logger.log(`Transcription paused for session: ${sessionId}`);
  }

  async resumeTranscription(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Transcription session not found: ${sessionId}`);
    }

    session.status = TranscriptionSessionStatus.ACTIVE;
    this.activeSessions.set(sessionId, session);

    this.logger.log(`Transcription resumed for session: ${sessionId}`);
  }

  async cancelTranscription(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Transcription session not found: ${sessionId}`);
    }

    session.status = TranscriptionSessionStatus.CANCELLED;
    session.endTime = new Date();
    this.activeSessions.set(sessionId, session);

    // Clean up resources
    this.audioChunks.delete(sessionId);
    this.processingQueue.delete(sessionId);
    this.sessionMetrics.delete(sessionId);

    // Close WebSocket connection
    if (session.websocketId) {
      await this.websocketService.closeConnection(session.websocketId);
    }

    this.logger.log(`Transcription cancelled for session: ${sessionId}`);
  }

  async getTranscriptionSession(sessionId: string): Promise<TranscriptionSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Transcription session not found: ${sessionId}`);
    }
    
    return session;
  }

  async getQualityMetrics(sessionId: string): Promise<TranscriptionQualityMetrics> {
    const metrics = this.sessionMetrics.get(sessionId);
    if (!metrics) {
      throw new Error(`Quality metrics not found for session: ${sessionId}`);
    }
    
    return metrics;
  }

  // Private helper methods
  private async setupAudioStreamProcessing(audioStream: NodeJS.ReadableStream, session: TranscriptionSession): Promise<void> {
    return new Promise((resolve, reject) => {
      let buffer = Buffer.alloc(0);
      
      audioStream.on('data', async (chunk: Buffer) => {
        try {
          buffer = Buffer.concat([buffer, chunk]);
          
          // Process chunks when we have enough data
          while (buffer.length >= session.config.chunkSize) {
            const audioChunk = buffer.slice(0, session.config.chunkSize);
            buffer = buffer.slice(session.config.chunkSize - session.config.overlapSize);
            
            // Process chunk asynchronously
            this.processAudioChunk(session.sessionId, audioChunk).catch(error => {
              this.logger.error(`Error processing audio chunk:`, error);
            });
          }
        } catch (error) {
          this.logger.error('Error in audio stream processing:', error);
        }
      });

      audioStream.on('end', () => {
        // Process remaining buffer
        if (buffer.length > 0) {
          this.processAudioChunk(session.sessionId, buffer).catch(error => {
            this.logger.error(`Error processing final audio chunk:`, error);
          });
        }
        resolve();
      });

      audioStream.on('error', reject);
    });
  }

  private getFallbackModels(currentModel: string): string[] {
    const allModels = [
      'facebook/wav2vec2-large-960h-lv60-self',
      'facebook/wav2vec2-base-960h',
      'openai/whisper-base',
      'openai/whisper-small'
    ];
    
    return allModels.filter(model => model !== currentModel);
  }

  private getFallbackModelsUsed(session: TranscriptionSession): string[] {
    // Track which fallback models were actually used
    const usedModels = new Set(session.segments.map(s => s.modelUsed));
    usedModels.delete(session.config.modelName);
    return Array.from(usedModels);
  }

  private estimateAudioDuration(audioData: Buffer, config: TranscriptionConfig): number {
    // Estimate duration based on buffer size and audio format
    const bytesPerSample = config.bitDepth / 8;
    const samplesPerSecond = config.sampleRate * config.channels;
    const bytesPerSecond = samplesPerSecond * bytesPerSample;
    return (audioData.length / bytesPerSecond) * 1000; // Return in milliseconds
  }

  private calculateSessionDuration(session: TranscriptionSession): number {
    if (!session.endTime) return 0;
    return session.endTime.getTime() - session.startTime.getTime();
  }

  private calculateAverageConfidence(segments: TranscriptSegment[]): number {
    if (segments.length === 0) return 0;
    const totalConfidence = segments.reduce((sum, segment) => sum + segment.confidence, 0);
    return totalConfidence / segments.length;
  }

  private calculateAverageProcessingTime(segments: TranscriptSegment[]): number {
    if (segments.length === 0) return 0;
    const totalTime = segments.reduce((sum, segment) => sum + segment.processingTime, 0);
    return totalTime / segments.length;
  }

  private countModelSwitches(session: TranscriptionSession): number {
    let switches = 0;
    let currentModel = session.config.modelName;
    
    for (const segment of session.segments) {
      if (segment.modelUsed !== currentModel) {
        switches++;
        currentModel = segment.modelUsed;
      }
    }
    
    return switches;
  }

  private calculateTotalTokens(segments: TranscriptSegment[]): number {
    return segments.reduce((total, segment) => total + segment.text.split(' ').length, 0);
  }

  private estimateCost(segments: TranscriptSegment[]): number {
    // Rough cost estimation based on API usage
    const apiCalls = segments.length;
    const costPerCall = 0.001; // $0.001 per API call (example)
    return apiCalls * costPerCall;
  }

  private async schedulePostProcessing(sessionId: string, transcript: FullTranscript): Promise<void> {
    try {
      // Schedule Inngest job for post-processing
      await this.inngestService.scheduleTranscriptionPostProcessing({
        sessionId,
        transcriptId: transcript.id,
        segments: transcript.segments.length,
        duration: transcript.duration
      });
      
      this.logger.debug(`Scheduled post-processing for session: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to schedule post-processing for session ${sessionId}:`, error);
    }
  }

  private initializeSessionMetrics(sessionId: string): void {
    const metrics: TranscriptionQualityMetrics = {
      sessionId,
      averageConfidence: 0,
      latency: 0,
      throughput: 0,
      modelPerformance: []
    };
    
    this.sessionMetrics.set(sessionId, metrics);
  }

  private updateSessionMetrics(sessionId: string, startTime: number, success: boolean, confidence: number): void {
    const metrics = this.sessionMetrics.get(sessionId);
    if (!metrics) return;

    const processingTime = Date.now() - startTime;
    metrics.latency = (metrics.latency + processingTime) / 2; // Running average
    
    if (success) {
      metrics.averageConfidence = (metrics.averageConfidence + confidence) / 2;
    }
    
    this.sessionMetrics.set(sessionId, metrics);
  }

  private createTranscriptionError(error: unknown, sessionId: string): TranscriptionError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      code: TranscriptionErrorCode.UNKNOWN_ERROR,
      message: errorMessage,
      timestamp: new Date(),
      sessionId,
      retryable: true,
      details: { originalError: error }
    };
  }

  // ID generators
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChunkId(): string {
    return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSegmentId(): string {
    return `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTranscriptId(): string {
    return `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}