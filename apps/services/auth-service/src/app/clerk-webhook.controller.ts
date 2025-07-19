import {
  Controller,
  Post,
  Body,
  Headers,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ClerkSyncService } from '@meetgenie/shared';
import { ClerkWebhookEvent } from '@meetgenie/shared';

@Controller('webhooks/clerk')
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(private readonly clerkSyncService: ClerkSyncService) {}

  @Post()
  async handleClerkWebhook(
    @Body() body: ClerkWebhookEvent,
    @Headers('svix-signature') signature: string,
    @Raw() rawBody: Buffer,
  ) {
    try {
      this.logger.log(`Received Clerk webhook: ${body.type}`);

      // Validate webhook signature
      const isValid = this.clerkSyncService.validateClerkWebhook(
        rawBody.toString(),
        signature,
      );

      if (!isValid) {
        this.logger.error('Invalid webhook signature');
        throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
      }

      // Process the webhook event
      const result = await this.clerkSyncService.processWebhookEvent(body);

      if (!result.success) {
        this.logger.error(`Webhook processing failed: ${result.error}`);
        throw new HttpException(
          `Webhook processing failed: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log(`Webhook processed successfully: ${body.type}`);
      return {
        success: true,
        message: 'Webhook processed successfully',
        userId: result.userId,
        syncStatus: result.syncStatus,
      };
    } catch (error) {
      this.logger.error('Error processing Clerk webhook:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
