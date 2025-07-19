import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from '@meetgenie/shared';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MeetingController } from './meeting.controller';
import { MeetingService } from './meeting.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    SharedModule,
  ],
  controllers: [AppController, MeetingController],
  providers: [AppService, MeetingService],
})
export class AppModule {}
