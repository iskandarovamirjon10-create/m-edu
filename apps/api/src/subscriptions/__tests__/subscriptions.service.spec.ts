import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionsService } from '../subscriptions.service';
import { PlanTierCode, BillingCycle } from '../dto/subscription.dto';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

describe('SubscriptionsService — SaaS Subscription & Quota Engine', () => {
  let service: SubscriptionsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      saaSPlan: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      subscription: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      subscriptionInvoice: {
        create: vi.fn(),
      },
      student: {
        count: vi.fn(),
      },
      branch: {
        count: vi.fn(),
      },
      user: {
        count: vi.fn(),
      },
      camera: {
        count: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prisma)),
    };

    service = new SubscriptionsService(prisma);
  });

  describe('getPlans', () => {
    it('returns seeded plans if database contains existing active plans', async () => {
      prisma.saaSPlan.findMany.mockResolvedValue([
        {
          id: 'plan-1',
          code: 'START',
          nameUz: 'Start',
          nameRu: 'Старт',
          priceUzsPerMonth: BigInt(299000),
          maxStudents: 100,
          maxBranches: 1,
          maxEmployees: 5,
          maxCameras: 0,
          hasFaceId: false,
          hasAiCopilot: true,
          isActive: true,
          sortOrder: 1,
        },
      ]);

      const plans = await service.getPlans();
      expect(plans.length).toBe(1);
      expect(plans[0].code).toBe('START');
      expect(plans[0].priceUzsPerMonth).toBe(299000);
    });

    it('auto-seeds the 4 standard commercial tiers when plans table is empty', async () => {
      prisma.saaSPlan.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { code: 'START', priceUzsPerMonth: BigInt(299000) },
          { code: 'STANDARD', priceUzsPerMonth: BigInt(549000) },
          { code: 'PRO', priceUzsPerMonth: BigInt(1190000) },
          { code: 'ENTERPRISE', priceUzsPerMonth: BigInt(2490000) },
        ]);

      const plans = await service.getPlans();
      expect(prisma.saaSPlan.upsert).toHaveBeenCalledTimes(4);
      expect(plans.length).toBe(4);
    });
  });

  describe('createTrial & 7-day expiration', () => {
    it('creates a 7-day trial with START limits and TRIALING status', async () => {
      prisma.saaSPlan.findMany.mockResolvedValue([
        {
          id: 'p-start',
          code: 'START',
          maxStudents: 100,
          maxBranches: 1,
          maxEmployees: 5,
          maxCameras: 0,
          hasFaceId: false,
          hasAiCopilot: true,
          priceUzsPerMonth: BigInt(299000),
        },
      ]);

      prisma.subscription.upsert.mockResolvedValue({
        id: 'sub-1',
        organizationId: 'org-test',
        status: SubscriptionStatus.TRIALING,
        trialStartAt: new Date(),
        trialEndAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const trial = await service.createTrial('org-test');
      expect(trial.status).toBe(SubscriptionStatus.TRIALING);
      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-test' },
        }),
      );
    });

    it('automatically transitions TRIALING to EXPIRED when current date exceeds trialEndAt', async () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        organizationId: 'org-expired',
        plan: SubscriptionPlan.START,
        status: SubscriptionStatus.TRIALING,
        trialStartAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        trialEndAt: pastDate,
        maxStudents: 100,
        maxBranches: 1,
        maxEmployees: 5,
        maxCameras: 0,
        saasPlan: { code: 'START', nameUz: 'Start' },
      });

      prisma.subscription.update.mockResolvedValue({
        id: 'sub-1',
        organizationId: 'org-expired',
        plan: SubscriptionPlan.START,
        status: SubscriptionStatus.EXPIRED,
        trialEndAt: pastDate,
        maxStudents: 100,
        maxBranches: 1,
        maxEmployees: 5,
        maxCameras: 0,
        saasPlan: { code: 'START', nameUz: 'Start' },
      });

      prisma.student.count.mockResolvedValue(10);
      prisma.branch.count.mockResolvedValue(1);
      prisma.user.count.mockResolvedValue(2);
      prisma.camera.count.mockResolvedValue(0);

      const sub = await service.getSubscription('org-expired');
      expect(sub.status).toBe(SubscriptionStatus.EXPIRED);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { organizationId: 'org-expired' },
        data: { status: SubscriptionStatus.EXPIRED },
        include: { saasPlan: true },
      });
    });
  });

  describe('Quota enforcement', () => {
    it('allows creation when current usage is within plan limits', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-active',
        organizationId: 'org-active',
        status: SubscriptionStatus.ACTIVE,
        maxStudents: 100,
        maxBranches: 1,
        maxEmployees: 5,
        maxCameras: 0,
        saasPlan: { code: 'START' },
      });
      prisma.student.count.mockResolvedValue(42);
      prisma.branch.count.mockResolvedValue(1);
      prisma.user.count.mockResolvedValue(3);
      prisma.camera.count.mockResolvedValue(0);

      const check = await service.checkQuota('org-active', 'students');
      expect(check.allowed).toBe(true);
      expect(check.current).toBe(42);
      expect(check.limit).toBe(100);
    });

    it('rejects creation with ForbiddenException when quota is exhausted', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-active',
        organizationId: 'org-capped',
        status: SubscriptionStatus.ACTIVE,
        maxStudents: 100,
        maxBranches: 1,
        maxEmployees: 5,
        maxCameras: 0,
        saasPlan: { code: 'START' },
      });
      prisma.student.count.mockResolvedValue(100);
      prisma.branch.count.mockResolvedValue(1);
      prisma.user.count.mockResolvedValue(3);
      prisma.camera.count.mockResolvedValue(0);

      await expect(
        service.checkQuota('org-capped', 'students'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects creation when subscription is EXPIRED or SUSPENDED', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-expired',
        organizationId: 'org-expired',
        status: SubscriptionStatus.EXPIRED,
        maxStudents: 100,
        maxBranches: 1,
        maxEmployees: 5,
        maxCameras: 0,
        saasPlan: { code: 'START' },
      });
      prisma.student.count.mockResolvedValue(10);
      prisma.branch.count.mockResolvedValue(1);
      prisma.user.count.mockResolvedValue(2);
      prisma.camera.count.mockResolvedValue(0);

      await expect(
        service.checkQuota('org-expired', 'students'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('Feature entitlements', () => {
    it('allows Face ID when plan includes hasFaceId: true', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-pro',
        organizationId: 'org-pro',
        status: SubscriptionStatus.ACTIVE,
        hasFaceId: true,
        hasAiCopilot: true,
        saasPlan: { code: 'PRO' },
      });
      prisma.student.count.mockResolvedValue(10);
      prisma.branch.count.mockResolvedValue(1);
      prisma.user.count.mockResolvedValue(2);
      prisma.camera.count.mockResolvedValue(0);

      const entitled = await service.checkEntitlement('org-pro', 'hasFaceId');
      expect(entitled).toBe(true);
    });

    it('denies Face ID with ForbiddenException on START plan', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-start',
        organizationId: 'org-start',
        status: SubscriptionStatus.ACTIVE,
        hasFaceId: false,
        hasAiCopilot: true,
        saasPlan: { code: 'START' },
      });
      prisma.student.count.mockResolvedValue(10);
      prisma.branch.count.mockResolvedValue(1);
      prisma.user.count.mockResolvedValue(2);
      prisma.camera.count.mockResolvedValue(0);

      await expect(
        service.checkEntitlement('org-start', 'hasFaceId'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('changePlan & downgrade safety', () => {
    it('prevents downgrade if current active students exceed new plan limit', async () => {
      prisma.saaSPlan.findUnique.mockResolvedValue({
        code: 'START',
        isActive: true,
        maxStudents: 100,
        maxBranches: 1,
      });

      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-current',
        organizationId: 'org-busy',
      });

      prisma.student.count.mockResolvedValue(250); // Currently 250 students
      prisma.branch.count.mockResolvedValue(1);
      prisma.user.count.mockResolvedValue(5);
      prisma.camera.count.mockResolvedValue(0);

      await expect(
        service.changePlan('org-busy', { planCode: PlanTierCode.START, billingCycle: BillingCycle.MONTHLY }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
