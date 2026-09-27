import { Module } from '@nestjs/common';
import { ClerkWebhookController } from './clerk-webhook.controller';

@Module({
  controllers: [ClerkWebhookController],
})
export class WebhooksModule {}
