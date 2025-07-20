import { Injectable, Logger } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import {
  PromptTemplateConfig,
  PromptCategory,
  PromptExample,
  PromptFeedback,
  LangChainPromptsService
} from '../interfaces/langchain.interface';

@Injectable()
export class LangChainPromptsService implements LangChainPromptsService {
  private readonly logger = new Logger(LangChainPromptsService.name);
  private readonly promptTemplates = new Map<string, PromptTemplateConfig>();

  constructor() {
    this.initializeDefaultPrompts();
    this.logger.log('LangChain Prompts Service initialized');
  }

  async createPromptTemplate(config: PromptTemplateConfig): Promise<PromptTemplateConfig> {
    try {
      // Validate template
      this.validatePromptTemplate(config);

      // Store template
      this.promptTemplates.set(config.id, {
        ...config,
        version: config.version || '1.0'
      });

      this.logger.log(`Created prompt template: ${config.id} (${config.name})`);
      return config;
    } catch (error) {
      this.logger.error(`Failed to create prompt template: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPromptTemplate(id: string): Promise<PromptTemplateConfig> {
    const template = this.promptTemplates.get(id);
    if (!template) {
      throw new Error(`Prompt template not found: ${id}`);
    }
    return template;
  }

  async updatePromptTemplate(id: string, updates: Partial<PromptTemplateConfig>): Promise<PromptTemplateConfig> {
    const existing = this.promptTemplates.get(id);
    if (!existing) {
      throw new Error(`Prompt template not found: ${id}`);
    }

    const updated = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      version: this.incrementVersion(existing.version)
    };

    this.validatePromptTemplate(updated);
    this.promptTemplates.set(id, updated);

    this.logger.log(`Updated prompt template: ${id}`);
    return updated;
  }

  async deletePromptTemplate(id: string): Promise<void> {
    if (!this.promptTemplates.has(id)) {
      throw new Error(`Prompt template not found: ${id}`);
    }

    this.promptTemplates.delete(id);
    this.logger.log(`Deleted prompt template: ${id}`);
  }

  async listPromptTemplates(category?: PromptCategory): Promise<PromptTemplateConfig[]> {
    let templates = Array.from(this.promptTemplates.values());

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    return templates.sort((a, b) => a.name.localeCompare(b.name));
  }

  async renderPrompt(templateId: string, variables: Record<string, any>): Promise<string> {
    const template = await this.getPromptTemplate(templateId);
    
    try {
      const promptTemplate = PromptTemplate.fromTemplate(template.template);
      const rendered = await promptTemplate.format(variables);
      
      this.logger.debug(`Rendered prompt template: ${templateId}`);
      return rendered;
    } catch (error) {
      this.logger.error(`Failed to render prompt template ${templateId}:`, error);
      throw new Error(`Failed to render prompt: ${error.message}`);
    }
  }

  async optimizePrompt(templateId: string, feedback: PromptFeedback[]): Promise<PromptTemplateConfig> {
    const template = await this.getPromptTemplate(templateId);
    
    // Analyze feedback to identify improvement opportunities
    const analysis = this.analyzeFeedback(feedback);
    
    // Generate optimized version based on feedback
    const optimizedTemplate = await this.generateOptimizedTemplate(template, analysis);
    
    // Create new version
    const optimized = {
      ...template,
      id: `${templateId}_optimized_${Date.now()}`,
      template: optimizedTemplate,
      version: this.incrementVersion(template.version),
      description: `${template.description} (Optimized based on feedback)`
    };

    await this.createPromptTemplate(optimized);
    
    this.logger.log(`Optimized prompt template: ${templateId} -> ${optimized.id}`);
    return optimized;
  }

  private validatePromptTemplate(config: PromptTemplateConfig): void {
    if (!config.id || !config.name || !config.template) {
      throw new Error('Prompt template must have id, name, and template');
    }

    // Validate input variables are present in template
    const templateVars = this.extractTemplateVariables(config.template);
    const missingVars = config.inputVariables.filter(v => !templateVars.includes(v));
    
    if (missingVars.length > 0) {
      throw new Error(`Template missing variables: ${missingVars.join(', ')}`);
    }
  }

  private extractTemplateVariables(template: string): string[] {
    const matches = template.match(/\{(\w+)\}/g);
    return matches ? matches.map(m => m.slice(1, -1)) : [];
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  private analyzeFeedback(feedback: PromptFeedback[]): any {
    const totalScore = feedback.reduce((sum, f) => sum + f.score, 0);
    const averageScore = totalScore / feedback.length;
    
    const lowScoreFeedback = feedback.filter(f => f.score < 3);
    const commonIssues = this.identifyCommonIssues(lowScoreFeedback);
    
    return {
      averageScore,
      totalFeedback: feedback.length,
      lowScoreCount: lowScoreFeedback.length,
      commonIssues
    };
  }

  private identifyCommonIssues(feedback: PromptFeedback[]): string[] {
    // Simple analysis - in production, use more sophisticated NLP
    const issues: string[] = [];
    
    const hasFormatIssues = feedback.some(f => 
      f.comments?.toLowerCase().includes('format') || 
      f.comments?.toLowerCase().includes('structure')
    );
    
    if (hasFormatIssues) {
      issues.push('formatting');
    }

    const hasContentIssues = feedback.some(f => 
      f.comments?.toLowerCase().includes('missing') || 
      f.comments?.toLowerCase().includes('incomplete')
    );
    
    if (hasContentIssues) {
      issues.push('content_completeness');
    }

    return issues;
  }

  private async generateOptimizedTemplate(template: PromptTemplateConfig, analysis: any): Promise<string> {
    // Simple optimization - in production, use LLM to optimize
    let optimized = template.template;
    
    if (analysis.commonIssues.includes('formatting')) {
      optimized = this.improveFormatting(optimized);
    }
    
    if (analysis.commonIssues.includes('content_completeness')) {
      optimized = this.improveCompleteness(optimized);
    }
    
    return optimized;
  }

  private improveFormatting(template: string): string {
    // Add structure improvements
    if (!template.includes('Please provide:')) {
      template += '\n\nPlease provide your response in a clear, structured format.';
    }
    return template;
  }

  private improveCompleteness(template: string): string {
    // Add completeness instructions
    if (!template.includes('comprehensive')) {
      template = template.replace('Analyze', 'Comprehensively analyze');
    }
    return template;
  }

  private initializeDefaultPrompts(): void {
    // Meeting Summarization Prompts
    this.promptTemplates.set('meeting_summary_comprehensive', {
      id: 'meeting_summary_comprehensive',
      name: 'Comprehensive Meeting Summary',
      description: 'Generates detailed meeting summaries with all key elements',
      template: `
Analyze the following meeting transcript and provide a comprehensive summary:

**Meeting Transcript:**
{transcript}

**Meeting Context:**
- Duration: {duration} minutes
- Participants: {participants}
- Meeting Type: {meetingType}

Please provide a structured summary including:

1. **Executive Summary** (2-3 sentences)
2. **Key Discussion Points** (bullet points with timestamps)
3. **Action Items** (with assignees and due dates if mentioned)
4. **Decisions Made** (clear outcomes)
5. **Next Steps** (follow-up actions)
6. **Participant Insights** (contribution levels and engagement)

Format your response as valid JSON with the following structure:
{
  "executiveSummary": "...",
  "keyPoints": [{"topic": "...", "description": "...", "timestamp": "...", "participants": [...]}],
  "actionItems": [{"description": "...", "assignee": "...", "dueDate": "...", "priority": "..."}],
  "decisions": [{"decision": "...", "rationale": "...", "timestamp": "..."}],
  "nextSteps": [...],
  "participantInsights": [{"participant": "...", "contribution": "...", "engagement": "..."}]
}
      `.trim(),
      inputVariables: ['transcript', 'duration', 'participants', 'meetingType'],
      outputFormat: 'json',
      examples: [],
      optimizedFor: 'gemini-pro',
      category: PromptCategory.SUMMARIZATION,
      version: '1.0'
    });

    this.promptTemplates.set('action_items_extraction', {
      id: 'action_items_extraction',
      name: 'Action Items Extraction',
      description: 'Extracts action items with assignees and priorities',
      template: `
Extract action items from the following meeting transcript:

**Transcript:**
{transcript}

**Instructions:**
- Identify specific tasks or commitments mentioned
- Determine who is responsible (if mentioned)
- Assess priority level based on context
- Include relevant timestamps
- Note any mentioned deadlines

Return a JSON array of action items:
[
  {
    "description": "Clear, actionable task description",
    "assignee": "Person responsible (or 'Unassigned' if unclear)",
    "priority": "High/Medium/Low",
    "dueDate": "Mentioned deadline or null",
    "timestamp": "When it was discussed",
    "context": "Surrounding discussion context"
  }
]

If no action items are found, return an empty array.
      `.trim(),
      inputVariables: ['transcript'],
      outputFormat: 'json',
      examples: [],
      optimizedFor: 'gemini-pro',
      category: PromptCategory.EXTRACTION,
      version: '1.0'
    });

    this.promptTemplates.set('qa_answer_generation', {
      id: 'qa_answer_generation',
      name: 'Q&A Answer Generation',
      description: 'Generates answers to questions about meeting content',
      template: `
Answer the following question based on the provided meeting context:

**Question:** {question}

**Meeting Context:**
{context}

**Meeting Metadata:**
- Date: {meetingDate}
- Duration: {duration}
- Participants: {participants}

**Instructions:**
- Provide a direct, accurate answer based only on the meeting content
- Include relevant timestamps and speaker references
- If the information is not available, clearly state this
- Cite specific parts of the transcript when possible
- Suggest related topics if the exact answer isn't available

**Response Format:**
{
  "answer": "Direct answer to the question",
  "confidence": "High/Medium/Low",
  "sources": [
    {
      "timestamp": "MM:SS",
      "speaker": "Speaker name",
      "text": "Relevant quote from transcript"
    }
  ],
  "relatedTopics": ["Topic 1", "Topic 2"],
  "followUpQuestions": ["Suggested question 1", "Suggested question 2"]
}

If no relevant information is found, respond with:
{
  "answer": "I don't have information about [topic] in this meeting.",
  "confidence": "Low",
  "sources": [],
  "relatedTopics": [],
  "followUpQuestions": []
}
      `.trim(),
      inputVariables: ['question', 'context', 'meetingDate', 'duration', 'participants'],
      outputFormat: 'json',
      examples: [],
      optimizedFor: 'gemini-pro',
      category: PromptCategory.QA,
      version: '1.0'
    });

    this.promptTemplates.set('sentiment_analysis', {
      id: 'sentiment_analysis',
      name: 'Meeting Sentiment Analysis',
      description: 'Analyzes sentiment and engagement in meetings',
      template: `
Analyze the sentiment and engagement levels in this meeting transcript:

**Transcript:**
{transcript}

**Participants:**
{participants}

Provide analysis including:

1. **Overall Meeting Sentiment** (Positive/Neutral/Negative with score -1 to 1)
2. **Individual Participant Sentiment** (for each speaker)
3. **Engagement Levels** (High/Medium/Low for each participant)
4. **Emotional Tone** (Professional, Collaborative, Tense, etc.)
5. **Key Sentiment Shifts** (moments where tone changed)

**Response Format:**
{
  "overallSentiment": {
    "sentiment": "Positive/Neutral/Negative",
    "score": 0.5,
    "description": "Brief explanation"
  },
  "participantSentiments": [
    {
      "participant": "Name",
      "sentiment": "Positive/Neutral/Negative",
      "score": 0.3,
      "engagement": "High/Medium/Low",
      "dominantEmotions": ["Professional", "Enthusiastic"]
    }
  ],
  "emotionalTone": ["Professional", "Collaborative"],
  "sentimentShifts": [
    {
      "timestamp": "MM:SS",
      "description": "What changed and why",
      "trigger": "What caused the shift"
    }
  ],
  "engagementLevel": "High/Medium/Low"
}
      `.trim(),
      inputVariables: ['transcript', 'participants'],
      outputFormat: 'json',
      examples: [],
      optimizedFor: 'gemini-pro',
      category: PromptCategory.ANALYSIS,
      version: '1.0'
    });

    this.promptTemplates.set('decision_extraction', {
      id: 'decision_extraction',
      name: 'Decision Extraction',
      description: 'Extracts decisions made during meetings',
      template: `
Identify and extract all decisions made during this meeting:

**Transcript:**
{transcript}

**Context:**
- Meeting Type: {meetingType}
- Participants: {participants}

Look for:
- Explicit decisions ("We decided to...", "It's agreed that...")
- Implicit decisions (clear consensus, approved actions)
- Rejected options (what was considered but not chosen)
- Deferred decisions (postponed for later)

**Response Format:**
{
  "decisions": [
    {
      "decision": "Clear statement of what was decided",
      "type": "Approved/Rejected/Deferred",
      "rationale": "Why this decision was made",
      "timestamp": "When it was decided",
      "participants": ["Who was involved in the decision"],
      "impact": "Expected impact or consequences",
      "nextSteps": ["What needs to happen next"]
    }
  ],
  "deferredItems": [
    {
      "item": "What was deferred",
      "reason": "Why it was deferred",
      "followUp": "When/how it will be addressed"
    }
  ]
}

If no decisions were made, return empty arrays.
      `.trim(),
      inputVariables: ['transcript', 'meetingType', 'participants'],
      outputFormat: 'json',
      examples: [],
      optimizedFor: 'gemini-pro',
      category: PromptCategory.EXTRACTION,
      version: '1.0'
    });

    this.logger.log('Initialized default prompt templates');
  }
}