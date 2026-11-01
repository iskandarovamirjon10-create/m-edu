import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BiometricRetentionService } from '../biometric-retention.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('BiometricRetentionService', () => {
  let service: BiometricRetentionService;
  let prisma: {
    recognitionAttempt: {
      findMany: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    cameraAttendanceEvent: {
      findMany: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      recognitionAttempt: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      cameraAttendanceEvent: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    service = new BiometricRetentionService(prisma as unknown as PrismaService);
    delete process.env.BIOMETRIC_RETENTION_DAYS;
  });

  describe('cutoff calculation', () => {
    it('defaults to 30 days retention when no env var is set', () => {
      const fixedNow = new Date('2026-10-27T12:00:00.000Z');
      const cutoff = service.getCutoffDate(fixedNow);
      const expected = new Date(fixedNow.getTime() - 30 * 24 * 60 * 60 * 1000);
      expect(cutoff.toISOString()).toBe(expected.toISOString());
    });

    it('respects valid BIOMETRIC_RETENTION_DAYS from environment', () => {
      process.env.BIOMETRIC_RETENTION_DAYS = '14';
      const fixedNow = new Date('2026-10-27T12:00:00.000Z');
      const cutoff = service.getCutoffDate(fixedNow);
      const expected = new Date(fixedNow.getTime() - 14 * 24 * 60 * 60 * 1000);
      expect(cutoff.toISOString()).toBe(expected.toISOString());
    });

    it('enforces a minimum retention threshold of 7 days', () => {
      process.env.BIOMETRIC_RETENTION_DAYS = '2'; // Less than 7 days is rejected for safety
      const fixedNow = new Date('2026-10-27T12:00:00.000Z');
      const cutoff = service.getCutoffDate(fixedNow);
      // Falls back to default (30 days) to prevent accidental immediate deletion
      const expected = new Date(fixedNow.getTime() - 30 * 24 * 60 * 60 * 1000);
      expect(cutoff.toISOString()).toBe(expected.toISOString());
    });
  });

  describe('purgeTransientRecognitionAttemptsOlderThan', () => {
    it('deletes transient attempts in batches and returns total deleted count', async () => {
      const cutoff = new Date('2026-09-01T00:00:00.000Z');
      prisma.recognitionAttempt.findMany
        .mockResolvedValueOnce([{ id: 'att-1' }, { id: 'att-2' }])
        .mockResolvedValueOnce([]); // end of batches
      prisma.recognitionAttempt.deleteMany.mockResolvedValueOnce({ count: 2 });

      const total = await service.purgeTransientRecognitionAttemptsOlderThan(cutoff);

      expect(total).toBe(2);
      expect(prisma.recognitionAttempt.findMany).toHaveBeenCalledWith({
        where: {
          attendanceId: null,
          status: {
            in: [
              'MATCH_NOT_FOUND',
              'QUALITY_FAILED',
              'LIVENESS_FAILED',
              'UNIDENTIFIED',
              'ERROR',
            ],
          },
          createdAt: { lt: cutoff },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 1000,
      });
      expect(prisma.recognitionAttempt.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['att-1', 'att-2'] } },
      });
    });

    it('stops when batch is empty', async () => {
      const cutoff = new Date();
      prisma.recognitionAttempt.findMany.mockResolvedValueOnce([]);

      const total = await service.purgeTransientRecognitionAttemptsOlderThan(cutoff);

      expect(total).toBe(0);
      expect(prisma.recognitionAttempt.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('purgeTransientCameraEventsOlderThan', () => {
    it('deletes transient camera events where attendanceId is null', async () => {
      const cutoff = new Date('2026-09-01T00:00:00.000Z');
      prisma.cameraAttendanceEvent.findMany
        .mockResolvedValueOnce([{ id: 'evt-1' }])
        .mockResolvedValueOnce([]);
      prisma.cameraAttendanceEvent.deleteMany.mockResolvedValueOnce({ count: 1 });

      const total = await service.purgeTransientCameraEventsOlderThan(cutoff);

      expect(total).toBe(1);
      expect(prisma.cameraAttendanceEvent.findMany).toHaveBeenCalledWith({
        where: {
          attendanceId: null,
          decision: {
            in: ['NO_SCHEDULE', 'NOT_ENROLLED', 'HOLIDAY', 'STUDENT_INACTIVE'],
          },
          createdAt: { lt: cutoff },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 1000,
      });
    });
  });

  describe('sweep integration', () => {
    it('runs both purges and returns summary without throwing', async () => {
      prisma.recognitionAttempt.findMany.mockResolvedValueOnce([{ id: 'att-1' }]);
      prisma.recognitionAttempt.deleteMany.mockResolvedValueOnce({ count: 1 });

      prisma.cameraAttendanceEvent.findMany.mockResolvedValueOnce([{ id: 'evt-1' }]);
      prisma.cameraAttendanceEvent.deleteMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.sweep();

      expect(result).toEqual({ purgedAttempts: 1, purgedEvents: 1 });
    });

    it('catches and logs errors without bubbling to crash scheduler', async () => {
      prisma.recognitionAttempt.findMany.mockRejectedValue(new Error('DB disconnect'));

      const result = await service.sweep();

      expect(result).toEqual({ purgedAttempts: 0, purgedEvents: 0 });
    });
  });
});
