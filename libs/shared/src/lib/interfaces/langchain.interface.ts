import { BaseMessage } from '@langchain/core/messages';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';

// Core LangChain Interfaces
export interface LangChainConfig {
  googleApiKey: string;
  langSmithApiKey?: string;
  langSmithProjectName?: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  safetySettings: GeminiSafetySettings[];
}

export interface GeminiSafetySettings {
  category: 'HARM_CATEGORY_HARASSMENT' | 'HARM_CATEGORY_HATE_SPEECH' | 'HARM_CATEGORY_SEXUALLY_EXPLICIT' | 'HARM_CATEGORY_DANGEROUS_CONTENT';
  threshold: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
}

// Workflow Management
export interface LangGraphWorkflow {
  id: string;
  name: string;
  type: WorkflowType;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  state: WorkflowState;
  config: WorkflowConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: NodeType;
  function: string;
  inputs: NodeInput[];
  outputs: NodeOutput[];
  llmConfig?: LLMConfig;
  promptTemplate?: string;
  outputParser?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
  weight?: number;
}

export interface WorkflowState {
  currentNode: string;
  variables: Record<string, any>;
  history: WorkflowExecution[];
  status: WorkflowStatus;
  error?: string;
}

export interface WorkflowConfig {
  maxRetries: number;
  timeout: number;
  enableLogging: boolean;
  enableMonitoring: boolean;
  costTracking: boolean;
}

export interface NodeInput {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface NodeOutput {
  name: string;
  type: string;
  description?: string;
}

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  topK?: number;
  safetySettings?: GeminiSafetySettings[];
}

// Workflow Types and Enums
export enum WorkflowType {
  MEETING_SUMMARIZATION = 'meeting_summarization',
  ACTION_ITEM_EXTRACTION = 'action_item_extraction',
  QA_PROCESSING = 'qa_processing',
  SPEAKER_ANALYSIS = 'speaker_analysis',
  SENTIMENT_ANALYSIS = 'sentiment_analysis',
  DECISION_EXTRACTION = 'decision_extraction',
  TOPIC_ANALYSIS = 'topic_analysis'
}

export enum NodeType {
  LLM_CALL = 'llm_call',
  PROMPT_TEMPLATE = 'prompt_template',
  OUTPUT_PARSER = 'output_parser',
  RETRIEVER = 'retriever',
  MEMORY = 'memory',
  TOOL = 'tool',
  CONDITION = 'condition',
  AGGREGATOR = 'aggregator'
}

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Execution and Results
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  nodeId: string;
  input: any;
  output: any;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: ExecutionStatus;
  error?: string;
  metadata?: ExecutionMetadata;
}

export interface ExecutionMetadata {
  tokenUsage?: TokenUsage;
  modelUsed?: string;
  cost?: number;
  retryCount?: number;
  cacheHit?: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

// Prompt Templates
export interface PromptTemplateConfig {
  id: string;
  name: string;
  description: string;
  template: string;
  inputVariables: string[];
  outputFormat?: string;
  examples?: PromptExample[];
  optimizedFor: string; // model name
  category: PromptCategory;
  version: string;
}

export interface PromptExample {
  input: Record<string, any>;
  output: string;
  explanation?: string;
}

export enum PromptCategory {
  SUMMARIZATION = 'summarization',
  EXTRACTION = 'extraction',
  ANALYSIS = 'analysis',
  QA = 'qa',
  CLASSIFICATION = 'classification',
  GENERATION = 'generation'
}

// Output Parsers
export interface OutputParserConfig {
  id: string;
  name: string;
  type: ParserType;
  schema?: any; // Zod schema
  format: OutputFormat;
  validation: ValidationRule[];
}

export enum ParserType {
  JSON = 'json',
  STRUCTURED = 'structured',
  LIST = 'list',
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  STRING = 'string'
}

export enum OutputFormat {
  JSON = 'json',
  YAML = 'yaml',
  CSV = 'csv',
  TEXT = 'text'
}

export interface ValidationRule {
  field: string;
  rule: string;
  message: string;
}

// Cost Monitoring
export interface CostMonitor {
  trackUsage(execution: WorkflowExecution): Promise<void>;
  getCostReport(timeRange: TimeRange): Promise<CostReport>;
  getUsageMetrics(workflowId?: string): Promise<UsageMetrics>;
  setAlerts(alerts: CostAlert[]): Promise<void>;
}

export interface CostReport {
  totalCost: number;
  currency: string;
  period: TimeRange;
  breakdown: CostBreakdown[];
  trends: CostTrend[];
}

export interface CostBreakdown {
  category: string;
  cost: number;
  percentage: number;
  usage: number;
  unit: string;
}

export interface CostTrend {
  date: Date;
  cost: number;
  usage: number;
}

export interface UsageMetrics {
  totalRequests: number;
  totalTokens: number;
  averageLatency: number;
  errorRate: number;
  costPerRequest: number;
  topWorkflows: WorkflowUsage[];
}

export interface WorkflowUsage {
  workflowId: string;
  workflowName: string;
  requests: number;
  tokens: number;
  cost: number;
  averageLatency: number;
}

export interface CostAlert {
  id: string;
  type: AlertType;
  threshold: number;
  period: string;
  enabled: boolean;
  recipients: string[];
}

export enum AlertType {
  DAILY_COST = 'daily_cost',
  MONTHLY_COST = 'monthly_cost',
  TOKEN_USAGE = 'token_usage',
  ERROR_RATE = 'error_rate'
}

export interface TimeRange {
  start: Date;
  end: Date;
}

// LangSmith Integration
export interface LangSmithConfig {
  apiKey: string;
  projectName: string;
  endpoint?: string;
  enableTracing: boolean;
  enableFeedback: boolean;
  enableEvaluation: boolean;
}

export interface LangSmithTrace {
  runId: string;
  name: string;
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  startTime: Date;
  endTime?: Date;
  error?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  parentRunId?: string;
}

export interface LangSmithFeedback {
  runId: string;
  key: string;
  score: number;
  value?: any;
  comment?: string;
  correction?: any;
  feedbackSourceType?: string;
}

export interface LangSmithMetrics {
  runCount: number;
  averageLatency: number;
  errorRate: number;
  feedbackScore?: number;
  costMetrics?: TokenUsage;
}

// Error Handling
export interface LangChainError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  timestamp: Date;
  workflowId?: string;
  nodeId?: string;
}

export enum LangChainErrorCode {
  API_ERROR = 'API_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PARSING_ERROR = 'PARSING_ERROR',
  WORKFLOW_ERROR = 'WORKFLOW_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR'
}

// Retry Configuration
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// Service Interfaces
export interface LangChainOrchestratorService {
  createWorkflow(config: CreateWorkflowRequest): Promise<LangGraphWorkflow>;
  executeWorkflow(workflowId: string, input: WorkflowInput): Promise<WorkflowResult>;
  getWorkflow(workflowId: string): Promise<LangGraphWorkflow>;
  updateWorkflow(workflowId: string, updates: Partial<LangGraphWorkflow>): Promise<LangGraphWorkflow>;
  deleteWorkflow(workflowId: string): Promise<void>;
  listWorkflows(filters?: WorkflowFilters): Promise<LangGraphWorkflow[]>;
}

export interface CreateWorkflowRequest {
  name: string;
  type: WorkflowType;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  config: WorkflowConfig;
}

export interface WorkflowInput {
  variables: Record<string, any>;
  context?: Record<string, any>;
}

export interface WorkflowResult {
  id: string;
  workflowId: string;
  output: any;
  status: WorkflowStatus;
  executionTime: number;
  tokenUsage: TokenUsage;
  cost: number;
  error?: string;
  metadata: ExecutionMetadata;
}

export interface WorkflowFilters {
  type?: WorkflowType;
  status?: WorkflowStatus;
  createdAfter?: Date;
  createdBefore?: Date;
  tags?: string[];
}

export interface LangChainPromptsService {
  createPromptTemplate(config: PromptTemplateConfig): Promise<PromptTemplateConfig>;
  getPromptTemplate(id: string): Promise<PromptTemplateConfig>;
  updatePromptTemplate(id: string, updates: Partial<PromptTemplateConfig>): Promise<PromptTemplateConfig>;
  deletePromptTemplate(id: string): Promise<void>;
  listPromptTemplates(category?: PromptCategory): Promise<PromptTemplateConfig[]>;
  renderPrompt(templateId: string, variables: Record<string, any>): Promise<string>;
  optimizePrompt(templateId: string, feedback: PromptFeedback[]): Promise<PromptTemplateConfig>;
}

export interface PromptFeedback {
  input: Record<string, any>;
  expectedOutput: string;
  actualOutput: string;
  score: number;
  comments?: string;
}

export interface AICostMonitorService {
  trackExecution(execution: WorkflowExecution): Promise<void>;
  getCostReport(timeRange: TimeRange, filters?: CostFilters): Promise<CostReport>;
  getUsageMetrics(workflowId?: string): Promise<UsageMetrics>;
  setAlerts(alerts: CostAlert[]): Promise<void>;
  getAlerts(): Promise<CostAlert[]>;
  checkAlerts(): Promise<AlertNotification[]>;
}

export interface CostFilters {
  workflowType?: WorkflowType;
  userId?: string;
  model?: string;
}

export interface AlertNotification {
  alertId: string;
  type: AlertType;
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
}

export interface AIRetryHandlerService {
  executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    context?: string
  ): Promise<T>;
  isRetryableError(error: any): boolean;
  getRetryDelay(attempt: number, config: RetryConfig): number;
}