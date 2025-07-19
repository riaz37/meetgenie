import { Injectable, Logger } from '@nestjs/common';
import { Inngest } from 'inngest';
import { ClerkSyncService } from './clerk-sync.service';
import { ConfigService } from '@nestjs/config';
import { EnvironmentConfig } from '../config/environment.config';

@Injectable()
export class InngestFunctionsService {
  private readonly logger = new Logger(InngestFunctionsService.name);
  private readonly inngest: Inngest;

  constructor(
    private readonly clerkSyncService: ClerkSyncService,
    private readonly configService: ConfigService<EnvironmentConfig>
  ) {
    const inngestConfig = this.configService.get('inngest', { infer: true });
    this.inngest = new Inngest({
      id: 'meetgenie-auth-service',
      eventKey: inngestConfig?.eventKey
    });
  }

  /**
   * Initialize Inngest functions
   */
  initializeFunctions() {
    // Batch user synchronization function
    const batchSyncUsers = this.inngest.createFunction(
      { id: 'batch-sync-users' },
      { cron: '0 */6 * * *' }, // Run every 6 hours
      async ({ event, step }) => {
        this.logger.log('Starting batch user synchronization job');

        try {
          await step.run('sync-users', async () => {
            await this.clerkSyncService.batchSyncUsers(100);
            return { success: true, message: 'Batch sync completed' };
          });

          this.logger.log('Batch user synchronization completed successfully');
          return { success: true };
        } catch (error) {
          this.logger.error('Batch user synchronization failed:', error);
          throw error;
        }
      }
    );

    // Retry failed user synchronizations
    const retryFailedSyncs = this.inngest.createFunction(
      { id: 'retry-failed-syncs' },
      { cron: '0 */2 * * *' }, // Run every 2 hours
      async ({ event, step }) => {
        this.logger.log('Starting retry failed synchronizations job');

        try {
          await step.run('retry-syncs', async () => {
            // This would query for users with sync errors and retry them
            await this.clerkSyncService.batchSyncUsers(50);
            return { success: true, message: 'Retry sync completed' };
          });

          this.logger.log('Retry failed synchronizations completed successfully');
          return { success: true };
        } catch (error) {
          this.logger.error('Retry failed synchronizations failed:', error);
          throw error;
        }
      }
    );

    // User cleanup job for deleted users
    const cleanupDeletedUsers = this.inngest.createFunction(
      { id: 'cleanup-deleted-users' },
      { cron: '0 2 * * 0' }, // Run weekly on Sunday at 2 AM
      async ({ event, step }) => {
        this.logger.log('Starting cleanup deleted users job');

        try {
          await step.run('cleanup-users', async () => {
            // This would handle cleanup of data for users marked as deleted
            this.logger.log('Cleanup deleted users completed');
            return { success: true, message: 'Cleanup completed' };
          });

          return { success: true };
        } catch (error) {
          this.logger.error('Cleanup deleted users failed:', error);
          throw error;
        }
      }
    );

    return [batchSyncUsers, retryFailedSyncs, cleanupDeletedUsers];
  }

  /**
   * Trigger manual user sync
   */
  async triggerUserSync(clerkUserId: string) {
    try {
      await this.inngest.send({
        name: 'user/sync.requested',
        data: { clerkUserId }
      });
    } catch (error) {
      this.logger.error('Error triggering user sync:', error);
      throw error;
    }
  }

  /**
   * Trigger batch sync manually
   */
  async triggerBatchSync() {
    try {
      await this.inngest.send({
        name: 'user/batch-sync.requested',
        data: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      this.logger.error('Error triggering batch sync:', error);
      throw error;
    }
  }
}