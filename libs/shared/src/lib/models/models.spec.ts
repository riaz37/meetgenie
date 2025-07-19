import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { User, SubscriptionTier, TonePreference, SummaryFormat } from './user.model';
import { Meeting, MeetingPlatform, MeetingStatus, ParticipantRole } from './meeting.model';
import { Transcript, ProcessingStatus } from './transcript.model';
import { Summary, Priority, ActionItemStatus, SummaryType } from './summary.model';

describe('Data Models', () => {
  describe('User Model', () => {
    it('should create a valid user', async () => {
      const userData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
        clerkUserId: 'clerk_123',
        subscriptionTier: SubscriptionTier.FREE,
        preferences: {
          language: 'en',
          summaryFormat: SummaryFormat.BULLET_POINTS,
          tone: TonePreference.PROFESSIONAL,
          focusAreas: ['technical', 'business'],
          notifications: {
            email: true,
            push: false,
            meetingReminders: true,
            summaryReady: true,
            actionItemUpdates: false,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      const user = plainToClass(User, userData);
      const errors = await validate(user);

      expect(errors).toHaveLength(0);
      expect(user.email).toBe('test@example.com');
      expect(user.subscriptionTier).toBe(SubscriptionTier.FREE);
    });

    it('should fail validation with invalid email', async () => {
      const userData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'invalid-email',
        name: 'Test User',
        clerkUserId: 'clerk_123',
        subscriptionTier: SubscriptionTier.FREE,
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      const user = plainToClass(User, userData);
      const errors = await validate(user);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.property === 'email')).toBe(true);
    });
  });

  describe('Meeting Model', () => {
    it('should create a valid meeting', async () => {
      const meetingData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Meeting',
        description: 'A test meeting',
        scheduledTime: new Date(),
        duration: 3600,
        platform: MeetingPlatform.ZOOM,
        platformMeetingId: 'zoom_123',
        organizerId: '123e4567-e89b-12d3-a456-426614174001',
        status: MeetingStatus.SCHEDULED,
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const meeting = plainToClass(Meeting, meetingData);
      const errors = await validate(meeting);

      expect(errors).toHaveLength(0);
      expect(meeting.title).toBe('Test Meeting');
      expect(meeting.platform).toBe(MeetingPlatform.ZOOM);
    });

    it('should fail validation with invalid status', async () => {
      const meetingData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Meeting',
        scheduledTime: new Date(),
        duration: 3600,
        platform: MeetingPlatform.ZOOM,
        platformMeetingId: 'zoom_123',
        organizerId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'invalid_status' as any,
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const meeting = plainToClass(Meeting, meetingData);
      const errors = await validate(meeting);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.property === 'status')).toBe(true);
    });
  });

  describe('Transcript Model', () => {
    it('should create a valid transcript', async () => {
      const transcriptData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        meetingId: '123e4567-e89b-12d3-a456-426614174001',
        language: 'en',
        confidence: 0.95,
        processingStatus: ProcessingStatus.COMPLETED,
        wordCount: 1500,
        duration: 3600,
        segments: [],
        speakers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const transcript = plainToClass(Transcript, transcriptData);
      const errors = await validate(transcript);

      expect(errors).toHaveLength(0);
      expect(transcript.confidence).toBe(0.95);
      expect(transcript.processingStatus).toBe(ProcessingStatus.COMPLETED);
    });

    it('should fail validation with confidence out of range', async () => {
      const transcriptData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        meetingId: '123e4567-e89b-12d3-a456-426614174001',
        language: 'en',
        confidence: 1.5, // Invalid: > 1.0
        processingStatus: ProcessingStatus.COMPLETED,
        wordCount: 1500,
        duration: 3600,
        segments: [],
        speakers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const transcript = plainToClass(Transcript, transcriptData);
      const errors = await validate(transcript);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.property === 'confidence')).toBe(true);
    });
  });

  describe('Summary Model', () => {
    it('should create a valid summary', async () => {
      const summaryData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        meetingId: '123e4567-e89b-12d3-a456-426614174001',
        version: 1,
        content: {
          keyPoints: [],
          actionItems: [],
          decisions: [],
          participantInsights: [],
        },
        summaryType: SummaryType.STANDARD,
        generatedAt: new Date(),
        createdAt: new Date(),
        actionItems: [],
        decisions: [],
      };

      const summary = plainToClass(Summary, summaryData);
      const errors = await validate(summary);

      expect(errors).toHaveLength(0);
      expect(summary.version).toBe(1);
      expect(summary.summaryType).toBe(SummaryType.STANDARD);
    });

    it('should fail validation with invalid version', async () => {
      const summaryData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        meetingId: '123e4567-e89b-12d3-a456-426614174001',
        version: 0, // Invalid: < 1
        content: {
          keyPoints: [],
          actionItems: [],
          decisions: [],
          participantInsights: [],
        },
        summaryType: SummaryType.STANDARD,
        generatedAt: new Date(),
        createdAt: new Date(),
        actionItems: [],
        decisions: [],
      };

      const summary = plainToClass(Summary, summaryData);
      const errors = await validate(summary);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.property === 'version')).toBe(true);
    });
  });
});