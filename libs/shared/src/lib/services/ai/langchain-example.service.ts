import { Injectable, Logger } from '@nestjs/common';
import { LangChainOrchestratorService } from './langchain-orchestrator.service';
import { LangChainPromptsService } from './langchain-prompts.service';
import { AICostMonitorService } from './ai-cost-monitor.service';
import { AIRetryHandlerService } from './ai-retry-handler.service';
import { LangChainConfigService } from '../config/langchain.config';
import {
  WorkflowType,
  WorkflowInput,
  WorkflowResult,
} from '../interfaces/langchain.interface';

@Injectable()
export class LangChainExampleService {
  private readonly logger = new Logger(LangChainExampleService.name);

  constructor(
    private readonly orchestrator: LangChainOrchestratorService,
    private readonly promptsService: LangChainPromptsService,
    private readonly costMonitor: AICostMonitorService,
    private readonly retryHandler: AIRetryHandlerService,
    private readonly configService: LangChainConfigService,
  ) {
    this.logger.log('LangChain Example Service initialized');
  }

  /**
   * Example: Generate a meeting summary using the LangChain orchestration system
   */
  async generateMeetingSummary(
    transcript: string,
    meetingMetadata?: any,
  ): Promise<any> {
    try {
      this.logger.log('Starting meeting summary generation');

      // Create or get the meeting summarization workflow
      const workflow =
        await this.orchestrator.createMeetingSummarizationWorkflow();

      // Prepare input for the workflow
      const input: WorkflowInput = {
        variables: {
          transcript,
          duration: meetingMetadata?.duration || '30',
          participants: meetingMetadata?.participants || 'Unknown',
          meetingType: meetingMetadata?.type || 'General Meeting',
        },
        context: {
          userId: meetingMetadata?.userId,
          meetingId: meetingMetadata?.meetingId,
        },
      };

      // Execute the workflow with retry logic
      const result = await this.retryHandler.retryLLMCall(
        () => this.orchestrator.executeWorkflow(workflow.id, input),
        'Meeting Summary Generation',
      );

      // Track the execution cost
      if (result.status === 'COMPLETED') {
        await this.costMonitor.trackExecution({
          id: result.id,
          workflowId: result.workflowId,
          nodeId: 'summary_generation',
          input,
          output: result.output,
          startTime: new Date(Date.now() - result.executionTime),
          endTime: new Date(),
          duration: result.executionTime,
          status: 'COMPLETED' as any,
          metadata: result.metadata,
        });
      }

      this.logger.log(
        `Meeting summary generated successfully in ${result.executionTime}ms`,
      );
      return {
        success: true,
        summary: result.output,
        cost: result.cost,
        executionTime: result.executionTime,
        tokenUsage: result.tokenUsage,
      };
    } catch (error: any) {
      this.logger.error('Failed to generate meeting summary:', error);
      return {
        success: false,
        error: error.message,
        cost: 0,
        executionTime: 0,
      };
    }
  }

  /**
   * Example: Process a Q&A query about meeting content
   */
  async processQAQuery(
    question: string,
    meetingContext: string,
    metadata?: any,
  ): Promise<any> {
    try {
      this.logger.log(`Processing Q&A query: ${question.substring(0, 50)}...`);

      // Create or get the Q&A processing workflow
      const workflow = await this.orchestrator.createQAProcessingWorkflow();

      // Prepare input for the workflow
      const input: WorkflowInput = {
        variables: {
          question,
          context: meetingContext,
          meetingDate: metadata?.date || new Date().toISOString(),
          duration: metadata?.duration || '30',
          participants: metadata?.participants || 'Unknown',
        },
        context: {
          userId: metadata?.userId,
          meetingId: metadata?.meetingId,
        },
      };

      // Execute the workflow with retry logic
      const result = await this.retryHandler.retryLLMCall(
        () => this.orchestrator.executeWorkflow(workflow.id, input),
        'Q&A Processing',
      );

      // Track the execution cost
      if (result.status === 'COMPLETED') {
        await this.costMonitor.trackExecution({
          id: result.id,
          workflowId: result.workflowId,
          nodeId: 'qa_processing',
          input,
          output: result.output,
          startTime: new Date(Date.now() - result.executionTime),
          endTime: new Date(),
          duration: result.executionTime,
          status: 'COMPLETED' as any,
          metadata: result.metadata,
        });
      }

      this.logger.log(
        `Q&A query processed successfully in ${result.executionTime}ms`,
      );
      return {
        success: true,
        answer: result.output,
        cost: result.cost,
        executionTime: result.executionTime,
        tokenUsage: result.tokenUsage,
      };
    } catch (error: any) {
      this.logger.error('Failed to process Q&A query:', error);
      return {
        success: false,
        error: error.message,
        cost: 0,
        executionTime: 0,
      };
    }
  }

  /**
   * Example: Get cost and usage analytics
   */
  async getAnalytics(timeRange?: { start: Date; end: Date }): Promise<any> {
    try {
      const defaultTimeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: new Date(),
      };

      const range = timeRange || defaultTimeRange;

      // Get cost report
      const costReport = await this.costMonitor.getCostReport(range);

      // Get usage metrics
      const usageMetrics = await this.costMonitor.getUsageMetrics();

      // Get daily summary
      const dailySummary = await this.costMonitor.getDailyCostSummary();

      // Get model usage breakdown
      const modelBreakdown = await this.costMonitor.getModelUsageBreakdown();

      return {
        success: true,
        analytics: {
          costReport,
          usageMetrics,
          dailySummary,
          modelBreakdown,
        },
      };
    } catch (error: any) {
      this.logger.error('Failed to get analytics:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Example: Test the system with sample data
   */
  async runSystemTest(): Promise<any> {
    try {
      this.logger.log('Running LangChain system test');

      const sampleTranscript = `
        Meeting started at 2:00 PM with John, Sarah, and Mike present.
        
        John: Let's discuss the Q3 project timeline. We need to deliver the new feature by September 30th.
        
        Sarah: I think we can meet that deadline if we prioritize the core functionality first. 
        The advanced features can be added in Q4.
        
        Mike: Agreed. I'll take ownership of the backend API development. 
        Sarah, can you handle the frontend components?
        
        Sarah: Yes, I can do that. When do you need the API endpoints ready?
        
        Mike: I'll have them ready by September 15th, so you have two weeks for frontend integration.
        
        John: Perfect. Let's also schedule weekly check-ins every Friday at 3 PM.
        
        Meeting ended at 2:30 PM.
      `;

      // Test meeting summarization
      const summaryResult = await this.generateMeetingSummary(
        sampleTranscript,
        {
          duration: '30',
          participants: 'John, Sarah, Mike',
          type: 'Project Planning',
          userId: 'test-user-1',
          meetingId: 'test-meeting-1',
        },
      );

      // Test Q&A processing
      const qaResult = await this.processQAQuery(
        'What are the key action items from this meeting?',
        sampleTranscript,
        {
          date: new Date().toISOString(),
          duration: '30',
          participants: 'John, Sarah, Mike',
          userId: 'test-user-1',
          meetingId: 'test-meeting-1',
        },
      );

      // Get analytics
      const analytics = await this.getAnalytics();

      return {
        success: true,
        testResults: {
          summarization: summaryResult,
          qaProcessing: qaResult,
          analytics: analytics.analytics,
        },
      };
    } catch (error: any) {
      this.logger.error('System test failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Example: Demonstrate prompt template usage
   */
  async demonstratePromptTemplates(): Promise<any> {
    try {
      this.logger.log('Demonstrating prompt templates');

      // List available templates
      const templates = await this.promptsService.listPromptTemplates();

      // Render a specific template
      const summaryTemplate = templates.find(
        (t) => t.id === 'meeting_summary_comprehensive',
      );
      if (summaryTemplate) {
        const rendered = await this.promptsService.renderPrompt(
          summaryTemplate.id,
          {
            transcript: 'Sample meeting transcript...',
            duration: '45',
            participants: 'Alice, Bob, Charlie',
            meetingType: 'Team Standup',
          },
        );

        return {
          success: true,
          demonstration: {
            availableTemplates: templates.map((t) => ({
              id: t.id,
              name: t.name,
              category: t.category,
            })),
            renderedExample: {
              templateId: summaryTemplate.id,
              templateName: summaryTemplate.name,
              renderedPrompt: rendered.substring(0, 500) + '...', // Truncate for display
            },
          },
        };
      }

      return {
        success: true,
        demonstration: {
          availableTemplates: templates.map((t) => ({
            id: t.id,
            name: t.name,
            category: t.category,
          })),
        },
      };
    } catch (error: any) {
      this.logger.error('Failed to demonstrate prompt templates:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Example: Health check for all LangChain services
   */
  async healthCheck(): Promise<any> {
    try {
      const health = {
        orchestrator: false,
        prompts: false,
        costMonitor: false,
        retryHandler: false,
        config: false,
      };

      // Test orchestrator
      try {
        const workflows = await this.orchestrator.listWorkflows();
        health.orchestrator = true;
      } catch (error) {
        this.logger.warn('Orchestrator health check failed:', error);
      }

      // Test prompts service
      try {
        const templates = await this.promptsService.listPromptTemplates();
        health.prompts = templates.length > 0;
      } catch (error) {
        this.logger.warn('Prompts service health check failed:', error);
      }

      // Test cost monitor
      try {
        const metrics = await this.costMonitor.getUsageMetrics();
        health.costMonitor = true;
      } catch (error) {
        this.logger.warn('Cost monitor health check failed:', error);
      }

      // Test retry handler
      try {
        const stats = this.retryHandler.getRetryStatistics();
        health.retryHandler = true;
      } catch (error) {
        this.logger.warn('Retry handler health check failed:', error);
      }

      // Test config
      try {
        const isValid = this.configService.validateConfig();
        health.config = isValid;
      } catch (error) {
        this.logger.warn('Config validation failed:', error);
      }

      const allHealthy = Object.values(health).every(
        (status) => status === true,
      );

      return {
        success: allHealthy,
        health,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('Health check failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
