import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResilientRedisThrottlerStorage } from '../guards/throttler-redis.storage';

vi.mock('ioredis', () => {
  return {
    Redis: class {
      on = vi.fn();
      multi = vi.fn();
      pexpire = vi.fn();
    },
  };
});

describe('ResilientRedisThrottlerStorage', () => {
  let storage: ResilientRedisThrottlerStorage;

  beforeEach(() => {
    storage = new ResilientRedisThrottlerStorage('redis://localhost:6379');
  });

  it('should fall back to memory storage when redis is not connected', async () => {
    const record = await storage.increment('test-key', 60000, 10, 60000, 'default');

    expect(record.totalHits).toBe(1);
    expect(record.isBlocked).toBe(false);
    expect(record.timeToExpire).toBeGreaterThan(0);
    expect(record.timeToBlockExpire).toBe(0);
  });

  it('should increment hits in memory and block when limit exceeded', async () => {
    for (let i = 0; i < 5; i++) {
      await storage.increment('limit-key', 60000, 3, 30000, 'default');
    }

    const blockedRecord = await storage.increment('limit-key', 60000, 3, 30000, 'default');

    expect(blockedRecord.totalHits).toBe(6);
    expect(blockedRecord.isBlocked).toBe(true);
    expect(blockedRecord.timeToBlockExpire).toBe(30);
  });

  it('should handle redis increment when connected', async () => {
    const redisInstance = (storage as unknown as { redis: { multi: ReturnType<typeof vi.fn> } }).redis;
    (storage as unknown as { isRedisConnected: boolean }).isRedisConnected = true;

    const mockExec = vi.fn().mockResolvedValue([
      [null, 2],
      [null, 50000],
    ]);

    const mockMulti = {
      incr: vi.fn().mockReturnThis(),
      pttl: vi.fn().mockReturnThis(),
      exec: mockExec,
    };

    redisInstance.multi = vi.fn().mockReturnValue(mockMulti);

    const record = await storage.increment('redis-key', 60000, 5, 60000, 'default');

    expect(record.totalHits).toBe(2);
    expect(record.isBlocked).toBe(false);
    expect(record.timeToExpire).toBe(50);
  });

  it('should fall back to memory if redis multi exec fails', async () => {
    const redisInstance = (storage as unknown as { redis: { multi: ReturnType<typeof vi.fn> } }).redis;
    (storage as unknown as { isRedisConnected: boolean }).isRedisConnected = true;

    const mockMulti = {
      incr: vi.fn().mockReturnThis(),
      pttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockRejectedValue(new Error('Connection dropped')),
    };

    redisInstance.multi = vi.fn().mockReturnValue(mockMulti);

    const record = await storage.increment('fallback-key', 60000, 5, 60000, 'default');

    expect(record.totalHits).toBe(1);
    expect((storage as unknown as { isRedisConnected: boolean }).isRedisConnected).toBe(false);
  });

  it('bounds memory storage capacity and evicts oldest entries', async () => {
    const origMax = ResilientRedisThrottlerStorage.MAX_MEMORY_ENTRIES;
    (ResilientRedisThrottlerStorage as any).MAX_MEMORY_ENTRIES = 5;

    try {
      for (let i = 1; i <= 6; i++) {
        await storage.increment(`key-${i}`, 60000, 10, 60000, 'default');
      }

      const map = (storage as any).memoryStorage as Map<string, unknown>;
      expect(map.size).toBeLessThanOrEqual(5);
      // key-1 should have been evicted
      expect(map.has('throttler:default:key-1')).toBe(false);
      // key-6 must be present
      expect(map.has('throttler:default:key-6')).toBe(true);
    } finally {
      (ResilientRedisThrottlerStorage as any).MAX_MEMORY_ENTRIES = origMax;
    }
  });
});
