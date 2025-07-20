import { Injectable, Logger, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ClerkSyncService, PrismaService } from '@meetgenie/shared';
import { ConfigService } from '@nestjs/config';
import { EnvironmentConfig } from '@meetgenie/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  clerkUserId: string;
  subscriptionTier: SubscriptionTier;
  permissions: string[];
  isActive: boolean;
}

export interface AuthenticationResult {
  user: AuthenticatedUser;
  sessionId?: string;
  expiresAt?: Date;
}

export interface UserRegistrationData {
  email: string;
  name: string;
  clerkUserId: string;
  subscriptionTier?: SubscriptionTier;
  preferences?: Record<string, any>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly clerkSyncService: ClerkSyncService,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService<EnvironmentConfig>,
  ) {}

  /**
   * Authenticate user using Clerk session token
   */
  async authenticateUser(sessionToken: string): Promise<AuthenticationResult> {
    try {
      this.logger.debug(`Authenticating user with session token`);

      // Validate session with Clerk
      const userSession = await this.clerkSyncService.validateClerkToken(sessionToken);
      if (!userSession) {
        throw new UnauthorizedException('Invalid or expired session token');
      }

      // Get user from database
      const user = await this.prismaService.user.findUnique({
        where: { id: userSession.userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if user is active
      if (user.clerkSyncStatus === 'deleted') {
        throw new UnauthorizedException('User account is deactivated');
      }

      // Update last active timestamp
      await this.prismaService.user.update({
        where: { id: user.id },
        data: { lastActive: new Date() },
      });

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        clerkUserId: user.clerkUserId,
        subscriptionTier: user.subscriptionTier || SubscriptionTier.free,
        permissions: this.getUserPermissions(user.subscriptionTier || SubscriptionTier.free),
        isActive: user.clerkSyncStatus !== 'deleted',
      };

      this.logger.log(`User authenticated successfully: ${user.email}`);

      return {
        user: authenticatedUser,
        sessionId: userSession.sessionId,
        expiresAt: userSession.expiresAt,
      };
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Get user by ID with authentication check
   */
  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.clerkSyncStatus === 'deleted') {
        throw new UnauthorizedException('User account is deactivated');
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        clerkUserId: user.clerkUserId,
        subscriptionTier: user.subscriptionTier || SubscriptionTier.free,
        permissions: this.getUserPermissions(user.subscriptionTier || SubscriptionTier.free),
        isActive: user.clerkSyncStatus !== 'deleted',
      };
    } catch (error) {
      this.logger.error('Error getting authenticated user:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Failed to get user information');
    }
  }

  /**
   * Check if user has required permission
   */
  async checkPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const user = await this.getAuthenticatedUser(userId);
      return user.permissions.includes(permission);
    } catch (error) {
      this.logger.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Require specific permission or throw exception
   */
  async requirePermission(userId: string, permission: string): Promise<void> {
    const hasPermission = await this.checkPermission(userId, permission);
    if (!hasPermission) {
      throw new ForbiddenException(`Required permission: ${permission}`);
    }
  }

  /**
   * Check if user has any of the required permissions
   */
  async checkAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    try {
      const user = await this.getAuthenticatedUser(userId);
      return permissions.some(permission => user.permissions.includes(permission));
    } catch (error) {
      this.logger.error('Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Update user subscription tier
   */
  async updateSubscriptionTier(userId: string, tier: SubscriptionTier): Promise<AuthenticatedUser> {
    try {
      const updatedUser = await this.prismaService.user.update({
        where: { id: userId },
        data: { 
          subscriptionTier: tier,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Updated subscription tier for user ${userId} to ${tier}`);

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        clerkUserId: updatedUser.clerkUserId,
        subscriptionTier: updatedUser.subscriptionTier || SubscriptionTier.free,
        permissions: this.getUserPermissions(updatedUser.subscriptionTier || SubscriptionTier.free),
        isActive: updatedUser.clerkSyncStatus !== 'deleted',
      };
    } catch (error) {
      this.logger.error('Error updating subscription tier:', error);
      throw new Error('Failed to update subscription tier');
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: Record<string, any>): Promise<void> {
    try {
      await this.prismaService.user.update({
        where: { id: userId },
        data: { 
          preferences,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Updated preferences for user ${userId}`);
    } catch (error) {
      this.logger.error('Error updating user preferences:', error);
      throw new Error('Failed to update user preferences');
    }
  }

  /**
   * Get user activity status
   */
  async getUserActivityStatus(userId: string): Promise<{
    lastActive: Date;
    isRecentlyActive: boolean;
    daysSinceLastActive: number;
  }> {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { id: userId },
        select: { lastActive: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const now = new Date();
      const daysSinceLastActive = Math.floor(
        (now.getTime() - user.lastActive.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        lastActive: user.lastActive,
        isRecentlyActive: daysSinceLastActive <= 7, // Active within last 7 days
        daysSinceLastActive,
      };
    } catch (error) {
      this.logger.error('Error getting user activity status:', error);
      throw new Error('Failed to get user activity status');
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string, reason?: string): Promise<void> {
    try {
      await this.prismaService.user.update({
        where: { id: userId },
        data: { 
          clerkSyncStatus: 'deleted',
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Deactivated user account ${userId}${reason ? ` - Reason: ${reason}` : ''}`);
    } catch (error) {
      this.logger.error('Error deactivating user:', error);
      throw new Error('Failed to deactivate user account');
    }
  }

  /**
   * Reactivate user account
   */
  async reactivateUser(userId: string): Promise<void> {
    try {
      await this.prismaService.user.update({
        where: { id: userId },
        data: { 
          clerkSyncStatus: 'synced',
          updatedAt: new Date(),
          lastActive: new Date(),
        },
      });

      this.logger.log(`Reactivated user account ${userId}`);
    } catch (error) {
      this.logger.error('Error reactivating user:', error);
      throw new Error('Failed to reactivate user account');
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    newUsersThisMonth: number;
    usersByTier: Record<string, number>;
  }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        activeUsers,
        newUsersThisMonth,
        usersByTier,
      ] = await Promise.all([
        this.prismaService.user.count({
          where: { clerkSyncStatus: { not: 'deleted' } },
        }),
        this.prismaService.user.count({
          where: {
            clerkSyncStatus: { not: 'deleted' },
            lastActive: { gte: sevenDaysAgo },
          },
        }),
        this.prismaService.user.count({
          where: {
            clerkSyncStatus: { not: 'deleted' },
            createdAt: { gte: startOfMonth },
          },
        }),
        this.prismaService.user.groupBy({
          by: ['subscriptionTier'],
          where: { clerkSyncStatus: { not: 'deleted' } },
          _count: true,
        }),
      ]);

      const tierStats = usersByTier.reduce((acc, item) => {
        acc[item.subscriptionTier || 'free'] = item._count;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalUsers,
        activeUsers,
        newUsersThisMonth,
        usersByTier: tierStats,
      };
    } catch (error) {
      this.logger.error('Error getting user statistics:', error);
      throw new Error('Failed to get user statistics');
    }
  }

  /**
   * Get user permissions based on subscription tier
   */
  private getUserPermissions(tier: SubscriptionTier): string[] {
    const basePermissions = ['read:meetings', 'create:meetings', 'read:profile', 'update:profile'];

    switch (tier) {
      case SubscriptionTier.pro:
        return [
          ...basePermissions,
          'advanced:summaries',
          'export:data',
          'create:integrations',
          'advanced:analytics',
        ];
      case SubscriptionTier.enterprise:
        return [
          ...basePermissions,
          'advanced:summaries',
          'export:data',
          'create:integrations',
          'advanced:analytics',
          'admin:users',
          'admin:billing',
          'bulk:operations',
        ];
      default:
        return basePermissions;
    }
  }

  /**
   * Sync user data from Clerk (manual trigger)
   */
  async syncUserFromClerk(clerkUserId: string): Promise<void> {
    try {
      const result = await this.clerkSyncService.syncUserFromClerk(clerkUserId);
      if (!result.success) {
        throw new Error(result.error || 'Sync failed');
      }
      this.logger.log(`Successfully synced user from Clerk: ${clerkUserId}`);
    } catch (error) {
      this.logger.error('Error syncing user from Clerk:', error);
      throw new Error('Failed to sync user from Clerk');
    }
  }

  /**
   * Batch sync users (admin operation)
   */
  async batchSyncUsers(limit = 100): Promise<void> {
    try {
      await this.clerkSyncService.batchSyncUsers(limit);
      this.logger.log('Batch user sync completed');
    } catch (error) {
      this.logger.error('Error in batch user sync:', error);
      throw new Error('Failed to perform batch user sync');
    }
  }
}