import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  const microservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'admin-service',
        brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      },
      consumer: {
        groupId: 'admin-service-group',
      },
    },
  });

  await app.startAllMicroservices();
  
  const port = process.env.ADMIN_SERVICE_PORT || 3010;
  await app.listen(port);
  
  Logger.log(`⚙️ Admin Service is running on: http://localhost:${port}/api`);
  Logger.log(`📋 Health check available at: http://localhost:${port}/api/health`);
}

bootstrap();
