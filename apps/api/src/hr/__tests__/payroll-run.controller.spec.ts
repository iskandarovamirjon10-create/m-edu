import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PayrollRunController } from '../payroll-run.controller';
import { PayrollService } from '../payroll.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { CreatePayrollRunDto } from '../dto/payroll.dto';

describe('PayrollRunController', () => {
  let controller: PayrollRunController;
  let service: {
    listRuns: ReturnType<typeof vi.fn>;
    getPeriodSummary: ReturnType<typeof vi.fn>;
    getRun: ReturnType<typeof vi.fn>;
    calculateRun: ReturnType<typeof vi.fn>;
    review: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    pay: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-test-uuid-1';
  const userId = 'user-test-uuid-1';
  const runId = 'run-test-uuid-1';

  beforeEach(async () => {
    service = {
      listRuns: vi.fn(),
      getPeriodSummary: vi.fn(),
      getRun: vi.fn(),
      calculateRun: vi.fn(),
      review: vi.fn(),
      approve: vi.fn(),
      pay: vi.fn(),
      cancel: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayrollRunController],
      providers: [
        {
          provide: PayrollService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<PayrollRunController>(PayrollRunController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listRuns', () => {
    const query = {
      year: 2026,
      month: 9,
      status: 'CALCULATED',
      teacherId: 'teacher-uuid-1',
      page: 1,
      limit: 20,
    };

    it('delegates to payrollService.listRuns with orgId and query', async () => {
      const mockResult = {
        items: [{ id: runId, periodYear: 2026, periodMonth: 9, netAmount: 1500 }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        totals: { gross: 1800, net: 1500, runs: 1 },
      };
      service.listRuns.mockResolvedValue(mockResult);

      const result = await controller.listRuns(orgId, query);

      expect(service.listRuns).toHaveBeenCalledWith(orgId, query);
      expect(result).toEqual(mockResult);
    });

    it('propagates service errors', async () => {
      service.listRuns.mockRejectedValue(new Error('Database query failed'));

      await expect(controller.listRuns(orgId, query)).rejects.toThrow('Database query failed');
    });
  });

  describe('getPeriodSummary', () => {
    const yearStr = '2026';
    const monthStr = '9';

    it('delegates to payrollService.getPeriodSummary with parsed numbers', async () => {
      const mockResult = {
        periodYear: 2026,
        periodMonth: 9,
        totals: { gross: 10000, net: 8500, runs: 5 },
        byStatus: { CALCULATED: 2, APPROVED: 3 },
      };
      service.getPeriodSummary.mockResolvedValue(mockResult);

      const result = await controller.getPeriodSummary(orgId, yearStr, monthStr);

      expect(service.getPeriodSummary).toHaveBeenCalledWith(orgId, 2026, 9);
      expect(result).toEqual(mockResult);
    });

    it('propagates service errors', async () => {
      service.getPeriodSummary.mockRejectedValue(new Error('Period summary retrieval failed'));

      await expect(controller.getPeriodSummary(orgId, yearStr, monthStr)).rejects.toThrow(
        'Period summary retrieval failed',
      );
    });
  });

  describe('getRun', () => {
    it('delegates to payrollService.getRun with orgId and id', async () => {
      const mockResult = {
        id: runId,
        organizationId: orgId,
        teacherId: 'teacher-1',
        periodYear: 2026,
        periodMonth: 9,
        netAmount: 2500,
        status: 'CALCULATED',
      };
      service.getRun.mockResolvedValue(mockResult);

      const result = await controller.getRun(orgId, runId);

      expect(service.getRun).toHaveBeenCalledWith(orgId, runId);
      expect(result).toEqual(mockResult);
    });

    it('propagates service errors', async () => {
      service.getRun.mockRejectedValue(new Error('Payroll run not found'));

      await expect(controller.getRun(orgId, runId)).rejects.toThrow('Payroll run not found');
    });
  });

  describe('calculate', () => {
    const dto: CreatePayrollRunDto = {
      teacherId: 'teacher-uuid-1',
      periodYear: 2026,
      periodMonth: 9,
      baseAmount: 3000,
      bonus: 200,
    };

    it('delegates to payrollService.calculateRun with orgId, userId, and dto', async () => {
      const mockResult = {
        id: runId,
        status: 'CALCULATED',
        grossAmount: 3200,
        netAmount: 2800,
      };
      service.calculateRun.mockResolvedValue(mockResult);

      const result = await controller.calculate(orgId, userId, dto);

      expect(service.calculateRun).toHaveBeenCalledWith(orgId, userId, dto);
      expect(result).toEqual(mockResult);
    });

    it('propagates service errors', async () => {
      service.calculateRun.mockRejectedValue(new Error('Calculation failed'));

      await expect(controller.calculate(orgId, userId, dto)).rejects.toThrow('Calculation failed');
    });
  });

  describe('createRun', () => {
    const dto: CreatePayrollRunDto = {
      teacherId: 'teacher-uuid-2',
      periodYear: 2026,
      periodMonth: 9,
      baseAmount: 3500,
    };

    it('delegates to payrollService.calculateRun with orgId, userId, and dto', async () => {
      const mockResult = {
        id: 'run-uuid-2',
        status: 'CALCULATED',
        grossAmount: 3500,
        netAmount: 3100,
      };
      service.calculateRun.mockResolvedValue(mockResult);

      const result = await controller.createRun(orgId, userId, dto);

      expect(service.calculateRun).toHaveBeenCalledWith(orgId, userId, dto);
      expect(result).toEqual(mockResult);
    });

    it('propagates service errors', async () => {
      service.calculateRun.mockRejectedValue(new Error('Create run failed'));

      await expect(controller.createRun(orgId, userId, dto)).rejects.toThrow('Create run failed');
    });
  });

  describe('reviewRun', () => {
    it('delegates to payrollService.review with orgId, userId, and id', async () => {
      const mockResult = { id: runId, status: 'REVIEWED' };
      service.review.mockResolvedValue(mockResult);

      const result = await controller.reviewRun(orgId, userId, runId);

      expect(service.review).toHaveBeenCalledWith(orgId, userId, runId);
      expect(result).toEqual(mockResult);
    });

    it('propagates service errors', async () => {
      service.review.mockRejectedValue(new Error('Invalid transition to REVIEWED'));

      await expect(controller.reviewRun(orgId, userId, runId)).rejects.toThrow(
        'Invalid transition to REVIEWED',
      );
    });
  });

  describe('approveRun', () => {
    it('delegates to payrollService.approve with orgId, userId, and id', async () => {
      const mockResult = { id: runId, status: 'APPROVED' };
      service.approve.mockResolvedValue(mockResult);

      const result = await controller.approveRun(orgId, userId, runId);

      expect(service.approve).toHaveBeenCalledWith(orgId, userId, runId);
      expect(result).toEqual(mockResult);
    });

    it('propagates service errors', async () => {
      service.approve.mockRejectedValue(new Error('Cannot approve non-reviewed run'));

      await expect(controller.approveRun(orgId, userId, runId)).rejects.toThrow(
        'Cannot approve non-reviewed run',
      );
    });
  });

  describe('processRun', () => {
    it('delegates to payrollService.pay with orgId, userId, and id', async () => {
      const mockResult = { id: runId, status: 'PAID' };
      service.pay.mockResolvedValue(mockResult);

      const result = await controller.processRun(orgId, userId, runId);

      expect(service.pay).toHaveBeenCalledWith(orgId, userId, runId);
      expect(result).toEqual(mockResult);
    });

    it('propagates service errors', async () => {
      service.pay.mockRejectedValue(new Error('Payment processing failed'));

      await expect(controller.processRun(orgId, userId, runId)).rejects.toThrow(
        'Payment processing failed',
      );
    });
  });

  describe('payRun', () => {
    it('delegates to payrollService.pay with orgId, userId, and id', async () => {
      const mockResult = { id: runId, status: 'PAID' };
      service.pay.mockResolvedValue(mockResult);

      const result = await controller.payRun(orgId, userId, runId);

      expect(service.pay).toHaveBeenCalledWith(orgId, userId, runId);
      expect(result).toEqual(mockResult);
    });

    it('propagates service errors', async () => {
      service.pay.mockRejectedValue(new Error('Payment already completed'));

      await expect(controller.payRun(orgId, userId, runId)).rejects.toThrow(
        'Payment already completed',
      );
    });
  });

  describe('cancelRun', () => {
    const reason = 'Incorrect hours reported';

    it('delegates to payrollService.cancel with orgId, userId, id, and reason', async () => {
      const mockResult = { id: runId, status: 'CANCELLED', cancellationReason: reason };
      service.cancel.mockResolvedValue(mockResult);

      const result = await controller.cancelRun(orgId, userId, runId, reason);

      expect(service.cancel).toHaveBeenCalledWith(orgId, userId, runId, reason);
      expect(result).toEqual(mockResult);
    });

    it('propagates service errors', async () => {
      service.cancel.mockRejectedValue(new Error('Cannot cancel paid run'));

      await expect(controller.cancelRun(orgId, userId, runId, reason)).rejects.toThrow(
        'Cannot cancel paid run',
      );
    });
  });

  describe('Decorator & Guard verification (structural metadata)', () => {
    it('has Controller decorator configured with multiple path prefixes', () => {
      const paths = Reflect.getMetadata('path', PayrollRunController);
      expect(paths).toEqual(['payroll/runs', 'hr/payroll/runs']);
    });

    it('has UseGuards decorator with JwtAuthGuard and RolesGuard applied at the class level', () => {
      const guards = Reflect.getMetadata('__guards__', PayrollRunController);
      expect(guards).toBeDefined();
      expect(guards).toHaveLength(2);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it('protects all route handlers with SUPER_ADMIN, ORG_ADMIN, and MANAGER roles', () => {
      const routeHandlers = [
        controller.listRuns,
        controller.getPeriodSummary,
        controller.getRun,
        controller.calculate,
        controller.createRun,
        controller.reviewRun,
        controller.approveRun,
        controller.processRun,
        controller.payRun,
        controller.cancelRun,
      ];

      for (const handler of routeHandlers) {
        const roles = Reflect.getMetadata('roles', handler);
        expect(roles).toBeDefined();
        expect(roles).toEqual([Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER]);
        expect(roles).toContain(Role.SUPER_ADMIN);
        expect(roles).toContain(Role.ORG_ADMIN);
        expect(roles).toContain(Role.MANAGER);
        expect(roles).not.toContain(Role.STUDENT);
        expect(roles).not.toContain(Role.TEACHER);
        expect(roles).not.toContain(Role.PARENT);
      }
    });
  });
});
