import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanTierCode, BillingCycle, ChangePlanDto } from './dto/subscription.dto';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

export interface QuotaCheckResult {
  allowed: boolean;
  resource: string;
  current: number;
  limit: number;
  planCode: string;
}

export const INITIAL_PLANS = [
  {
    code: PlanTierCode.START,
    nameUz: 'Boshlang‘ich (Start)',
    nameRu: 'Начальный (Start)',
    priceUzsPerMonth: BigInt(299000),
    maxStudents: 100,
    maxBranches: 1,
    maxEmployees: 5,
    maxCameras: 0,
    hasFaceId: false,
    hasAiCopilot: true,
    sortOrder: 1,
  },
  {
    code: PlanTierCode.STANDARD,
    nameUz: 'Standart (Standard)',
    nameRu: 'Стандарт (Standard)',
    priceUzsPerMonth: BigInt(549000),
    maxStudents: 300,
    maxBranches: 2,
    maxEmployees: 15,
    maxCameras: 2,
    hasFaceId: false,
    hasAiCopilot: true,
    sortOrder: 2,
  },
  {
    code: PlanTierCode.PRO,
    nameUz: 'Professional (Pro)',
    nameRu: 'Профессиональный (Pro)',
    priceUzsPerMonth: BigInt(1190000),
    maxStudents: 1000,
    maxBranches: 5,
    maxEmployees: 40,
    maxCameras: 10,
    hasFaceId: true,
    hasAiCopilot: true,
    sortOrder: 3,
  },
  {
    code: PlanTierCode.ENTERPRISE,
    nameUz: 'Korporativ (Enterprise)',
    nameRu: 'Корпоративный (Enterprise)',
    priceUzsPerMonth: BigInt(2490000),
    maxStudents: 5000,
    maxBranches: 20,
    maxEmployees: 200,
    maxCameras: 50,
    hasFaceId: true,
    hasAiCopilot: true,
    sortOrder: 4,
  },
];

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all available SaaS subscription plans. Seeds standard plans if empty.
   */
  async getPlans() {
    let plans = await this.prisma.saaSPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    if (plans.length === 0) {
      for (const p of INITIAL_PLANS) {
        await this.prisma.saaSPlan.upsert({
          where: { code: p.code },
          create: p,
          update: {},
        });
      }
      plans = await this.prisma.saaSPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    }

    return plans.map((p) => ({
      ...p,
      priceUzsPerMonth: Number(p.priceUzsPerMonth),
    }));
  }

  /**
   * Resolves current subscription for an organization, creates 7-day trial if missing,
   * and verifies trial expiration.
   */
  async getSubscription(organizationId: string) {
    let sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { saasPlan: true },
    });

    if (!sub) {
      sub = await this.createTrial(organizationId);
    }

    // Server-side trial expiration check
    if (sub.status === SubscriptionStatus.TRIALING && sub.trialEndAt) {
      if (new Date() > sub.trialEndAt) {
        sub = await this.prisma.subscription.update({
          where: { organizationId },
          data: { status: SubscriptionStatus.EXPIRED },
          include: { saasPlan: true },
        });
        this.logger.warn(`Trial expired for organization ${organizationId}`);
      }
    }

    const usage = await this.getUsage(organizationId);

    const trialDaysRemaining =
      sub.status === SubscriptionStatus.TRIALING && sub.trialEndAt
        ? Math.max(0, Math.ceil((sub.trialEndAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

    return {
      id: sub.id,
      organizationId: sub.organizationId,
      planCode: sub.saasPlan?.code || sub.plan,
      planNameUz: sub.saasPlan?.nameUz || 'Boshlang‘ich',
      status: sub.status,
      priceUzs: Number(sub.priceUzs ?? 0),
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialStartAt: sub.trialStartAt,
      trialEndAt: sub.trialEndAt,
      trialDaysRemaining,
      limits: {
        maxStudents: sub.maxStudents ?? 100,
        maxBranches: sub.maxBranches ?? 1,
        maxEmployees: sub.maxEmployees ?? 5,
        maxCameras: sub.maxCameras ?? 0,
        hasFaceId: sub.hasFaceId,
        hasAiCopilot: sub.hasAiCopilot,
      },
      usage,
    };
  }

  /**
   * Initializes a 7-day free trial for an educational organization.
   */
  async createTrial(organizationId: string) {
    const plans = await this.getPlans();
    const startPlan = plans.find((p) => p.code === PlanTierCode.START) || plans[0];

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return this.prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        planId: startPlan?.id,
        plan: SubscriptionPlan.START,
        status: SubscriptionStatus.TRIALING,
        trialStartAt: now,
        trialEndAt: trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
        maxStudents: startPlan?.maxStudents ?? 100,
        maxBranches: startPlan?.maxBranches ?? 1,
        maxEmployees: startPlan?.maxEmployees ?? 5,
        maxCameras: startPlan?.maxCameras ?? 0,
        hasFaceId: startPlan?.hasFaceId ?? false,
        hasAiCopilot: startPlan?.hasAiCopilot ?? true,
        priceUzs: BigInt(startPlan?.priceUzsPerMonth ?? 299000),
      },
      update: {},
      include: { saasPlan: true },
    });
  }

  /**
   * Upgrades or changes subscription plan and creates an issued invoice.
   */
  async changePlan(organizationId: string, dto: ChangePlanDto) {
    const plan = await this.prisma.saaSPlan.findUnique({
      where: { code: dto.planCode },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException(`Plan ${dto.planCode} is not available`);
    }

    const currentSub = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!currentSub) {
      throw new NotFoundException('Subscription not found');
    }

    const currentUsage = await this.getUsage(organizationId);
    if (currentUsage.activeStudents > plan.maxStudents) {
      throw new BadRequestException(
        `Cannot downgrade to ${plan.code}: organization currently has ${currentUsage.activeStudents} active students (plan limit: ${plan.maxStudents})`,
      );
    }
    if (currentUsage.branches > plan.maxBranches) {
      throw new BadRequestException(
        `Cannot downgrade to ${plan.code}: organization currently has ${currentUsage.branches} branches (plan limit: ${plan.maxBranches})`,
      );
    }

    const now = new Date();
    const periodMonths = dto.billingCycle === BillingCycle.ANNUAL ? 12 : 1;
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths);

    const multiplier = dto.billingCycle === BillingCycle.ANNUAL ? 10 : 1; // 2 months discount on annual
    const amountUzs = plan.priceUzsPerMonth * BigInt(multiplier);

    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return this.prisma.$transaction(async (tx) => {
      const updatedSub = await tx.subscription.update({
        where: { organizationId },
        data: {
          planId: plan.id,
          plan: plan.code as SubscriptionPlan,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          maxStudents: plan.maxStudents,
          maxBranches: plan.maxBranches,
          maxEmployees: plan.maxEmployees,
          maxCameras: plan.maxCameras,
          hasFaceId: plan.hasFaceId,
          hasAiCopilot: plan.hasAiCopilot,
          priceUzs: amountUzs,
        },
        include: { saasPlan: true },
      });

      const invoice = await tx.subscriptionInvoice.create({
        data: {
          organizationId,
          subscriptionId: updatedSub.id,
          invoiceNumber,
          planCode: plan.code,
          amountUzs,
          status: 'ISSUED',
          dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days payment window
          notes: `${plan.nameUz} ta'rifi uchun to'lov (${dto.billingCycle})`,
        },
      });

      return {
        subscription: {
          ...updatedSub,
          priceUzs: Number(updatedSub.priceUzs ?? 0),
        },
        invoice: {
          ...invoice,
          amountUzs: Number(invoice.amountUzs),
        },
      };
    });
  }

  /**
   * Cancels subscription renewal at the end of the current period.
   */
  async cancelSubscription(organizationId: string) {
    return this.prisma.subscription.update({
      where: { organizationId },
      data: {
        cancelledAt: new Date(),
        status: SubscriptionStatus.CANCELLED,
      },
    });
  }

  /**
   * Computes live usage metrics for an organization.
   */
  async getUsage(organizationId: string) {
    const [activeStudents, branches, employees, cameras] = await Promise.all([
      this.prisma.student.count({
        where: { organizationId, status: 'ACTIVE' },
      }),
      this.prisma.branch.count({
        where: { organizationId },
      }),
      this.prisma.user.count({
        where: {
          organizationId,
          isActive: true,
          role: { in: ['TEACHER', 'MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN', 'ASSISTANT'] },
        },
      }),
      this.prisma.camera.count({
        where: { organizationId, enabled: true },
      }),
    ]);

    return {
      activeStudents,
      branches: Math.max(1, branches),
      employees,
      cameras,
    };
  }

  /**
   * Race-condition safe quota verification before resource creation.
   */
  async checkQuota(
    organizationId: string,
    resource: 'students' | 'branches' | 'employees' | 'cameras',
  ): Promise<QuotaCheckResult> {
    const sub = await this.getSubscription(organizationId);

    if (sub.status === SubscriptionStatus.EXPIRED || sub.status === SubscriptionStatus.SUSPENDED) {
      throw new ForbiddenException(
        `Subscription is ${sub.status}. Please renew your plan at /settings/billing`,
      );
    }

    let current = 0;
    let limit = 0;

    switch (resource) {
      case 'students':
        current = sub.usage.activeStudents;
        limit = sub.limits.maxStudents;
        break;
      case 'branches':
        current = sub.usage.branches;
        limit = sub.limits.maxBranches;
        break;
      case 'employees':
        current = sub.usage.employees;
        limit = sub.limits.maxEmployees;
        break;
      case 'cameras':
        current = sub.usage.cameras;
        limit = sub.limits.maxCameras;
        break;
    }

    if (current >= limit) {
      throw new ForbiddenException(
        `Plan quota exceeded for ${resource}: current ${current} >= limit ${limit}. Upgrade plan at /settings/billing`,
      );
    }

    return {
      allowed: true,
      resource,
      current,
      limit,
      planCode: String(sub.planCode),
    };
  }

  /**
   * Checks whether the organization is entitled to a specific premium capability.
   */
  async checkEntitlement(
    organizationId: string,
    feature: 'hasFaceId' | 'hasAiCopilot',
  ): Promise<boolean> {
    const sub = await this.getSubscription(organizationId);

    if (sub.status === SubscriptionStatus.EXPIRED || sub.status === SubscriptionStatus.SUSPENDED) {
      throw new ForbiddenException(
        `Subscription is ${sub.status}. Feature unavailable until plan renewal.`,
      );
    }

    const isEntitled = Boolean(sub.limits[feature]);
    if (!isEntitled) {
      throw new ForbiddenException(
        `The feature "${feature}" is not included in your current ${sub.planCode} plan. Upgrade to PRO or ENTERPRISE to unlock.`,
      );
    }

    return true;
  }
}
