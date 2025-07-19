import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  DatabaseService,
  User,
  CreateUserDto,
  UpdateUserDto,
  UserResponse,
  UserPreferences,
  SubscriptionTier,
  KafkaService,
  UserEvent,
} from '@meetgenie/shared';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly kafkaService: KafkaService,
  ) {}

  getData(): { message: string } {
    return { message: 'User Management Service API' };
  }

  @MessagePattern('user.create')
  async createUser(
    @Payload() createUserDto: CreateUserDto,
  ): Promise<UserResponse> {
    try {
      this.logger.log(`Creating user: ${createUserDto.email}`);

      // Check if user already exists
      const existingUsers = await this.databaseService.findMany(
        'users',
        { email: createUserDto.email },
        User,
        { limit: 1 },
      );

      if (existingUsers.length > 0) {
        throw new BadRequestException('User with this email already exists');
      }

      // Create user with default preferences
      const userData = {
        ...createUserDto,
        subscriptionTier: SubscriptionTier.FREE,
        preferences: createUserDto.preferences || this.getDefaultPreferences(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      };

      const user = await this.databaseService.create('users', userData, User);

      // Publish user created event
      const userEvent: UserEvent = {
        id: `user-${Date.now()}`,
        timestamp: new Date(),
        version: '1.0.0',
        source: 'user-management-service',
        userId: user.id!,
        type: 'user.created',
        data: { email: user.email, name: user.name },
      };

      await this.kafkaService.publish('user-events', userEvent);

      this.logger.log(`User created successfully: ${user.id}`);
      return this.mapUserToResponse(user);
    } catch (error) {
      this.logger.error('Error creating user:', error);
      throw error;
    }
  }

  @MessagePattern('user.get_by_id')
  async getUserById(
    @Payload() data: { userId: string },
  ): Promise<UserResponse | null> {
    try {
      this.logger.log(`Getting user by ID: ${data.userId}`);

      const user = await this.databaseService.findById(
        'users',
        data.userId,
        User,
      );
      if (!user) {
        return null;
      }

      return this.mapUserToResponse(user);
    } catch (error) {
      this.logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  @MessagePattern('user.get_by_clerk_id')
  async getUserByClerkId(
    @Payload() data: { clerkUserId: string },
  ): Promise<UserResponse | null> {
    try {
      this.logger.log(`Getting user by Clerk ID: ${data.clerkUserId}`);

      const users = await this.databaseService.findMany(
        'users',
        { clerkUserId: data.clerkUserId },
        User,
        { limit: 1 },
      );

      if (users.length === 0) {
        return null;
      }

      return this.mapUserToResponse(users[0]);
    } catch (error) {
      this.logger.error('Error getting user by Clerk ID:', error);
      throw error;
    }
  }

  @MessagePattern('user.update')
  async updateUser(
    @Payload() data: { userId: string; updateData: UpdateUserDto },
  ): Promise<UserResponse> {
    try {
      this.logger.log(`Updating user: ${data.userId}`);

      const existingUser = await this.databaseService.findById(
        'users',
        data.userId,
        User,
      );
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      const updateData = {
        ...data.updateData,
        updatedAt: new Date(),
      };

      const updatedUser = await this.databaseService.update(
        'users',
        data.userId,
        updateData,
        User,
        data.userId,
      );

      // Publish user updated event
      const userEvent: UserEvent = {
        id: `user-${Date.now()}`,
        timestamp: new Date(),
        version: '1.0.0',
        source: 'user-management-service',
        userId: updatedUser.id!,
        type: 'user.updated',
        data: { changes: data.updateData },
      };

      await this.kafkaService.publish('user-events', userEvent);

      this.logger.log(`User updated successfully: ${updatedUser.id}`);
      return this.mapUserToResponse(updatedUser);
    } catch (error) {
      this.logger.error('Error updating user:', error);
      throw error;
    }
  }

  @MessagePattern('user.update_preferences')
  async updateUserPreferences(
    @Payload() data: { userId: string; preferences: Partial<UserPreferences> },
  ): Promise<UserResponse> {
    try {
      this.logger.log(`Updating user preferences: ${data.userId}`);

      const existingUser = await this.databaseService.findById(
        'users',
        data.userId,
        User,
      );
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Merge with existing preferences
      const updatedPreferences = {
        ...existingUser.preferences,
        ...data.preferences,
      };

      const updateData = {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      };

      const updatedUser = await this.databaseService.update(
        'users',
        data.userId,
        updateData,
        User,
        data.userId,
      );

      // Publish preferences updated event
      const userEvent: UserEvent = {
        id: `user-${Date.now()}`,
        timestamp: new Date(),
        version: '1.0.0',
        source: 'user-management-service',
        userId: updatedUser.id!,
        type: 'user.preferences_updated',
        data: { preferences: data.preferences },
      };

      await this.kafkaService.publish('user-events', userEvent);

      this.logger.log(
        `User preferences updated successfully: ${updatedUser.id}`,
      );
      return this.mapUserToResponse(updatedUser);
    } catch (error) {
      this.logger.error('Error updating user preferences:', error);
      throw error;
    }
  }

  @MessagePattern('user.update_subscription')
  async updateUserSubscription(
    @Payload() data: { userId: string; subscriptionTier: SubscriptionTier },
  ): Promise<UserResponse> {
    try {
      this.logger.log(
        `Updating user subscription: ${data.userId} to ${data.subscriptionTier}`,
      );

      const existingUser = await this.databaseService.findById(
        'users',
        data.userId,
        User,
      );
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      const updateData = {
        subscriptionTier: data.subscriptionTier,
        updatedAt: new Date(),
      };

      const updatedUser = await this.databaseService.update(
        'users',
        data.userId,
        updateData,
        User,
        data.userId,
      );

      // Publish subscription updated event
      const userEvent: UserEvent = {
        id: `user-${Date.now()}`,
        timestamp: new Date(),
        version: '1.0.0',
        source: 'user-management-service',
        userId: updatedUser.id!,
        type: 'user.subscription_updated',
        data: {
          oldTier: existingUser.subscriptionTier,
          newTier: data.subscriptionTier,
        },
      };

      await this.kafkaService.publish('user-events', userEvent);

      this.logger.log(
        `User subscription updated successfully: ${updatedUser.id}`,
      );
      return this.mapUserToResponse(updatedUser);
    } catch (error) {
      this.logger.error('Error updating user subscription:', error);
      throw error;
    }
  }

  @MessagePattern('user.update_last_active')
  async updateLastActive(@Payload() data: { userId: string }): Promise<void> {
    try {
      const updateData = {
        lastActive: new Date(),
        updatedAt: new Date(),
      };

      await this.databaseService.update('users', data.userId, updateData, User);
    } catch (error) {
      this.logger.error('Error updating last active:', error);
      // Don't throw error for last active updates to avoid breaking other operations
    }
  }

  @MessagePattern('user.delete')
  async deleteUser(@Payload() data: { userId: string }): Promise<void> {
    try {
      this.logger.log(`Deleting user: ${data.userId}`);

      const existingUser = await this.databaseService.findById(
        'users',
        data.userId,
        User,
      );
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      await this.databaseService.delete('users', data.userId, data.userId);

      // Publish user deleted event
      const userEvent: UserEvent = {
        id: `user-${Date.now()}`,
        timestamp: new Date(),
        version: '1.0.0',
        source: 'user-management-service',
        userId: data.userId,
        type: 'user.deleted',
        data: { email: existingUser.email, name: existingUser.name },
      };

      await this.kafkaService.publish('user-events', userEvent);

      this.logger.log(`User deleted successfully: ${data.userId}`);
    } catch (error) {
      this.logger.error('Error deleting user:', error);
      throw error;
    }
  }

  @MessagePattern('user.list')
  async listUsers(
    @Payload()
    data: {
      limit?: number;
      offset?: number;
      subscriptionTier?: SubscriptionTier;
      search?: string;
    },
  ): Promise<UserResponse[]> {
    try {
      this.logger.log('Listing users with filters:', data);

      const filters: any = {};
      if (data.subscriptionTier) {
        filters.subscriptionTier = data.subscriptionTier;
      }

      const users = await this.databaseService.findMany(
        'users',
        filters,
        User,
        {
          limit: data.limit || 50,
          offset: data.offset || 0,
          orderBy: 'createdAt',
          orderDirection: 'desc',
        },
      );

      return users.map((user) => this.mapUserToResponse(user));
    } catch (error) {
      this.logger.error('Error listing users:', error);
      throw error;
    }
  }

  @MessagePattern('user.get_permissions')
  async getUserPermissions(
    @Payload() data: { userId: string },
  ): Promise<string[]> {
    try {
      const user = await this.databaseService.findById(
        'users',
        data.userId,
        User,
      );
      if (!user) {
        return [];
      }

      return this.getUserPermissionsByTier(user.subscriptionTier);
    } catch (error) {
      this.logger.error('Error getting user permissions:', error);
      return [];
    }
  }

  private mapUserToResponse(user: User): UserResponse {
    return {
      id: user.id!,
      email: user.email,
      name: user.name,
      subscriptionTier: user.subscriptionTier || SubscriptionTier.FREE,
      preferences: user.preferences || this.getDefaultPreferences(),
      createdAt: user.createdAt!,
      lastActive: user.lastActive!,
    };
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      language: 'en',
      summaryFormat: 'bullet_points' as any,
      tone: 'professional' as any,
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

  private getUserPermissionsByTier(
    subscriptionTier?: SubscriptionTier,
  ): string[] {
    const basePermissions = ['read:meetings', 'create:meetings'];

    switch (subscriptionTier) {
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
}
