import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TranscriptionServiceImpl } from './transcription.service';
import { HuggingFaceService } from './huggingface.service';
import { AudioPreprocessingServiceImpl } from './audio-preprocessing.service';
import { SpeakerDiarizationServiceImpl } from './speaker-diarization.service';
import { WebSocketTranscriptionServiceImpl } from './websocket-transcription.service';
import { InngestFunctionsService } from './inngest-functions.service';
import { TranscriptionConfig, TranscriptionSessionStatus } from '../interfaces/transcription.interface';
import { Readable } from 'stream';

describe('TranscriptionServiceImpl', () => {
  let service: TranscriptionServiceImpl;
  let huggingFaceService: jest.Mocked<HuggingFaceService>;
  let audioPreprocessingService: jest.Mocked<AudioPreprocessingServiceImpl>;
  let speakerDiarizationService: jest.Mocked<SpeakerDiarizationServiceImpl>;
  let websocketService: jest.Mocked<WebSocketTranscriptionServiceImpl>;
  let inngestService: jest.Mocked<InngestFunctionsService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockHuggingFaceService = {
      getModelStatus: jest.fn(),
      loadModel: jest.fn(),
      transcribeAudio: jest.fn(),
      healthCheck: jest.fn(),
      getAllModelStatuses: jest.fn(),
      switchModel: jest.fn()
    };

    const mockAudioPreprocessingService = {
      preprocessAudio: jest.fn()
    };

    const mockSpeakerDiarizationService = {
      diarizeAudio: jest.fn(),
      identifySpeaker: jest.fn()
    };

    const mockWebSocketService = {
      createConnection: jest.fn(),
      sendTranscriptionUpdate: jest.fn(),
      closeConnection: jest.fn(),
      createSegmentMessage: jest.fn(),
      createStatusMessage: jest.fn()
    };

    const mockInngestService = {
      scheduleTranscriptionPostProcessing: jest.fn()
    };

    const mockEventEmitter = {
      emit: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptionServiceImpl,
        { provide: HuggingFaceService, useValue: mockHuggingFaceService },
        { provide: AudioPreprocessingServiceImpl, useValue: mockAudioPreprocessingService },
        { provide: SpeakerDiarizationServiceImpl, useValue: mockSpeakerDiarizationService },
        { provide: WebSocketTranscriptionServiceImpl, useValue: mockWebSocketService },
        { provide: InngestFunctionsService, useValue: mockInngestService },
        { provide: EventEmitter2, useValue: mockEventEmitter }
      ],
    }).compile();

    service = module.get<TranscriptionServiceImpl>(TranscriptionServiceImpl);
    huggingFaceService = module.get(HuggingFaceService);
    audioPreprocessingService = module.get(AudioPreprocessingServiceImpl);
    speakerDiarizationService = module.get(SpeakerDiarizationServiceImpl);
    websocketService = module.get(WebSocketTranscriptionServiceImpl);
    inngestService = module.get(InngestFunctionsService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startTranscription', () => {
    it('should start a transcription session successfully', async () => {
      // Arrange
      const config: TranscriptionConfig = {
        modelName: 'facebook/wav2vec2-large-960h-lv60-self',
        language: 'en',
        enableSpeakerDiarization: true,
        chunkSize: 1024 * 16,
        overlapSize: 1024 * 2,
        confidenceThreshold: 0.7,
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16
      };

      const audioStream = new Readable({
        read() {
          this.push(null); // End stream immediately for test
        }
      });

      huggingFaceService.getModelStatus.mockResolvedValue({
        modelName: config.modelName,
        status: 'ready',
        isLocal: false
      });

      websocketService.createConnection.mockResolvedValue('websocket-123');
      websocketService.createStatusMessage.mockReturnValue({
        type: 'status',
        sessionId: 'session-123',
        timestamp: new Date(),
        data: 'processing' as any
      });

      // Act
      const session = await service.startTranscription(audioStream, config);

      // Assert
      expect(session).toBeDefined();
      expect(session.config).toEqual(expect.objectContaining(config));
      expect(session.status).toBe(TranscriptionSessionStatus.ACTIVE);
      expect(huggingFaceService.getModelStatus).toHaveBeenCalledWith(config.modelName);
      expect(websocketService.createConnection).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('transcription.session.started', expect.any(Object));
    });

    it('should load model if not ready', async () => {
      // Arrange
      const config: TranscriptionConfig = {
        modelName: 'facebook/wav2vec2-large-960h-lv60-self',
        language: 'en',
        enableSpeakerDiarization: false,
        chunkSize: 1024 * 16,
        overlapSize: 1024 * 2,
        confidenceThreshold: 0.7,
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16
      };

      const audioStream = new Readable({
        read() {
          this.push(null);
        }
      });

      huggingFaceService.getModelStatus.mockResolvedValue({
        modelName: config.modelName,
        status: 'loading',
        isLocal: false
      });

      huggingFaceService.loadModel.mockResolvedValue({
        modelName: config.modelName,
        status: 'ready',
        isLocal: false
      });

      websocketService.createConnection.mockResolvedValue('websocket-123');
      websocketService.createStatusMessage.mockReturnValue({
        type: 'status',
        sessionId: 'session-123',
        timestamp: new Date(),
        data: 'processing' as any
      });

      // Act
      const session = await service.startTranscription(audioStream, config);

      // Assert
      expect(huggingFaceService.loadModel).toHaveBeenCalledWith(config.modelName);
      expect(session.status).toBe(TranscriptionSessionStatus.ACTIVE);
    });
  });

  describe('processAudioChunk', () => {
    it('should process audio chunk and return transcript segment', async () => {
      // Arrange
      const audioChunk = Buffer.from('fake-audio-data');
      
      // Create a mock session first
      const config: TranscriptionConfig = {
        modelName: 'facebook/wav2vec2-large-960h-lv60-self',
        language: 'en',
        enableSpeakerDiarization: false,
        chunkSize: 1024 * 16,
        overlapSize: 1024 * 2,
        confidenceThreshold: 0.7,
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16
      };

      const audioStream = new Readable({
        read() {
          this.push(null);
        }
      });

      huggingFaceService.getModelStatus.mockResolvedValue({
        modelName: config.modelName,
        status: 'ready',
        isLocal: false
      });

      websocketService.createConnection.mockResolvedValue('websocket-123');
      websocketService.createStatusMessage.mockReturnValue({
        type: 'status',
        sessionId: 'test-session',
        timestamp: new Date(),
        data: 'processing' as any
      });

      // Start session first and get the actual session ID
      const session = await service.startTranscription(audioStream, config);
      const sessionId = session.sessionId;

      // Mock preprocessing and transcription
      audioPreprocessingService.preprocessAudio.mockResolvedValue({
        processedAudio: audioChunk,
        originalSize: audioChunk.length,
        processedSize: audioChunk.length,
        sampleRate: 16000,
        channels: 1,
        duration: 1000,
        qualityScore: 0.8,
        enhancements: []
      });

      huggingFaceService.transcribeAudio.mockResolvedValue({
        text: 'Hello world',
        confidence: 0.9,
        processingTime: 100
      });

      websocketService.createSegmentMessage.mockReturnValue({
        type: 'segment',
        sessionId,
        timestamp: new Date(),
        data: {} as any
      });

      // Act
      const segment = await service.processAudioChunk(sessionId, audioChunk);

      // Assert
      expect(segment).toBeDefined();
      expect(segment.text).toBe('Hello world');
      expect(segment.confidence).toBe(0.9);
      expect(audioPreprocessingService.preprocessAudio).toHaveBeenCalledWith(audioChunk, expect.any(Object));
      expect(huggingFaceService.transcribeAudio).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('transcription.segment.processed', expect.any(Object));
    });
  });

  describe('finalizeTranscript', () => {
    it('should finalize transcript and schedule post-processing', async () => {
      // Arrange
      // Create a session first
      const config: TranscriptionConfig = {
        modelName: 'facebook/wav2vec2-large-960h-lv60-self',
        language: 'en',
        enableSpeakerDiarization: false,
        chunkSize: 1024 * 16,
        overlapSize: 1024 * 2,
        confidenceThreshold: 0.7,
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16
      };

      const audioStream = new Readable({
        read() {
          this.push(null);
        }
      });

      huggingFaceService.getModelStatus.mockResolvedValue({
        modelName: config.modelName,
        status: 'ready',
        isLocal: false
      });

      websocketService.createConnection.mockResolvedValue('websocket-123');
      websocketService.createStatusMessage.mockReturnValue({
        type: 'status',
        sessionId: 'test-session',
        timestamp: new Date(),
        data: 'processing' as any
      });

      // Start session and get actual session ID
      const session = await service.startTranscription(audioStream, config);
      const sessionId = session.sessionId;

      websocketService.sendTranscriptionUpdate.mockResolvedValue();
      inngestService.scheduleTranscriptionPostProcessing.mockResolvedValue();

      // Act
      const transcript = await service.finalizeTranscript(sessionId);

      // Assert
      expect(transcript).toBeDefined();
      expect(transcript.sessionId).toBe(sessionId);
      expect(inngestService.scheduleTranscriptionPostProcessing).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('transcription.session.completed', expect.any(Object));
    });
  });

  describe('getModelStatus', () => {
    it('should return model status', async () => {
      // Arrange
      const modelName = 'facebook/wav2vec2-large-960h-lv60-self';
      const expectedStatus = {
        modelName,
        status: 'ready' as const,
        isLocal: false
      };

      huggingFaceService.getModelStatus.mockResolvedValue(expectedStatus);

      // Act
      const statuses = await service.getModelStatus(modelName);

      // Assert
      expect(statuses).toEqual([expectedStatus]);
      expect(huggingFaceService.getModelStatus).toHaveBeenCalledWith(modelName);
    });

    it('should return all model statuses when no model name provided', async () => {
      // Arrange
      const expectedStatuses = [
        { modelName: 'model1', status: 'ready' as const, isLocal: false },
        { modelName: 'model2', status: 'loading' as const, isLocal: false }
      ];

      huggingFaceService.getAllModelStatuses.mockResolvedValue(expectedStatuses);

      // Act
      const statuses = await service.getModelStatus();

      // Assert
      expect(statuses).toEqual(expectedStatuses);
      expect(huggingFaceService.getAllModelStatuses).toHaveBeenCalled();
    });
  });
});