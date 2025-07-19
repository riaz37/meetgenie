export interface BaseEvent {
  id: string;
  timestamp: Date;
  version: string;
  source: string;
}

export interface MeetingEvent extends BaseEvent {
  meetingId: string;
  userId: string;
  type: 'meeting.created' | 'meeting.started' | 'meeting.ended' | 'meeting.updated';
  data: any;
}

export interface TranscriptionEvent extends BaseEvent {
  meetingId: string;
  transcriptId: string;
  type: 'transcription.started' | 'transcription.segment' | 'transcription.completed' | 'transcription.failed';
  data: any;
}

export interface PaymentEvent extends BaseEvent {
  userId: string;
  subscriptionId?: string;
  type: 'payment.succeeded' | 'payment.failed' | 'subscription.created' | 'subscription.updated' | 'subscription.canceled';
  data: any;
}

export interface UserEvent extends BaseEvent {
  userId: string;
  type: 'user.created' | 'user.updated' | 'user.deleted' | 'user.login' | 'user.logout';
  data: any;
}

export interface SummaryEvent extends BaseEvent {
  meetingId: string;
  summaryId: string;
  type: 'summary.started' | 'summary.completed' | 'summary.failed';
  data: any;
}

export interface QAEvent extends BaseEvent {
  meetingId: string;
  userId: string;
  type: 'qa.question' | 'qa.answer' | 'qa.search';
  data: any;
}

export interface AdminEvent extends BaseEvent {
  adminId: string;
  type: 'admin.user.action' | 'admin.system.config' | 'admin.audit.log';
  data: any;
}

export interface BillingEvent extends BaseEvent {
  userId: string;
  subscriptionId?: string;
  type: 'billing.invoice.created' | 'billing.invoice.paid' | 'billing.usage.recorded';
  data: any;
}