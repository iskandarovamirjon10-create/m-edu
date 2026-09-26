import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { isRedisEnabled } from '../config/redis.config';
import { TELEGRAM_LINK_ATTEMPT_WINDOW_SECONDS } from './telegram.constants';

/**
 * Distributed rate limiter for Telegram linking attempts.
 *
 * Brute-forcing a 256-bit link token is already statistically hopeless, but a
 * bounded attempt counter (a) caps abuse/noise and (b) limits the damage if
 * the token entropy were ever weakened. Correctness must not depend on a
 * single API instance, so the counter lives in Redis — the same shared
 * infrastructure the notification throttler and queues already use.
 *
 * Failure mode is deliberate: if Redis is unavailable the limiter FAILS OPEN
 * (returns "not blocked"). The primary control — token entropy + single-use
 * consumption — still holds, and a Redis outage must never take down the
 * webhook for every user. This mirrors the graceful degradation used by the
 * notification processor and ResilientRedisThrottlerStorage.
 */
@Injectable()
export class TelegramAttemptLimiter {
  private readonly logger = new Logger(TelegramAttemptLimiter.name);
  private redis: Redis | null = null;
  private initialised = false;

  /** Lazily create a dedicated client (one per process), as other services do. */
  private async getRedis(): Promise<Redis | null> {
    if (!isRedisEnabled()) return null;
    if (this.initialised) return this.redis;
    this.initialised = true;
    try {
      const mod = await import('ioredis');
      const RedisCtor = mod.default as unknown as {
        new (opts: Record<string, unknown>): Redis;
      };
      const client = new RedisCtor({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
      });
      // Swallow connection errors here: this limiter is best-effort and must
      // not spam the logs or crash the process when Redis is down.
      client.on('error', () => undefined);
      this.redis = client;
    } catch {
      this.redis = null;
    }
    return this.redis;
  }

  private key(scope: string): string {
    return `tg:link-attempts:${scope}`;
  }

  /** True when `scope` has reached/exceeded `max` failures in the window. */
  async isBlocked(scope: string, max: number): Promise<boolean> {
    const redis = await this.getRedis();
    if (!redis) return false;
    try {
      const raw = await redis.get(this.key(scope));
      return raw !== null && Number(raw) >= max;
    } catch {
      // Fail open — see class doc.
      return false;
    }
  }

  /**
   * Record one failure and return the new running count (0 when unavailable).
   * `windowSeconds` defaults to the linking attempt window.
   */
  async registerFailure(
    scope: string,
    windowSeconds: number = TELEGRAM_LINK_ATTEMPT_WINDOW_SECONDS,
  ): Promise<number> {
    return this.bump(scope, windowSeconds);
  }

  /**
   * Count a benign hit (a command or callback press) in a short window.
   * Separated from `registerFailure` only so the call sites read clearly —
   * both share the same distributed counter.
   */
  async hit(scope: string, windowSeconds: number): Promise<number> {
    return this.bump(scope, windowSeconds);
  }

  private async bump(scope: string, windowSeconds: number): Promise<number> {
    const redis = await this.getRedis();
    if (!redis) return 0;
    try {
      const k = this.key(scope);
      const count = await redis.incr(k);
      if (count === 1) {
        await redis.expire(k, windowSeconds);
      }
      return count;
    } catch {
      this.logger.warn('Failed to record Telegram attempt (Redis unavailable)');
      return 0;
    }
  }

  /**
   * Atomically claim a one-time action marker (distributed SET NX).
   *
   * Used as the replay defense for SENSITIVE callbacks (e.g. unlink
   * confirmation): the first press of a given signed payload claims the
   * marker, and any concurrent/replayed press of the SAME payload — on any API
   * instance — is refused while the marker lives. The marker TTL matches the
   * callback's own expiry, after which the payload is rejected by the TTL
   * check anyway.
   *
   * Failure mode: if Redis is unavailable the claim SUCCEEDS (fail open). The
   * protected operations are all idempotent (a second unlink finds no ACTIVE
   * link and changes nothing), so availability is preferred over strict
   * exactly-once during a Redis outage. This mirrors the limiter's documented
   * degradation policy.
   *
   * @returns true when the caller won the claim (may proceed).
   */
  async tryClaimOnce(key: string, ttlSeconds: number): Promise<boolean> {
    const redis = await this.getRedis();
    if (!redis) return true;
    try {
      const claimed = await redis.set(
        `tg:once:${key}`,
        '1',
        'EX',
        Math.max(1, ttlSeconds),
        'NX',
      );
      // ioredis resolves null when the key already existed.
      return claimed === 'OK' || claimed === 1 || claimed === true;
    } catch {
      return true;
    }
  }

  /** Reset the counter after a successful link. */
  async clear(scope: string): Promise<void> {
    const redis = await this.getRedis();
    if (!redis) return;
    try {
      await redis.del(this.key(scope));
    } catch {
      // Best-effort; the window will expire on its own.
    }
  }

  /** Test seam: inject a fake/undefined client. */
  setRedis(client: Redis | null): void {
    this.redis = client;
    this.initialised = true;
  }
}
