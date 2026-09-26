import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Webhook update deduplication.
 *
 * Telegram retries webhook deliveries and may deliver the same `update_id` to
 * several API instances at once. "Process exactly once" is therefore a
 * database guarantee (the `TelegramUpdate` primary key), never a process-local
 * Map — which is the failure mode the spec explicitly forbids.
 */
@Injectable()
export class TelegramUpdateService {
  private readonly logger = new Logger(TelegramUpdateService.name);

  /**
   * Retention for the dedup ledger. Telegram only redelivers for a bounded
   * window, so a week of `update_id`s is far more than enough; keeping the
   * table small keeps the primary-key insert (the hot path of every webhook)
   * cheap. Overridable via `TELEGRAM_UPDATE_RETENTION_DAYS`.
   */
  private static readonly DEFAULT_RETENTION_DAYS = 7;
  private static readonly SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6h

  /**
   * Bounded batch for the link-token purge. Deletion is chunked so the sweep
   * never opens a long transaction or locks a large slice of the table, and is
   * retry-safe: a crash mid-purge simply leaves the remainder for the next run.
   */
  private static readonly PURGE_BATCH = 1000;

  constructor(private readonly prisma: PrismaService) {
    const timer = setInterval(() => {
      void this.sweep();
    }, TelegramUpdateService.SWEEP_INTERVAL_MS);
    timer.unref?.();
  }

  /**
   * Retention sweep: drop dedup rows that can no longer be a retry, plus
   * expired/consumed link tokens (which contain only SHA-256 hashes and are
   * useless after their TTL).
   */
  async sweep(): Promise<void> {
    try {
      const removed = await this.purgeOlderThan(
        new Date(Date.now() - TelegramUpdateService.retentionMs()),
      );
      if (removed > 0) {
        this.logger.log(
          JSON.stringify({ event: 'telegram_update_retention', removed }),
        );
      }
    } catch (err: unknown) {
      // A failed sweep must never affect webhook handling.
      this.logger.warn(
        JSON.stringify({
          event: 'telegram_update_retention_failed',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    try {
      const removedTokens = await this.purgeExpiredLinkTokens();
      if (removedTokens > 0) {
        this.logger.log(
          JSON.stringify({ event: 'telegram_link_token_retention', removed: removedTokens }),
        );
      }
    } catch (err: unknown) {
      this.logger.warn(
        JSON.stringify({
          event: 'telegram_link_token_retention_failed',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  /**
   * Delete expired or already-consumed link tokens in bounded batches.
   *
   * Only rows whose `expiresAt` is older than the retention cutoff are removed
   * (a still-valid unused token is never touched), and only hashes are
   * involved, so there is no secret material at rest.
   */
  async purgeExpiredLinkTokens(): Promise<number> {
    const cutoff = new Date(
      Date.now() - TelegramUpdateService.linkTokenRetentionMs(),
    );
    let total = 0;
    for (;;) {
      const batch = await this.prisma.telegramLinkToken.findMany({
        where: { expiresAt: { lt: cutoff } },
        select: { id: true },
        take: TelegramUpdateService.PURGE_BATCH,
      });
      if (batch.length === 0) break;
      const result = await this.prisma.telegramLinkToken.deleteMany({
        where: { id: { in: batch.map((row) => row.id) } },
      });
      total += result.count;
      if (batch.length < TelegramUpdateService.PURGE_BATCH) break;
    }
    return total;
  }

  /** Update-ledger retention in ms (`TELEGRAM_UPDATE_RETENTION_DAYS`). */
  private static retentionMs(): number {
    return daysToMs(process.env.TELEGRAM_UPDATE_RETENTION_DAYS, this.DEFAULT_RETENTION_DAYS);
  }

  /** Link-token retention in ms (`TELEGRAM_LINK_TOKEN_RETENTION_DAYS`). */
  private static linkTokenRetentionMs(): number {
    return daysToMs(process.env.TELEGRAM_LINK_TOKEN_RETENTION_DAYS, this.DEFAULT_RETENTION_DAYS);
  }

  /**
   * Atomically claim an update id.
   *
   * @returns `true` when this caller is the first to see the update (process
   *          it); `false` when it is a duplicate (acknowledge and skip).
   */
  async claim(updateId: bigint): Promise<boolean> {
    try {
      await this.prisma.telegramUpdate.create({
        data: { updateId, status: 'PROCESSED' },
      });
      return true;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') {
        this.logger.log(
          JSON.stringify({ event: 'telegram_update_duplicate', updateId: updateId.toString() }),
        );
        return false;
      }
      throw err;
    }
  }

  /**
   * Delete deduplication rows older than `cutoff`.
   *
   * `TelegramUpdate` is process metadata (update id + receipt time), never
   * tenant data, so this is the one deliberate global sweep in the codebase —
   * it does not touch any organization-scoped table.
   */
  async purgeOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.telegramUpdate.deleteMany({
      where: { receivedAt: { lt: cutoff } },
    });
    return result.count;
  }
}

/** Parse a positive `DAYS` env value into ms, falling back to a safe default. */
function daysToMs(raw: string | undefined, fallbackDays: number): number {
  const parsed = Number(raw);
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackDays;
  return days * 24 * 60 * 60 * 1000;
}
