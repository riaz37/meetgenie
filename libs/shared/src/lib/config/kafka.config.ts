import { registerAs } from '@nestjs/config';

export default registerAs('kafka', () => ({
  clientId: process.env['KAFKA_CLIENT_ID'] || 'meetgenie-microservices',
  brokers: process.env['KAFKA_BROKERS']?.split(',') || ['localhost:9092'],
  groupId: process.env['KAFKA_GROUP_ID'] || 'meetgenie-group',
  topics: {
    meetingEvents: 'meeting-events',
    transcriptionEvents: 'transcription-events',
    paymentEvents: 'payment-events',
    userEvents: 'user-events',
    summaryEvents: 'summary-events',
    qaEvents: 'qa-events',
    adminEvents: 'admin-events',
    billingEvents: 'billing-events',
  },
}));