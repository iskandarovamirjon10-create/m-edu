import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DistributedLockService } from '../distributed-lock';
import { getErrorMessage, toError } from '../error';
import { parsePagination } from '../pagination';
import { withPrismaRetry } from '../prisma-retry.util';

describe('Lib Utilities', () => {
  describe('DistributedLockService', () => {
    let mockRedis: {
      set: ReturnType<typeof vi.fn>;
      eval: ReturnType<typeof vi.fn>;
    };
    let lockService: DistributedLockService;

    beforeEach(() => {
      mockRedis = {
        set: vi.fn().mockResolvedValue('OK'),
        eval: vi.fn().mockResolvedValue(1),
      };
      lockService = new DistributedLockService(mockRedis);
    });

    it('should acquire and release lock successfully', async () => {
      const lockValue = await lockService.acquireLock('resource-1', { ttlMs: 1000 });
      expect(lockValue).toBeDefined();
      expect(typeof lockValue).toBe('string');
      expect(mockRedis.set).toHaveBeenCalledWith('resource-1', lockValue, 'PX', 1000, 'NX');

      await lockService.releaseLock('resource-1', lockValue!);
      expect(mockRedis.eval).toHaveBeenCalledWith(expect.any(String), 1, 'resource-1', lockValue);
    });

    it('should not release another owner\'s lock when the token does not match', async () => {
      // Faithful fake of the Redis side: SET NX plus the compare-and-delete
      // Lua contract. This proves the *observable* safety property — a
      // non-owner release must leave the owner's key intact — rather than an
      // implementation detail such as "eval was never called".
      const store = new Map<string, string>();
      mockRedis.set = vi.fn(async (key: string, value: string) => {
        if (store.has(key)) return null;
        store.set(key, value);
        return 'OK';
      });
      mockRedis.eval = vi.fn(async (_script: string, _numKeys: number, key: string, value: string) => {
        if (store.get(key) === value) {
          store.delete(key);
          return 1;
        }
        return 0;
      });

      const ownerToken = await lockService.acquireLock('camera:1', { ttlMs: 1000 });
      expect(ownerToken).toBeTruthy();

      // Another replica (or a stale worker) tries to release with a wrong token.
      await lockService.releaseLock('camera:1', 'stale-worker-token');

      expect(store.get('camera:1')).toBe(ownerToken);

      // The real owner can still release it.
      await lockService.releaseLock('camera:1', ownerToken!);
      expect(store.has('camera:1')).toBe(false);
    });

    it('should timeout when lock cannot be acquired', async () => {
      mockRedis.set.mockResolvedValue(null);
      const lockValue = await lockService.acquireLock('busy-resource', { timeoutMs: 150 });
      expect(lockValue).toBeNull();
    });

    it('should execute fn withLock and release afterwards', async () => {
      const result = await lockService.withLock('lock-key', async () => {
        return 'executed';
      });
      expect(result).toBe('executed');
      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockRedis.eval).toHaveBeenCalled();
    });

    it('should return null withLock if lock acquisition fails', async () => {
      mockRedis.set.mockResolvedValue(null);
      const fn = vi.fn();
      const result = await lockService.withLock('lock-key', fn, { timeoutMs: 100 });
      expect(result).toBeNull();
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('Error utilities', () => {
    it('should extract error message from Error instance', () => {
      expect(getErrorMessage(new Error('Test error'))).toBe('Test error');
    });

    it('should extract message from string', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should extract message from object with message property', () => {
      expect(getErrorMessage({ message: 'Object error' })).toBe('Object error');
    });

    it('should convert unknown to Error instance', () => {
      const err = toError('Some failure');
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Some failure');
    });

    it('surfaces a nested cause when the aggregate message is empty', () => {
      // Node reports multi-address connection failures as an AggregateError
      // with an empty message; logging `error.message` alone yields "".
      const aggregate = new AggregateError([
        new Error('connect ECONNREFUSED 127.0.0.1:6379'),
      ]);

      expect(getErrorMessage(aggregate)).toBe(
        'connect ECONNREFUSED 127.0.0.1:6379',
      );
    });

    it('falls back to the errno code when nothing else is available', () => {
      const err = new Error('');
      (err as NodeJS.ErrnoException).code = 'ECONNREFUSED';

      expect(getErrorMessage(err)).toBe('Error: ECONNREFUSED');
    });

    it('keeps a non-empty message even when codes are present', () => {
      const err = new AggregateError([new Error('inner')], 'outer message');
      (err as NodeJS.ErrnoException).code = 'ECONNREFUSED';

      expect(getErrorMessage(err)).toBe('outer message');
    });
  });

  describe('Pagination utility', () => {
    it('should calculate skip and limit with defaults', () => {
      const result = parsePagination({ page: 1, limit: 20 });
      expect(result).toEqual({ page: 1, limit: 20, skip: 0 });
    });

    it('should handle string query parameters and bounds', () => {
      const result = parsePagination({ page: '3', limit: '15' });
      expect(result).toEqual({ page: 3, limit: 15, skip: 30 });
    });

    it('should enforce min page and max limit', () => {
      const result = parsePagination({ page: -5, limit: 500 }, { maxLimit: 50 });
      expect(result).toEqual({ page: 1, limit: 50, skip: 0 });
    });
  });

  describe('Prisma Retry utility', () => {
    it('should return result on first try if successful', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withPrismaRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry transient concurrency errors (deadlock / serialization / pool timeout)', async () => {
      for (const code of ['P2024', 'P2034', '40001', '40P01']) {
        const fn = vi
          .fn()
          .mockRejectedValueOnce({ code, message: 'transient' })
          .mockResolvedValue('recovered');

        const result = await withPrismaRetry(fn, { baseDelayMs: 1, maxAttempts: 2 });
        expect(result).toBe('recovered');
        expect(fn).toHaveBeenCalledTimes(2);
      }
    });

    it('should retry a deadlock reported only in the message', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('deadlock detected'))
        .mockResolvedValue('recovered');

      const result = await withPrismaRetry(fn, { baseDelayMs: 1, maxAttempts: 2 });
      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should NEVER retry deterministic errors (unique violation, validation, not found)', async () => {
      const deterministic = [
        { code: 'P2002', message: 'Unique constraint failed on the fields: (`email`)' },
        { code: 'P2000', message: 'The provided value is too long' },
        { code: 'P2025', message: 'Record to update not found' },
        { code: 'P2003', message: 'Foreign key constraint failed' },
      ];

      for (const err of deterministic) {
        const fn = vi.fn().mockRejectedValue(err);
        await expect(withPrismaRetry(fn, { baseDelayMs: 1, maxAttempts: 3 })).rejects.toMatchObject({
          code: err.code,
        });
        // One attempt only — a retry here is pure amplification.
        expect(fn).toHaveBeenCalledTimes(1);
      }
    });

    it('should rethrow non-serializable errors immediately', async () => {
      const regularError = new Error('Generic database error');
      const fn = vi.fn().mockRejectedValue(regularError);

      await expect(withPrismaRetry(fn, { baseDelayMs: 1 })).rejects.toThrow('Generic database error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should stop after maxAttempts for a persistent transient error', async () => {
      const fn = vi.fn().mockRejectedValue({ code: '40001', message: 'serialization failure' });
      await expect(
        withPrismaRetry(fn, { baseDelayMs: 1, maxAttempts: 3 }),
      ).rejects.toMatchObject({ code: '40001' });
      // 1 initial attempt + 3 retries, then give up.
      expect(fn).toHaveBeenCalledTimes(4);
    });
  });
});
