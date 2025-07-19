import { 
  Controller, 
  Get, 
  Put, 
  Body, 
  Param, 
  UseGuards,
  HttpStatus,
  HttpException,
  Logger,
  Query
} from '@nestjs/common';
import { 
  AuthGuard, 
  RequirePermissions,
  CurrentUser,
  UserPreferences,
  UpdateUserDto,
  UserResponse,
  UserSession,
  SubscriptionTier
} from '@meetgenie/shared';
import { AppService } from './app.service';

@Controller('profile')
@UseGuards(AuthGuard)
export class UserProfileController {
  private readonly logger = new Logger(UserProfileController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  async getProfile(@CurrentUser() user: UserSession): Promise<UserResponse> {
    try {
      const userProfile = await this.appService.getUserById({ userId: user.userId });
      if (!userProfile) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return userProfile;
    } catch (error) {
      this.logger.error('Error getting user profile:', error);
      throw error;
    }
  }

  @Put()
  async updateProfile(
    @CurrentUser() user: UserSession,
    @Body() updateData: UpdateUserDto
  ): Promise<UserResponse> {
    try {
      return await this.appService.updateUser({
        userId: user.userId,
        updateData
      });
    } catch (error) {
      this.logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: UserSession): Promise<UserPreferences> {
    try {
      const userProfile = await this.appService.getUserById({ userId: user.userId });
      if (!userProfile) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return userProfile.preferences;
    } catch (error) {
      this.logger.error('Error getting user preferences:', error);
      throw error;
    }
  }

  @Put('preferences')
  async updatePreferences(
    @CurrentUser() user: UserSession,
    @Body() preferences: Partial<UserPreferences>
  ): Promise<UserResponse> {
    try {
      return await this.appService.updateUserPreferences({
        userId: user.userId,
        preferences
      });
    } catch (error) {
      this.logger.error('Error updating user preferences:', error);
      throw error;
    }
  }

  @Get('permissions')
  async getPermissions(@CurrentUser() user: UserSession): Promise<{ permissions: string[] }> {
    try {
      const permissions = await this.appService.getUserPermissions({ userId: user.userId });
      return { permissions };
    } catch (error) {
      this.logger.error('Error getting user permissions:', error);
      throw error;
    }
  }
}

@Controller('admin/users')
@UseGuards(AuthGuard)
@RequirePermissions(['admin:users'])
export class AdminUserController {
  private readonly logger = new Logger(AdminUserController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  async listUsers(
    @Query() filters?: {
      limit?: number;
      offset?: number;
      subscriptionTier?: SubscriptionTier;
      search?: string;
    }
  ): Promise<UserResponse[]> {
    try {
      return await this.appService.listUsers(filters || {});
    } catch (error) {
      this.logger.error('Error listing users:', error);
      throw error;
    }
  }

  @Get(':userId')
  async getUser(@Param('userId') userId: string): Promise<UserResponse> {
    try {
      const user = await this.appService.getUserById({ userId });
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return user;
    } catch (error) {
      this.logger.error('Error getting user:', error);
      throw error;
    }
  }

  @Put(':userId')
  async updateUser(
    @Param('userId') userId: string,
    @Body() updateData: UpdateUserDto
  ): Promise<UserResponse> {
    try {
      return await this.appService.updateUser({ userId, updateData });
    } catch (error) {
      this.logger.error('Error updating user:', error);
      throw error;
    }
  }

  @Put(':userId/subscription')
  async updateUserSubscription(
    @Param('userId') userId: string,
    @Body() data: { subscriptionTier: SubscriptionTier }
  ): Promise<UserResponse> {
    try {
      return await this.appService.updateUserSubscription({
        userId,
        subscriptionTier: data.subscriptionTier
      });
    } catch (error) {
      this.logger.error('Error updating user subscription:', error);
      throw error;
    }
  }
}