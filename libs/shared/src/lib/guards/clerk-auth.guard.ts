import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkSyncService } from '../services/auth/clerk-sync.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Decorator to mark routes as public (no authentication required)
 */
export const Public = () => (target: any, key?: string, descriptor?: PropertyDescriptor) => {
  if (descriptor) {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, descriptor.value);
  } else {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, target);
  }
};

/**
 * Decorator to require specific permissions for a route
 */
export const RequirePermissions = (...permissions: string[]) => 
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, permissions, descriptor.value);
    } else {
      Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, permissions, target);
    }
  };

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(
    private readonly clerkSyncService: ClerkSyncService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }

    try {
      // Extract session token from Bearer token
      const sessionToken = this.extractSessionToken(authHeader);
      
      // Validate session with Clerk
      const userSession = await this.clerkSyncService.validateClerkToken(sessionToken);
      
      if (!userSession) {
        throw new UnauthorizedException('Invalid or expired session token');
      }

      // Add user information to request object
      request.user = userSession;

      // Check required permissions if specified
      const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
        REQUIRED_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasRequiredPermissions = requiredPermissions.every(permission =>
          userSession.permissions.includes(permission)
        );

        if (!hasRequiredPermissions) {
          throw new UnauthorizedException(
            `Required permissions: ${requiredPermissions.join(', ')}`
          );
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractSessionToken(authHeader: string): string {
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    return parts[1];
  }
}

/**
 * Decorator to get current user from request
 */
export const CurrentUser = () => (target: any, key: string, index: number) => {
  const existingMetadata = Reflect.getMetadata('custom:paramtypes', target, key) || [];
  existingMetadata[index] = 'user';
  Reflect.defineMetadata('custom:paramtypes', existingMetadata, target, key);
};