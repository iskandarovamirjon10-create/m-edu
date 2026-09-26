import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { NotificationDeliveryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Idempotency key for ONE channel delivery of a notification event.
 *
 * Aligned with the in-app dedup key (`user:type:entity:day`): a duplicate
 * delivery of the same event for the same principal on the same day must reuse
 * the same tracking row instead of creating a second delivery. The BullMQ job
 * id is deliberately NOT part of the key — a retry gets a new attempt but the
 * same logical delivery.
 */
export function telegramDeliveryDedupKey(params: {
  principalType: string;
  principalId: string;
  eventType: string;
  entityId: string;
  occurredAt: string;
}): string {
  return createHash('sha256')
    .update(
      `telegram:${params.principalType}:${params.principalId}:${params.eventType}:${params.entityId}:${params.occurredAt.slice(0, 10)}`,
    )
    .digest('hex');
}

export interface TrackedDelivery {
  id: string;
  /** True when a previous attempt already succeeded — do not send again. */
  alreadySent: boolean;
  attempts: number;
}

export interface TrackDeliveryInput {
  organizationId: string;
  eventId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  principalType: 'USER' | 'PARENT_ACCOUNT';
  principalId: string;
  telegramAccountId?: string | null;
  dedupKey: string;
  title?: string | null;
  body?: string | null;
  channel?: string;
}

/**
 * Delivery tracking for the Telegram channel.
 *
 * EXTENDS the existing notification architecture rather than duplicating it:
 * the in-app `NotificationDedup` row still decides whether an event is new,
 * while this model records what happened to the outbound Telegram attempt —
 * status, categorized failure, attempt count and timestamps. It is what lets
 * the pipeline distinguish "retry this" (transient) from "stop, the user
 * blocked the bot" (permanent).
 *
 * It never stores bot tokens, webhook/callback secrets or raw Telegram API
 * payloads; the only content kept is the already-rendered title/body, and only
 * so a quiet-hours deferral can be re-delivered.
 */
@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create (or fetch) the tracking row for this delivery and return whether an
   * earlier attempt already succeeded.
   *
   * Upsert on the unique `dedupKey` is race-safe: concurrent workers converge
   * on one row, and the `attempts` counter still reflects every attempt.
   */
  async ensureTracked(input: TrackDeliveryInput): Promise<TrackedDelivery> {
    const existing = await this.prisma.notificationDelivery.findUnique({
      where: { dedupKey: input.dedupKey },
      select: { id: true, status: true, attempts: true },
    });

    if (existing) {
      const bumped = await this.prisma.notificationDelivery.update({
        where: { id: existing.id },
        data: {
          attempts: { increment: 1 },
          attemptedAt: new Date(),
          telegramAccountId: input.telegramAccountId ?? undefined,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
        },
        select: { id: true, status: true, attempts: true },
      });
      return {
        id: bumped.id,
        alreadySent: bumped.status === NotificationDeliveryStatus.SENT,
        attempts: bumped.attempts,
      };
    }

    try {
      const created = await this.prisma.notificationDelivery.create({
        data: {
          organizationId: input.organizationId,
          eventId: input.eventId,
          eventType: input.eventType,
          entityType: input.entityType,
          entityId: input.entityId,
          channel: input.channel ?? 'TELEGRAM',
          principalType: input.principalType,
          principalId: input.principalId,
          telegramAccountId: input.telegramAccountId ?? null,
          dedupKey: input.dedupKey,
          title: input.title ?? null,
          body: input.body ?? null,
          status: NotificationDeliveryStatus.PENDING,
          attempts: 1,
        },
        select: { id: true, attempts: true },
      });
      return { id: created.id, alreadySent: false, attempts: created.attempts };
    } catch (err: unknown) {
      // Lost a race against a concurrent worker: fall back to the existing row.
      if ((err as { code?: string })?.code === 'P2002') {
        const row = await this.prisma.notificationDelivery.findUnique({
          where: { dedupKey: input.dedupKey },
          select: { id: true, status: true, attempts: true },
        });
        if (row) {
          return {
            id: row.id,
            alreadySent: row.status === NotificationDeliveryStatus.SENT,
            attempts: row.attempts,
          };
        }
      }
      throw err;
    }
  }

  async markSent(id: string, telegramAccountId?: string | null): Promise<void> {
    await this.update(id, {
      status: NotificationDeliveryStatus.SENT,
      failureCategory: null,
      sentAt: new Date(),
      deferredUntil: null,
      ...(telegramAccountId ? { telegramAccountId } : {}),
    });
  }

  async markFailed(
    id: string,
    failureCategory: string,
    telegramAccountId?: string | null,
  ): Promise<void> {
    await this.update(id, {
      status: NotificationDeliveryStatus.FAILED,
      failureCategory,
      failedAt: new Date(),
      ...(telegramAccountId ? { telegramAccountId } : {}),
    });
  }

  /**
   * A policy decision (channel disabled, no usable account). Never retried —
   * it is not a failure.
   */
  async markSkipped(id: string, reason: string): Promise<void> {
    await this.update(id, {
      status: NotificationDeliveryStatus.SKIPPED,
      failureCategory: reason,
    });
  }

  /**
   * Quiet hours: the delivery is NOT dropped, it waits for `deferredUntil` and
   * is re-delivered by `TelegramDeferredDeliveryService`. Content is persisted
   * so the sweep needs no re-render.
   */
  async markDeferred(
    id: string,
    deferredUntil: Date,
    content: { title: string; body: string },
  ): Promise<void> {
    await this.update(id, {
      status: NotificationDeliveryStatus.DEFERRED,
      deferredUntil,
      title: content.title,
      body: content.body,
    });
  }

  /**
   * Restart safety for the deferral sweep.
   *
   * A worker that claimed a row and then crashed leaves it `PROCESSING`
   * forever. Any claim older than `maxAgeMs` is returned to `DEFERRED` so the
   * notification is eventually delivered instead of silently lost.
   */
  async recoverStaleProcessing(maxAgeMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const result = await this.prisma.notificationDelivery.updateMany({
      where: {
        status: NotificationDeliveryStatus.PROCESSING,
        updatedAt: { lt: cutoff },
      },
      data: { status: NotificationDeliveryStatus.DEFERRED },
    });
    return result.count;
  }

  /**
   * Atomically claim due deferred deliveries for the sweep job.
   *
   * `updateMany` on `(status = DEFERRED, deferredUntil <= now)` is the
   * concurrency guard: with several API instances running the sweep, each
   * claims a disjoint batch, so a deferred notification is delivered once.
   * Returns the full rows for the claimed ids.
   */
  async claimDueDeferred(limit: number): Promise<DeferredDeliveryRow[]> {
    const due = await this.prisma.notificationDelivery.findMany({
      where: {
        status: NotificationDeliveryStatus.DEFERRED,
        deferredUntil: { lte: new Date() },
      },
      orderBy: { deferredUntil: 'asc' },
      take: limit,
      select: { id: true },
    });
    if (due.length === 0) return [];

    const ids = due.map((row) => row.id);
    const claimed = await this.prisma.notificationDelivery.updateMany({
      where: { id: { in: ids }, status: NotificationDeliveryStatus.DEFERRED },
      data: { status: NotificationDeliveryStatus.PROCESSING },
    });
    if (claimed.count === 0) return [];

    return this.prisma.notificationDelivery.findMany({
      where: { id: { in: ids }, status: NotificationDeliveryStatus.PROCESSING },
      orderBy: { deferredUntil: 'asc' },
    }) as Promise<DeferredDeliveryRow[]>;
  }

  /** Tenant-scoped, bounded operator view of recent delivery failures. */
  async recentFailures(organizationId: string, limit = 20) {
    return this.prisma.notificationDelivery.findMany({
      where: {
        organizationId,
        status: { in: [NotificationDeliveryStatus.FAILED] },
      },
      orderBy: { failedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        eventType: true,
        entityType: true,
        entityId: true,
        channel: true,
        status: true,
        failureCategory: true,
        attempts: true,
        failedAt: true,
      },
    });
  }

  private async update(
    id: string,
    data: Prisma.NotificationDeliveryUpdateInput,
  ): Promise<void> {
    try {
      await this.prisma.notificationDelivery.update({ where: { id }, data });
    } catch (err: unknown) {
      // Tracking must never fail the delivery it describes.
      this.logger.warn(
        JSON.stringify({
          event: 'notification_delivery_track_failed',
          deliveryId: id,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}

export interface DeferredDeliveryRow {
  id: string;
  organizationId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  channel: string;
  principalType: string;
  principalId: string;
  telegramAccountId: string | null;
  status: NotificationDeliveryStatus;
  failureCategory: string | null;
  attempts: number;
  title: string | null;
  body: string | null;
  deferredUntil: Date | null;
  createdAt: Date;
}
