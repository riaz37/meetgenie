import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TranscriptionServiceImpl } from './transcription.service';
import { RealTimeAudioStreamService, AudioStreamConfig } from './real-time-audio-stream.service';
import { WebSocketTranscriptionServiceImpl } from './websocket-transcription.service';
import { 
  TranscriptionConfig, 
  TranscriptionSession, 
  TranscriptSegment,
  FullTranscript,
  TranscriptionSessionStatus 
} from '../interfaces/transcription.interface';

export interface RealTimeTranscriptionConfig {
  transcriptionConfig: TranscriptionConfig;
  audioStreamConfig: AudioStreamConfig;
  enableRealTimeUpdates: boolean;
  bufferSize: number;
  processingInterval: number;
  autoFinalize: boolean;
  maxSessionDuration: number; // in milliseconds
}

export interface RealTimeTranscriptionSession {
  id: string;
  transcriptionSession: TranscriptionSession;
  audioStreamSessionId: string;
  config: RealTimeTranscriptionConfig;
  status: 'active' | 'paused' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
  segments: TranscriptSegment[];
  lastProcessedTime: number;
  processingBuffer: Buffer[];
  stats: {
    audioChunksReceived: number;
    segmentsGenerated: number;
    averageProcessingTime: number;
    totalAudioDuration: number;
  };
}

@Injectable()
export class RealTimeTranscriptionIntegrationService {
  private readonly logger = new Logger(RealTimeTranscriptionIntegrationService.name);
  private activeSessions = new Map<string, RealTimeTranscriptionSession>();
  private processingIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private transcriptionService: TranscriptionServiceImpl,
    private audioStreamService: RealTimeAudioStreamService,
    private websocketService: WebSocketTranscriptionServiceImpl,
    private eventEmitter: EventEmitter2
  ) {
    this.setupEventListeners();
  }

  async startRealTimeTranscription(
    config: RealTimeTranscriptionConfig,
    audioSource: 'microphone' | 'websocket' | 'buffer',
    sourceData?: any
  ): Promise<RealTimeTranscriptionSession> {
    const sessionId = this.generateSessionId();
    
    try {
      this.logger.log(`Starting real-time transcription session: ${sessionId}`);
      
      // Create audio stream based on source type
      let audioStreamSession;
      switch (audioSource) {
        case 'microphone':
          audioStreamSession = await this.audioStreamService.createAudioStream(config.audioStreamConfig);
          break;
        case 'websocket':
          audioStreamSession = await this.audioStreamService.createStreamFromWebSocket(sourceData, config.audioStreamConfig);
          break;
        case 'buffer':
          audioStreamSession = await this.audioStreamService.createStreamFromBuffer(sourceData, config.audioStreamConfig);
          break;
        default:
          throw new Error(`Unsupported audio source: ${audioSource}`);
      }

      // Start transcription session
      const transcriptionSession = await this.transcriptionService.startTranscription(
        audioStreamSession.stream,
        config.transcriptionConfig
      );

      // Create real-time session
      const rtSession: RealTimeTranscriptionSession = {
        id: sessionId,
        transcriptionSession,
        audioStreamSessionId: audioStreamSession.id,
        config,
        status: 'active',
        startTime: new Date(),
        segments: [],
        lastProcessedTime: Date.now(),
        processingBuffer: [],
        stats: {
          audioChunksReceived: 0,
          segmentsGenerated: 0,
          averageProcessingTime: 0,
          totalAudioDuration: 0
        }
      };

      this.activeSessions.set(sessionId, rtSession);

      // Start processing interval if configured
      if (config.processingInterval > 0) {
        this.startProcessingInterval(sessionId);
      }

      // Set up auto-finalization if configured
      if (config.autoFinalize && config.maxSessionDuration > 0) {
        setTimeout(() => {
          this.finalizeRealTimeTranscription(sessionId).catch(error => {
            this.logger.error(`Auto-finalization failed for session ${sessionId}:`, error);
          });
        }, config.maxSessionDuration);
      }

      // Emit session started event
      this.eventEmitter.emit('realtime.transcription.started', {
        sessionId,
        config,
        timestamp: new Date()
      });

      this.logger.log(`Real-time transcription session ${sessionId} started successfully`);
      return rtSession;

    } catch (error) {
      this.logger.error(`Failed to start real-time transcription session ${sessionId}:`, error);
      throw error;
    }
  }

  async pauseRealTimeTranscription(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Real-time transcription session not found: ${sessionId}`);
    }

    try {
      // Pause audio stream
      await this.audioStreamService.pauseAudioStream(session.audioStreamSessionId);
      
      // Pause transcription
      await this.transcriptionService.pauseTranscription(session.transcriptionSession.sessionId);
      
      // Stop processing interval
      this.stopProcessingInterval(sessionId);
      
      session.status = 'paused';
      
      this.logger.log(`Real-time transcription session ${sessionId} paused`);

    } catch (error) {
      this.logger.error(`Failed to pause real-time transcription session ${sessionId}:`, error);
      throw error;
    }
  }

  async resumeRealTimeTranscription(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Real-time transcription session not found: ${sessionId}`);
    }

    try {
      // Resume audio stream
      await this.audioStreamService.resumeAudioStream(session.audioStreamSessionId);
      
      // Resume transcription
      await this.transcriptionService.resumeTranscription(session.transcriptionSession.sessionId);
      
      // Restart processing interval
      if (session.config.processingInterval > 0) {
        this.startProcessingInterval(sessionId);
      }
      
      session.status = 'active';
      
      this.logger.log(`Real-time transcription session ${sessionId} resumed`);

    } catch (error) {
      this.logger.error(`Failed to resume real-time transcription session ${sessionId}:`, error);
      throw error;
    }
  }

  async finalizeRealTimeTranscription(sessionId: string): Promise<FullTranscript> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Real-time transcription session not found: ${sessionId}`);
    }

    try {
      this.logger.log(`Finalizing real-time transcription session: ${sessionId}`);
      
      // Stop audio stream
      await this.audioStreamService.stopAudioStream(session.audioStreamSessionId);
      
      // Stop processing interval
      this.stopProcessingInterval(sessionId);
      
      // Process any remaining buffer
      await this.processRemainingBuffer(sessionId);
      
      // Finalize transcription
      const transcript = await this.transcriptionService.finalizeTranscript(session.transcriptionSession.sessionId);
      
      session.status = 'completed';
      session.endTime = new Date();
      
      // Emit completion event
      this.eventEmitter.emit('realtime.transcription.completed', {
        sessionId,
        transcript,
        stats: session.stats,
        timestamp: new Date()
      });

      this.logger.log(`Real-time transcription session ${sessionId} finalized`);
      return transcript;

    } catch (error) {
      this.logger.error(`Failed to finalize real-time transcription session ${sessionId}:`, error);
      session.status = 'error';
      throw error;
    }
  }

  async cancelRealTimeTranscription(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Real-time transcription session not found: ${sessionId}`);
    }

    try {
      // Stop audio stream
      await this.audioStreamService.stopAudioStream(session.audioStreamSessionId);
      
      // Cancel transcription
      await this.transcriptionService.cancelTranscription(session.transcriptionSession.sessionId);
      
      // Stop processing interval
      this.stopProcessingInterval(sessionId);
      
      // Clean up session
      this.activeSessions.delete(sessionId);
      
      this.logger.log(`Real-time transcription session ${sessionId} cancelled`);

    } catch (error) {
      this.logger.error(`Failed to cancel real-time transcription session ${sessionId}:`, error);
      throw error;
    }
  }

  getRealTimeSession(sessionId: string): RealTimeTranscriptionSession {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Real-time transcription session not found: ${sessionId}`);
    }
    
    return { ...session };
  }

  getAllActiveSessions(): RealTimeTranscriptionSession[] {
    return Array.from(this.activeSessions.values()).filter(session => session.status === 'active');
  }

  private setupEventListeners(): void {
    // Listen for audio chunks
    this.eventEmitter.on('audio.chunk.received', async (event: { sessionId: string; chunk: Buffer; timestamp: number }) => {
      await this.handleAudioChunk(event.sessionId, event.chunk, event.timestamp);
    });

    // Listen for transcription segments
    this.eventEmitter.on('transcription.segment.processed', (event: { sessionId: string; segment: TranscriptSegment; timestamp: Date }) => {
      this.handleTranscriptionSegment(event.sessionId, event.segment);
    });
  }

  private async handleAudioChunk(audioStreamSessionId: string, chunk: Buffer, timestamp: number): Promise<void> {
    // Find the real-time session that owns this audio stream
    const rtSession = Array.from(this.activeSessions.values())
      .find(session => session.audioStreamSessionId === audioStreamSessionId);
    
    if (!rtSession || rtSession.status !== 'active') {
      return;
    }

    try {
      rtSession.stats.audioChunksReceived++;
      rtSession.processingBuffer.push(chunk);

      // If real-time processing is enabled, process immediately
      if (rtSession.config.enableRealTimeUpdates && rtSession.config.processingInterval === 0) {
        await this.processAudioBuffer(rtSession.id);
      }

    } catch (error) {
      this.logger.error(`Failed to handle audio chunk for session ${rtSession.id}:`, error);
    }
  }

  private handleTranscriptionSegment(transcriptionSessionId: string, segment: TranscriptSegment): void {
    // Find the real-time session that owns this transcription session
    const rtSession = Array.from(this.activeSessions.values())
      .find(session => session.transcriptionSession.sessionId === transcriptionSessionId);
    
    if (!rtSession) {
      return;
    }

    rtSession.segments.push(segment);
    rtSession.stats.segmentsGenerated++;
    
    // Update average processing time
    const totalTime = rtSession.stats.averageProcessingTime * (rtSession.stats.segmentsGenerated - 1) + segment.processingTime;
    rtSession.stats.averageProcessingTime = totalTime / rtSession.stats.segmentsGenerated;

    // Emit real-time segment event
    this.eventEmitter.emit('realtime.segment.generated', {
      sessionId: rtSession.id,
      segment,
      timestamp: new Date()
    });
  }

  private startProcessingInterval(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const interval = setInterval(async () => {
      try {
        await this.processAudioBuffer(sessionId);
      } catch (error) {
        this.logger.error(`Processing interval error for session ${sessionId}:`, error);
      }
    }, session.config.processingInterval);

    this.processingIntervals.set(sessionId, interval);
  }

  private stopProcessingInterval(sessionId: string): void {
    const interval = this.processingIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.processingIntervals.delete(sessionId);
    }
  }

  private async processAudioBuffer(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.processingBuffer.length === 0) {
      return;
    }

    try {
      // Combine buffered chunks
      const combinedBuffer = Buffer.concat(session.processingBuffer);
      session.processingBuffer = [];

      // Check if buffer meets minimum size requirement
      if (combinedBuffer.length >= session.config.bufferSize) {
        // Process the audio chunk
        await this.transcriptionService.processAudioChunk(
          session.transcriptionSession.sessionId,
          combinedBuffer
        );

        session.lastProcessedTime = Date.now();
      } else {
        // Put the buffer back if it's too small
        session.processingBuffer.push(combinedBuffer);
      }

    } catch (error) {
      this.logger.error(`Failed to process audio buffer for session ${sessionId}:`, error);
    }
  }

  private async processRemainingBuffer(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.processingBuffer.length === 0) {
      return;
    }

    try {
      // Process any remaining audio in the buffer
      const remainingBuffer = Buffer.concat(session.processingBuffer);
      session.processingBuffer = [];

      if (remainingBuffer.length > 0) {
        await this.transcriptionService.processAudioChunk(
          session.transcriptionSession.sessionId,
          remainingBuffer
        );
      }

    } catch (error) {
      this.logger.error(`Failed to process remaining buffer for session ${sessionId}:`, error);
    }
  }

  private generateSessionId(): string {
    return `rt_transcription_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  async cleanup(): Promise<void> {
    this.logger.log('Cleaning up real-time transcription integration service...');
    
    // Stop all active sessions
    const activeSessions = Array.from(this.activeSessions.keys());
    for (const sessionId of activeSessions) {
      try {
        await this.cancelRealTimeTranscription(sessionId);
      } catch (error) {
        this.logger.error(`Failed to cancel session ${sessionId} during cleanup:`, error);
      }
    }

    // Clear all intervals
    for (const interval of this.processingIntervals.values()) {
      clearInterval(interval);
    }
    this.processingIntervals.clear();

    this.activeSessions.clear();
    this.logger.log('Real-time transcription integration service cleanup complete');
  }
}