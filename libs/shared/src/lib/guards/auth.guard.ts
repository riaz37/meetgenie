import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  UnauthorizedException,
  Logger 
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkSyncService } from '../services/clerk-sync.service';
import { UserSession } from '../interfaces/clerk.interface';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly clerkSyncService: ClerkSyncService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromHeader(request);

      if (!token) {
        throw new UnauthorizedException('No authentication token provided');
      }

      // Validate token with Clerk
      const session = await this.clerkSyncService.validateClerkToken(token);
      if (!session) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // Attach user session to request
      request.user = session;
      request.userId = session.userId;

      // Check if route requires specific permissions
      const requiredPermissions = this.reflector.get<string[]>('permissions', context.getHandler());
      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasPermission = this.checkPermissions(session, requiredPermissions);
        if (!hasPermission) {
          throw new UnauthorizedException('Insufficient permissions');
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private checkPermissions(session: UserSession, requiredPermissions: string[]): boolean {
    return requiredPermissions.every(permission => 
      session.permissions.includes(permission)
    );
  }
}

// Decorator for requiring specific permissions
export const RequirePermissions = (permissions: string[]) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflector.createDecorator<string[]>('permissions')(permissions)(target, propertyKey, descriptor);
  };
};

// Decorator for requiring admin role
export const RequireAdmin = () => {
  return RequirePermissions(['admin:users']);
};

// Decorator for getting current user from request
export const CurrentUser = () => {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    // This would be implemented as a parameter decorator
    // For now, we'll use it as a marker
  };
};