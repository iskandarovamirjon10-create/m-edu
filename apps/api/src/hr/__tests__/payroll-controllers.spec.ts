import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PayrollRunController } from '../payroll-run.controller';
import { PayrollPeriodController } from '../payroll-period.controller';
import { PayrollService } from '../payroll.service';

describe('PayrollRunController & PayrollPeriodController', () => {
  let runController: PayrollRunController;
  let periodController: PayrollPeriodController;
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

  beforeEach(() => {
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
    runController = new PayrollRunController(service as unknown as PayrollService);
    periodController = new PayrollPeriodController(service as unknown as PayrollService);
  });

  describe('PayrollRunController', () => {
    it('listRuns delegates to payrollService.listRuns', async () => {
      service.listRuns.mockResolvedValue({ items: [], total: 0 });
      const query = { year: 2026, month: 9 };
      const res = await runController.listRuns('org-1', query);
      expect(service.listRuns).toHaveBeenCalledWith('org-1', query);
      expect(res).toBeDefined();
    });

    it('calculate delegates to payrollService.calculateRun', async () => {
      service.calculateRun.mockResolvedValue({ id: 'run-1' });
      const dto = { teacherId: 't-1', periodYear: 2026, periodMonth: 9 };
      const res = await runController.calculate('org-1', 'user-1', dto);
      expect(service.calculateRun).toHaveBeenCalledWith('org-1', 'user-1', dto);
      expect(res).toBeDefined();
    });

    it('reviewRun delegates to payrollService.review', async () => {
      service.review.mockResolvedValue({ id: 'run-1', status: 'REVIEWED' });
      const res = await runController.reviewRun('org-1', 'user-1', 'run-1');
      expect(service.review).toHaveBeenCalledWith('org-1', 'user-1', 'run-1');
      expect(res).toBeDefined();
    });

    it('approveRun delegates to payrollService.approve', async () => {
      service.approve.mockResolvedValue({ id: 'run-1', status: 'APPROVED' });
      const res = await runController.approveRun('org-1', 'user-1', 'run-1');
      expect(service.approve).toHaveBeenCalledWith('org-1', 'user-1', 'run-1');
      expect(res).toBeDefined();
    });

    it('payRun delegates to payrollService.pay', async () => {
      service.pay.mockResolvedValue({ id: 'run-1', status: 'PAID' });
      const res = await runController.payRun('org-1', 'user-1', 'run-1');
      expect(service.pay).toHaveBeenCalledWith('org-1', 'user-1', 'run-1');
      expect(res).toBeDefined();
    });

    it('cancelRun delegates to payrollService.cancel', async () => {
      service.cancel.mockResolvedValue({ id: 'run-1', status: 'CANCELLED' });
      const res = await runController.cancelRun('org-1', 'user-1', 'run-1', 'Mistake');
      expect(service.cancel).toHaveBeenCalledWith('org-1', 'user-1', 'run-1', 'Mistake');
      expect(res).toBeDefined();
    });
  });

  describe('PayrollPeriodController', () => {
    it('getPeriodSummary delegates to payrollService.getPeriodSummary', async () => {
      service.getPeriodSummary.mockResolvedValue({ year: 2026, month: 9, runs: 0 });
      const res = await periodController.getPeriodSummary('org-1', '2026', '9');
      expect(service.getPeriodSummary).toHaveBeenCalledWith('org-1', 2026, 9);
      expect(res).toBeDefined();
    });
  });
});
