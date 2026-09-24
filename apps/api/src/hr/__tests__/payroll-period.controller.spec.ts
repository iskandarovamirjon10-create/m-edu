import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RequestMethod } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PayrollPeriodController } from '../payroll-period.controller';
import { PayrollService } from '../payroll.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { ROLES_KEY } from '../../auth/roles.decorator';

describe('PayrollPeriodController', () => {
  let controller: PayrollPeriodController;
  let service: {
    getPeriodSummary: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-test-123';

  beforeEach(async () => {
    service = {
      getPeriodSummary: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayrollPeriodController],
      providers: [
        {
          provide: PayrollService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<PayrollPeriodController>(PayrollPeriodController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPeriodSummary', () => {
    it('delegates to payrollService.getPeriodSummary with converted numeric year and month', async () => {
      const mockSummary = {
        year: 2026,
        month: 9,
        teachersCount: 15,
        runs: 15,
        byStatus: {
          DRAFT: 0,
          CALCULATED: 2,
          REVIEWED: 3,
          APPROVED: 5,
          PAID: 5,
          CANCELLED: 0,
        },
        totalGross: 45000,
        totalNet: 38000,
        unpaid: 10,
        paid: 5,
        pendingApproval: 8,
      };
      service.getPeriodSummary.mockResolvedValue(mockSummary);

      const result = await controller.getPeriodSummary(orgId, '2026', '9');

      expect(service.getPeriodSummary).toHaveBeenCalledTimes(1);
      expect(service.getPeriodSummary).toHaveBeenCalledWith(orgId, 2026, 9);
      expect(result).toEqual(mockSummary);
    });

    it('correctly handles zero or double-digit month strings', async () => {
      const mockSummary = {
        year: 2025,
        month: 12,
        teachersCount: 0,
        runs: 0,
        byStatus: {},
        totalGross: 0,
        totalNet: 0,
        unpaid: 0,
        paid: 0,
        pendingApproval: 0,
      };
      service.getPeriodSummary.mockResolvedValue(mockSummary);

      const result = await controller.getPeriodSummary(orgId, '2025', '12');

      expect(service.getPeriodSummary).toHaveBeenCalledWith(orgId, 2025, 12);
      expect(result).toEqual(mockSummary);
    });

    it('propagates service errors when getPeriodSummary fails', async () => {
      const error = new Error('Database connection failed');
      service.getPeriodSummary.mockRejectedValue(error);

      await expect(
        controller.getPeriodSummary(orgId, '2026', '9'),
      ).rejects.toThrow('Database connection failed');
      expect(service.getPeriodSummary).toHaveBeenCalledWith(orgId, 2026, 9);
    });
  });

  describe('Security and Decorator metadata', () => {
    it('has UseGuards applied at the class level with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', PayrollPeriodController);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(guards.length).toBeGreaterThanOrEqual(2);
    });

    it('has Controller decorator configuring dual route paths', () => {
      const path = Reflect.getMetadata('path', PayrollPeriodController);
      expect(path).toEqual(['payroll', 'hr/payroll']);
    });

    it('has Roles decorator restricting getPeriodSummary access to SUPER_ADMIN, ORG_ADMIN, and MANAGER', () => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        PayrollPeriodController.prototype.getPeriodSummary,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain(Role.SUPER_ADMIN);
      expect(roles).toContain(Role.ORG_ADMIN);
      expect(roles).toContain(Role.MANAGER);
      expect(roles).not.toContain(Role.TEACHER);
      expect(roles).not.toContain(Role.STUDENT);
    });

    it('has Get decorator mapping to period-summary endpoint', () => {
      const path = Reflect.getMetadata(
        'path',
        PayrollPeriodController.prototype.getPeriodSummary,
      );
      const method = Reflect.getMetadata(
        'method',
        PayrollPeriodController.prototype.getPeriodSummary,
      );
      expect(path).toBe('period-summary');
      expect(method).toBe(RequestMethod.GET);
    });
  });
});
