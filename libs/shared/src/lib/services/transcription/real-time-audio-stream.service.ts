import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Readable, Transform } from 'stream';
import * as mic from 'mic';

export interface AudioStreamConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  chunkSize: number;
  device?: string;
  enableEchoCancellation: boolean;
  enableNoiseReduction: boolean;
}

export interface AudioStreamSession {
  id: string;
  config: AudioStreamConfig;
  stream: Readable;
  isActive: boolean;
  startTime: Date;
  endTime?: Date;
  bytesProcessed: number;
  chunksProcessed: number;
}

@Injectable()
export class RealTimeAudioStreamService {
  private readonly logger = new Logger(RealTimeAudioStreamService.name);
  private activeSessions = new Map<string, AudioStreamSession>();
  private micInstance: any = null;

  constructor(private eventEmitter: EventEmitter2) {}

  async createAudioStream(config: AudioStreamConfig): Promise<AudioStreamSession> {
    const sessionId = this.generateSessionId();
    
    try {
      this.logger.log(`Creating audio stream session: ${sessionId}`);
      
      // Create microphone instance
      const micInstance = mic({
        rate: config.sampleRate.toString(),
        channels: config.channels.toString(),
        debug: false,
        exitOnSilence: 0,
        device: config.device || 'default'
      });

      // Get the audio stream
      const micInputStream = micInstance.getAudioStream();
      
      // Create a transform stream to handle chunking
      const chunkTransform = new Transform({
        transform(chunk, encoding, callback) {
          // Process audio chunk
          this.push(chunk);
          callback();
        }
      });

      // Create readable stream
      const audioStream = new Readable({
        read() {
          // This will be fed by the microphone input
        }
      });

      // Pipe microphone input through transform to readable stream
      micInputStream.pipe(chunkTransform);
      
      chunkTransform.on('data', (chunk: Buffer) => {
        audioStream.push(chunk);
        
        // Update session stats
        const session = this.activeSessions.get(sessionId);
        if (session) {
          session.bytesProcessed += chunk.length;
          session.chunksProcessed++;
        }

        // Emit audio chunk event
        this.eventEmitter.emit('audio.chunk.received', {
          sessionId,
          chunk,
          timestamp: Date.now()
        });
      });

      chunkTransform.on('end', () => {
        audioStream.push(null);
        this.logger.debug(`Audio stream ended for session: ${sessionId}`);
      });

      chunkTransform.on('error', (error) => {
        this.logger.error(`Audio stream error for session ${sessionId}:`, error);
        audioStream.destroy(error);
      });

      // Create session
      const session: AudioStreamSession = {
        id: sessionId,
        config,
        stream: audioStream,
        isActive: true,
        startTime: new Date(),
        bytesProcessed: 0,
        chunksProcessed: 0
      };

      this.activeSessions.set(sessionId, session);
      this.micInstance = micInstance;

      // Start recording
      micInstance.start();

      this.logger.log(`Audio stream session ${sessionId} created and started`);
      return session;

    } catch (error) {
      this.logger.error(`Failed to create audio stream session ${sessionId}:`, error);
      throw error;
    }
  }

  async createStreamFromBuffer(audioBuffer: Buffer, config: AudioStreamConfig): Promise<AudioStreamSession> {
    const sessionId = this.generateSessionId();
    
    try {
      this.logger.log(`Creating buffer-based audio stream session: ${sessionId}`);
      
      // Create readable stream from buffer
      const audioStream = new Readable({
        read() {
          // Will be fed by chunks from the buffer
        }
      });

      // Create session
      const session: AudioStreamSession = {
        id: sessionId,
        config,
        stream: audioStream,
        isActive: true,
        startTime: new Date(),
        bytesProcessed: 0,
        chunksProcessed: 0
      };

      this.activeSessions.set(sessionId, session);

      // Process buffer in chunks
      this.processBufferInChunks(audioBuffer, session);

      this.logger.log(`Buffer-based audio stream session ${sessionId} created`);
      return session;

    } catch (error) {
      this.logger.error(`Failed to create buffer-based audio stream session ${sessionId}:`, error);
      throw error;
    }
  }

  async createStreamFromWebSocket(websocket: any, config: AudioStreamConfig): Promise<AudioStreamSession> {
    const sessionId = this.generateSessionId();
    
    try {
      this.logger.log(`Creating WebSocket-based audio stream session: ${sessionId}`);
      
      // Create readable stream
      const audioStream = new Readable({
        read() {
          // Will be fed by WebSocket messages
        }
      });

      // Create session
      const session: AudioStreamSession = {
        id: sessionId,
        config,
        stream: audioStream,
        isActive: true,
        startTime: new Date(),
        bytesProcessed: 0,
        chunksProcessed: 0
      };

      this.activeSessions.set(sessionId, session);

      // Handle WebSocket messages
      websocket.on('message', (data: Buffer) => {
        if (session.isActive) {
          audioStream.push(data);
          session.bytesProcessed += data.length;
          session.chunksProcessed++;

          // Emit audio chunk event
          this.eventEmitter.emit('audio.chunk.received', {
            sessionId,
            chunk: data,
            timestamp: Date.now()
          });
        }
      });

      websocket.on('close', () => {
        this.logger.debug(`WebSocket closed for audio stream session: ${sessionId}`);
        this.stopAudioStream(sessionId);
      });

      websocket.on('error', (error: Error) => {
        this.logger.error(`WebSocket error for audio stream session ${sessionId}:`, error);
        audioStream.destroy(error);
      });

      this.logger.log(`WebSocket-based audio stream session ${sessionId} created`);
      return session;

    } catch (error) {
      this.logger.error(`Failed to create WebSocket-based audio stream session ${sessionId}:`, error);
      throw error;
    }
  }

  async stopAudioStream(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Audio stream session not found: ${sessionId}`);
    }

    try {
      this.logger.log(`Stopping audio stream session: ${sessionId}`);
      
      session.isActive = false;
      session.endTime = new Date();
      
      // Stop microphone if it's a mic-based session
      if (this.micInstance) {
        this.micInstance.stop();
        this.micInstance = null;
      }

      // End the stream
      session.stream.push(null);

      // Emit session ended event
      this.eventEmitter.emit('audio.stream.ended', {
        sessionId,
        duration: session.endTime.getTime() - session.startTime.getTime(),
        bytesProcessed: session.bytesProcessed,
        chunksProcessed: session.chunksProcessed,
        timestamp: new Date()
      });

      this.logger.log(`Audio stream session ${sessionId} stopped`);

    } catch (error) {
      this.logger.error(`Failed to stop audio stream session ${sessionId}:`, error);
      throw error;
    }
  }

  async pauseAudioStream(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Audio stream session not found: ${sessionId}`);
    }

    session.isActive = false;
    
    if (this.micInstance) {
      this.micInstance.pause();
    }

    this.logger.log(`Audio stream session ${sessionId} paused`);
  }

  async resumeAudioStream(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Audio stream session not found: ${sessionId}`);
    }

    session.isActive = true;
    
    if (this.micInstance) {
      this.micInstance.resume();
    }

    this.logger.log(`Audio stream session ${sessionId} resumed`);
  }

  getAudioStream(sessionId: string): Readable {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Audio stream session not found: ${sessionId}`);
    }

    return session.stream;
  }

  getSessionInfo(sessionId: string): AudioStreamSession {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Audio stream session not found: ${sessionId}`);
    }

    return { ...session };
  }

  getAllActiveSessions(): AudioStreamSession[] {
    return Array.from(this.activeSessions.values()).filter(session => session.isActive);
  }

  async cleanup(): Promise<void> {
    this.logger.log('Cleaning up audio stream service...');
    
    // Stop all active sessions
    const activeSessions = Array.from(this.activeSessions.keys());
    for (const sessionId of activeSessions) {
      try {
        await this.stopAudioStream(sessionId);
      } catch (error) {
        this.logger.error(`Failed to stop session ${sessionId} during cleanup:`, error);
      }
    }

    // Stop microphone
    if (this.micInstance) {
      this.micInstance.stop();
      this.micInstance = null;
    }

    this.activeSessions.clear();
    this.logger.log('Audio stream service cleanup complete');
  }

  private processBufferInChunks(buffer: Buffer, session: AudioStreamSession): void {
    const chunkSize = session.config.chunkSize;
    let offset = 0;

    const processNextChunk = () => {
      if (offset >= buffer.length || !session.isActive) {
        // End of buffer or session stopped
        session.stream.push(null);
        return;
      }

      const chunk = buffer.slice(offset, Math.min(offset + chunkSize, buffer.length));
      session.stream.push(chunk);
      
      session.bytesProcessed += chunk.length;
      session.chunksProcessed++;

      // Emit audio chunk event
      this.eventEmitter.emit('audio.chunk.received', {
        sessionId: session.id,
        chunk,
        timestamp: Date.now()
      });

      offset += chunkSize;

      // Schedule next chunk processing
      setImmediate(processNextChunk);
    };

    // Start processing
    processNextChunk();
  }

  private generateSessionId(): string {
    return `audio_stream_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}