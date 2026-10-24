import { describe, it, expect } from 'vitest';
import { InferenceConcurrencyLimiter } from '../inference-limiter';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('InferenceConcurrencyLimiter', () => {
  it('allows immediate acquisition under concurrency limit', async () => {
    const limiter = new InferenceConcurrencyLimiter({ maxConcurrency: 2, maxQueueSize: 5 });
    const release1 = await limiter.acquire();
    const release2 = await limiter.acquire();

    expect(limiter.stats.active).toBe(2);
    expect(limiter.stats.queued).toBe(0);

    release1();
    expect(limiter.stats.active).toBe(1);

    release2();
    expect(limiter.stats.active).toBe(0);
  });

  it('queues callers when concurrency limit is reached and serves FIFO', async () => {
    const limiter = new InferenceConcurrencyLimiter({ maxConcurrency: 1, maxQueueSize: 5 });
    const release1 = await limiter.acquire();
    expect(limiter.stats.active).toBe(1);

    let acquired2 = false;
    const promise2 = limiter.acquire().then((rel) => {
      acquired2 = true;
      return rel;
    });

    expect(acquired2).toBe(false);
    expect(limiter.stats.queued).toBe(1);

    release1();
    const release2 = await promise2;
    expect(acquired2).toBe(true);
    expect(limiter.stats.active).toBe(1);
    expect(limiter.stats.queued).toBe(0);

    release2();
    expect(limiter.stats.active).toBe(0);
  });

  it('throws 429 when queue capacity is exceeded', async () => {
    const limiter = new InferenceConcurrencyLimiter({ maxConcurrency: 1, maxQueueSize: 1 });
    const release1 = await limiter.acquire();

    // 1 in queue
    const queuedPromise = limiter.acquire();
    expect(limiter.stats.queued).toBe(1);

    // Exceed queue limit
    await expect(limiter.acquire()).rejects.toThrowError(HttpException);

    release1();
    const releaseQueued = await queuedPromise;
    releaseQueued();
  });
});
