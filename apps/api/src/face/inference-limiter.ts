import { HttpException, HttpStatus, Logger } from '@nestjs/common';

export interface InferenceLimiterOptions {
  maxConcurrency?: number;
  maxQueueSize?: number;
  queueTimeoutMs?: number;
}

/**
 * InferenceConcurrencyLimiter
 *
 * Protects Node.js Event Loop from CPU starvation during heavy ONNX model inference.
 * Limits the number of concurrent model execution passes and manages a bounded FIFO queue.
 */
export class InferenceConcurrencyLimiter {
  private readonly logger = new Logger(InferenceConcurrencyLimiter.name);
  private active = 0;
  private queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  private readonly maxConcurrency: number;
  private readonly maxQueueSize: number;
  private readonly queueTimeoutMs: number;

  constructor(options: InferenceLimiterOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 2;
    this.maxQueueSize = options.maxQueueSize ?? 12;
    this.queueTimeoutMs = options.queueTimeoutMs ?? 5000;
  }

  async acquire(): Promise<() => void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return () => this.release();
    }

    if (this.queue.length >= this.maxQueueSize) {
      this.logger.warn(
        `Face recognition inference throttled: queue full (${this.queue.length}/${this.maxQueueSize}), active=${this.active}`,
      );
      throw new HttpException(
        'Server is at maximum face recognition capacity. Please retry momentarily.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return new Promise<() => void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((item) => item.timer === timer);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          this.logger.warn('Face recognition request timed out waiting in inference queue');
          reject(
            new HttpException(
              'Face recognition request timed out in queue.',
              HttpStatus.REQUEST_TIMEOUT,
            ),
          );
        }
      }, this.queueTimeoutMs);

      this.queue.push({
        resolve: () => {
          clearTimeout(timer);
          this.active++;
          resolve(() => this.release());
        },
        reject,
        timer,
      });
    });
  }

  private release(): void {
    this.active--;
    if (this.queue.length > 0 && this.active < this.maxConcurrency) {
      const next = this.queue.shift();
      if (next) {
        next.resolve();
      }
    }
  }

  get stats() {
    return {
      active: this.active,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      maxQueueSize: this.maxQueueSize,
    };
  }
}
