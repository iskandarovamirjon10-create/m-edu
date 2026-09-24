import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { CommunicationHistoryController } from './communication-history.controller';
import { NotificationsService } from './notifications.service';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramService } from './telegram.service';
import { SmsService } from './sms.service';
import { CommunicationHistoryService } from './communication-history.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [
    NotificationsController,
    CommunicationHistoryController,
    EmailController,
    TelegramWebhookController,
  ],
  providers: [
    NotificationsService,
    EmailService,
    TelegramService,
    SmsService,
    CommunicationHistoryService,
    NotificationPreferenceService,
  ],
  exports: [
    NotificationsService,
    EmailService,
    TelegramService,
    SmsService,
    CommunicationHistoryService,
    NotificationPreferenceService,
  ],
})
export class NotificationsModule {}

