import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { TelegramController } from './telegram.controller';
import { TelegramAdminController } from './telegram-admin.controller';
import { TelegramObservabilityService } from './telegram-observability.service';
import { TelegramService } from './telegram.service';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramUpdateService } from './telegram-update.service';
import { TelegramAttemptLimiter } from './telegram-attempt-limiter.service';
import { TelegramCallbackService } from './telegram-callback.service';
import { TelegramContextService } from './telegram-context.service';
import { TelegramDeliveryService } from './telegram-delivery.service';

/**
 * Telegram core: the Bot API adapter, identity/link lifecycle, dedup,
 * rate limiting and the self-service settings API.
 *
 * This module deliberately depends on NOTHING from the business domain
 * (no payments, no students, no notifications). That keeps it safe for the
 * notification pipeline to import — `NotificationsModule` -> here — without
 * creating a cycle back through the modules that emit notification events.
 *
 * `PrismaModule` is `@Global()`, so only config + audit are imported.
 */
@Module({
  imports: [ConfigModule, AuditModule],
  controllers: [TelegramController, TelegramAdminController],
  providers: [
    TelegramService,
    TelegramObservabilityService,
    TelegramLinkService,
    TelegramUpdateService,
    TelegramAttemptLimiter,
    TelegramCallbackService,
    TelegramContextService,
    TelegramDeliveryService,
  ],
  exports: [
    TelegramService,
    TelegramObservabilityService,
    TelegramLinkService,
    TelegramUpdateService,
    TelegramAttemptLimiter,
    TelegramCallbackService,
    TelegramContextService,
    TelegramDeliveryService,
  ],
})
export class TelegramCoreModule {}
