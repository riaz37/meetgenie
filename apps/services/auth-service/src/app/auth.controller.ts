import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Headers,
  HttpStatus,
  HttpException,
  Logger,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SubscriptionTier } from '@prisma/client';

export class AuthenticateDto {
  sessionToken: string;
}

export class UpdateSubscriptionDto {
  tier: SubscriptionTier;
}

export class UpdatePreferencesDto {
  preferences: Record<string, any>;
}

export class DeactivateUserDto {
  reason?: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Authenticate user with session token
   */
  @Post('authenticate')
  async authenticate(@Body() body: AuthenticateDto) {
    try {
      const result = await this.authService.authenticateUser(body.sessionToken);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Authentication failed',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Get current user information
   */
  @Get('me')
  async getCurrentUser(@Headers('authorization') authHeader: string) {
    try {
      const sessionToken = this.extractSessionToken(authHeader);
      const result = await this.authService.authenticateUser(sessionToken);
      return {
        success: true,
        data: result.user,
      };
    } catch (error) {
      this.logger.error('Failed to get current user:', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to get user information',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Get user by ID
   */
  @Get('users/:userId')
  async getUser(@Param('userId') userId: string) {
    try {
      const user = await this.authService.getAuthenticatedUser(userId);
      return {
        success: true,
        data: user,
      };
    } catch (error) {
      this.logger.error('Failed to get user:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to get user',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Check user permission
   */
  @Get('users/:userId/permissions/:permission')
  async checkPermission(
    @Param('userId') userId: string,
    @Param('permission') permission: string,
  ) {
    try {
      const hasPermission = await this.authService.checkPermission(
        userId,
        permission,
      );
      return {
        success: true,
        data: {
          userId,
          permission,
          hasPermission,
        },
      };
    } catch (error) {
      this.logger.error('Failed to check permission:', error);
      throw new HttpException(
        'Failed to check permission',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update user subscription tier
   */
  @Put('users/:userId/subscription')
  async updateSubscription(
    @Param('userId') userId: string,
    @Body() body: UpdateSubscriptionDto,
  ) {
    try {
      const user = await this.authService.updateSubscriptionTier(
        userId,
        body.tier,
      );
      return {
        success: true,
        data: user,
      };
    } catch (error) {
      this.logger.error('Failed to update subscription:', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to update subscription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update user preferences
   */
  @Put('users/:userId/preferences')
  async updatePreferences(
    @Param('userId') userId: string,
    @Body() body: UpdatePreferencesDto,
  ) {
    try {
      await this.authService.updateUserPreferences(userId, body.preferences);
      return {
        success: true,
        message: 'Preferences updated successfully',
      };
    } catch (error) {
      this.logger.error('Failed to update preferences:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to update preferences',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get user activity status
   */
  @Get('users/:userId/activity')
  async getUserActivity(@Param('userId') userId: string) {
    try {
      const activity = await this.authService.getUserActivityStatus(userId);
      return {
        success: true,
        data: activity,
      };
    } catch (error) {
      this.logger.error('Failed to get user activity:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to get user activity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Deactivate user account
   */
  @Post('users/:userId/deactivate')
  async deactivateUser(
    @Param('userId') userId: string,
    @Body() body: DeactivateUserDto,
  ) {
    try {
      await this.authService.deactivateUser(userId, body.reason);
      return {
        success: true,
        message: 'User account deactivated successfully',
      };
    } catch (error) {
      this.logger.error('Failed to deactivate user:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to deactivate user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Reactivate user account
   */
  @Post('users/:userId/reactivate')
  async reactivateUser(@Param('userId') userId: string) {
    try {
      await this.authService.reactivateUser(userId);
      return {
        success: true,
        message: 'User account reactivated successfully',
      };
    } catch (error) {
      this.logger.error('Failed to reactivate user:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to reactivate user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get user statistics (admin only)
   */
  @Get('admin/stats')
  async getUserStats() {
    try {
      const stats = await this.authService.getUserStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Failed to get user stats:', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to get user statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Sync user from Clerk (admin operation)
   */
  @Post('admin/sync/:clerkUserId')
  async syncUserFromClerk(@Param('clerkUserId') clerkUserId: string) {
    try {
      await this.authService.syncUserFromClerk(clerkUserId);
      return {
        success: true,
        message: 'User synced successfully from Clerk',
      };
    } catch (error) {
      this.logger.error('Failed to sync user from Clerk:', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to sync user from Clerk',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Batch sync users (admin operation)
   */
  @Post('admin/batch-sync')
  async batchSyncUsers(@Query('limit') limit?: string) {
    try {
      const syncLimit = limit ? parseInt(limit, 10) : 100;
      await this.authService.batchSyncUsers(syncLimit);
      return {
        success: true,
        message: 'Batch user sync completed successfully',
      };
    } catch (error) {
      this.logger.error('Failed to perform batch sync:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to perform batch sync',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Extract session token from Authorization header
   */
  private extractSessionToken(authHeader: string): string {
    if (!authHeader) {
      throw new HttpException(
        'Authorization header is required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new HttpException(
        'Invalid authorization header format',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return parts[1];
  }
}
