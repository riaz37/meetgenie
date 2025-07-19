import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from '@meetgenie/shared';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { ProxyModule } from './proxy/proxy.module';
import { ProxyService } from './proxy/proxy.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    SharedModule,
    ProxyModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, ProxyService],
  exports: [ProxyService],
})
export class AppModule {}
