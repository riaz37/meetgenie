import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentConfig } from '../../config/environment.config';
import { LangChainPromptsService } from './langchain-prompts.service';
import { AICostMonitorService } from './ai-cost-monitor.service';
import { AIRetryHandlerService } from './ai-retry-handler.service';

export interface OrchestrationRequest {
  type: 'summarization' | 'qa' | 'analysis' | 'extraction';
  input: string | Record<string, any>;
  context?: Record<string, any>;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
  };
}

export interface OrchestrationResult {
  success: boolean;
  result?: any;
  error?: string;
  metadata: {
    model: string;
    tokensUsed: number;
    cost: number;
    duration: number;
    retryCount: number;
  };
}

export interface WorkflowStep {
  id: string;
  type: string;
  input: any;
  output?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface WorkflowExecution {
  id: string;
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  totalCost: number;
  totalTokens: number;
}

@Injectable()
export class LangChainOrchestratorService {
  private readonly logger = new Logger(LangChainOrchestratorService.name);
  private readonly workflows = new Map<string, WorkflowExecution>();

  constructor(
    private readonly configService: ConfigService<EnvironmentConfig>,
    private readonly promptsService: LangChainPromptsService,
    private readonly costMonitor: AICostMonitorService,
    private readonly retryHandler: AIRetryHandlerService,
  ) {}

  /**
   * Execute a single AI operation with orchestration
   */
  async executeOperation(request: OrchestrationRequest): Promise<OrchestrationResult> {
    const startTime = Date.now();
    let retryCount = 0;

    try {
      this.logger.log(`Executing ${request.type} operation`);

      // Monitor cost before execution
      await this.costMonitor.checkBudgetLimits();

      // Execute with retry logic
      const result = await this.retryHandler.executeWithRetry(
        async () => {
          retryCount++;
          return await this.performOperation(request);
        },
        {
          maxRetries: 3,
          backoffMs: 1000,
          shouldRetry: (error) => this.shouldRetryOperation(error),
        }
      );

      const duration = Date.now() - startTime;
      const tokensUsed = this.estimateTokenUsage(request, result);
      const cost = await this.costMonitor.calculateCost(tokensUsed, request.options?.model || 'gpt-3.5-turbo');

      // Track usage
      await this.costMonitor.trackUsage({
        operation: request.type,
        model: request.options?.model || 'gpt-3.5-turbo',
        tokensUsed,
        cost,
        duration,
      });

      this.logger.log(`Operation completed successfully in ${duration}ms`);

      return {
        success: true,
        result,
        metadata: {
          model: request.options?.model || 'gpt-3.5-turbo',
          tokensUsed,
          cost,
          duration,
          retryCount: retryCount - 1,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Operation failed after ${duration}ms:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          model: request.options?.model || 'gpt-3.5-turbo',
          tokensUsed: 0,
          cost: 0,
          duration,
          retryCount: retryCount - 1,
        },
      };
    }
  }

  /**
   * Execute a complex workflow with multiple steps
   */
  async executeWorkflow(steps: Omit<WorkflowStep, 'status' | 'startTime' | 'endTime'>[]): Promise<WorkflowExecution> {
    const workflowId = this.generateWorkflowId();
    const workflow: WorkflowExecution = {
      id: workflowId,
      steps: steps.map(step => ({
        ...step,
        status: 'pending',
      })),
      status: 'pending',
      startTime: new Date(),
      totalCost: 0,
      totalTokens: 0,
    };

    this.workflows.set(workflowId, workflow);

    try {
      this.logger.log(`Starting workflow ${workflowId} with ${steps.length} steps`);
      workflow.status = 'running';

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        step.status = 'running';
        step.startTime = new Date();

        try {
          this.logger.log(`Executing step ${step.id} (${step.type})`);

          const request: OrchestrationRequest = {
            type: step.type as any,
            input: step.input,
            context: this.buildStepContext(workflow.steps, i),
          };

          const result = await this.executeOperation(request);

          if (result.success) {
            step.output = result.result;
            step.status = 'completed';
            workflow.totalCost += result.metadata.cost;
            workflow.totalTokens += result.metadata.tokensUsed;
          } else {
            step.error = result.error;
            step.status = 'failed';
            throw new Error(`Step ${step.id} failed: ${result.error}`);
          }
        } catch (error) {
          step.error = error instanceof Error ? error.message : 'Unknown error';
          step.status = 'failed';
          throw error;
        } finally {
          step.endTime = new Date();
        }
      }

      workflow.status = 'completed';
      workflow.endTime = new Date();

      this.logger.log(`Workflow ${workflowId} completed successfully`);
      return workflow;
    } catch (error) {
      workflow.status = 'failed';
      workflow.endTime = new Date();

      this.logger.error(`Workflow ${workflowId} failed:`, error);
      return workflow;
    }
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId: string): WorkflowExecution | null {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(workflowId: string): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'running') {
      return false;
    }

    workflow.status = 'failed';
    workflow.endTime = new Date();

    // Mark any running steps as failed
    workflow.steps.forEach(step => {
      if (step.status === 'running') {
        step.status = 'failed';
        step.error = 'Workflow cancelled';
        step.endTime = new Date();
      }
    });

    this.logger.log(`Workflow ${workflowId} cancelled`);
    return true;
  }

  /**
   * Clean up old workflows
   */
  cleanupWorkflows(olderThanHours = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [id, workflow] of this.workflows.entries()) {
      if (workflow.startTime < cutoffTime) {
        this.workflows.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} old workflows`);
    }
  }

  /**
   * Get workflow statistics
   */
  getWorkflowStats(): {
    total: number;
    running: number;
    completed: number;
    failed: number;
    totalCost: number;
    totalTokens: number;
  } {
    const workflows = Array.from(this.workflows.values());
    
    return {
      total: workflows.length,
      running: workflows.filter(w => w.status === 'running').length,
      completed: workflows.filter(w => w.status === 'completed').length,
      failed: workflows.filter(w => w.status === 'failed').length,
      totalCost: workflows.reduce((sum, w) => sum + w.totalCost, 0),
      totalTokens: workflows.reduce((sum, w) => sum + w.totalTokens, 0),
    };
  }

  /**
   * Perform the actual AI operation
   */
  private async performOperation(request: OrchestrationRequest): Promise<any> {
    switch (request.type) {
      case 'summarization':
        return await this.performSummarization(request);
      case 'qa':
        return await this.performQA(request);
      case 'analysis':
        return await this.performAnalysis(request);
      case 'extraction':
        return await this.performExtraction(request);
      default:
        throw new Error(`Unsupported operation type: ${request.type}`);
    }
  }

  /**
   * Perform summarization operation
   */
  private async performSummarization(request: OrchestrationRequest): Promise<string> {
    const prompt = await this.promptsService.getSummarizationPrompt(
      request.input as string,
      request.context
    );

    // This would integrate with actual LangChain implementation
    // For now, return a mock response
    return `Summary of: ${request.input}`;
  }

  /**
   * Perform Q&A operation
   */
  private async performQA(request: OrchestrationRequest): Promise<string> {
    const { question, context } = request.input as { question: string; context: string };
    
    const prompt = await this.promptsService.getQAPrompt(question, context);

    // This would integrate with actual LangChain implementation
    return `Answer to "${question}" based on provided context`;
  }

  /**
   * Perform analysis operation
   */
  private async performAnalysis(request: OrchestrationRequest): Promise<any> {
    const prompt = await this.promptsService.getAnalysisPrompt(
      request.input as string,
      request.context
    );

    // This would integrate with actual LangChain implementation
    return {
      sentiment: 'positive',
      topics: ['topic1', 'topic2'],
      keyPoints: ['point1', 'point2'],
    };
  }

  /**
   * Perform extraction operation
   */
  private async performExtraction(request: OrchestrationRequest): Promise<any> {
    const prompt = await this.promptsService.getExtractionPrompt(
      request.input as string,
      request.context
    );

    // This would integrate with actual LangChain implementation
    return {
      entities: ['entity1', 'entity2'],
      relationships: ['rel1', 'rel2'],
      metadata: {},
    };
  }

  /**
   * Determine if an operation should be retried
   */
  private shouldRetryOperation(error: any): boolean {
    // Retry on rate limits, temporary failures, but not on authentication or validation errors
    if (error.code === 'rate_limit_exceeded') return true;
    if (error.code === 'server_error') return true;
    if (error.code === 'timeout') return true;
    if (error.code === 'authentication_error') return false;
    if (error.code === 'invalid_request') return false;
    
    return true; // Default to retry for unknown errors
  }

  /**
   * Estimate token usage for cost calculation
   */
  private estimateTokenUsage(request: OrchestrationRequest, result: any): number {
    // Simple estimation - in real implementation, this would be more sophisticated
    const inputLength = typeof request.input === 'string' 
      ? request.input.length 
      : JSON.stringify(request.input).length;
    
    const outputLength = typeof result === 'string' 
      ? result.length 
      : JSON.stringify(result).length;

    // Rough estimation: 4 characters per token
    return Math.ceil((inputLength + outputLength) / 4);
  }

  /**
   * Build context for workflow step execution
   */
  private buildStepContext(steps: WorkflowStep[], currentIndex: number): Record<string, any> {
    const context: Record<string, any> = {};
    
    // Include outputs from previous completed steps
    for (let i = 0; i < currentIndex; i++) {
      const step = steps[i];
      if (step.status === 'completed' && step.output) {
        context[`step_${step.id}`] = step.output;
      }
    }

    return context;
  }

  /**
   * Generate unique workflow ID
   */
  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}