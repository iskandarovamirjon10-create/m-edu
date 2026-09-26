import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TelegramService } from '../telegram/telegram.service';
import { TelegramDeliveryService, isTransientFailure } from '../telegram/telegram-delivery.service';
import { escapeHtml } from '../telegram/ui/format';
import {
  NotificationDeliveryService,
  DeferredDeliveryRow,
} from './notification-delivery.service';

/** Rows claimed per sweep. Bounded so one run cannot monopolise the worker. */
const SWEEP_BATCH_SIZE = 50;

/** A claim older than this was abandoned by a crashed worker. */
const STALE_CLAIM_MS = 10 * 60 * 1000;

/** Give up (and record FAILED) after this many deferred re-attempts. */
const MAX_DEFERRED_ATTEMPTS = 6;

/** Backoff base for the Nth deferred retry (2^attempts minutes, capped at 1h). */
const RETRY_BASE_MS = 60_000;
const RETRY_CAP_MS = 60 * 60 * 1000;

/**
 * A deferral older than this is not delivered at all.
 *
 * Quiet hours are hours; a notification that has been sitting in the queue for
 * days (Telegram disabled, a long outage) would reach the recipient as stale
 * noise — "your child was absent last Tuesday" arriving this Friday. Those rows
 * are marked SKIPPED with an explicit reason (observable, and removed by
 * retention) instead of being sent.
 */
const MAX_DEFERRAL_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Quiet-hours deferred delivery.
 *
 * A notification produced inside a user's quiet hours is NOT dropped: the
 * worker records it as `DEFERRED` with `deferredUntil` set to the end of the
 * window, and this scheduled sweep re-delivers it afterwards.
 *
 * Correctness properties:
 *   - DB-backed, so a process restart or a deploy mid-window loses nothing
 *     (unlike an in-memory timer).
 *   - `claimDueDeferred` transitions rows atomically, so multiple API instances
 *     running the sweep deliver each notification exactly once.
 *   - Stale `PROCESSING` claims from a crashed worker are recovered.
 *   - Transient Telegram failures are re-deferred with backoff; after
 *     `MAX_DEFERRED_ATTEMPTS` the delivery is recorded `FAILED` (observable)
 *     instead of retrying forever.
 *   - Permanent failures mark the account BLOCKED (via TelegramDeliveryService)
 *     so nothing else is queued for a dead chat.
 */
@Injectable()
export class TelegramDeferredDeliveryService {
  private readonly logger = new Logger(TelegramDeferredDeliveryService.name);
  private running = false;

  constructor(
    private readonly deliveries: NotificationDeliveryService,
    private readonly telegram: TelegramService,
    private readonly targets: TelegramDeliveryService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    // Guard against an overlapping run in the same process (multi-instance
    // safety is handled by the atomic claim).
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch (err: unknown) {
      this.logger.error(
        JSON.stringify({
          event: 'telegram_deferred_sweep_failed',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      this.running = false;
    }
  }

  /** Exposed for tests and for an operational trigger. */
  async runOnce(now = new Date()): Promise<{ delivered: number; failed: number; requeued: number }> {
    if (!this.telegram.isConfigured()) {
      return { delivered: 0, failed: 0, requeued: 0 };
    }

    await this.deliveries.recoverStaleProcessing(STALE_CLAIM_MS);
    const rows = await this.deliveries.claimDueDeferred(SWEEP_BATCH_SIZE);

    let delivered = 0;
    let failed = 0;
    let requeued = 0;

    for (const row of rows) {
      const outcome = await this.deliverOne(row, now);
      if (outcome === 'SENT') delivered += 1;
      else if (outcome === 'FAILED') failed += 1;
      else if (outcome === 'REQUEUED') requeued += 1;
    }

    if (rows.length > 0) {
      this.logger.log(
        JSON.stringify({
          event: 'telegram_deferred_sweep',
          claimed: rows.length,
          delivered,
          failed,
          requeued,
        }),
      );
    }
    return { delivered, failed, requeued };
  }

  private async deliverOne(
    row: DeferredDeliveryRow,
    now: Date,
  ): Promise<'SENT' | 'FAILED' | 'REQUEUED' | 'SKIPPED'> {
    if (now.getTime() - new Date(row.createdAt).getTime() > MAX_DEFERRAL_AGE_MS) {
      await this.deliveries.markSkipped(row.id, 'STALE_DEFERRAL');
      return 'SKIPPED';
    }

    const principal =
      row.principalType === 'USER'
        ? ({ type: 'USER', userId: row.principalId } as const)
        : ({ type: 'PARENT_ACCOUNT', parentAccountId: row.principalId } as const);

    const target = await this.targets.resolveActiveTarget(row.organizationId, principal);
    if (!target) {
      // The account was disconnected/blocked while the notification waited.
      await this.deliveries.markSkipped(row.id, 'NOT_ACTIVE');
      return 'SKIPPED';
    }

    const text = `<b>${escapeHtml(row.title ?? '')}</b>\n\n${escapeHtml(row.body ?? '')}`;
    const result = await this.telegram.sendMessageDetailed(target.chatId, text);
    if (result.ok) {
      await this.deliveries.markSent(row.id, target.accountId);
      return 'SENT';
    }

    const category = await this.targets.applyFailure(target, result);
    if (isTransientFailure(category) && row.attempts < MAX_DEFERRED_ATTEMPTS) {
      const backoff = Math.min(RETRY_BASE_MS * 2 ** row.attempts, RETRY_CAP_MS);
      await this.deliveries.markDeferred(row.id, new Date(now.getTime() + backoff), {
        title: row.title ?? '',
        body: row.body ?? '',
      });
      return 'REQUEUED';
    }

    await this.deliveries.markFailed(row.id, category, target.accountId);
    return 'FAILED';
  }
}
