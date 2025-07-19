import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('health')
export class HealthController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      version: '1.0.0',
    };
  }

  @Get('services')
  async getServicesHealth() {
    return this.appService.checkServicesHealth();
  }
}