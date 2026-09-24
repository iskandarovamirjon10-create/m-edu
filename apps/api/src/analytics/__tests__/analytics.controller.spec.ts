import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerException } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { AnalyticsController } from '../analytics.controller';
import { AnalyticsService } from '../analytics.service';
import { FinancialBrainService } from '../financial-brain.service';
import { ExecutiveSummaryService } from '../executive-summary.service';
import { PayrollAnalyticsService } from '../payroll-analytics.service';
import { CrmAnalyticsService } from '../crm-analytics.service';
import { AnomalyDetectionService } from '../anomaly-detection.service';
import { ReconciliationService } from '../reconciliation.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';

const mockService = () => {
  const m: Record<string, ReturnType<typeof vi.fn>> = {};
  return new Proxy(m, {
    get: (_t, prop: string) => {
      if (prop === 'then') return undefined;
      if (!(prop in m)) m[prop] = vi.fn().mockResolvedValue({});
      return m[prop];
    },
  });
};

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: {
    getOverview: ReturnType<typeof vi.fn>;
  };
  let financialBrainService: {
    getGroupContribution: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-uuid-123';

  beforeEach(async () => {
    analyticsService = {
      getOverview: vi.fn(),
    };

    financialBrainService = {
      getGroupContribution: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: analyticsService,
        },
        {
          provide: FinancialBrainService,
          useValue: financialBrainService,
        },
        { provide: ExecutiveSummaryService, useValue: mockService() },
        { provide: PayrollAnalyticsService, useValue: mockService() },
        { provide: CrmAnalyticsService, useValue: mockService() },
        { provide: AnomalyDetectionService, useValue: mockService() },
        { provide: ReconciliationService, useValue: mockService() },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOverview', () => {
    it('delegates to analyticsService.getOverview with organizationId and returns result', async () => {
      const mockOverview = {
        totalStudents: 150,
        newStudentsThisMonth: 12,
        newStudentsLastMonth: 8,
        totalTeachers: 10,
        activeGroups: 15,
        revenueStats: { totalRevenue: 50000 },
        monthlyRevenue: [],
        attendanceStats: { present: 90, absent: 5, late: 5 },
        dailyAttendance: [],
        leadStats: [],
      };
      analyticsService.getOverview.mockResolvedValue(mockOverview);

      const result = await controller.getOverview(orgId);

      expect(analyticsService.getOverview).toHaveBeenCalledWith(orgId);
      expect(result).toEqual(mockOverview);
    });

    it('propagates errors from analyticsService.getOverview', async () => {
      analyticsService.getOverview.mockRejectedValue(new Error('Database error'));

      await expect(controller.getOverview(orgId)).rejects.toThrow('Database error');
      expect(analyticsService.getOverview).toHaveBeenCalledWith(orgId);
    });

    it('enforces rate limit of 30 requests per minute per organization', async () => {
      analyticsService.getOverview.mockResolvedValue({} as any);

      // 30 requests should succeed
      for (let i = 0; i < 30; i++) {
        await controller.getOverview('rate-limited-org');
      }

      // The 31st request must trigger a ThrottlerException
      expect(() => controller.getOverview('rate-limited-org')).toThrow(ThrottlerException);
    });
  });

  describe('getGroupProfitability', () => {
    const groupId = 'group-uuid-456';

    it('delegates to financialBrainService.getGroupContribution with provided dates', async () => {
      const startDateStr = '2026-03-01T00:00:00.000Z';
      const endDateStr = '2026-03-31T23:59:59.999Z';
      const expectedContribution = {
        groupId,
        groupName: 'Math Advanced',
        revenue: 10000,
        teacherPayouts: 3000,
        allocatedOverhead: 1000,
        grossProfit: 7000,
        netProfit: 6000,
        profitMargin: 60,
      };
      financialBrainService.getGroupContribution.mockResolvedValue(expectedContribution);

      const result = await controller.getGroupProfitability(
        orgId,
        groupId,
        startDateStr,
        endDateStr,
      );

      expect(financialBrainService.getGroupContribution).toHaveBeenCalledWith(
        orgId,
        groupId,
        new Date(startDateStr),
        new Date(endDateStr),
      );
      expect(result).toEqual(expectedContribution);
    });

    it('defaults start date to Jan 1 of current year and end date to now when omitted', async () => {
      const expectedContribution = {
        groupId,
        revenue: 5000,
      };
      financialBrainService.getGroupContribution.mockResolvedValue(expectedContribution);

      const beforeCall = Date.now();
      const result = await controller.getGroupProfitability(orgId, groupId);
      const afterCall = Date.now();

      expect(financialBrainService.getGroupContribution).toHaveBeenCalledTimes(1);
      const [calledOrgId, calledGroupId, calledStart, calledEnd] =
        financialBrainService.getGroupContribution.mock.calls[0];

      expect(calledOrgId).toBe(orgId);
      expect(calledGroupId).toBe(groupId);

      const currentYear = new Date().getFullYear();
      expect(calledStart).toEqual(new Date(currentYear, 0, 1));
      expect(calledEnd.getTime()).toBeGreaterThanOrEqual(beforeCall);
      expect(calledEnd.getTime()).toBeLessThanOrEqual(afterCall);
      expect(result).toEqual(expectedContribution);
    });

    it('defaults end date to now when only startDate is provided', async () => {
      financialBrainService.getGroupContribution.mockResolvedValue({ groupId });

      const startDateStr = '2026-02-01';
      const beforeCall = Date.now();
      await controller.getGroupProfitability(orgId, groupId, startDateStr);
      const afterCall = Date.now();

      expect(financialBrainService.getGroupContribution).toHaveBeenCalledTimes(1);
      const [, , calledStart, calledEnd] =
        financialBrainService.getGroupContribution.mock.calls[0];

      expect(calledStart).toEqual(new Date(startDateStr));
      expect(calledEnd.getTime()).toBeGreaterThanOrEqual(beforeCall);
      expect(calledEnd.getTime()).toBeLessThanOrEqual(afterCall);
    });

    it('defaults start date to Jan 1 of current year when only endDate is provided', async () => {
      financialBrainService.getGroupContribution.mockResolvedValue({ groupId });

      const endDateStr = '2026-05-31';
      await controller.getGroupProfitability(orgId, groupId, undefined, endDateStr);

      const currentYear = new Date().getFullYear();
      expect(financialBrainService.getGroupContribution).toHaveBeenCalledWith(
        orgId,
        groupId,
        new Date(currentYear, 0, 1),
        new Date(endDateStr),
      );
    });

    it('propagates errors from financialBrainService.getGroupContribution', async () => {
      financialBrainService.getGroupContribution.mockRejectedValue(
        new Error('Failed to calculate group contribution'),
      );

      await expect(
        controller.getGroupProfitability(orgId, groupId, '2026-01-01', '2026-01-31'),
      ).rejects.toThrow('Failed to calculate group contribution');
    });

    it('enforces rate limit of 60 requests per minute per organization', async () => {
      financialBrainService.getGroupContribution.mockResolvedValue({} as any);

      // 60 requests should succeed
      for (let i = 0; i < 60; i++) {
        await controller.getGroupProfitability('rate-limited-profitability-org', groupId);
      }

      // The 61st request must trigger a ThrottlerException
      expect(() =>
        controller.getGroupProfitability('rate-limited-profitability-org', groupId),
      ).toThrow(ThrottlerException);
    });
  });

  describe('Guard and Role metadata verification', () => {
    it('has UseGuards decorator applied at the class level with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', AnalyticsController);
      expect(guards).toBeDefined();
      expect(Array.isArray(guards)).toBe(true);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(guards.length).toBeGreaterThanOrEqual(2);
    });

    it('has Roles decorator restricting access to SUPER_ADMIN, ORG_ADMIN, and MANAGER', () => {
      const roles = Reflect.getMetadata('roles', AnalyticsController);
      expect(roles).toBeDefined();
      expect(roles).toContain(Role.SUPER_ADMIN);
      expect(roles).toContain(Role.ORG_ADMIN);
      expect(roles).toContain(Role.MANAGER);

      // Disallowed roles must not have access to analytics
      expect(roles).not.toContain(Role.TEACHER);
      expect(roles).not.toContain(Role.ASSISTANT);
      expect(roles).not.toContain(Role.STUDENT);
    });
  });
});
