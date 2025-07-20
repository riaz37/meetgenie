import { Injectable, Logger } from '@nestjs/common';
import {
  RetryConfig,
  AIRetryHandlerService,
  LangChainError,
  LangChainErrorCode
} from '../interfaces/langchain.interface';

@Injectable()
export class AIRetryHandlerService implements AIRetryHandlerService {
  private readonly logger = new Logger(AIRetryHandlerService.name);
  
  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    retryableErrors: [
      LangChainErrorCode.RATE_LIMIT,
      LangChainErrorCode.TIMEOUT,
      LangChainErrorCode.API_ERROR
    ]
  };

  constructor() {
    this.logger.log('AI Retry Handler Service initialized');
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = this.defaultRetryConfig,
    context?: string
  ): Promise<T> {
    let lastError: Error;
    const mergedConfig = { ...this.defaultRetryConfig, ...config };
    
    for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.getRetryDelay(attempt, mergedConfig);
          this.logger.debug(`Retrying operation (attempt ${attempt}/${mergedConfig.maxRetries}) after ${delay}ms delay${context ? ` - ${context}` : ''}`);
          await this.sleep(delay);
        }

        const result = await operation();
        
        if (attempt > 0) {
          this.logger.log(`Operation succeeded on attempt ${attempt + 1}${context ? ` - ${context}` : ''}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (!this.isRetryableError(error) || attempt === mergedConfig.maxRetries) {
          if (attempt === mergedConfig.maxRetries) {
            this.logger.error(`Operation failed after ${mergedConfig.maxRetries + 1} attempts${context ? ` - ${context}` : ''}:`, error);
          } else {
            this.logger.error(`Operation failed with non-retryable error${context ? ` - ${context}` : ''}:`, error);
          }
          throw error;
        }

        this.logger.warn(`Operation failed on attempt ${attempt + 1}, will retry${context ? ` - ${context}` : ''}:`, error.message);
      }
    }

    throw lastError!;
  }

  isRetryableError(error: any): boolean {
    // Check if it's a LangChain error with retryable flag
    if (error.retryable !== undefined) {
      return error.retryable;
    }

    // Check error code
    if (error.code && this.defaultRetryConfig.retryableErrors.includes(error.code)) {
      return true;
    }

    // Check error message patterns
    const errorMessage = error.message?.toLowerCase() || '';
    
    // Rate limiting errors
    if (errorMessage.includes('rate limit') || 
        errorMessage.includes('quota exceeded') ||
        errorMessage.includes('too many requests') ||
        error.status === 429) {
      return true;
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('timed out') ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET') {
      return true;
    }

    // Network errors
    if (errorMessage.includes('network') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('enotfound') ||
        errorMessage.includes('econnrefused') ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED') {
      return true;
    }

    // Server errors (5xx)
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // Google API specific errors
    if (errorMessage.includes('internal error') ||
        errorMessage.includes('service unavailable') ||
        errorMessage.includes('backend error')) {
      return true;
    }

    // LangChain specific errors
    if (errorMessage.includes('model overloaded') ||
        errorMessage.includes('model unavailable')) {
      return true;
    }

    return false;
  }

  getRetryDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff with jitter
    const baseDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 0.1 * baseDelay; // Add up to 10% jitter
    const delay = Math.min(baseDelay + jitter, config.maxDelay);
    
    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Specialized retry methods for different types of operations

  async retryLLMCall<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    const config: RetryConfig = {
      maxRetries: 5,
      baseDelay: 2000,
      maxDelay: 60000,
      backoffMultiplier: 2,
      retryableErrors: [
        LangChainErrorCode.RATE_LIMIT,
        LangChainErrorCode.TIMEOUT,
        LangChainErrorCode.API_ERROR
      ]
    };

    return this.executeWithRetry(operation, config, context);
  }

  async retryWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitBreakerKey: string,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    // Simple circuit breaker implementation
    const circuitState = this.getCircuitState(circuitBreakerKey);
    
    if (circuitState.isOpen) {
      if (Date.now() - circuitState.lastFailure < circuitState.timeout) {
        throw new Error(`Circuit breaker is open for ${circuitBreakerKey}`);
      } else {
        // Half-open state - try one request
        circuitState.isOpen = false;
        circuitState.halfOpen = true;
      }
    }

    try {
      const result = await this.executeWithRetry(operation, config);
      
      // Success - reset circuit breaker
      if (circuitState.halfOpen) {
        circuitState.halfOpen = false;
        circuitState.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      circuitState.failureCount++;
      circuitState.lastFailure = Date.now();
      
      if (circuitState.failureCount >= 5) {
        circuitState.isOpen = true;
        circuitState.timeout = 60000; // 1 minute
        this.logger.warn(`Circuit breaker opened for ${circuitBreakerKey}`);
      }
      
      throw error;
    }
  }

  async retryWithBackpressure<T>(
    operation: () => Promise<T>,
    maxConcurrent: number = 5,
    context?: string
  ): Promise<T> {
    // Simple backpressure implementation
    const activeRequests = this.getActiveRequestCount();
    
    if (activeRequests >= maxConcurrent) {
      const delay = Math.random() * 5000; // Random delay up to 5 seconds
      this.logger.debug(`Applying backpressure, delaying request by ${delay}ms`);
      await this.sleep(delay);
    }

    this.incrementActiveRequests();
    
    try {
      return await this.executeWithRetry(operation, undefined, context);
    } finally {
      this.decrementActiveRequests();
    }
  }

  // Utility methods for error analysis and reporting

  analyzeError(error: any): {
    isRetryable: boolean;
    errorType: string;
    suggestedAction: string;
    estimatedRecoveryTime?: number;
  } {
    const isRetryable = this.isRetryableError(error);
    let errorType = 'unknown';
    let suggestedAction = 'Check error details and try again';
    let estimatedRecoveryTime: number | undefined;

    const errorMessage = error.message?.toLowerCase() || '';

    if (errorMessage.includes('rate limit') || error.status === 429) {
      errorType = 'rate_limit';
      suggestedAction = 'Wait before retrying, consider implementing request throttling';
      estimatedRecoveryTime = 60000; // 1 minute
    } else if (errorMessage.includes('timeout')) {
      errorType = 'timeout';
      suggestedAction = 'Increase timeout duration or optimize request size';
      estimatedRecoveryTime = 5000; // 5 seconds
    } else if (error.status >= 500) {
      errorType = 'server_error';
      suggestedAction = 'Server issue, retry with exponential backoff';
      estimatedRecoveryTime = 30000; // 30 seconds
    } else if (errorMessage.includes('authentication') || error.status === 401) {
      errorType = 'authentication';
      suggestedAction = 'Check API credentials and refresh tokens';
    } else if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
      errorType = 'quota_exceeded';
      suggestedAction = 'Check billing status and usage limits';
    } else if (errorMessage.includes('model') && errorMessage.includes('unavailable')) {
      errorType = 'model_unavailable';
      suggestedAction = 'Try alternative model or wait for model to become available';
      estimatedRecoveryTime = 120000; // 2 minutes
    }

    return {
      isRetryable,
      errorType,
      suggestedAction,
      estimatedRecoveryTime
    };
  }

  createRetryableError(originalError: any, context?: string): LangChainError {
    const analysis = this.analyzeError(originalError);
    
    return {
      code: this.mapErrorTypeToCode(analysis.errorType),
      message: `${originalError.message}${context ? ` (Context: ${context})` : ''}`,
      details: {
        originalError: originalError,
        analysis,
        retryable: analysis.isRetryable
      },
      retryable: analysis.isRetryable,
      timestamp: new Date()
    };
  }

  private mapErrorTypeToCode(errorType: string): LangChainErrorCode {
    switch (errorType) {
      case 'rate_limit':
        return LangChainErrorCode.RATE_LIMIT;
      case 'timeout':
        return LangChainErrorCode.TIMEOUT;
      case 'server_error':
        return LangChainErrorCode.API_ERROR;
      case 'authentication':
        return LangChainErrorCode.AUTHENTICATION_ERROR;
      default:
        return LangChainErrorCode.API_ERROR;
    }
  }

  // Circuit breaker state management
  private circuitStates = new Map<string, {
    isOpen: boolean;
    halfOpen: boolean;
    failureCount: number;
    lastFailure: number;
    timeout: number;
  }>();

  private getCircuitState(key: string) {
    if (!this.circuitStates.has(key)) {
      this.circuitStates.set(key, {
        isOpen: false,
        halfOpen: false,
        failureCount: 0,
        lastFailure: 0,
        timeout: 60000
      });
    }
    return this.circuitStates.get(key)!;
  }

  // Backpressure management
  private activeRequests = 0;

  private getActiveRequestCount(): number {
    return this.activeRequests;
  }

  private incrementActiveRequests(): void {
    this.activeRequests++;
  }

  private decrementActiveRequests(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  // Health check and monitoring
  getRetryStatistics(): {
    circuitBreakerStates: Array<{ key: string; isOpen: boolean; failureCount: number }>;
    activeRequests: number;
    totalRetries: number;
  } {
    const circuitBreakerStates = Array.from(this.circuitStates.entries()).map(([key, state]) => ({
      key,
      isOpen: state.isOpen,
      failureCount: state.failureCount
    }));

    return {
      circuitBreakerStates,
      activeRequests: this.activeRequests,
      totalRetries: 0 // Would track this in production
    };
  }

  resetCircuitBreaker(key: string): void {
    if (this.circuitStates.has(key)) {
      const state = this.circuitStates.get(key)!;
      state.isOpen = false;
      state.halfOpen = false;
      state.failureCount = 0;
      state.lastFailure = 0;
      this.logger.log(`Reset circuit breaker for ${key}`);
    }
  }

  resetAllCircuitBreakers(): void {
    this.circuitStates.clear();
    this.logger.log('Reset all circuit breakers');
  }
}