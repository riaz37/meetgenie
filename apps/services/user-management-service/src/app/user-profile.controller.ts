import { 
  Controller, 
  Get, 
  Put, 
  Body, 
  Param, 
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
  Logger
} from '@nestjs/common';
import { 
  AuthGuard, 
  RequirePermissions,
  UserPreferences,
  UpdateUserDto,
  UserResponse
} from '@meetgenie/shared';
import { AppService } from './app.service';

@Controller('profile')
@UseGuards(AuthGuard)
export class UserProfileController {
  private readonly logger = new Logger(UserProfileController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  async getProfile(@Request() req: any): Promise<UserResponse> {
    try {
      const user = await this.appService.getUserById({ userId: req.userId });
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return user;
    } catch (error) {
      this.logger.error('Error getting user profile:', error);
      throw error;
    }
  }

  @Put()
  async updateProfile(
    @Request() req: any,
    @Body() updateData: UpdateUserDto
  ): Promise<UserResponse> {
    try {
      return await this.appService.updateUser({
        userId: req.userId,
        updateData
      });
    } catch (error) {
      this.logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  @Get('preferences')
  async getPreferences(@Request() req: any): Promise<UserPreferences> {
    try {
      const user = await this.appService.getUserById({ userId: req.userId });
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return user.preferences;
    } catch (error) {
      this.logger.error('Error getting user preferences:', error);
      throw error;
    }
  }

  @Put('preferences')
  async updatePreferences(
    @Request() req: any,
    @Body() preferences: Partial<UserPreferences>
  ): Promise<UserResponse> {
    try {
      return await this.appService.updateUserPreferences({
        userId: req.userId,
        preferences
      });
    } catch (error) {
      this.logger.error('Error updating user preferences:', error);
      throw error;
    }
  }

  @Get('permissions')
  async getPermissions(@Request() req: any): Promise<{ permissions: string[] }> {
    try {
      const permissions = await this.appService.getUserPermissions({ userId: req.userId });
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
    @Request() req: any,
    @Body() filters?: {
      limit?: number;
      offset?: number;
      subscriptionTier?: string;
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
    @Body() data: { subscriptionTier: string }
  ): Promise<UserResponse> {
    try {
      return await this.appService.updateUserSubscription({
        userId,
        subscriptionTier: data.subscriptionTier as any
      });
    } catch (error) {
      this.logger.error('Error updating user subscription:', error);
      throw error;
    }
  }
}