import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramUpdateDispatcherService } from './telegram-update-dispatcher.service';

@Injectable()
export class TelegramPollingService implements OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollingService.name);
  private isRunning = false;
  private currentOffset = 0;
  private lastPollAt: Date | null = null;
  private errorCount = 0;
  private pollPromise: Promise<void> | null = null;

  constructor(
    private readonly telegram: TelegramService,
    private readonly dispatcher: TelegramUpdateDispatcherService,
  ) {}

  onModuleDestroy() {
    this.stopPolling();
  }

  isPolling(): boolean {
    return this.isRunning;
  }

  getStatus() {
    return {
      isPolling: this.isRunning,
      currentOffset: this.currentOffset,
      lastPollAt: this.lastPollAt,
      errorCount: this.errorCount,
    };
  }

  /**
   * Starts the Long-Polling engine. Automatically removes active webhook on Telegram
   * to unlock the `getUpdates` API.
   */
  async startPolling(): Promise<boolean> {
    if (this.isRunning) {
      return true;
    }
    if (!this.telegram.isConfigured()) {
      this.logger.warn('Cannot start Telegram polling: Bot is not configured (missing TELEGRAM_BOT_TOKEN).');
      return false;
    }

    this.logger.log('Starting Telegram Long-Polling engine (local/development mode)...');
    try {
      // Telegram requires active webhook to be removed before getUpdates can work (avoids 409 Conflict).
      await this.telegram.deleteWebhook(false);
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to clear webhook before polling: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.isRunning = true;
    this.pollPromise = this.pollLoop();
    return true;
  }

  /**
   * Stops the Long-Polling loop gracefully.
   */
  stopPolling(): void {
    if (!this.isRunning) return;
    this.logger.log('Stopping Telegram Long-Polling engine...');
    this.isRunning = false;
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        this.lastPollAt = new Date();
        const updates = await this.telegram.getUpdates(
          this.currentOffset > 0 ? this.currentOffset : undefined,
          100,
          10, // 10-second long-polling timeout
        );

        if (!this.isRunning) break;

        if (Array.isArray(updates) && updates.length > 0) {
          for (const update of updates) {
            if (!this.isRunning) break;
            try {
              await this.dispatcher.dispatch(update);
            } catch (err: unknown) {
              this.logger.error(
                `Failed to dispatch polled update ${update?.update_id}: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              );
            }
            if (typeof update?.update_id === 'number') {
              this.currentOffset = Math.max(this.currentOffset, update.update_id + 1);
            }
          }
        } else {
          // Pause between empty poll cycles to prevent spin-looping
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        this.errorCount = 0;
      } catch (err: unknown) {
        this.errorCount++;
        this.logger.warn(
          `Telegram polling encountered error: ${
            err instanceof Error ? err.message : String(err)
          }. Retrying in 3 seconds...`,
        );
        // Backoff delay before retrying
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
}
