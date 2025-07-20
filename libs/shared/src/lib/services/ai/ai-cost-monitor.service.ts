import { Injectable, Logger } from '@nestjs/common';
import {
  WorkflowExecution,
  CostReport,
  UsageMetrics,
  CostAlert,
  AlertNotification,
  TimeRange,
  CostFilters,
  WorkflowUsage,
  CostBreakdown,
  CostTrend,
  AlertType,
  AICostMonitorService as IAICostMonitorService,
  TokenUsage,
  WorkflowType
} from '../interfaces/langchain.interface';

interface CostRecord {
  id: string;
  timestamp: Date;
  workflowId: string;
  workflowType: WorkflowType;
  userId?: string;
  model: string;
  tokenUsage: TokenUsage;
  cost: number;
  executionTime: number;
  status: string;
}

@Injectable()
export class AICostMonitorService implements IAICostMonitorService {
  private readonly logger = new Logger(AICostMonitorService.name);
  private readonly costRecords: CostRecord[] = [];
  private readonly alerts: CostAlert[] = [];
  private readonly costRates: Record<string, { inputCostPer1K: number; outputCostPer1K: number }> = {
    'gemini-pro': {
      inputCostPer1K: 0.00025,
      outputCostPer1K: 0.0005
    },
    'gemini-pro-1.5': {
      inputCostPer1K: 0.00025,
      outputCostPer1K: 0.0005
    },
    'facebook/wav2vec2-large-960h-lv60-self': {
      inputCostPer1K: 0.00001, // Hugging Face pricing
      outputCostPer1K: 0.00001
    }
  };

  constructor() {
    this.initializeDefaultAlerts();
    this.startPeriodicAlertCheck();
    this.logger.log('AI Cost Monitor Service initialized');
  }

  async trackExecution(execution: WorkflowExecution): Promise<void> {
    try {
      const cost = this.calculateExecutionCost(execution);
      
      const record: CostRecord = {
        id: execution.id,
        timestamp: execution.startTime,
        workflowId: execution.workflowId,
        workflowType: this.inferWorkflowType(execution.workflowId),
        userId: this.extractUserId(execution),
        model: execution.metadata?.modelUsed || 'gemini-pro',
        tokenUsage: execution.metadata?.tokenUsage || {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCost: 0
        },
        cost,
        executionTime: execution.duration || 0,
        status: execution.status.toString()
      };

      this.costRecords.push(record);
      
      // Keep only last 10,000 records to prevent memory issues
      if (this.costRecords.length > 10000) {
        this.costRecords.splice(0, this.costRecords.length - 10000);
      }

      this.logger.debug(`Tracked execution cost: ${execution.id} - $${cost.toFixed(4)}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to track execution cost: ${errorMessage}`, errorStack);
    }
  }

  async getCostReport(timeRange: TimeRange, filters?: CostFilters): Promise<CostReport> {
    try {
      let filteredRecords = this.costRecords.filter(record => 
        record.timestamp >= timeRange.start && record.timestamp <= timeRange.end
      );

      if (filters) {
        if (filters.workflowType) {
          filteredRecords = filteredRecords.filter(r => r.workflowType === filters.workflowType);
        }
        if (filters.userId) {
          filteredRecords = filteredRecords.filter(r => r.userId === filters.userId);
        }
        if (filters.model) {
          filteredRecords = filteredRecords.filter(r => r.model === filters.model);
        }
      }

      const totalCost = filteredRecords.reduce((sum, record) => sum + record.cost, 0);
      const breakdown = this.generateCostBreakdown(filteredRecords);
      const trends = this.generateCostTrends(filteredRecords, timeRange);

      return {
        totalCost,
        currency: 'USD',
        period: timeRange,
        breakdown,
        trends
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to generate cost report: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async getUsageMetrics(workflowId?: string): Promise<UsageMetrics> {
    try {
      let records = this.costRecords;
      
      if (workflowId) {
        records = records.filter(r => r.workflowId === workflowId);
      }

      const totalRequests = records.length;
      const totalTokens = records.reduce((sum, r) => sum + r.tokenUsage.totalTokens, 0);
      const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
      const totalExecutionTime = records.reduce((sum, r) => sum + r.executionTime, 0);
      const errorCount = records.filter(r => r.status === 'FAILED').length;

      const averageLatency = totalRequests > 0 ? totalExecutionTime / totalRequests : 0;
      const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;
      const costPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;

      const topWorkflows = this.getTopWorkflows(records);

      return {
        totalRequests,
        totalTokens,
        averageLatency,
        errorRate,
        costPerRequest,
        topWorkflows
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get usage metrics: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async setAlerts(alerts: CostAlert[]): Promise<void> {
    try {
      this.alerts.splice(0, this.alerts.length, ...alerts);
      this.logger.log(`Updated ${alerts.length} cost alerts`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to set alerts: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async getAlerts(): Promise<CostAlert[]> {
    return [...this.alerts];
  }

  async checkAlerts(): Promise<AlertNotification[]> {
    const notifications: AlertNotification[] = [];
    const now = new Date();

    try {
      for (const alert of this.alerts.filter(a => a.enabled)) {
        const currentValue = await this.getCurrentAlertValue(alert, now);
        
        if (currentValue >= alert.threshold) {
          notifications.push({
            alertId: alert.id,
            type: alert.type,
            message: this.generateAlertMessage(alert, currentValue),
            currentValue,
            threshold: alert.threshold,
            timestamp: now
          });
        }
      }

      if (notifications.length > 0) {
        this.logger.warn(`Generated ${notifications.length} cost alert notifications`);
      }

      return notifications;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to check alerts: ${errorMessage}`, errorStack);
      return [];
    }
  }

  private calculateExecutionCost(execution: WorkflowExecution): number {
    const tokenUsage = execution.metadata?.tokenUsage;
    const model = execution.metadata?.modelUsed || 'gemini-pro';
    
    if (!tokenUsage || !this.costRates[model]) {
      return 0;
    }

    const rates = this.costRates[model];
    const inputCost = (tokenUsage.promptTokens / 1000) * rates.inputCostPer1K;
    const outputCost = (tokenUsage.completionTokens / 1000) * rates.outputCostPer1K;
    
    return inputCost + outputCost;
  }

  private inferWorkflowType(workflowId: string): WorkflowType {
    // Simple inference based on workflow ID patterns
    if (workflowId.includes('summary')) return WorkflowType.MEETING_SUMMARIZATION;
    if (workflowId.includes('qa')) return WorkflowType.QA_PROCESSING;
    if (workflowId.includes('action')) return WorkflowType.ACTION_ITEM_EXTRACTION;
    if (workflowId.includes('sentiment')) return WorkflowType.SENTIMENT_ANALYSIS;
    if (workflowId.includes('speaker')) return WorkflowType.SPEAKER_ANALYSIS;
    return WorkflowType.MEETING_SUMMARIZATION; // default
  }

  private extractUserId(execution: WorkflowExecution): string | undefined {
    // Extract user ID from execution context if available
    return execution.input?.userId || execution.input?.context?.userId;
  }

  private generateCostBreakdown(records: CostRecord[]): CostBreakdown[] {
    const breakdown = new Map<string, { cost: number; count: number }>();
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

    // Group by workflow type
    records.forEach(record => {
      const key = record.workflowType;
      const existing = breakdown.get(key) || { cost: 0, count: 0 };
      breakdown.set(key, {
        cost: existing.cost + record.cost,
        count: existing.count + 1
      });
    });

    return Array.from(breakdown.entries()).map(([category, data]) => ({
      category,
      cost: data.cost,
      percentage: totalCost > 0 ? (data.cost / totalCost) * 100 : 0,
      usage: data.count,
      unit: 'requests'
    }));
  }

  private generateCostTrends(records: CostRecord[], timeRange: TimeRange): CostTrend[] {
    const trends = new Map<string, { cost: number; usage: number }>();
    const dayMs = 24 * 60 * 60 * 1000;

    // Group by day
    records.forEach(record => {
      const dayKey = new Date(Math.floor(record.timestamp.getTime() / dayMs) * dayMs).toISOString().split('T')[0];
      const existing = trends.get(dayKey) || { cost: 0, usage: 0 };
      trends.set(dayKey, {
        cost: existing.cost + record.cost,
        usage: existing.usage + 1
      });
    });

    return Array.from(trends.entries())
      .map(([date, data]) => ({
        date: new Date(date),
        cost: data.cost,
        usage: data.usage
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private getTopWorkflows(records: CostRecord[]): WorkflowUsage[] {
    const workflowStats = new Map<string, {
      name: string;
      requests: number;
      tokens: number;
      cost: number;
      totalLatency: number;
    }>();

    records.forEach(record => {
      const existing = workflowStats.get(record.workflowId) || {
        name: record.workflowId,
        requests: 0,
        tokens: 0,
        cost: 0,
        totalLatency: 0
      };

      workflowStats.set(record.workflowId, {
        name: existing.name,
        requests: existing.requests + 1,
        tokens: existing.tokens + record.tokenUsage.totalTokens,
        cost: existing.cost + record.cost,
        totalLatency: existing.totalLatency + record.executionTime
      });
    });

    return Array.from(workflowStats.entries())
      .map(([workflowId, stats]) => ({
        workflowId,
        workflowName: stats.name,
        requests: stats.requests,
        tokens: stats.tokens,
        cost: stats.cost,
        averageLatency: stats.requests > 0 ? stats.totalLatency / stats.requests : 0
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
  }

  private async getCurrentAlertValue(alert: CostAlert, now: Date): Promise<number> {
    const timeRange = this.getAlertTimeRange(alert, now);
    const records = this.costRecords.filter(r => 
      r.timestamp >= timeRange.start && r.timestamp <= timeRange.end
    );

    switch (alert.type) {
      case AlertType.DAILY_COST:
      case AlertType.MONTHLY_COST:
        return records.reduce((sum, r) => sum + r.cost, 0);
      
      case AlertType.TOKEN_USAGE:
        return records.reduce((sum, r) => sum + r.tokenUsage.totalTokens, 0);
      
      case AlertType.ERROR_RATE:
        { const totalRequests = records.length;
        const errorCount = records.filter(r => r.status === 'FAILED').length;
        return totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0; }
      
      default:
        return 0;
    }
  }

  private getAlertTimeRange(alert: CostAlert, now: Date): TimeRange {
    const start = new Date(now);
    
    switch (alert.type) {
      case AlertType.DAILY_COST:
        start.setHours(0, 0, 0, 0);
        break;
      
      case AlertType.MONTHLY_COST:
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      
      default:
        start.setHours(now.getHours() - 1); // Last hour
        break;
    }

    return { start, end: now };
  }

  private generateAlertMessage(alert: CostAlert, currentValue: number): string {
    const formatValue = (value: number, type: AlertType): string => {
      switch (type) {
        case AlertType.DAILY_COST:
        case AlertType.MONTHLY_COST:
          return `$${value.toFixed(2)}`;
        case AlertType.TOKEN_USAGE:
          return `${Math.round(value).toLocaleString()} tokens`;
        case AlertType.ERROR_RATE:
          return `${value.toFixed(1)}%`;
        default:
          return value.toString();
      }
    };

    const period = alert.type === AlertType.MONTHLY_COST ? 'month' : 'day';
    const current = formatValue(currentValue, alert.type);
    const threshold = formatValue(alert.threshold, alert.type);

    return `AI cost alert: ${alert.type.replace('_', ' ')} has reached ${current}, exceeding threshold of ${threshold} for this ${period}`;
  }

  private initializeDefaultAlerts(): void {
    this.alerts.push(
      {
        id: 'daily_cost_100',
        type: AlertType.DAILY_COST,
        threshold: 100,
        period: 'daily',
        enabled: true,
        recipients: ['admin@meetgenie.ai']
      },
      {
        id: 'monthly_cost_1000',
        type: AlertType.MONTHLY_COST,
        threshold: 1000,
        period: 'monthly',
        enabled: true,
        recipients: ['admin@meetgenie.ai']
      },
      {
        id: 'error_rate_10',
        type: AlertType.ERROR_RATE,
        threshold: 10, // 10%
        period: 'hourly',
        enabled: true,
        recipients: ['admin@meetgenie.ai']
      }
    );

    this.logger.log('Initialized default cost alerts');
  }

  private startPeriodicAlertCheck(): void {
    // Check alerts every 5 minutes
    setInterval(async () => {
      try {
        const notifications = await this.checkAlerts();
        if (notifications.length > 0) {
          // In production, send notifications via email/Slack/etc.
          this.logger.warn(`Cost alerts triggered: ${notifications.length}`);
          notifications.forEach(notification => {
            this.logger.warn(`Alert: ${notification.message}`);
          });
        }
      } catch (error) {
        this.logger.error('Failed to check periodic alerts:', error);
      }
    }, 5 * 60 * 1000);
  }

  // Utility methods for cost analysis
  async getDailyCostSummary(date?: Date): Promise<{ cost: number; requests: number; tokens: number }> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const records = this.costRecords.filter(r => 
      r.timestamp >= startOfDay && r.timestamp <= endOfDay
    );

    return {
      cost: records.reduce((sum, r) => sum + r.cost, 0),
      requests: records.length,
      tokens: records.reduce((sum, r) => sum + r.tokenUsage.totalTokens, 0)
    };
  }

  async getMonthlyCostSummary(year: number, month: number): Promise<{ cost: number; requests: number; tokens: number }> {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const records = this.costRecords.filter(r => 
      r.timestamp >= startOfMonth && r.timestamp <= endOfMonth
    );

    return {
      cost: records.reduce((sum, r) => sum + r.cost, 0),
      requests: records.length,
      tokens: records.reduce((sum, r) => sum + r.tokenUsage.totalTokens, 0)
    };
  }

  async getModelUsageBreakdown(): Promise<Array<{ model: string; cost: number; requests: number; tokens: number }>> {
    const modelStats = new Map<string, { cost: number; requests: number; tokens: number }>();

    this.costRecords.forEach(record => {
      const existing = modelStats.get(record.model) || { cost: 0, requests: 0, tokens: 0 };
      modelStats.set(record.model, {
        cost: existing.cost + record.cost,
        requests: existing.requests + 1,
        tokens: existing.tokens + record.tokenUsage.totalTokens
      });
    });

    return Array.from(modelStats.entries()).map(([model, stats]) => ({
      model,
      ...stats
    }));
  }
}