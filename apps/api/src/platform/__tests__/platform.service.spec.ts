import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlatformService } from '../platform.service';
import { SubscriptionStatus } from '@prisma/client';

describe('PlatformService', () => {
  let service: PlatformService;
  let prismaMock: any;
  let securityMock: any;

  beforeEach(() => {
    prismaMock = {
      organization: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      user: {
        count: vi.fn(),
      },
      student: {
        count: vi.fn(),
      },
      subscription: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      saaSPlan: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      platformInvitation: {
        create: vi.fn(),
      },
    };

    securityMock = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new PlatformService(prismaMock, securityMock);
  });

  describe('getStatistics', () => {
    it('calculates MRR, ARR, active subscriber and status counts', async () => {
      prismaMock.organization.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8);
      prismaMock.user.count.mockResolvedValue(50);
      prismaMock.student.count.mockResolvedValue(400);
      prismaMock.subscription.findMany.mockResolvedValue([
        { status: SubscriptionStatus.ACTIVE, priceUzs: 549000, plan: 'STANDARD' },
        { status: SubscriptionStatus.ACTIVE, priceUzs: 1190000, plan: 'PRO' },
        { status: SubscriptionStatus.TRIALING, priceUzs: 0, plan: 'START' },
      ]);

      const stats = await service.getStatistics();

      expect(stats.orgCount).toBe(10);
      expect(stats.activeOrgs).toBe(8);
      expect(stats.userCount).toBe(50);
      expect(stats.studentCount).toBe(400);
      expect(stats.mrr).toBe(1739000); // 549000 + 1190000
      expect(stats.arr).toBe(1739000 * 12);
      expect(stats.statusCounts.ACTIVE).toBe(2);
      expect(stats.statusCounts.TRIALING).toBe(1);
      expect(stats.planCounts.STANDARD).toBe(1);
      expect(stats.planCounts.PRO).toBe(1);
    });
  });

  describe('updateOrganizationSubscription', () => {
    it('overrides subscription attributes and logs security audit event', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'Test Academy',
        subscription: {
          id: 'sub-1',
          plan: 'START',
          status: SubscriptionStatus.TRIALING,
        },
      });

      prismaMock.subscription.update.mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.ACTIVE,
        maxStudents: 500,
        priceUzs: 549000,
      });

      const updated = await service.updateOrganizationSubscription(
        'org-1',
        {
          status: SubscriptionStatus.ACTIVE,
          maxStudents: 500,
          priceUzs: 549000,
        },
        'owner-user-id',
      );

      expect(updated.status).toBe(SubscriptionStatus.ACTIVE);
      expect(updated.maxStudents).toBe(500);
      expect(securityMock.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-user-id',
          resourceType: 'Subscription',
        }),
      );
    });
  });

  describe('suspendOrganization & reactivateOrganization', () => {
    it('suspends an organization subscription', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        subscription: { id: 'sub-1', status: SubscriptionStatus.ACTIVE },
      });
      prismaMock.subscription.update.mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.SUSPENDED,
      });

      const res = await service.suspendOrganization('org-1', 'owner-user-id');
      expect(res.status).toBe(SubscriptionStatus.SUSPENDED);
    });

    it('reactivates an organization subscription', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        subscription: { id: 'sub-1', status: SubscriptionStatus.SUSPENDED },
      });
      prismaMock.subscription.update.mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.ACTIVE,
      });

      const res = await service.reactivateOrganization('org-1', 'owner-user-id');
      expect(res.status).toBe(SubscriptionStatus.ACTIVE);
    });
  });

  describe('getPlans & updatePlan', () => {
    it('returns all plans with numeric prices', async () => {
      prismaMock.saaSPlan.findMany.mockResolvedValue([
        { id: 'plan-1', code: 'START', priceUzsPerMonth: BigInt(299000) },
        { id: 'plan-2', code: 'STANDARD', priceUzsPerMonth: BigInt(549000) },
      ]);

      const plans = await service.getPlans();
      expect(plans).toHaveLength(2);
      expect(plans[0].priceUzs).toBe(299000);
    });

    it('updates a plan configuration', async () => {
      prismaMock.saaSPlan.findUnique.mockResolvedValue({
        id: 'plan-1',
        code: 'START',
      });
      prismaMock.saaSPlan.update.mockResolvedValue({
        id: 'plan-1',
        code: 'START',
        priceUzsPerMonth: BigInt(320000),
        maxStudents: 150,
      });

      const updated = await service.updatePlan('plan-1', {
        priceUzs: 320000,
        maxStudents: 150,
      });

      expect(updated.priceUzs).toBe(320000);
      expect(updated.maxStudents).toBe(150);
    });
  });
});
