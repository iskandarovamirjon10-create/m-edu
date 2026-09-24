import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { HremployeeService } from '../hr.service';
import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  const tx = {
    leaveRequest: {
      findFirst: vi.fn(),
      create: vi.fn(async (args: { data: unknown }) => ({ id: 'lr-new', ...args.data })),
    },
    salaryRecord: {
      findMany: vi.fn(),
      create: vi.fn(async (args: { data: unknown }) => ({ id: 'sal-new', ...args.data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };

  return {
    employee: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(),
      create: vi.fn(async (args: { data: unknown }) => ({ id: 'emp-new', ...args.data })),
      update: vi.fn(async (args: { where: unknown; data: unknown }) => ({ id: 'emp-1', ...args.data })),
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    user: {
      findUnique: vi.fn(),
    },
    leaveRequest: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(),
      update: vi.fn(async (args: { where: unknown; data: unknown }) => ({ id: 'lr-1', ...args.data })),
      count: vi.fn(async () => 0),
    },
    salaryRecord: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(),
      update: vi.fn(async (args: { where: unknown; data: unknown }) => ({ id: 'sal-1', ...args.data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      aggregate: vi.fn(async () => ({ _sum: { netSalary: 5000 } })),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    tx,
  };
}

describe('HremployeeService', () => {
  let service: HremployeeService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = new HremployeeService(prisma as unknown as PrismaService);
  });

  describe('findAllEmployees', () => {
    it('queries employees with search, department and isActive filters', async () => {
      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', department: 'IT', isActive: true },
      ]);
      prisma.employee.count.mockResolvedValue(1);

      const result = await service.findAllEmployees('org-1', {
        search: 'Ali',
        department: 'IT',
        isActive: true,
        page: 1,
        limit: 10,
      });

      expect(prisma.employee.findMany).toHaveBeenCalled();
      expect(result.employees).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe('findEmployeeById', () => {
    it('throws NotFoundException if employee is not found in organization', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.findEmployeeById('org-1', 'emp-not-found'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns employee if found', async () => {
      const mockEmp = { id: 'emp-1', organizationId: 'org-1' };
      prisma.employee.findFirst.mockResolvedValue(mockEmp);

      const result = await service.findEmployeeById('org-1', 'emp-1');
      expect(result).toBe(mockEmp);
    });
  });

  describe('createEmployee', () => {
    it('throws NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createEmployee('org-1', {
          userId: 'u-none',
          employeeNumber: 'E001',
          department: 'Math',
          position: 'Teacher',
          hireDate: '2026-01-01',
          salary: 5000,
          contractType: 'FULL_TIME',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if user is already an employee', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', organizationId: 'org-1' });
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-existing' });

      await expect(
        service.createEmployee('org-1', {
          userId: 'u-1',
          employeeNumber: 'E001',
          department: 'Math',
          position: 'Teacher',
          hireDate: '2026-01-01',
          salary: 5000,
          contractType: 'FULL_TIME',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates an employee successfully', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', organizationId: 'org-1' });
      prisma.employee.findFirst.mockResolvedValue(null);

      const result = await service.createEmployee('org-1', {
        userId: 'u-1',
        employeeNumber: 'E001',
        department: 'Math',
        position: 'Teacher',
        hireDate: '2026-01-01',
        salary: 5000,
        contractType: 'FULL_TIME',
      });

      expect(prisma.employee.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('terminateEmployee', () => {
    it('throws BadRequestException if reason is empty', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', organizationId: 'org-1' });

      await expect(
        service.terminateEmployee('org-1', 'emp-1', '   '),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks employee as inactive with termination date', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', organizationId: 'org-1' });

      await service.terminateEmployee('org-1', 'emp-1', 'Relocated');

      expect(prisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'emp-1', organizationId: 'org-1' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });

  describe('createLeaveRequest', () => {
    it('throws BadRequestException if employee has overlapping leave', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', organizationId: 'org-1' });
      prisma.tx.leaveRequest.findFirst.mockResolvedValue({ id: 'lr-overlap' });

      await expect(
        service.createLeaveRequest('org-1', {
          employeeId: 'emp-1',
          type: 'SICK',
          startDate: '2026-09-10',
          endDate: '2026-09-15',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates leave request when no overlap', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', organizationId: 'org-1' });
      prisma.tx.leaveRequest.findFirst.mockResolvedValue(null);

      const result = await service.createLeaveRequest('org-1', {
        employeeId: 'emp-1',
        type: 'VACATION',
        startDate: '2026-09-10',
        endDate: '2026-09-15',
      });

      expect(prisma.tx.leaveRequest.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('approveLeaveRequest & rejectLeaveRequest', () => {
    it('approves a pending leave request', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'lr-1', status: 'PENDING' });

      await service.approveLeaveRequest('org-1', 'lr-1', 'approver-1');

      expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lr-1', organizationId: 'org-1' },
          data: expect.objectContaining({ status: 'APPROVED', approvedBy: 'approver-1' }),
        }),
      );
    });

    it('rejects a pending leave request', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'lr-1', status: 'PENDING' });

      await service.rejectLeaveRequest('org-1', 'lr-1', 'Capacity low');

      expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lr-1', organizationId: 'org-1' },
          data: expect.objectContaining({ status: 'REJECTED', rejectionReason: 'Capacity low' }),
        }),
      );
    });
  });

  describe('generatePayroll & processSalaryPayment', () => {
    it('generates payroll records inside transaction', async () => {
      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', salary: 3000 },
      ]);
      prisma.tx.salaryRecord.findMany.mockResolvedValue([]);

      const result = await service.generatePayroll('org-1', {
        month: '2026-09-01',
      });

      expect(result.generatedCount).toBe(1);
      expect(prisma.tx.salaryRecord.create).toHaveBeenCalled();
    });

    it('processes salary payment to PAID via atomic updateMany (TOCTOU-safe)', async () => {
      prisma.salaryRecord.findFirst.mockResolvedValue({ id: 'sal-1', status: 'PENDING' });
      prisma.salaryRecord.updateMany.mockResolvedValue({ count: 1 });
      prisma.salaryRecord.findUnique = vi.fn(async () => ({
        id: 'sal-1',
        status: 'PAID',
      }));

      await service.processSalaryPayment('org-1', 'sal-1');

      expect(prisma.salaryRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sal-1', organizationId: 'org-1', status: 'PENDING' },
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
      expect(prisma.salaryRecord.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when atomic salary payment matches no row', async () => {
      prisma.salaryRecord.findFirst.mockResolvedValue({ id: 'sal-1', status: 'PENDING' });
      prisma.salaryRecord.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.processSalaryPayment('org-1', 'sal-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getHRStats', () => {
    it('returns aggregated HR metrics', async () => {
      prisma.employee.count
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(18); // active
      prisma.employee.groupBy.mockResolvedValue([
        { department: 'Engineering', _count: { department: 10 } },
      ]);
      prisma.leaveRequest.count.mockResolvedValue(2);
      prisma.salaryRecord.aggregate.mockResolvedValue({ _sum: { netSalary: 50000 } });

      const stats = await service.getHRStats('org-1');

      expect(stats.totalEmployees).toBe(20);
      expect(stats.activeEmployees).toBe(18);
      expect(stats.pendingLeaves).toBe(2);
      expect(stats.monthlyPayroll).toBe(50000);
      expect(stats.departments).toEqual([{ name: 'Engineering', count: 10 }]);
    });
  });
});
