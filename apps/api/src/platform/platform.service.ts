import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';
import {
  CreatePlatformInvitationDto,
  UpdateOrganizationSubscriptionDto,
  UpdateSaaSPlanDto,
} from './platform.dto';
import { SecurityEventService, SecurityEventType } from '../common/security/security-event.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityEventService,
  ) {}

  async getStatistics() {
    const [orgCount, userCount, studentCount, activeOrgs, subscriptions] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.prisma.student.count(),
      this.prisma.organization.count({
        where: { users: { some: { isActive: true } } },
      }),
      this.prisma.subscription.findMany({
        select: {
          status: true,
          priceUzs: true,
          plan: true,
        },
      }),
    ]);

    let mrr = 0;
    const statusCounts: Record<string, number> = {
      ACTIVE: 0,
      TRIALING: 0,
      PAST_DUE: 0,
      SUSPENDED: 0,
      CANCELLED: 0,
      EXPIRED: 0,
    };
    const planCounts: Record<string, number> = {};

    for (const sub of subscriptions) {
      statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1;
      const planName = sub.plan || 'UNKNOWN';
      planCounts[planName] = (planCounts[planName] || 0) + 1;

      if (sub.status === SubscriptionStatus.ACTIVE) {
        mrr += Number(sub.priceUzs || 0);
      }
    }

    const arr = mrr * 12;

    return {
      orgCount,
      userCount,
      studentCount,
      activeOrgs,
      mrr,
      arr,
      statusCounts,
      planCounts,
    };
  }

  async getOrganizations() {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: {
          select: { users: true, students: true, branches: true },
        },
        subscription: {
          select: {
            id: true,
            plan: true,
            status: true,
            priceUzs: true,
            maxStudents: true,
            maxBranches: true,
            maxEmployees: true,
            hasFaceId: true,
            hasAiCopilot: true,
            trialStartAt: true,
            trialEndAt: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    return orgs.map((org) => ({
      ...org,
      subscription: org.subscription
        ? {
            ...org.subscription,
            priceUzs: Number(org.subscription.priceUzs || 0),
          }
        : null,
    }));
  }

  async updateOrganizationSubscription(
    orgId: string,
    dto: UpdateOrganizationSubscriptionDto,
    ownerId: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { subscription: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.planId) {
      const plan = await this.prisma.saaSPlan.findUnique({ where: { id: dto.planId } });
      if (plan) {
        data.saasPlanId = plan.id;
        data.plan = plan.code as any;
        data.priceUzs = plan.priceUzsPerMonth;
        data.maxStudents = plan.maxStudents;
        data.maxBranches = plan.maxBranches;
        data.maxEmployees = plan.maxEmployees;
        data.hasFaceId = plan.hasFaceId;
        data.hasAiCopilot = plan.hasAiCopilot;
      }
    }
    if (dto.priceUzs !== undefined) data.priceUzs = dto.priceUzs;
    if (dto.maxStudents !== undefined) data.maxStudents = dto.maxStudents;
    if (dto.maxBranches !== undefined) data.maxBranches = dto.maxBranches;
    if (dto.maxEmployees !== undefined) data.maxEmployees = dto.maxEmployees;
    if (dto.hasFaceId !== undefined) data.hasFaceId = dto.hasFaceId;
    if (dto.hasAiCopilot !== undefined) data.hasAiCopilot = dto.hasAiCopilot;
    if (dto.trialEndAt) data.trialEndAt = new Date(dto.trialEndAt);
    if (dto.currentPeriodEnd) data.currentPeriodEnd = new Date(dto.currentPeriodEnd);

    let updated;
    if (org.subscription) {
      updated = await this.prisma.subscription.update({
        where: { organizationId: orgId },
        data,
      });
    } else {
      updated = await this.prisma.subscription.create({
        data: {
          organizationId: orgId,
          plan: 'START',
          status: dto.status || 'TRIALING',
          ...data,
        },
      });
    }

    await this.security.logEvent({
      eventType: SecurityEventType.SUBSCRIPTION_UPDATED,
      userId: ownerId,
      resourceType: 'Subscription',
      resourceId: updated.id,
      success: true,
    });

    return {
      ...updated,
      priceUzs: Number(updated.priceUzs || 0),
    };
  }

  async suspendOrganization(orgId: string, ownerId: string) {
    return this.updateOrganizationSubscription(
      orgId,
      { status: SubscriptionStatus.SUSPENDED },
      ownerId,
    );
  }

  async reactivateOrganization(orgId: string, ownerId: string) {
    return this.updateOrganizationSubscription(
      orgId,
      { status: SubscriptionStatus.ACTIVE },
      ownerId,
    );
  }

  async getPlans() {
    const plans = await this.prisma.saaSPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map((p) => ({
      ...p,
      priceUzs: Number(p.priceUzsPerMonth),
    }));
  }

  async updatePlan(planId: string, dto: UpdateSaaSPlanDto) {
    const plan = await this.prisma.saaSPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('SaaS Plan not found');
    }

    const updated = await this.prisma.saaSPlan.update({
      where: { id: planId },
      data: {
        ...(dto.name && { nameUz: dto.name, nameRu: dto.name }),
        ...(dto.priceUzs !== undefined && { priceUzsPerMonth: BigInt(dto.priceUzs) }),
        ...(dto.maxStudents !== undefined && { maxStudents: dto.maxStudents }),
        ...(dto.maxBranches !== undefined && { maxBranches: dto.maxBranches }),
        ...(dto.maxEmployees !== undefined && { maxEmployees: dto.maxEmployees }),
        ...(dto.hasFaceId !== undefined && { hasFaceId: dto.hasFaceId }),
        ...(dto.hasAiCopilot !== undefined && { hasAiCopilot: dto.hasAiCopilot }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return {
      ...updated,
      priceUzs: Number(updated.priceUzsPerMonth),
    };
  }

  async createInvitation(creatorId: string, dto: CreatePlatformInvitationDto) {
    const rawCode = 'M-EDU-' + randomBytes(16).toString('hex').toUpperCase();
    const codeHash = createHash('sha256').update(rawCode).digest('hex');

    const invite = await this.prisma.platformInvitation.create({
      data: {
        codeHash,
        maxUses: dto.maxUses,
        expiresAt: this.resolveInvitationExpiry(dto.expiresAt),
        metadata: dto.metadata || {},
        createdBy: creatorId,
      },
    });

    await this.security.logEvent({
      eventType: SecurityEventType.INVITE_CREATED,
      userId: creatorId,
      resourceType: 'PlatformInvitation',
      resourceId: invite.id,
      success: true,
    });

    return {
      id: invite.id,
      code: rawCode,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
    };
  }

  private resolveInvitationExpiry(expiresAt: string): Date {
    const expires = new Date(expiresAt);
    const now = new Date();
    const MAX_TTL_MS = 365 * 24 * 60 * 60 * 1000;

    if (Number.isNaN(expires.getTime()) || expires <= now) {
      throw new BadRequestException('expiresAt must be a future date');
    }
    if (expires.getTime() - now.getTime() > MAX_TTL_MS) {
      throw new BadRequestException('expiresAt must be within 365 days');
    }

    return expires;
  }
}
