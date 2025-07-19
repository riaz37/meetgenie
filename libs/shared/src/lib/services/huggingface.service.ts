import { Injectable, Logger } from '@nestjs/common';
import { HfInference } from '@huggingface/inference';
import { 
  HuggingFaceModelStatus, 
  TranscriptionConfig, 
  TranscriptionError, 
  TranscriptionErrorCode,
  ModelPerformanceMetrics 
} from '../interfaces/transcription.interface';

@Injectable()
export class HuggingFaceService {
  private readonly logger = new Logger(HuggingFaceService.name);
  private hfClient: HfInference;
  private modelStatuses = new Map<string, HuggingFaceModelStatus>();
  private modelPerformance = new Map<string, ModelPerformanceMetrics>();
  private readonly defaultModels = [
    'facebook/wav2vec2-large-960h-lv60-self',
    'facebook/wav2vec2-base-960h',
    'openai/whisper-base',
    'openai/whisper-small'
  ];

  constructor() {
    const apiKey = process.env['HUGGINGFACE_API_KEY'];
    if (!apiKey) {
      this.logger.warn('HUGGINGFACE_API_KEY not found. Some features may be limited.');
    }
    
    this.hfClient = new HfInference(apiKey);
    this.initializeModels();
  }

  private async initializeModels(): Promise<void> {
    this.logger.log('Initializing Hugging Face models...');
    
    for (const modelName of this.defaultModels) {
      try {
        await this.loadModel(modelName);
      } catch (error) {
        this.logger.error(`Failed to initialize model ${modelName}:`, error);
      }
    }
  }

  async loadModel(modelName: string): Promise<HuggingFaceModelStatus> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Loading model: ${modelName}`);
      
      // Update status to loading
      this.modelStatuses.set(modelName, {
        modelName,
        status: 'loading',
        isLocal: false,
        apiEndpoint: `https://api-inference.huggingface.co/models/${modelName}`
      });

      // Test the model with a small audio sample to ensure it's ready
      const testBuffer = Buffer.alloc(1024); // Small test buffer
      await this.transcribeAudio(testBuffer, { modelName } as TranscriptionConfig);
      
      const loadTime = Date.now() - startTime;
      const status: HuggingFaceModelStatus = {
        modelName,
        status: 'ready',
        loadTime,
        lastUsed: new Date(),
        isLocal: false,
        apiEndpoint: `https://api-inference.huggingface.co/models/${modelName}`
      };
      
      this.modelStatuses.set(modelName, status);
      this.initializeModelPerformance(modelName);
      
      this.logger.log(`Model ${modelName} loaded successfully in ${loadTime}ms`);
      return status;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const status: HuggingFaceModelStatus = {
        modelName,
        status: 'error',
        errorMessage,
        isLocal: false,
        apiEndpoint: `https://api-inference.huggingface.co/models/${modelName}`
      };
      
      this.modelStatuses.set(modelName, status);
      this.logger.error(`Failed to load model ${modelName}:`, error);
      throw error;
    }
  }

  private initializeModelPerformance(modelName: string): void {
    if (!this.modelPerformance.has(modelName)) {
      this.modelPerformance.set(modelName, {
        modelName,
        averageLatency: 0,
        successRate: 0,
        errorRate: 0,
        averageConfidence: 0,
        usageCount: 0,
        totalProcessingTime: 0
      });
    }
  }

  async transcribeAudio(audioBuffer: Buffer, config: TranscriptionConfig): Promise<{
    text: string;
    confidence: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const modelName = config.modelName || this.defaultModels[0];
    
    try {
      // Check if model is available
      const modelStatus = await this.getModelStatus(modelName);
      if (modelStatus.status !== 'ready') {
        throw new Error(`Model ${modelName} is not ready. Status: ${modelStatus.status}`);
      }

      this.logger.debug(`Transcribing audio with model: ${modelName}`);
      
      // Convert buffer to blob for Hugging Face API
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      
      // Call Hugging Face Inference API
      const result = await this.hfClient.automaticSpeechRecognition({
        data: audioBlob,
        model: modelName
      });

      const processingTime = Date.now() - startTime;
      
      // Update model performance metrics
      this.updateModelPerformance(modelName, processingTime, true, 0.9); // Default confidence
      
      // Update model last used time
      const status = this.modelStatuses.get(modelName);
      if (status) {
        status.lastUsed = new Date();
        this.modelStatuses.set(modelName, status);
      }

      this.logger.debug(`Transcription completed in ${processingTime}ms`);
      
      return {
        text: result.text || '',
        confidence: 0.9, // Hugging Face doesn't provide confidence scores directly
        processingTime
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateModelPerformance(modelName, processingTime, false, 0);
      
      this.logger.error(`Transcription failed for model ${modelName}:`, error);
      
      // Try fallback models
      const fallbackModels = this.getFallbackModels(modelName);
      if (fallbackModels.length > 0) {
        this.logger.log(`Trying fallback model: ${fallbackModels[0]}`);
        return this.transcribeAudio(audioBuffer, { ...config, modelName: fallbackModels[0] });
      }
      
      throw this.createTranscriptionError(error, modelName);
    }
  }

  private updateModelPerformance(
    modelName: string, 
    processingTime: number, 
    success: boolean, 
    confidence: number
  ): void {
    const performance = this.modelPerformance.get(modelName);
    if (!performance) return;

    performance.usageCount++;
    performance.totalProcessingTime += processingTime;
    performance.averageLatency = performance.totalProcessingTime / performance.usageCount;
    
    if (success) {
      performance.successRate = (performance.successRate * (performance.usageCount - 1) + 1) / performance.usageCount;
      performance.averageConfidence = (performance.averageConfidence * (performance.usageCount - 1) + confidence) / performance.usageCount;
    } else {
      performance.errorRate = (performance.errorRate * (performance.usageCount - 1) + 1) / performance.usageCount;
    }
    
    this.modelPerformance.set(modelName, performance);
  }

  private getFallbackModels(currentModel: string): string[] {
    return this.defaultModels.filter(model => 
      model !== currentModel && 
      this.modelStatuses.get(model)?.status === 'ready'
    );
  }

  private createTranscriptionError(error: unknown, modelName: string): TranscriptionError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    let errorCode = TranscriptionErrorCode.UNKNOWN_ERROR;
    let retryable = true;
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      errorCode = TranscriptionErrorCode.RATE_LIMIT_EXCEEDED;
      retryable = true;
    } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      errorCode = TranscriptionErrorCode.NETWORK_ERROR;
      retryable = true;
    } else if (errorMessage.includes('model') || errorMessage.includes('unavailable')) {
      errorCode = TranscriptionErrorCode.MODEL_UNAVAILABLE;
      retryable = false;
    } else if (errorMessage.includes('audio') || errorMessage.includes('format')) {
      errorCode = TranscriptionErrorCode.INVALID_AUDIO_FORMAT;
      retryable = false;
    }

    return {
      code: errorCode,
      message: errorMessage,
      timestamp: new Date(),
      sessionId: '', // Will be set by caller
      modelName,
      retryable,
      details: { originalError: error }
    };
  }

  async getModelStatus(modelName?: string): Promise<HuggingFaceModelStatus> {
    if (modelName) {
      const status = this.modelStatuses.get(modelName);
      if (!status) {
        // Try to load the model if it's not loaded
        return this.loadModel(modelName);
      }
      return status;
    }
    
    // Return status of primary model
    const primaryModel = this.defaultModels[0];
    return this.getModelStatus(primaryModel);
  }

  async getAllModelStatuses(): Promise<HuggingFaceModelStatus[]> {
    return Array.from(this.modelStatuses.values());
  }

  getModelPerformance(modelName: string): ModelPerformanceMetrics | undefined {
    return this.modelPerformance.get(modelName);
  }

  getAllModelPerformance(): ModelPerformanceMetrics[] {
    return Array.from(this.modelPerformance.values());
  }

  async switchModel(fromModel: string, toModel: string): Promise<void> {
    this.logger.log(`Switching from model ${fromModel} to ${toModel}`);
    
    // Ensure target model is loaded and ready
    const targetStatus = await this.getModelStatus(toModel);
    if (targetStatus.status !== 'ready') {
      await this.loadModel(toModel);
    }
    
    this.logger.log(`Successfully switched to model ${toModel}`);
  }

  getAvailableModels(): string[] {
    return Array.from(this.modelStatuses.keys()).filter(
      modelName => this.modelStatuses.get(modelName)?.status === 'ready'
    );
  }

  getBestPerformingModel(): string {
    let bestModel = this.defaultModels[0];
    let bestScore = 0;
    
    for (const [modelName, performance] of this.modelPerformance) {
      // Calculate composite score based on success rate, confidence, and latency
      const score = (performance.successRate * 0.4) + 
                   (performance.averageConfidence * 0.4) + 
                   ((1000 / Math.max(performance.averageLatency, 1)) * 0.2);
      
      if (score > bestScore) {
        bestScore = score;
        bestModel = modelName;
      }
    }
    
    return bestModel;
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      totalModels: number;
      readyModels: number;
      errorModels: number;
      averageLatency: number;
    };
  }> {
    const statuses = Array.from(this.modelStatuses.values());
    const readyModels = statuses.filter(s => s.status === 'ready').length;
    const errorModels = statuses.filter(s => s.status === 'error').length;
    
    const performances = Array.from(this.modelPerformance.values());
    const averageLatency = performances.length > 0 
      ? performances.reduce((sum, p) => sum + p.averageLatency, 0) / performances.length 
      : 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (readyModels === 0) {
      status = 'unhealthy';
    } else if (errorModels > readyModels || averageLatency > 5000) {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        totalModels: statuses.length,
        readyModels,
        errorModels,
        averageLatency
      }
    };
  }

  async cleanup(): Promise<void> {
    this.logger.log('Cleaning up Hugging Face service...');
    this.modelStatuses.clear();
    this.modelPerformance.clear();
  }
}