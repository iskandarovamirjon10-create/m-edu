import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { Redis } from 'ioredis';

@Injectable()
export class ResilientRedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(ResilientRedisThrottlerStorage.name);
  private redis: Redis;
  private isRedisConnected = false;
  private memoryStorage = new Map<string, { totalHits: number; expiresAt: number }>();

  /**
   * Whether the credential-endpoint bucket must REFUSE traffic instead of
   * degrading to the in-process limiter while Redis is unavailable.
   *
   * Previously this decision existed in the code (`isSecurityCritical`) but
   * could never fire, because only a throttler named `default` was registered
   * — so the documented fail-closed posture was unreachable. It is now wired
   * to a `security` throttler and defaults to ON in production (override with
   * `RATE_LIMIT_FAIL_CLOSED=false`), OFF everywhere else so a missing Redis in
   * development never turns every login into a 500.
   */
  private readonly failClosedSecurity: boolean;

  static readonly MAX_MEMORY_ENTRIES = 10_000;

  private static readonly ATOMIC_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl == -1 or ttl == -2 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {hits, ttl}
`;

  constructor(redisUrl: string, options?: { failClosedSecurity?: boolean }) {
    this.failClosedSecurity =
      options?.failClosedSecurity ??
      (process.env.RATE_LIMIT_FAIL_CLOSED !== undefined
        ? process.env.RATE_LIMIT_FAIL_CLOSED === 'true'
        : process.env.NODE_ENV === 'production');

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        return Math.min(times * 1000, 5000);
      },
    });

    this.redis.on('connect', () => {
      this.isRedisConnected = true;
      this.logger.log('Redis connected for Throttler');
    });

    this.redis.on('error', (err) => {
      if (this.isRedisConnected) {
        this.logger.error(`Redis error: ${err.message}`);
      }
      this.isRedisConnected = false;
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const isSecurityCritical = throttlerName === 'security' || throttlerName === 'auth';
    // Only the credential bucket is allowed to take the API down; everything
    // else degrades to the bounded in-process limiter.
    const mustFailClosed = isSecurityCritical && this.failClosedSecurity;

    if (this.isRedisConnected) {
      const fullKey = `throttler:${throttlerName}:${key}`;
      try {
        const results = await (this.redis.eval as any)(
          ResilientRedisThrottlerStorage.ATOMIC_SCRIPT,
          1,
          fullKey,
          ttl,
        );

        if (!results || !Array.isArray(results) || results.length !== 2) {
          throw new Error('Redis eval returned invalid response');
        }

        const hits = Number(results[0]);
        const timeToLive = Number(results[1]);

        return {
          totalHits: hits,
          timeToExpire: Math.ceil(timeToLive / 1000),
          isBlocked: hits > limit,
          timeToBlockExpire: hits > limit ? Math.ceil(blockDuration / 1000) : 0,
        };
      } catch (err: unknown) {
        this.isRedisConnected = false;
        const message = err instanceof Error ? err.message : String(err);
        if (mustFailClosed) {
          this.logger.error(`Redis throttler failed on security endpoint: ${message}`);
          throw new InternalServerErrorException('Security infrastructure unavailable. Please try again later.');
        }
        this.logger.warn(`Redis throttling failed, falling back to memory: ${message}`);
      }
    }

    if (mustFailClosed) {
      this.logger.warn('Redis is offline. Security throttler failing closed to protect endpoints.');
      throw new InternalServerErrorException('Security infrastructure unavailable. Please try again later.');
    }

    return this.memoryIncrement(key, ttl, limit, blockDuration, throttlerName);
  }

  private memoryIncrement(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ThrottlerStorageRecord {
    const fullKey = `throttler:${throttlerName}:${key}`;
    const now = Date.now();

    let record = this.memoryStorage.get(fullKey);
    if (!record || record.expiresAt < now) {
      record = { totalHits: 0, expiresAt: now + ttl };
    }

    record.totalHits += 1;
    // Map in JS maintains insertion order: deleting and re-inserting promotes key to MRU
    this.memoryStorage.delete(fullKey);
    this.memoryStorage.set(fullKey, record);

    // Bounded capacity check: prevent memory leaks/DoS if Redis is down
    if (this.memoryStorage.size > ResilientRedisThrottlerStorage.MAX_MEMORY_ENTRIES) {
      // 1. Purge expired entries
      for (const [k, v] of this.memoryStorage.entries()) {
        if (v.expiresAt <= now) {
          this.memoryStorage.delete(k);
        }
      }
      // 2. If still over capacity, evict oldest entries (LRU/FIFO)
      while (this.memoryStorage.size > ResilientRedisThrottlerStorage.MAX_MEMORY_ENTRIES) {
        const oldestKey = this.memoryStorage.keys().next().value;
        if (!oldestKey) break;
        this.memoryStorage.delete(oldestKey);
      }
    } else if (Math.random() < 0.01) {
      for (const [k, v] of this.memoryStorage.entries()) {
        if (v.expiresAt < now) {
          this.memoryStorage.delete(k);
        }
      }
    }

    return {
      totalHits: record.totalHits,
      timeToExpire: Math.ceil((record.expiresAt - now) / 1000),
      isBlocked: record.totalHits > limit,
      timeToBlockExpire: record.totalHits > limit ? Math.ceil(blockDuration / 1000) : 0,
    };
  }
}
