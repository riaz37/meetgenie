import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { 
  WebSocketTranscriptionService, 
  WebSocketTranscriptionMessage, 
  TranscriptSegment, 
  Speaker, 
  TranscriptionStatus, 
  TranscriptionError 
} from '../interfaces/transcription.interface';

interface TranscriptionConnection {
  id: string;
  sessionId: string;
  socket: Socket;
  userId?: string;
  connectedAt: Date;
  lastActivity: Date;
}

@Injectable()
export class WebSocketTranscriptionServiceImpl implements WebSocketTranscriptionService {
  private readonly logger = new Logger(WebSocketTranscriptionServiceImpl.name);
  private io: Server | null = null;
  private connections = new Map<string, TranscriptionConnection>();
  private sessionConnections = new Map<string, Set<string>>(); // sessionId -> connectionIds
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: any): void {
    this.io = new Server(server, {
      cors: {
        origin: process.env['FRONTEND_URL'] || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    this.startHeartbeat();
    
    this.logger.log('WebSocket transcription service initialized');
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      this.logger.debug(`New WebSocket connection: ${socket.id}`);

      socket.on('join_transcription', async (data: { sessionId: string; userId?: string }) => {
        await this.handleJoinTranscription(socket, data);
      });

      socket.on('leave_transcription', async (data: { sessionId: string }) => {
        await this.handleLeaveTranscription(socket, data);
      });

      socket.on('transcription_feedback', (data: { 
        sessionId: string; 
        segmentId: string; 
        feedback: 'correct' | 'incorrect' | 'partial';
        correction?: string;
      }) => {
        this.handleTranscriptionFeedback(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

      socket.on('error', (error) => {
        this.logger.error(`WebSocket error for ${socket.id}:`, error);
      });

      // Send initial connection confirmation
      socket.emit('connection_confirmed', {
        connectionId: socket.id,
        timestamp: new Date()
      });
    });
  }

  private async handleJoinTranscription(socket: Socket, data: { sessionId: string; userId?: string }): Promise<void> {
    try {
      const connectionId = socket.id;
      const connection: TranscriptionConnection = {
        id: connectionId,
        sessionId: data.sessionId,
        socket,
        userId: data.userId,
        connectedAt: new Date(),
        lastActivity: new Date()
      };

      // Store connection
      this.connections.set(connectionId, connection);

      // Add to session connections
      if (!this.sessionConnections.has(data.sessionId)) {
        this.sessionConnections.set(data.sessionId, new Set());
      }
      this.sessionConnections.get(data.sessionId)!.add(connectionId);

      // Join socket room for the session
      socket.join(`transcription_${data.sessionId}`);

      // Send confirmation
      socket.emit('joined_transcription', {
        sessionId: data.sessionId,
        connectionId,
        timestamp: new Date()
      });

      this.logger.debug(`Client ${connectionId} joined transcription session ${data.sessionId}`);

    } catch (error) {
      this.logger.error('Failed to handle join transcription:', error);
      socket.emit('error', {
        message: 'Failed to join transcription session',
        timestamp: new Date()
      });
    }
  }

  private async handleLeaveTranscription(socket: Socket, data: { sessionId: string }): Promise<void> {
    try {
      const connectionId = socket.id;
      
      // Remove from session connections
      const sessionConnections = this.sessionConnections.get(data.sessionId);
      if (sessionConnections) {
        sessionConnections.delete(connectionId);
        if (sessionConnections.size === 0) {
          this.sessionConnections.delete(data.sessionId);
        }
      }

      // Leave socket room
      socket.leave(`transcription_${data.sessionId}`);

      // Send confirmation
      socket.emit('left_transcription', {
        sessionId: data.sessionId,
        connectionId,
        timestamp: new Date()
      });

      this.logger.debug(`Client ${connectionId} left transcription session ${data.sessionId}`);

    } catch (error) {
      this.logger.error('Failed to handle leave transcription:', error);
    }
  }

  private handleTranscriptionFeedback(socket: Socket, data: {
    sessionId: string;
    segmentId: string;
    feedback: 'correct' | 'incorrect' | 'partial';
    correction?: string;
  }): void {
    try {
      // Update connection activity
      const connection = this.connections.get(socket.id);
      if (connection) {
        connection.lastActivity = new Date();
      }

      // Broadcast feedback to other clients in the session (optional)
      socket.to(`transcription_${data.sessionId}`).emit('transcription_feedback_received', {
        segmentId: data.segmentId,
        feedback: data.feedback,
        correction: data.correction,
        timestamp: new Date()
      });

      this.logger.debug(`Received transcription feedback for segment ${data.segmentId}: ${data.feedback}`);

    } catch (error) {
      this.logger.error('Failed to handle transcription feedback:', error);
    }
  }

  private handleDisconnection(socket: Socket): void {
    try {
      const connectionId = socket.id;
      const connection = this.connections.get(connectionId);

      if (connection) {
        // Remove from session connections
        const sessionConnections = this.sessionConnections.get(connection.sessionId);
        if (sessionConnections) {
          sessionConnections.delete(connectionId);
          if (sessionConnections.size === 0) {
            this.sessionConnections.delete(connection.sessionId);
          }
        }

        // Remove connection
        this.connections.delete(connectionId);

        this.logger.debug(`Client ${connectionId} disconnected from session ${connection.sessionId}`);
      }

    } catch (error) {
      this.logger.error('Failed to handle disconnection:', error);
    }
  }

  async createConnection(sessionId: string): Promise<string> {
    // This method is called when a transcription session starts
    // It doesn't create a WebSocket connection directly, but prepares for connections
    
    if (!this.sessionConnections.has(sessionId)) {
      this.sessionConnections.set(sessionId, new Set());
    }

    this.logger.debug(`Prepared transcription session ${sessionId} for WebSocket connections`);
    return sessionId; // Return sessionId as connection identifier
  }

  async sendTranscriptionUpdate(connectionId: string, message: WebSocketTranscriptionMessage): Promise<void> {
    try {
      if (!this.io) {
        throw new Error('WebSocket server not initialized');
      }

      // If connectionId is actually a sessionId, broadcast to all connections in that session
      const sessionConnections = this.sessionConnections.get(connectionId);
      if (sessionConnections && sessionConnections.size > 0) {
        // Broadcast to all clients in the session
        this.io.to(`transcription_${connectionId}`).emit('transcription_update', message);
        
        this.logger.debug(`Sent transcription update to ${sessionConnections.size} clients in session ${connectionId}`);
        return;
      }

      // Try to send to specific connection
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.socket.emit('transcription_update', message);
        connection.lastActivity = new Date();
        
        this.logger.debug(`Sent transcription update to connection ${connectionId}`);
      } else {
        this.logger.warn(`Connection not found: ${connectionId}`);
      }

    } catch (error) {
      this.logger.error(`Failed to send transcription update to ${connectionId}:`, error);
      throw error;
    }
  }

  async closeConnection(connectionId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.socket.disconnect(true);
        this.handleDisconnection(connection.socket);
        
        this.logger.debug(`Closed connection ${connectionId}`);
      }

    } catch (error) {
      this.logger.error(`Failed to close connection ${connectionId}:`, error);
    }
  }

  getActiveConnections(): string[] {
    return Array.from(this.connections.keys());
  }

  async broadcastToSession(sessionId: string, message: WebSocketTranscriptionMessage): Promise<void> {
    try {
      if (!this.io) {
        throw new Error('WebSocket server not initialized');
      }

      this.io.to(`transcription_${sessionId}`).emit('transcription_update', message);
      
      const connectionCount = this.sessionConnections.get(sessionId)?.size || 0;
      this.logger.debug(`Broadcasted message to ${connectionCount} clients in session ${sessionId}`);

    } catch (error) {
      this.logger.error(`Failed to broadcast to session ${sessionId}:`, error);
      throw error;
    }
  }

  // Utility methods
  getSessionConnections(sessionId: string): string[] {
    const connections = this.sessionConnections.get(sessionId);
    return connections ? Array.from(connections) : [];
  }

  getConnectionInfo(connectionId: string): TranscriptionConnection | undefined {
    return this.connections.get(connectionId);
  }

  getSessionStats(sessionId: string): {
    connectionCount: number;
    connections: Array<{
      id: string;
      userId?: string;
      connectedAt: Date;
      lastActivity: Date;
    }>;
  } {
    const connectionIds = this.getSessionConnections(sessionId);
    const connections = connectionIds
      .map(id => this.connections.get(id))
      .filter(conn => conn !== undefined)
      .map(conn => ({
        id: conn!.id,
        userId: conn!.userId,
        connectedAt: conn!.connectedAt,
        lastActivity: conn!.lastActivity
      }));

    return {
      connectionCount: connections.length,
      connections
    };
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, 30000); // 30 seconds
  }

  private performHeartbeat(): void {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [connectionId, connection] of this.connections) {
      const timeSinceActivity = now.getTime() - connection.lastActivity.getTime();
      
      if (timeSinceActivity > staleThreshold) {
        this.logger.warn(`Removing stale connection: ${connectionId}`);
        this.handleDisconnection(connection.socket);
      } else {
        // Send ping to keep connection alive
        connection.socket.emit('ping', { timestamp: now });
      }
    }
  }

  async shutdown(): Promise<void> {
    this.logger.log('Shutting down WebSocket transcription service...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.socket.disconnect(true);
    }

    this.connections.clear();
    this.sessionConnections.clear();

    if (this.io) {
      this.io.close();
      this.io = null;
    }

    this.logger.log('WebSocket transcription service shutdown complete');
  }

  // Helper methods for creating different types of messages
  createSegmentMessage(sessionId: string, segment: TranscriptSegment): WebSocketTranscriptionMessage {
    return {
      type: 'segment',
      sessionId,
      timestamp: new Date(),
      data: segment
    };
  }

  createSpeakerUpdateMessage(sessionId: string, speaker: Speaker): WebSocketTranscriptionMessage {
    return {
      type: 'speaker_update',
      sessionId,
      timestamp: new Date(),
      data: speaker
    };
  }

  createStatusMessage(sessionId: string, status: TranscriptionStatus): WebSocketTranscriptionMessage {
    return {
      type: 'status',
      sessionId,
      timestamp: new Date(),
      data: status
    };
  }

  createErrorMessage(sessionId: string, error: TranscriptionError): WebSocketTranscriptionMessage {
    return {
      type: 'error',
      sessionId,
      timestamp: new Date(),
      data: error
    };
  }
}