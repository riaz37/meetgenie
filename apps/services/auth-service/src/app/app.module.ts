import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from '@meetgenie/shared';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { ClerkWebhookController } from './clerk-webhook.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    SharedModule,
  ],
  controllers: [AppController, HealthController, ClerkWebhookController],
  providers: [AppService],
})
export class AppModule {}
