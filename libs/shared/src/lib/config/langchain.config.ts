import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LangChainConfig, GeminiSafetySettings } from '../interfaces/langchain.interface';

@Injectable()
export class LangChainConfigService {
  constructor(private readonly configService: ConfigService) {}

  getLangChainConfig(): LangChainConfig {
    return {
      googleApiKey: this.configService.get<string>('GOOGLE_AI_API_KEY') || '',
      langSmithApiKey: this.configService.get<string>('LANGSMITH_API_KEY'),
      langSmithProjectName: this.configService.get<string>('LANGSMITH_PROJECT_NAME') || 'meetgenie-ai',
      defaultModel: this.configService.get<string>('DEFAULT_AI_MODEL') || 'gemini-pro',
      temperature: parseFloat(this.configService.get<string>('AI_TEMPERATURE') || '0.7'),
      maxTokens: parseInt(this.configService.get<string>('AI_MAX_TOKENS') || '2048'),
      topP: parseFloat(this.configService.get<string>('AI_TOP_P') || '0.8'),
      topK: parseInt(this.configService.get<string>('AI_TOP_K') || '40'),
      safetySettings: this.getSafetySettings()
    };
  }

  private getSafetySettings(): GeminiSafetySettings[] {
    return [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ];
  }

  validateConfig(): boolean {
    const config = this.getLangChainConfig();
    
    if (!config.googleApiKey) {
      throw new Error('GOOGLE_AI_API_KEY is required for LangChain configuration');
    }

    if (config.temperature < 0 || config.temperature > 1) {
      throw new Error('AI_TEMPERATURE must be between 0 and 1');
    }

    if (config.maxTokens < 1 || config.maxTokens > 8192) {
      throw new Error('AI_MAX_TOKENS must be between 1 and 8192');
    }

    if (config.topP < 0 || config.topP > 1) {
      throw new Error('AI_TOP_P must be between 0 and 1');
    }

    if (config.topK < 1 || config.topK > 100) {
      throw new Error('AI_TOP_K must be between 1 and 100');
    }

    return true;
  }

  getModelConfigurations() {
    return {
      'gemini-pro': {
        maxTokens: 2048,
        supportedFeatures: ['text', 'chat', 'function_calling'],
        costPer1KTokens: {
          input: 0.00025,
          output: 0.0005
        }
      },
      'gemini-pro-1.5': {
        maxTokens: 8192,
        supportedFeatures: ['text', 'chat', 'function_calling', 'multimodal'],
        costPer1KTokens: {
          input: 0.00025,
          output: 0.0005
        }
      }
    };
  }

  getOptimalConfigForWorkflow(workflowType: string) {
    const baseConfig = this.getLangChainConfig();
    
    switch (workflowType) {
      case 'meeting_summarization':
        return {
          ...baseConfig,
          temperature: 0.3,
          maxTokens: 2048,
          topP: 0.9
        };
      
      case 'qa_processing':
        return {
          ...baseConfig,
          temperature: 0.2,
          maxTokens: 1024,
          topP: 0.8
        };
      
      case 'action_item_extraction':
        return {
          ...baseConfig,
          temperature: 0.1,
          maxTokens: 1024,
          topP: 0.7
        };
      
      case 'sentiment_analysis':
        return {
          ...baseConfig,
          temperature: 0.4,
          maxTokens: 512,
          topP: 0.8
        };
      
      default:
        return baseConfig;
    }
  }
}