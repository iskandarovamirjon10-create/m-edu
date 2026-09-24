import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrmAnalyticsService } from '../crm-analytics.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    $queryRaw: vi.fn(),
    lead: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  } as unknown as PrismaService;
}

describe('CrmAnalyticsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: CrmAnalyticsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new CrmAnalyticsService(prisma);
    prisma.user.findMany.mockResolvedValue([]);
  });

  describe('getFunnelAnalysis', () => {
    it('returns correct stage counts and conversion rates', async () => {
      prisma.lead.groupBy.mockResolvedValue([
        { stage: 'NEW', _count: { stage: 2 } },
        { stage: 'CONTACTED', _count: { stage: 1 } },
        { stage: 'WON', _count: { stage: 1 } },
      ]);
      const result = await service.getFunnelAnalysis('org-1');
      expect(result.total).toBe(4);
      expect(result.overallConversion).toBe(25); // 1 won / 4 total
    });

    it('returns zero counts for empty data', async () => {
      prisma.lead.groupBy.mockResolvedValue([]);
      const result = await service.getFunnelAnalysis('org-1');
      expect(result.total).toBe(0);
      expect(result.overallConversion).toBe(0);
    });
  });

  describe('getSourcePerformance', () => {
    it('groups leads by source with correct stats', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { source: 'Website', total: 2, won: 1 },
        { source: 'Referral', total: 1, won: 0 },
      ]);

      const result = await service.getSourcePerformance('org-1');
      expect(result).toHaveLength(2);
      const website = result.find((s: { source: string }) => s.source === 'Website');
      expect(website.totalLeads).toBe(2);
      expect(website.wonLeads).toBe(1);
      expect(website.conversionRate).toBe(50);
    });
  });

  describe('getPipelineVelocity', () => {
    it('calculates average days in pipeline', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { stage: 'NEW', avg_days: 4, median_days: 4, lead_count: 1 },
        { stage: 'CONTACTED', avg_days: 4, median_days: 4, lead_count: 1 },
      ]);

      const result = await service.getPipelineVelocity('org-1');
      expect(result.stageVelocity).toHaveLength(5);
      expect(result.totalActiveLeads).toBe(2);
      expect(result.avgDaysInPipeline).toBe(4);
    });
  });

  describe('getLostReasons', () => {
    it('groups lost leads by reason', async () => {
      prisma.lead.groupBy.mockResolvedValue([
        { lostReason: 'Too expensive', _count: { lostReason: 2 } },
        { lostReason: 'No response', _count: { lostReason: 1 } },
        { lostReason: null, _count: { lostReason: 1 } },
      ]);

      const result = await service.getLostReasons('org-1');
      expect(result.totalLost).toBe(4);
      expect(result.reasons).toHaveLength(3);
      expect(result.reasons[0].reason).toBe('Too expensive');
      expect(result.reasons[0].count).toBe(2);
    });
  });

  describe('getLeadAging', () => {
    it('categorizes leads by age', async () => {
      const now = new Date('2026-09-10');
      vi.useFakeTimers({ now });

      prisma.lead.findMany.mockResolvedValue([
        { id: '1', firstName: 'A', lastName: 'B', stage: 'NEW', source: 'Web', createdAt: new Date('2026-09-08'), updatedAt: new Date('2026-09-09') },
        { id: '2', firstName: 'C', lastName: 'D', stage: 'CONTACTED', source: 'Ref', createdAt: new Date('2026-08-01'), updatedAt: new Date('2026-08-15') },
      ]);

      const result = await service.getLeadAging('org-1');
      expect(result.total).toBe(2);
      expect(result.statusCounts.FRESH).toBe(1);
      expect(result.statusCounts.STUCK).toBe(1);

      vi.useRealTimers();
    });
  });

  describe('getModeratorActivity', () => {
    it('groups leads by owner with conversion rates', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { ownerId: 'u1', total: 2, won: 1 },
        { ownerId: 'u2', total: 1, won: 0 },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
        { id: 'u2', firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com' },
      ]);

      const result = await service.getModeratorActivity('org-1');
      expect(result).toHaveLength(2);
      const john = result.find((m: { moderatorId: string }) => m.moderatorId === 'u1');
      expect(john.totalLeads).toBe(2);
      expect(john.wonLeads).toBe(1);
      expect(john.conversionRate).toBe(50);
    });
  });
});
