import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { KafkaService, UserEvent, ClerkSyncService, UserSession } from '@meetgenie/shared';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly clerkSyncService: ClerkSyncService
  ) {}

  async onModuleInit() {
    // Subscribe to user events
    await this.kafkaService.subscribe(
      'user-events',
      'auth-service-group',
      this.handleUserEvent.bind(this)
    );
  }

  getData(): { message: string } {
    return { message: 'Auth Service API' };
  }

  @MessagePattern('auth.validate_token')
  async validateToken(@Payload() data: { token: string }): Promise<UserSession | null> {
    try {
      this.logger.log('Validating Clerk token');
      
      const session = await this.clerkSyncService.validateClerkToken(data.token);
      
      if (session) {
        // Update last active timestamp
        await this.updateUserLastActive(session.userId);
        
        // Publish user activity event
        const userEvent: UserEvent = {
          id: `auth-${Date.now()}`,
          timestamp: new Date(),
          version: '1.0.0',
          source: 'auth-service',
          userId: session.userId,
          type: 'user.activity',
          data: { action: 'token_validated', timestamp: new Date() },
        };

        await this.kafkaService.publish('user-events', userEvent);
      }
      
      return session;
    } catch (error) {
      this.logger.error('Error validating token:', error);
      return null;
    }
  }

  @MessagePattern('auth.get_user_session')
  async getUserSession(@Payload() data: { clerkUserId: string }): Promise<UserSession | null> {
    try {
      this.logger.log(`Getting user session for Clerk ID: ${data.clerkUserId}`);
      
      const user = await this.clerkSyncService.getUserByClerkId(data.clerkUserId);
      if (!user) {
        return null;
      }

      return {
        userId: user.id!,
        clerkUserId: user.clerkUserId,
        email: user.email,
        name: user.name,
        permissions: this.getUserPermissions(user.subscriptionTier),
        subscriptionTier: user.subscriptionTier || 'free'
      };
    } catch (error) {
      this.logger.error('Error getting user session:', error);
      return null;
    }
  }

  @MessagePattern('auth.sync_user')
  async syncUser(@Payload() data: { clerkUserId: string }) {
    try {
      this.logger.log(`Syncing user: ${data.clerkUserId}`);
      
      const result = await this.clerkSyncService.syncUserFromClerk(data.clerkUserId);
      
      if (result.success && result.userId) {
        // Publish user sync event
        const userEvent: UserEvent = {
          id: `auth-${Date.now()}`,
          timestamp: new Date(),
          version: '1.0.0',
          source: 'auth-service',
          userId: result.userId,
          type: 'user.synced',
          data: { clerkUserId: data.clerkUserId, syncStatus: result.syncStatus },
        };

        await this.kafkaService.publish('user-events', userEvent);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error syncing user:', error);
      return { success: false, error: error.message, syncStatus: 'error' };
    }
  }

  @MessagePattern('auth.login')
  async handleLogin(@Payload() data: any) {
    this.logger.log('Processing login request', data);
    
    // Publish user login event
    const userEvent: UserEvent = {
      id: `auth-${Date.now()}`,
      timestamp: new Date(),
      version: '1.0.0',
      source: 'auth-service',
      userId: data.userId,
      type: 'user.login',
      data: { email: data.email, timestamp: new Date() },
    };

    await this.kafkaService.publish('user-events', userEvent);
    
    return { success: true, message: 'Login processed' };
  }

  @MessagePattern('auth.logout')
  async handleLogout(@Payload() data: any) {
    this.logger.log('Processing logout request', data);
    
    // Publish user logout event
    const userEvent: UserEvent = {
      id: `auth-${Date.now()}`,
      timestamp: new Date(),
      version: '1.0.0',
      source: 'auth-service',
      userId: data.userId,
      type: 'user.logout',
      data: { timestamp: new Date() },
    };

    await this.kafkaService.publish('user-events', userEvent);
    
    return { success: true, message: 'Logout processed' };
  }

  private async handleUserEvent(message: unknown) {
    try {
      const event = JSON.parse(message.value.toString());
      this.logger.log('Received user event:', event);
      
      // Process user events as needed
      switch (event.type) {
        case 'user.created':
          this.logger.log('User created event received');
          break;
        case 'user.updated':
          this.logger.log('User updated event received');
          break;
        default:
          this.logger.log('Unknown user event type:', event.type);
      }
    } catch (error) {
      this.logger.error('Error processing user event:', error);
    }
  }

  private async updateUserLastActive(userId: string): Promise<void> {
    try {
      // This would typically update the user's last active timestamp
      // For now, we'll just log it since we don't have direct database access here
      this.logger.log(`Updating last active for user: ${userId}`);
    } catch (error) {
      this.logger.error('Error updating user last active:', error);
    }
  }

  private getUserPermissions(subscriptionTier?: string): string[] {
    const basePermissions = ['read:meetings', 'create:meetings'];
    
    switch (subscriptionTier) {
      case 'pro':
        return [...basePermissions, 'advanced:summaries', 'export:data'];
      case 'enterprise':
        return [...basePermissions, 'advanced:summaries', 'export:data', 'admin:users'];
      default:
        return basePermissions;
    }
  }
}
