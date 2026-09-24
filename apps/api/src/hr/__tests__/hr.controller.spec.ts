import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HremployeeController } from '../hr.controller';
import { HremployeeService } from '../hr.service';

describe('HremployeeController', () => {
  let controller: HremployeeController;
  let service: {
    findAllEmployees: ReturnType<typeof vi.fn>;
    findEmployeeById: ReturnType<typeof vi.fn>;
    createEmployee: ReturnType<typeof vi.fn>;
    updateEmployee: ReturnType<typeof vi.fn>;
    terminateEmployee: ReturnType<typeof vi.fn>;
    findAllLeaveRequests: ReturnType<typeof vi.fn>;
    createLeaveRequest: ReturnType<typeof vi.fn>;
    approveLeaveRequest: ReturnType<typeof vi.fn>;
    rejectLeaveRequest: ReturnType<typeof vi.fn>;
    getEmployeeSalaryHistory: ReturnType<typeof vi.fn>;
    generatePayroll: ReturnType<typeof vi.fn>;
    getPayrollSummary: ReturnType<typeof vi.fn>;
    processSalaryPayment: ReturnType<typeof vi.fn>;
    getHRStats: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      findAllEmployees: vi.fn(),
      findEmployeeById: vi.fn(),
      createEmployee: vi.fn(),
      updateEmployee: vi.fn(),
      terminateEmployee: vi.fn(),
      findAllLeaveRequests: vi.fn(),
      createLeaveRequest: vi.fn(),
      approveLeaveRequest: vi.fn(),
      rejectLeaveRequest: vi.fn(),
      getEmployeeSalaryHistory: vi.fn(),
      generatePayroll: vi.fn(),
      getPayrollSummary: vi.fn(),
      processSalaryPayment: vi.fn(),
      getHRStats: vi.fn(),
    };
    controller = new HremployeeController(service as unknown as HremployeeService);
  });

  it('findAllEmployees delegates with orgId and params', async () => {
    service.findAllEmployees.mockResolvedValue({ employees: [], total: 0 });
    const result = await controller.findAllEmployees({ organizationId: 'org-1' }, { page: 1, limit: 10 });
    expect(service.findAllEmployees).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
    expect(result).toBeDefined();
  });

  it('findEmployeeById delegates with orgId and id', async () => {
    service.findEmployeeById.mockResolvedValue({ id: 'emp-1' });
    const result = await controller.findEmployeeById({ organizationId: 'org-1' }, 'emp-1');
    expect(service.findEmployeeById).toHaveBeenCalledWith('org-1', 'emp-1');
    expect(result).toBeDefined();
  });

  it('createEmployee delegates with orgId and dto', async () => {
    const dto = {
      userId: 'u-1',
      employeeNumber: 'E01',
      department: 'Dept',
      position: 'Pos',
      hireDate: '2026-01-01',
      salary: 1000,
      contractType: 'FULL_TIME' as const,
    };
    service.createEmployee.mockResolvedValue({ id: 'emp-1', ...dto });
    const result = await controller.createEmployee({ organizationId: 'org-1' }, dto);
    expect(service.createEmployee).toHaveBeenCalledWith('org-1', dto);
    expect(result).toBeDefined();
  });

  it('terminateEmployee delegates with orgId, id, and reason', async () => {
    service.terminateEmployee.mockResolvedValue({ id: 'emp-1', isActive: false });
    const result = await controller.terminateEmployee({ organizationId: 'org-1' }, 'emp-1', 'Leaving');
    expect(service.terminateEmployee).toHaveBeenCalledWith('org-1', 'emp-1', 'Leaving');
    expect(result).toBeDefined();
  });

  it('approveLeaveRequest delegates with orgId, id, and userId', async () => {
    service.approveLeaveRequest.mockResolvedValue({ id: 'lr-1', status: 'APPROVED' });
    const result = await controller.approveLeaveRequest({ organizationId: 'org-1', id: 'user-admin' }, 'lr-1');
    expect(service.approveLeaveRequest).toHaveBeenCalledWith('org-1', 'lr-1', 'user-admin');
    expect(result).toBeDefined();
  });

  it('getHRStats delegates with orgId', async () => {
    service.getHRStats.mockResolvedValue({ totalEmployees: 10 });
    const result = await controller.getHRStats({ organizationId: 'org-1' });
    expect(service.getHRStats).toHaveBeenCalledWith('org-1');
    expect(result).toBeDefined();
  });
});
