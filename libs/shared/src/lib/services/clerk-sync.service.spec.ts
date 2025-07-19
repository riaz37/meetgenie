import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClerkSyncService } from './clerk-sync.service';
import { DatabaseService } from './database.service';
import { ClerkUser, ClerkWebhookType, SyncStatus } from '../interfaces/clerk.interface';
import { User, SubscriptionTier } from '../models/user.model';

describe('ClerkSyncService', () => {
  let service: ClerkSyncService;
  let databaseService: jest.Mocked<DatabaseService>;
  let configService: jest.Mocked<ConfigService>;

  const mockClerkUser: ClerkUser = {
    id: 'clerk_123',
    email_addresses: [{ id: 'email_1', email_address: 'test@example.com' }],
    first_name: 'John',
    last_name: 'Doe',
    created_at: Date.now(),
    updated_at: Date.now()
  };

  const mockUser: User = {
    id: 'user_123',
    email: 'test@example.com',
    name: 'John Doe',
    clerkUserId: 'clerk_123',
    subscriptionTier: SubscriptionTier.FREE,
    preferences: {
      language: 'en',
      summaryFormat: 'bullet_points' as any,
      tone: 'professional' as any,
      focusAreas: [],
      notifications: {
        email: true,
        push: true,
        meetingReminders: true,
        summaryReady: true,
        actionItemUpdates: true
      }
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActive: new Date(),
    clerkSyncStatus: SyncStatus.SYNCED,
    lastClerkSyncAt: new Date()
  };

  beforeEach(async () => {
    const mockDatabaseService = {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn()
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue({
        secretKey: 'test-secret-key'
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClerkSyncService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigService, useValue: mockConfigService }
      ],
    }).compile();

    service = module.get<ClerkSyncService>(ClerkSyncService);
    databaseService = module.get(DatabaseService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleUserCreated', () => {
    it('should create a new user when Clerk user is created', async () => {
      databaseService.findMany.mockResolvedValue([]);
      databaseService.create.mockResolvedValue(mockUser);

      const result = await service.handleUserCreated(mockClerkUser);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(mockUser.id);
      expect(result.syncStatus).toBe(SyncStatus.SYNCED);
      expect(databaseService.create).toHaveBeenCalledWith(
        'users',
        expect.objectContaining({
          email: 'test@example.com',
          name: 'John Doe',
          clerkUserId: 'clerk_123',
          subscriptionTier: SubscriptionTier.FREE
        }),
        User
      );
    });

    it('should return existing user if already exists', async () => {
      databaseService.findMany.mockResolvedValue([mockUser]);

      const result = await service.handleUserCreated(mockClerkUser);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(mockUser.id);
      expect(result.syncStatus).toBe(SyncStatus.SYNCED);
      expect(databaseService.create).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      databaseService.findMany.mockRejectedValue(new Error('Database error'));

      const result = await service.handleUserCreated(mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(result.syncStatus).toBe(SyncStatus.ERROR);
    });
  });

  describe('handleUserUpdated', () => {
    it('should update existing user', async () => {
      databaseService.findMany.mockResolvedValue([mockUser]);
      databaseService.update.mockResolvedValue({ ...mockUser, name: 'John Updated' });

      const result = await service.handleUserUpdated(mockClerkUser);

      expect(result.success).toBe(true);
      expect(result.syncStatus).toBe(SyncStatus.SYNCED);
      expect(databaseService.update).toHaveBeenCalledWith(
        'users',
        mockUser.id,
        expect.objectContaining({
          email: 'test@example.com',
          name: 'John Doe',
          clerkSyncStatus: SyncStatus.SYNCED
        }),
        User
      );
    });

    it('should create user if not found during update', async () => {
      databaseService.findMany.mockResolvedValue([]);
      databaseService.create.mockResolvedValue(mockUser);

      const result = await service.handleUserUpdated(mockClerkUser);

      expect(result.success).toBe(true);
      expect(databaseService.create).toHaveBeenCalled();
    });
  });

  describe('handleUserDeleted', () => {
    it('should mark user as deleted', async () => {
      databaseService.findMany.mockResolvedValue([mockUser]);
      databaseService.update.mockResolvedValue({ ...mockUser, clerkSyncStatus: SyncStatus.DELETED });

      const result = await service.handleUserDeleted('clerk_123');

      expect(result.success).toBe(true);
      expect(result.syncStatus).toBe(SyncStatus.DELETED);
      expect(databaseService.update).toHaveBeenCalledWith(
        'users',
        mockUser.id,
        expect.objectContaining({
          clerkSyncStatus: SyncStatus.DELETED
        }),
        User
      );
    });

    it('should handle non-existent user deletion', async () => {
      databaseService.findMany.mockResolvedValue([]);

      const result = await service.handleUserDeleted('clerk_123');

      expect(result.success).toBe(true);
      expect(result.syncStatus).toBe(SyncStatus.DELETED);
      expect(databaseService.update).not.toHaveBeenCalled();
    });
  });

  describe('getUserByClerkId', () => {
    it('should return user by Clerk ID', async () => {
      databaseService.findMany.mockResolvedValue([mockUser]);

      const result = await service.getUserByClerkId('clerk_123');

      expect(result).toEqual(mockUser);
      expect(databaseService.findMany).toHaveBeenCalledWith(
        'users',
        { clerkUserId: 'clerk_123' },
        User,
        { limit: 1 }
      );
    });

    it('should return null if user not found', async () => {
      databaseService.findMany.mockResolvedValue([]);

      const result = await service.getUserByClerkId('clerk_123');

      expect(result).toBeNull();
    });
  });

  describe('createDefaultUserPreferences', () => {
    it('should create default preferences', () => {
      const preferences = service.createDefaultUserPreferences();

      expect(preferences).toEqual({
        language: 'en',
        summaryFormat: 'bullet_points',
        tone: 'professional',
        focusAreas: [],
        notifications: {
          email: true,
          push: true,
          meetingReminders: true,
          summaryReady: true,
          actionItemUpdates: true
        }
      });
    });
  });

  describe('processWebhookEvent', () => {
    it('should process user.created event', async () => {
      databaseService.findMany.mockResolvedValue([]);
      databaseService.create.mockResolvedValue(mockUser);

      const event = {
        type: ClerkWebhookType.USER_CREATED,
        data: mockClerkUser,
        object: 'event',
        timestamp: Date.now()
      };

      const result = await service.processWebhookEvent(event);

      expect(result.success).toBe(true);
      expect(result.syncStatus).toBe(SyncStatus.SYNCED);
    });

    it('should process user.updated event', async () => {
      databaseService.findMany.mockResolvedValue([mockUser]);
      databaseService.update.mockResolvedValue(mockUser);

      const event = {
        type: ClerkWebhookType.USER_UPDATED,
        data: mockClerkUser,
        object: 'event',
        timestamp: Date.now()
      };

      const result = await service.processWebhookEvent(event);

      expect(result.success).toBe(true);
      expect(result.syncStatus).toBe(SyncStatus.SYNCED);
    });

    it('should process user.deleted event', async () => {
      databaseService.findMany.mockResolvedValue([mockUser]);
      databaseService.update.mockResolvedValue({ ...mockUser, clerkSyncStatus: SyncStatus.DELETED });

      const event = {
        type: ClerkWebhookType.USER_DELETED,
        data: mockClerkUser,
        object: 'event',
        timestamp: Date.now()
      };

      const result = await service.processWebhookEvent(event);

      expect(result.success).toBe(true);
      expect(result.syncStatus).toBe(SyncStatus.DELETED);
    });

    it('should handle unknown event types', async () => {
      const event = {
        type: 'unknown.event' as any,
        data: mockClerkUser,
        object: 'event',
        timestamp: Date.now()
      };

      const result = await service.processWebhookEvent(event);

      expect(result.success).toBe(true);
      expect(result.syncStatus).toBe(SyncStatus.SYNCED);
    });
  });
});