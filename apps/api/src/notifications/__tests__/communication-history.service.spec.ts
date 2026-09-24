import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommunicationHistoryService } from '../communication-history.service';

import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    communicationHistory: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
    },
  };
}

describe('CommunicationHistoryService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: CommunicationHistoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new CommunicationHistoryService(prisma as unknown as PrismaService);
  });

  describe('getHistory', () => {
    it('returns paginated history scoped to organization', async () => {
      prisma.communicationHistory.findMany.mockResolvedValue([{ id: 'c1', channel: 'EMAIL' }]);
      prisma.communicationHistory.count.mockResolvedValue(1);
      const result = await svc.getHistory('org-1', { page: '1', limit: '10' });
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(prisma.communicationHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-1' }) }),
      );
    });

    it('applies channel filter when provided', async () => {
      prisma.communicationHistory.findMany.mockResolvedValue([]);
      prisma.communicationHistory.count.mockResolvedValue(0);
      await svc.getHistory('org-1', { channel: 'SMS' });
      expect(prisma.communicationHistory.findMany.mock.calls[0][0].where.channel).toBe('SMS');
    });

    it('applies date range filter when provided', async () => {
      prisma.communicationHistory.findMany.mockResolvedValue([]);
      prisma.communicationHistory.count.mockResolvedValue(0);
      await svc.getHistory('org-1', { startDate: '2025-01-01', endDate: '2025-12-31' });
      const where = prisma.communicationHistory.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toEqual(new Date('2025-01-01'));
      expect(where.createdAt.lte).toEqual(new Date('2025-12-31'));
    });
  });

  describe('getTimeline', () => {
    it('returns timeline scoped to entity', async () => {
      prisma.communicationHistory.findMany.mockResolvedValue([{ id: 'c1' }]);
      const result = await svc.getTimeline('org-1', 'STUDENT', 'stu-1');
      expect(result.items).toHaveLength(1);
      expect(prisma.communicationHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', entityType: 'STUDENT', entityId: 'stu-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('getStats', () => {
    it('computes stats with delivery and failure rates', async () => {
      prisma.communicationHistory.count.mockResolvedValue(100);
      prisma.communicationHistory.groupBy
        .mockResolvedValueOnce([
          { channel: 'EMAIL', _count: { id: 50 } },
          { channel: 'SMS', _count: { id: 30 } },
          { channel: 'TELEGRAM', _count: { id: 20 } },
        ])
        .mockResolvedValueOnce([
          { status: 'DELIVERED', _count: { id: 70 } },
          { status: 'SENT', _count: { id: 10 } },
          { status: 'FAILED', _count: { id: 5 } },
          { status: 'BOUNCED', _count: { id: 5 } },
          { status: 'QUEUED', _count: { id: 10 } },
        ]);
      prisma.communicationHistory.aggregate.mockResolvedValue({ _count: { id: 100 } });

      const result = await svc.getStats('org-1');
      expect(result.total).toBe(100);
      expect(result.deliveryRate).toBe(80);
      expect(result.failureRate).toBe(10);
      expect(result.byChannel).toHaveLength(3);
      expect(result.byStatus).toHaveLength(5);
    });

    it('handles zero total gracefully', async () => {
      prisma.communicationHistory.count.mockResolvedValue(0);
      prisma.communicationHistory.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prisma.communicationHistory.aggregate.mockResolvedValue({ _count: { id: 0 } });

      const result = await svc.getStats('org-1');
      expect(result.total).toBe(0);
      expect(result.deliveryRate).toBe(0);
      expect(result.failureRate).toBe(0);
    });
  });

  describe('recordCommunication', () => {
    it('creates a new communication record', async () => {
      const created = { id: 'c-new', channel: 'EMAIL', status: 'SENT' };
      prisma.communicationHistory.create.mockResolvedValue(created);
      const result = await svc.recordCommunication('org-1', {
        entityType: 'STUDENT',
        entityId: 'stu-1',
        channel: 'EMAIL',
        content: 'Test message',
      });
      expect(result).toEqual(created);
      expect(prisma.communicationHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          entityType: 'STUDENT',
          entityId: 'stu-1',
          channel: 'EMAIL',
          content: 'Test message',
        }),
      });
    });

    it('defaults to OUTBOUND direction and QUEUED status', async () => {
      prisma.communicationHistory.create.mockResolvedValue({});
      await svc.recordCommunication('org-1', {
        entityType: 'PARENT',
        entityId: 'par-1',
        channel: 'SMS',
        content: 'Hello',
      });
      expect(prisma.communicationHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ direction: 'OUTBOUND', status: 'QUEUED' }),
      });
    });
  });
});
