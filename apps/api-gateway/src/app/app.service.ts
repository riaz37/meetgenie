import { Injectable } from '@nestjs/common';
import { ProxyService } from './proxy/proxy.service';

@Injectable()
export class AppService {
  constructor(private proxyService: ProxyService) {}

  getData(): { message: string } {
    return { message: 'MeetGenie API Gateway' };
  }

  async checkServicesHealth() {
    const services = this.proxyService.getRegisteredServices();
    const healthChecks = await Promise.allSettled(
      services.map(async (service) => ({
        service,
        healthy: await this.proxyService.checkServiceHealth(service),
      }))
    );

    return {
      timestamp: new Date().toISOString(),
      services: healthChecks.map((result) => 
        result.status === 'fulfilled' ? result.value : { service: 'unknown', healthy: false }
      ),
    };
  }
}
