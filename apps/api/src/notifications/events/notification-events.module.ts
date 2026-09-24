import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications.module';
import { NotificationEventService } from './notification-event.service';
import { NotificationEventProcessor } from './notification-event.processor';
import { NOTIFICATION_EVENTS_QUEUE, NOTIFICATION_EVENTS_DLQ } from './notification.events';
import { isRedisEnabled } from '../../config/redis.config';

// @ts-ignore – @nestjs/bullmq is ESM-only; resolved at runtime via monorepo hoisting
const { BullModule } = require('@nestjs/bullmq');

const redisEnabled = isRedisEnabled();

/**
 * Queue-backed delivery of domain notification events.
 *
 * This is the single canonical producer/consumer of the
 * `notification-events` queue:
 *   - NotificationEventService (producer) is exported and injected by the
 *     business modules that emit events (payments, attendance, leads,
 *     automation).
 *   - NotificationEventProcessor (consumer) is registered here exactly once,
 *     so a single worker drains the queue per instance.
 *   - Exhausted jobs are parked on `notification-events-dlq` (separate queue)
 *     so a failed event never re-enters the source queue.
 *
 * When Redis is disabled (`REDIS_ENABLED=false`, development only) the queue
 * is not registered at all: the service falls back to its logged no-op and no
 * worker is started. `BullModule.forRoot(...)` lives in AppModule, which skips
 * it under the same flag.
 */
@Module({
  imports: [
    NotificationsModule,
    ...(redisEnabled
      ? [
          BullModule.registerQueue({ name: NOTIFICATION_EVENTS_QUEUE }),
          BullModule.registerQueue({ name: NOTIFICATION_EVENTS_DLQ }),
        ]
      : []),
  ],
  providers: [
    NotificationEventService,
    ...(redisEnabled ? [NotificationEventProcessor] : []),
  ],
  exports: [NotificationEventService],
})
export class NotificationEventsModule {}
