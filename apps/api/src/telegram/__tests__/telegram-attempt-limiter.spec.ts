import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelegramAttemptLimiter } from '../telegram-attempt-limiter.service';
import { TELEGRAM_LINK_ATTEMPT_WINDOW_SECONDS } from '../telegram.constants';

describe('TelegramAttemptLimiter', () => {
  let limiter: TelegramAttemptLimiter;
  let redis: {
    get: ReturnType<typeof vi.fn>;
    incr: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  const originalRedisEnabled = process.env.REDIS_ENABLED;

  beforeEach(() => {
    delete process.env.REDIS_ENABLED;
    limiter = new TelegramAttemptLimiter();
    redis = {
      get: vi.fn().mockResolvedValue(null),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue('OK'),
    };
    limiter.setRedis(redis as never);
  });

  afterEach(() => {
    if (originalRedisEnabled === undefined) delete process.env.REDIS_ENABLED;
    else process.env.REDIS_ENABLED = originalRedisEnabled;
  });

  it('increments the counter and arms the window on the first failure', async () => {
    await expect(limiter.registerFailure('chat:1')).resolves.toBe(1);
    expect(redis.incr).toHaveBeenCalledWith('tg:link-attempts:chat:1');
    expect(redis.expire).toHaveBeenCalledWith(
      'tg:link-attempts:chat:1',
      TELEGRAM_LINK_ATTEMPT_WINDOW_SECONDS,
    );
  });

  it('does not re-arm the window on subsequent failures', async () => {
    redis.incr.mockResolvedValue(4);
    await limiter.registerFailure('chat:1');
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('blocks once the counter reaches the limit', async () => {
    redis.get.mockResolvedValue('10');
    await expect(limiter.isBlocked('chat:1', 10)).resolves.toBe(true);

    redis.get.mockResolvedValue('9');
    await expect(limiter.isBlocked('chat:1', 10)).resolves.toBe(false);

    redis.get.mockResolvedValue(null);
    await expect(limiter.isBlocked('chat:1', 10)).resolves.toBe(false);
  });

  it('clears the counter', async () => {
    await limiter.clear('chat:1');
    expect(redis.del).toHaveBeenCalledWith('tg:link-attempts:chat:1');
  });

  it('fails open when Redis is unavailable', async () => {
    redis.get.mockRejectedValue(new Error('connection refused'));
    redis.incr.mockRejectedValue(new Error('connection refused'));

    await expect(limiter.isBlocked('chat:1', 10)).resolves.toBe(false);
    await expect(limiter.registerFailure('chat:1')).resolves.toBe(0);
  });

  it('is inert when Redis is disabled by configuration', async () => {
    process.env.REDIS_ENABLED = 'false';
    const disabled = new TelegramAttemptLimiter();

    await expect(disabled.isBlocked('chat:1', 1)).resolves.toBe(false);
    await expect(disabled.registerFailure('chat:1')).resolves.toBe(0);
    await expect(disabled.clear('chat:1')).resolves.toBeUndefined();
  });

  describe('one-time action claims (sensitive-callback replay defense)', () => {
    it('claims a fresh key and refuses the second press of the same payload', async () => {
      await expect(limiter.tryClaimOnce('abc123', 300)).resolves.toBe(true);
      expect(redis.set).toHaveBeenCalledWith('tg:once:abc123', '1', 'EX', 300, 'NX');

      // Concurrent/replayed press of the SAME payload loses the race.
      redis.set.mockResolvedValue(null);
      await expect(limiter.tryClaimOnce('abc123', 300)).resolves.toBe(false);
    });

    it('uses different keys for different payloads', async () => {
      await expect(limiter.tryClaimOnce('p1', 300)).resolves.toBe(true);
      await expect(limiter.tryClaimOnce('p2', 300)).resolves.toBe(true);
      expect(redis.set).toHaveBeenCalledTimes(2);
    });

    it('fails open when Redis is unavailable (operations stay idempotent)', async () => {
      redis.set.mockRejectedValue(new Error('connection refused'));
      await expect(limiter.tryClaimOnce('abc', 300)).resolves.toBe(true);
    });

    it('clamps non-positive TTLs to at least 1 second', async () => {
      await limiter.tryClaimOnce('abc', 0);
      expect(redis.set).toHaveBeenCalledWith('tg:once:abc', '1', 'EX', 1, 'NX');
    });
  });
});
