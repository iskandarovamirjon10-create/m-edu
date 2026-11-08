import { describe, expect, it, vi } from 'vitest';
import { executeWithRetry, isTransientDatabaseError } from '../prisma-resilience';

describe('PrismaResilience', () => {
  describe('isTransientDatabaseError', () => {
    it('detects PostgreSQL deadlock code 40P01', () => {
      expect(isTransientDatabaseError({ code: '40P01', message: 'deadlock detected' })).toBe(true);
    });

    it('detects PostgreSQL serialization failure code 40001', () => {
      expect(isTransientDatabaseError({ code: '40001', message: 'could not serialize access' })).toBe(true);
    });

    it('detects Prisma transaction conflict P2034', () => {
      expect(isTransientDatabaseError({ code: 'P2034', message: 'Transaction conflict' })).toBe(true);
    });

    it('detects connection pool timeout P2024', () => {
      expect(isTransientDatabaseError({ code: 'P2024', message: 'Timed out pool' })).toBe(true);
    });

    it('detects socket connection drop from message', () => {
      expect(isTransientDatabaseError(new Error('Connection terminated unexpectedly'))).toBe(true);
      expect(isTransientDatabaseError(new Error('read ECONNRESET'))).toBe(true);
    });

    it('returns false for permanent domain errors (e.g. unique constraint or not found)', () => {
      expect(isTransientDatabaseError({ code: 'P2002', message: 'Unique constraint failed' })).toBe(false);
      expect(isTransientDatabaseError({ code: 'P2025', message: 'Record not found' })).toBe(false);
      expect(isTransientDatabaseError(new Error('Validation error: invalid email'))).toBe(false);
    });
  });

  describe('executeWithRetry', () => {
    it('returns result immediately on successful operation', async () => {
      const mockOp = vi.fn().mockResolvedValue('success-payload');
      const result = await executeWithRetry(mockOp);
      expect(result).toBe('success-payload');
      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('retries on deadlock and succeeds on subsequent attempt', async () => {
      let callCount = 0;
      const mockOp = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('deadlock detected') as Error & { code: string };
          err.code = '40P01';
          throw err;
        }
        return 'recovered-after-deadlock';
      });

      const result = await executeWithRetry(mockOp, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
      });

      expect(result).toBe('recovered-after-deadlock');
      expect(mockOp).toHaveBeenCalledTimes(2);
    });

    it('immediately throws non-transient error without retrying', async () => {
      const mockOp = vi.fn().mockImplementation(async () => {
        const err = new Error('Unique constraint failed') as Error & { code: string };
        err.code = 'P2002';
        throw err;
      });

      await expect(
        executeWithRetry(mockOp, { maxRetries: 3, initialDelayMs: 10 }),
      ).rejects.toThrow('Unique constraint failed');

      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('throws if max retries are exhausted', async () => {
      const mockOp = vi.fn().mockImplementation(async () => {
        const err = new Error('could not serialize access') as Error & { code: string };
        err.code = '40001';
        throw err;
      });

      await expect(
        executeWithRetry(mockOp, { maxRetries: 2, initialDelayMs: 10, maxDelayMs: 20 }),
      ).rejects.toThrow('could not serialize access');

      expect(mockOp).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });
});
