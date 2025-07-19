import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';
import {
  User,
  SubscriptionTier,
  TonePreference,
  SummaryFormat,
  UserPreferences,
} from '../models/user.model';
import {
  ClerkUser,
  ClerkWebhookEvent,
  ClerkWebhookType,
  SyncStatus,
  ClerkSyncResult,
  UserSession,
} from '../interfaces/clerk.interface';
import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { EnvironmentConfig } from '../config/environment.config';
import * as crypto from 'crypto';

@Injectable()
export class ClerkSyncService {
  private readonly logger = new Logger(ClerkSyncService.name);
  private readonly clerkClient;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService<EnvironmentConfig>,
  ) {
    const clerkConfig = this.configService.get('clerk', { infer: true });
    this.clerkClient = createClerkClient({
      secretKey: clerkConfig?.secretKey,
    });
  }

  /**
   * Validate Clerk webhook signature for security
   */
  validateClerkWebhook(payload: string, signature: string): boolean {
    try {
      const clerkConfig = this.configService.get('clerk', { infer: true });
      if (!clerkConfig?.secretKey) {
        this.logger.error('Clerk secret key not configured');
        return false;
      }

      // Extract timestamp and signature from header
      const elements = signature.split(',');
      const timestamp = elements
        .find((el) => el.startsWith('t='))
        ?.substring(2);
      const sig = elements.find((el) => el.startsWith('v1='))?.substring(3);

      if (!timestamp || !sig) {
        this.logger.error('Invalid webhook signature format');
        return false;
      }

      // Create expected signature
      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', clerkConfig.secretKey)
        .update(signedPayload, 'utf8')
        .digest('hex');

      // Compare signatures
      return crypto.timingSafeEqual(
        Buffer.from(sig, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch (error) {
      this.logger.error('Error validating webhook signature:', error);
      return false;
    }
  }

  /**
   * Process Clerk webhook event
   */
  async processWebhookEvent(
    event: ClerkWebhookEvent,
  ): Promise<ClerkSyncResult> {
    try {
      this.logger.log(`Processing Clerk webhook event: ${event.type}`);

      switch (event.type) {
        case ClerkWebhookType.USER_CREATED:
          return await this.handleUserCreated(event.data as ClerkUser);

        case ClerkWebhookType.USER_UPDATED:
          return await this.handleUserUpdated(event.data as ClerkUser);

        case ClerkWebhookType.USER_DELETED:
          return await this.handleUserDeleted((event.data as ClerkUser).id);

        default:
          this.logger.warn(`Unhandled webhook event type: ${event.type}`);
          return { success: true, syncStatus: SyncStatus.SYNCED };
      }
    } catch (error) {
      this.logger.error('Error processing webhook event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        syncStatus: SyncStatus.ERROR,
      };
    }
  }

  /**
   * Handle user created event from Clerk
   */
  async handleUserCreated(clerkUser: ClerkUser): Promise<ClerkSyncResult> {
    try {
      this.logger.log(`Creating user from Clerk: ${clerkUser.id}`);

      // Check if user already exists
      const existingUser = await this.getUserByClerkId(clerkUser.id);
      if (existingUser) {
        this.logger.warn(`User already exists for Clerk ID: ${clerkUser.id}`);
        return {
          success: true,
          userId: existingUser.id,
          syncStatus: SyncStatus.SYNCED,
        };
      }

      // Create new user
      const userData = this.mapClerkUserToLocal(clerkUser);
      const user = await this.databaseService.create('users', userData, User);

      this.logger.log(`User created successfully: ${user.id}`);
      return {
        success: true,
        userId: user.id,
        syncStatus: SyncStatus.SYNCED,
      };
    } catch (error) {
      this.logger.error('Error creating user from Clerk:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        syncStatus: SyncStatus.ERROR,
      };
    }
  }

  /**
   * Handle user updated event from Clerk
   */
  async handleUserUpdated(clerkUser: ClerkUser): Promise<ClerkSyncResult> {
    try {
      this.logger.log(`Updating user from Clerk: ${clerkUser.id}`);

      const existingUser = await this.getUserByClerkId(clerkUser.id);
      if (!existingUser) {
        this.logger.warn(
          `User not found for Clerk ID: ${clerkUser.id}, creating new user`,
        );
        return await this.handleUserCreated(clerkUser);
      }

      // Update user data
      const updateData = {
        email: this.getPrimaryEmail(clerkUser),
        name: this.getFullName(clerkUser),
        lastClerkSyncAt: new Date(),
        clerkSyncStatus: SyncStatus.SYNCED,
        updatedAt: new Date(),
      };

      if (!existingUser.id) {
        throw new Error('User ID is required for update operation');
      }

      const updatedUser = await this.databaseService.update(
        'users',
        existingUser.id,
        updateData,
        User,
      );

      this.logger.log(`User updated successfully: ${updatedUser.id}`);
      return {
        success: true,
        userId: updatedUser.id,
        syncStatus: SyncStatus.SYNCED,
      };
    } catch (error) {
      this.logger.error('Error updating user from Clerk:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        syncStatus: SyncStatus.ERROR,
      };
    }
  }

  /**
   * Handle user deleted event from Clerk
   */
  async handleUserDeleted(clerkUserId: string): Promise<ClerkSyncResult> {
    try {
      this.logger.log(`Deleting user from Clerk: ${clerkUserId}`);

      const existingUser = await this.getUserByClerkId(clerkUserId);
      if (!existingUser) {
        this.logger.warn(`User not found for Clerk ID: ${clerkUserId}`);
        return { success: true, syncStatus: SyncStatus.DELETED };
      }

      // Mark user as deleted instead of hard delete to preserve data integrity
      const updateData = {
        clerkSyncStatus: SyncStatus.DELETED,
        lastClerkSyncAt: new Date(),
        updatedAt: new Date(),
      };

      if (!existingUser.id) {
        throw new Error('User ID is required for update operation');
      }

      await this.databaseService.update(
        'users',
        existingUser.id,
        updateData,
        User,
      );

      this.logger.log(`User marked as deleted: ${existingUser.id}`);
      return {
        success: true,
        userId: existingUser.id,
        syncStatus: SyncStatus.DELETED,
      };
    } catch (error) {
      this.logger.error('Error deleting user from Clerk:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        syncStatus: SyncStatus.ERROR,
      };
    }
  }

  /**
   * Get user by Clerk ID
   */
  async getUserByClerkId(clerkUserId: string): Promise<User | null> {
    try {
      const users = await this.databaseService.findMany(
        'users',
        { clerkUserId },
        User,
        { limit: 1 },
      );
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      this.logger.error('Error finding user by Clerk ID:', error);
      return null;
    }
  }

  /**
   * Sync user from Clerk by ID
   */
  async syncUserFromClerk(clerkUserId: string): Promise<ClerkSyncResult> {
    try {
      this.logger.log(`Syncing user from Clerk: ${clerkUserId}`);

      // Get user from Clerk
      const clerkApiUser = await this.clerkClient.users.getUser(clerkUserId);
      if (!clerkApiUser) {
        return {
          success: false,
          error: 'User not found in Clerk',
          syncStatus: SyncStatus.ERROR,
        };
      }

      // Convert Clerk API response to our ClerkUser interface
      const clerkUser: ClerkUser = {
        id: clerkApiUser.id,
        email_addresses: clerkApiUser.emailAddresses.map((email) => ({
          id: email.id,
          email_address: email.emailAddress,
        })),
        first_name: clerkApiUser.firstName,
        last_name: clerkApiUser.lastName,
        image_url: clerkApiUser.imageUrl,
        created_at: clerkApiUser.createdAt,
        updated_at: clerkApiUser.updatedAt,
        last_sign_in_at: clerkApiUser.lastSignInAt || undefined,
      };

      // Check if user exists locally
      const existingUser = await this.getUserByClerkId(clerkUserId);

      if (existingUser) {
        return await this.handleUserUpdated(clerkUser);
      } else {
        return await this.handleUserCreated(clerkUser);
      }
    } catch (error) {
      this.logger.error('Error syncing user from Clerk:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        syncStatus: SyncStatus.ERROR,
      };
    }
  }

  /**
   * Validate Clerk token and get user session
   */
  async validateClerkToken(sessionId: string): Promise<UserSession | null> {
    try {
      // Get session from Clerk using session ID
      const session = await this.clerkClient.sessions.getSession(sessionId);
      if (!session || !session.userId) {
        return null;
      }

      // Get user from local database
      const user = await this.getUserByClerkId(session.userId);
      if (!user || user.clerkSyncStatus === SyncStatus.DELETED) {
        return null;
      }

      if (!user.id) {
        throw new Error('User ID is required for session validation');
      }

      return {
        userId: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        name: user.name,
        permissions: this.getUserPermissions(user),
        subscriptionTier: user.subscriptionTier || SubscriptionTier.FREE,
        sessionId: session.id,
        expiresAt: new Date(session.expireAt),
      };
    } catch (error) {
      this.logger.error('Error validating Clerk token:', error);
      return null;
    }
  }

  /**
   * Create default user preferences
   */
  createDefaultUserPreferences(): UserPreferences {
    return {
      language: 'en',
      summaryFormat: SummaryFormat.BULLET_POINTS,
      tone: TonePreference.PROFESSIONAL,
      focusAreas: [],
      notifications: {
        email: true,
        push: true,
        meetingReminders: true,
        summaryReady: true,
        actionItemUpdates: true,
      },
    };
  }

  /**
   * Map Clerk user to local user format
   */
  private mapClerkUserToLocal(clerkUser: ClerkUser): Partial<User> {
    return {
      email: this.getPrimaryEmail(clerkUser),
      name: this.getFullName(clerkUser),
      clerkUserId: clerkUser.id,
      subscriptionTier: SubscriptionTier.FREE,
      preferences: this.createDefaultUserPreferences(),
      clerkSyncStatus: SyncStatus.SYNCED,
      lastClerkSyncAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActive: new Date(),
    };
  }

  /**
   * Get primary email from Clerk user
   */
  private getPrimaryEmail(clerkUser: ClerkUser): string {
    if (!clerkUser.email_addresses || clerkUser.email_addresses.length === 0) {
      throw new Error('No email addresses found for user');
    }
    return clerkUser.email_addresses[0].email_address;
  }

  /**
   * Get full name from Clerk user
   */
  private getFullName(clerkUser: ClerkUser): string {
    const firstName = clerkUser.first_name || '';
    const lastName = clerkUser.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    // Fallback to email if no name is provided
    if (!fullName) {
      return this.getPrimaryEmail(clerkUser).split('@')[0];
    }

    return fullName;
  }

  /**
   * Get user permissions based on subscription tier
   */
  private getUserPermissions(user: User): string[] {
    const basePermissions = ['read:meetings', 'create:meetings'];

    switch (user.subscriptionTier) {
      case SubscriptionTier.PRO:
        return [...basePermissions, 'advanced:summaries', 'export:data'];
      case SubscriptionTier.ENTERPRISE:
        return [
          ...basePermissions,
          'advanced:summaries',
          'export:data',
          'admin:users',
        ];
      default:
        return basePermissions;
    }
  }

  /**
   * Batch synchronization job for reconciling missed webhook events
   */
  async batchSyncUsers(limit = 100): Promise<void> {
    try {
      this.logger.log('Starting batch user synchronization');

      // Get users that need sync (error status or old sync date)
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - 24); // 24 hours ago

      const usersToSync = await this.databaseService.findMany(
        'users',
        {
          clerkSyncStatus: [SyncStatus.ERROR, SyncStatus.PENDING],
        },
        User,
        { limit },
      );

      this.logger.log(`Found ${usersToSync.length} users to sync`);

      for (const user of usersToSync) {
        try {
          await this.syncUserFromClerk(user.clerkUserId);
          // Add delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          this.logger.error(`Failed to sync user ${user.id}:`, error);
        }
      }

      this.logger.log('Batch user synchronization completed');
    } catch (error) {
      this.logger.error('Error in batch user synchronization:', error);
    }
  }
}
