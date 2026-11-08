import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentsController } from '../payments.controller';
import { PaymentsService } from '../payments.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    getZReportSummary: ReturnType<typeof vi.fn>;
    getRecentZReports: ReturnType<typeof vi.fn>;
    closeCashierShift: ReturnType<typeof vi.fn>;
    openCashShift: ReturnType<typeof vi.fn>;
    getCurrentShift: ReturnType<typeof vi.fn>;
    getCashierShifts: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-1';

  beforeEach(async () => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      getZReportSummary: vi.fn(),
      getRecentZReports: vi.fn(),
      closeCashierShift: vi.fn(),
      openCashShift: vi.fn(),
      getCurrentShift: vi.fn(),
      getCashierShifts: vi.fn(),
    };

    controller = new PaymentsController(service as unknown as PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('delegates to service.findAll', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 });
      const result = await controller.findAll(orgId, { page: 1, limit: 10 });
      expect(result).toEqual({ items: [], total: 0 });
      expect(service.findAll).toHaveBeenCalledWith(orgId, { page: 1, limit: 10 });
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne', async () => {
      const mockPay = { id: 'p-1', amount: 100 };
      service.findOne.mockResolvedValue(mockPay);
      const result = await controller.findOne(orgId, 'p-1');
      expect(result).toEqual(mockPay);
      expect(service.findOne).toHaveBeenCalledWith(orgId, 'p-1');
    });
  });

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto = { studentId: 's-1', amount: 50 } as never;
      const mockPay = { id: 'p-2', amount: 50 };
      service.create.mockResolvedValue(mockPay);
      const result = await controller.create(orgId, dto);
      expect(result).toEqual(mockPay);
      expect(service.create).toHaveBeenCalledWith(orgId, dto);
    });

    it('delegates to service.create with idempotency key when provided', async () => {
      const dto = { studentId: 's-1', amount: 50 } as never;
      const mockPay = { id: 'p-2', amount: 50 };
      service.create.mockResolvedValue(mockPay);
      const result = await controller.create(orgId, dto, 'idemp-key-12345');
      expect(result).toEqual(mockPay);
      expect(service.create).toHaveBeenCalledWith(orgId, dto, 'idemp-key-12345');
    });

    it('delegates to service.create with cashier userId attribution', async () => {
      const dto = { studentId: 's-1', amount: 50 } as never;
      const mockPay = { id: 'p-2', amount: 50, receivedById: 'cashier-1' };
      service.create.mockResolvedValue(mockPay);
      const result = await controller.create(orgId, dto, undefined, undefined, 'cashier-1');
      expect(result).toEqual(mockPay);
      expect(service.create).toHaveBeenCalledWith(orgId, dto, undefined, 'cashier-1');
    });
  });

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { status: 'PAID' } as never;
      const mockPay = { id: 'p-1', status: 'PAID' };
      service.update.mockResolvedValue(mockPay);
      const result = await controller.update(orgId, 'p-1', dto);
      expect(result).toEqual(mockPay);
      expect(service.update).toHaveBeenCalledWith(orgId, 'p-1', dto);
    });
  });

  describe('cashier shift endpoints', () => {
    it('delegates openCashierShift to service', async () => {
      const mockShift = { id: 'shift-1', status: 'OPEN', openingBalance: 500000 };
      service.openCashShift.mockResolvedValue(mockShift);
      const dto = { openingBalance: 500000, openingNote: 'Ertalabki smena' };
      const res = await controller.openCashierShift(orgId, 'cashier-1', dto);
      expect(res).toEqual(mockShift);
      expect(service.openCashShift).toHaveBeenCalledWith(orgId, 'cashier-1', dto);
    });

    it('delegates getCurrentShift to service', async () => {
      const mockActive = { active: true, shift: { id: 'shift-1', status: 'OPEN' } };
      service.getCurrentShift.mockResolvedValue(mockActive);
      const res = await controller.getCurrentShift(orgId, 'cashier-1');
      expect(res).toEqual(mockActive);
      expect(service.getCurrentShift).toHaveBeenCalledWith(orgId, 'cashier-1');
    });

    it('delegates getCashierShifts history to service', async () => {
      const mockHistory = { items: [{ id: 'shift-1' }], total: 1 };
      service.getCashierShifts.mockResolvedValue(mockHistory);
      const query = { status: 'CLOSED' as const, limit: 10 };
      const res = await controller.getCashierShifts(orgId, query);
      expect(res).toEqual(mockHistory);
      expect(service.getCashierShifts).toHaveBeenCalledWith(orgId, query);
    });
  });

  describe('cashier Z-report endpoints', () => {
    it('delegates getZReportSummary to service', async () => {
      const mockSummary = { totalCollected: 1000000 };
      service.getZReportSummary.mockResolvedValue(mockSummary);
      const query = { startDate: '2026-10-26T00:00:00.000Z' };
      const res = await controller.getZReportSummary(orgId, query);
      expect(res).toEqual(mockSummary);
      expect(service.getZReportSummary).toHaveBeenCalledWith(orgId, query);
    });

    it('delegates getZReportHistory to service', async () => {
      const mockHistory = [{ reportNumber: 'Z-20261026-001' }];
      service.getRecentZReports.mockResolvedValue(mockHistory);
      const res = await controller.getZReportHistory(orgId, 10);
      expect(res).toEqual(mockHistory);
      expect(service.getRecentZReports).toHaveBeenCalledWith(orgId, 10);
    });

    it('delegates closeCashierShift to service', async () => {
      const mockClose = { success: true, reportNumber: 'Z-20261026-001' };
      service.closeCashierShift.mockResolvedValue(mockClose);
      const user = { sub: 'user-1', firstName: 'Dilshod' };
      const dto = { actualCashCounted: 500000 };
      const res = await controller.closeCashierShift(orgId, user as any, dto);
      expect(res).toEqual(mockClose);
      expect(service.closeCashierShift).toHaveBeenCalledWith(orgId, user, dto);
    });
  });
});
