import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { CommunicationHistoryController } from './communication-history.controller';
import { NotificationsService } from './notifications.service';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { CommunicationHistoryService } from './communication-history.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { TelegramNotificationPolicyService } from './telegram-notification-policy.service';
import { TelegramDeferredDeliveryService } from './telegram-deferred-delivery.service';
import { NotificationRetentionService } from './notification-retention.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramCoreModule } from '../telegram/telegram-core.module';

/**
 * Notification + communication module.
 *
 * Telegram delivery is provided by `TelegramCoreModule` (imported and
 * re-exported here) rather than owned locally: `TelegramService` is the single
 * Bot API adapter and must live next to the rest of the Telegram integration.
 *
 * `TelegramCoreModule` is imported rather than the umbrella `TelegramModule`
 * on purpose — the umbrella pulls in `TelegramCommandsModule`, which itself
 * imports this module, and that would be a cycle. Core has no business-domain
 * dependencies, so the graph stays acyclic.
 */
@Module({
  imports: [PrismaModule, ConfigModule, TelegramCoreModule],
  controllers: [
    NotificationsController,
    CommunicationHistoryController,
    EmailController,
  ],
  providers: [
    NotificationsService,
    EmailService,
    SmsService,
    CommunicationHistoryService,
    NotificationPreferenceService,
    // Telegram delivery policy + tracking (extends the existing pipeline).
    NotificationDeliveryService,
    TelegramNotificationPolicyService,
    TelegramDeferredDeliveryService,
    NotificationRetentionService,
  ],
  exports: [
    NotificationsService,
    EmailService,
    SmsService,
    CommunicationHistoryService,
    NotificationPreferenceService,
    NotificationDeliveryService,
    TelegramNotificationPolicyService,
    TelegramCoreModule,
  ],
})
export class NotificationsModule {}
