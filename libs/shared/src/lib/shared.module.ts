import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaService } from './services/kafka.service';
import { RedisService } from './services/redis.service';
import { SupabaseService } from './services/supabase.service';
import { DatabaseService } from './services/database.service';
import { MigrationService } from './services/migration.service';
import { ClerkSyncService } from './services/clerk-sync.service';
import { InngestFunctionsService } from './services/inngest-functions.service';
import { AuthGuard } from './guards/auth.guard';
import kafkaConfig from './config/kafka.config';
import redisConfig from './config/redis.config';
import databaseConfig from './config/database.config';
import environmentConfig from './config/environment.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [kafkaConfig, redisConfig, databaseConfig, environmentConfig],
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),
  ],
  providers: [
    KafkaService, 
    RedisService, 
    SupabaseService, 
    DatabaseService, 
    MigrationService,
    ClerkSyncService,
    InngestFunctionsService,
    AuthGuard
  ],
  exports: [
    KafkaService, 
    RedisService, 
    SupabaseService, 
    DatabaseService, 
    MigrationService,
    ClerkSyncService,
    InngestFunctionsService,
    AuthGuard,
    ConfigModule
  ],
})
export class SharedModule {}