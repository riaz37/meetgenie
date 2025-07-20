import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { ClerkSyncService, PrismaService } from '@meetgenie/shared';

describe('AuthService', () => {
  let service: AuthService;
  let mockClerkSyncService: jest.Mocked<ClerkSyncService>;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Create mock services
    mockClerkSyncService = {
      validateClerkToken: jest.fn(),
      syncUserFromClerk: jest.fn(),
      batchSyncUsers: jest.fn(),
    } as any;

    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ClerkSyncService,
          useValue: mockClerkSyncService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('authenticateUser', () => {
    it('should authenticate user successfully', async () => {
      const mockUserSession = {
        userId: 'user-123',
        clerkUserId: 'clerk-123',
        email: 'test@example.com',
        name: 'Test User',
        permissions: ['read:meetings'],
        subscriptionTier: 'free',
        sessionId: 'session-123',
        expiresAt: new Date(),
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        clerkUserId: 'clerk-123',
        subscriptionTier: 'free',
        clerkSyncStatus: 'synced',
      };

      mockClerkSyncService.validateClerkToken.mockResolvedValue(mockUserSession);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrismaService.user.update.mockResolvedValue(mockUser as any);

      const result = await service.authenticateUser('valid-session-token');

      expect(result).toBeDefined();
      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
      expect(mockClerkSyncService.validateClerkToken).toHaveBeenCalledWith('valid-session-token');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      mockClerkSyncService.validateClerkToken.mockResolvedValue(null);

      await expect(service.authenticateUser('invalid-token')).rejects.toThrow(
        'Invalid or expired session token'
      );
    });
  });

  describe('checkPermission', () => {
    it('should return true for user with required permission', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        clerkUserId: 'clerk-123',
        subscriptionTier: 'pro',
        clerkSyncStatus: 'synced',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.checkPermission('user-123', 'read:meetings');

      expect(result).toBe(true);
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      mockPrismaService.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(80)  // activeUsers
        .mockResolvedValueOnce(10); // newUsersThisMonth

      mockPrismaService.user.groupBy.mockResolvedValue([
        { subscriptionTier: 'free', _count: 70 },
        { subscriptionTier: 'pro', _count: 25 },
        { subscriptionTier: 'enterprise', _count: 5 },
      ] as any);

      const result = await service.getUserStats();

      expect(result).toEqual({
        totalUsers: 100,
        activeUsers: 80,
        newUsersThisMonth: 10,
        usersByTier: {
          free: 70,
          pro: 25,
          enterprise: 5,
        },
      });
    });
  });
});