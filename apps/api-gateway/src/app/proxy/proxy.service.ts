import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import axios, { AxiosResponse } from 'axios';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly serviceRegistry = new Map<string, string[]>();

  constructor(private configService: ConfigService) {
    this.initializeServiceRegistry();
  }

  private initializeServiceRegistry() {
    // Service discovery configuration - in production this would be dynamic
    this.serviceRegistry.set('auth-service', [
      `http://localhost:${this.configService.get('AUTH_SERVICE_PORT', 3002)}`
    ]);
    this.serviceRegistry.set('user-management-service', [
      `http://localhost:${this.configService.get('USER_SERVICE_PORT', 3003)}`
    ]);
    this.serviceRegistry.set('meeting-service', [
      `http://localhost:${this.configService.get('MEETING_SERVICE_PORT', 3004)}`
    ]);
    this.serviceRegistry.set('transcription-service', [
      `http://localhost:${this.configService.get('TRANSCRIPTION_SERVICE_PORT', 3005)}`
    ]);
    this.serviceRegistry.set('summarization-service', [
      `http://localhost:${this.configService.get('SUMMARIZATION_SERVICE_PORT', 3006)}`
    ]);
    this.serviceRegistry.set('qa-service', [
      `http://localhost:${this.configService.get('QA_SERVICE_PORT', 3007)}`
    ]);
    this.serviceRegistry.set('payment-service', [
      `http://localhost:${this.configService.get('PAYMENT_SERVICE_PORT', 3008)}`
    ]);
    this.serviceRegistry.set('billing-service', [
      `http://localhost:${this.configService.get('BILLING_SERVICE_PORT', 3009)}`
    ]);
    this.serviceRegistry.set('admin-service', [
      `http://localhost:${this.configService.get('ADMIN_SERVICE_PORT', 3010)}`
    ]);
  }

  async proxyRequest(serviceName: string, req: Request, res: Response, next: NextFunction) {
    try {
      const serviceUrl = this.getServiceUrl(serviceName);
      if (!serviceUrl) {
        throw new HttpException(`Service ${serviceName} not available`, HttpStatus.SERVICE_UNAVAILABLE);
      }

      // Remove the service prefix from the path
      const servicePath = req.path.replace(`/api/${serviceName.split('-')[0]}`, '');
      const targetUrl = `${serviceUrl}/api${servicePath}`;

      this.logger.debug(`Proxying ${req.method} ${req.path} to ${targetUrl}`);

      const response: AxiosResponse = await axios({
        method: req.method as any,
        url: targetUrl,
        data: req.body,
        params: req.query,
        headers: {
          ...req.headers,
          host: undefined, // Remove host header to avoid conflicts
        },
        timeout: 30000,
        validateStatus: () => true, // Don't throw on HTTP error status codes
      });

      // Forward response headers
      Object.keys(response.headers).forEach(key => {
        res.setHeader(key, response.headers[key]);
      });

      res.status(response.status).json(response.data);
    } catch (error) {
      this.logger.error(`Error proxying request to ${serviceName}:`, error.message);
      
      if (error.code === 'ECONNREFUSED') {
        res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          error: 'Service temporarily unavailable',
          service: serviceName,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: 'Internal server error',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private getServiceUrl(serviceName: string): string | null {
    const instances = this.serviceRegistry.get(serviceName);
    if (!instances || instances.length === 0) {
      return null;
    }

    // Simple round-robin load balancing
    const instance = instances[Math.floor(Math.random() * instances.length)];
    return instance;
  }

  async checkServiceHealth(serviceName: string): Promise<boolean> {
    try {
      const serviceUrl = this.getServiceUrl(serviceName);
      if (!serviceUrl) return false;

      const response = await axios.get(`${serviceUrl}/api/health`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      this.logger.warn(`Health check failed for ${serviceName}:`, error.message);
      return false;
    }
  }

  getRegisteredServices(): string[] {
    return Array.from(this.serviceRegistry.keys());
  }
}