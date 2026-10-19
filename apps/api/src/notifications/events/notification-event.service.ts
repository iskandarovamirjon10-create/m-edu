import { Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  NOTIFICATION_EVENTS_QUEUE,
  NotificationEventPayload,
} from './notification.events';

// @ts-ignore – @nestjs/bullmq is ESM-only; resolved at runtime via monorepo hoisting
const { InjectQueue } = require('@nestjs/bullmq');

/**
 * Emits domain events onto the BullMQ notification queue. Fire-and-forget
 * from the caller's perspective: business transactions must never fail
 * because a notification could not be queued, so all enqueue errors are
 * logged and swallowed here.
 */
@Injectable()
export class NotificationEventService {
  private readonly logger = new Logger(NotificationEventService.name);

  constructor(
    // The queue token is only provided when Redis/BullMQ is enabled (see
    // config/redis.config.ts). Without it this service degrades to a
    // logged no-op instead of breaking application startup — a machine
    // without Redis must not prevent every other feature from working.
    @Optional()
    @InjectQueue(NOTIFICATION_EVENTS_QUEUE)
    private readonly queue: Queue | null,
  ) {
    if (!this.queue) {
      this.logger.warn(
        'REDIS_ENABLED=false: notification events are accepted but dropped — no in-app/SMS/Telegram delivery will happen.',
      );
    }
  }

  async emit(event: NotificationEventPayload): Promise<void> {
    if (!this.queue) return;
    try {
      const enqueue = this.queue.add(event.type, event, {
        // Deterministic ID per (type, entity, day) collapses accidental
        // duplicate emissions while still allowing legitimate repeats on
        // later days (e.g. a student absent two days in a row).
        jobId: `${event.type}:${event.entityId}:${event.occurredAt.slice(0, 10)}`,
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });

      // Bounded wait: a slow or offline Redis must never hang the business transaction.
      await Promise.race([
        enqueue,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Queue timeout (Redis unreachable)')), 2000),
        ),
      ]);
    } catch (error) {
      // Never break the business flow on notification failure.
      this.logger.error(
        `Failed to enqueue notification event ${event.type} for ${event.entityType}/${event.entityId}: ${String(error)}`,
      );
    }
  }
}
