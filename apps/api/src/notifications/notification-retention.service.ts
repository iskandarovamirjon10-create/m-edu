import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/** Bounded delete batch — never one massive transaction. */
const PURGE_BATCH_SIZE = 1000;

/** Deliveries are operational records; 30 days is enough to investigate. */
const DEFAULT_RETENTION_DAYS = 30;

/**
 * Retention for delegated (Telegram) delivery-tracking rows.
 *
 * Delivery records are operational metadata, not business truth: they exist to
 * classify provider failures and observe delivery health, so they are retained
 * for a bounded window and then purged. Deletion is:
 *   - scheduled (a daily cron, no request-path work),
 *   - configurable (`NOTIFICATION_DELIVERY_RETENTION_DAYS`),
 *   - chunked + indexed (`createdAt`), so no long lock or huge transaction,
 *   - retry-safe (a crash leaves the remainder for the next run),
 *   - observable (a structured log per sweep, warnings on failure).
 *
 * It never touches `AuditLog` — audit retention is a separate, existing system.
 */
@Injectable()
export class NotificationRetentionService {
  private readonly logger = new Logger(NotificationRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sweep(): Promise<void> {
    try {
      const removed = await this.purgeOlderThan(this.cutoff());
      if (removed > 0) {
        this.logger.log(
          JSON.stringify({ event: 'notification_delivery_retention', removed }),
        );
      }
    } catch (err: unknown) {
      this.logger.warn(
        JSON.stringify({
          event: 'notification_delivery_retention_failed',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  /** Delete delivery rows older than the retention cutoff, in batches. */
  async purgeOlderThan(cutoff: Date): Promise<number> {
    let total = 0;
    for (;;) {
      const batch = await this.prisma.notificationDelivery.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: PURGE_BATCH_SIZE,
      });
      if (batch.length === 0) break;

      const result = await this.prisma.notificationDelivery.deleteMany({
        where: { id: { in: batch.map((row) => row.id) } },
      });
      total += result.count;
      if (batch.length < PURGE_BATCH_SIZE) break;
    }
    return total;
  }

  private cutoff(now = new Date()): Date {
    const parsed = Number(process.env.NOTIFICATION_DELIVERY_RETENTION_DAYS);
    const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
}
