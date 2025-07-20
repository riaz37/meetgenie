import { Controller, Get, Logger } from '@nestjs/common';
import { PrismaService } from '@meetgenie/shared';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async getHealth() {
    const timestamp = new Date().toISOString();
    
    try {
      // Check database connectivity
      const dbHealth = await this.prismaService.healthCheck();
      const dbInfo = await this.prismaService.getHealthInfo();

      return {
        status: dbHealth ? 'ok' : 'degraded',
        timestamp,
        service: 'auth-service',
        version: '1.0.0',
        checks: {
          database: {
            status: dbHealth ? 'healthy' : 'unhealthy',
            ...dbInfo,
          },
        },
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'error',
        timestamp,
        service: 'auth-service',
        version: '1.0.0',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('detailed')
  async getDetailedHealth() {
    const timestamp = new Date().toISOString();
    
    try {
      // Check database connectivity and get detailed info
      const dbHealth = await this.prismaService.healthCheck();
      const dbInfo = await this.prismaService.getHealthInfo();
      const connectionPool = await this.prismaService.getConnectionPoolStatus();

      // Get user count as a basic functionality test
      const userCount = await this.prismaService.user.count();

      return {
        status: dbHealth ? 'ok' : 'degraded',
        timestamp,
        service: 'auth-service',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        checks: {
          database: {
            status: dbHealth ? 'healthy' : 'unhealthy',
            ...dbInfo,
            connectionPool,
            userCount,
          },
        },
      };
    } catch (error) {
      this.logger.error('Detailed health check failed:', error);
      return {
        status: 'error',
        timestamp,
        service: 'auth-service',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}