import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from '../payments.controller';
import { PaymentsService } from '../payments.service';
import { RedisPubSubService } from '../../common/redis/redis-pubsub.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
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
      service.create = vi.fn().mockResolvedValue(mockPay);
      const result = await controller.create(orgId, dto);
      expect(result).toEqual(mockPay);
      expect(service.create).toHaveBeenCalledWith(orgId, dto);
    });
  });

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { status: 'PAID' } as never;
      const mockPay = { id: 'p-1', status: 'PAID' };
      service.update = vi.fn().mockResolvedValue(mockPay);
      const result = await controller.update(orgId, 'p-1', dto);
      expect(result).toEqual(mockPay);
      expect(service.update).toHaveBeenCalledWith(orgId, 'p-1', dto);
    });
  });

  describe('cashier Z-report endpoints', () => {
    it('delegates getZReportSummary to service', async () => {
      const mockSummary = { totalCollected: 1000000 };
      (service as any).getZReportSummary = vi.fn().mockResolvedValue(mockSummary);
      const query = { startDate: '2026-10-26T00:00:00.000Z' };
      const res = await controller.getZReportSummary(orgId, query);
      expect(res).toEqual(mockSummary);
      expect((service as any).getZReportSummary).toHaveBeenCalledWith(orgId, query);
    });

    it('delegates getZReportHistory to service', async () => {
      const mockHistory = [{ reportNumber: 'Z-20261026-001' }];
      (service as any).getRecentZReports = vi.fn().mockResolvedValue(mockHistory);
      const res = await controller.getZReportHistory(orgId, 10);
      expect(res).toEqual(mockHistory);
      expect((service as any).getRecentZReports).toHaveBeenCalledWith(orgId, 10);
    });

    it('delegates closeCashierShift to service', async () => {
      const mockClose = { success: true, reportNumber: 'Z-20261026-001' };
      (service as any).closeCashierShift = vi.fn().mockResolvedValue(mockClose);
      const user = { sub: 'user-1', firstName: 'Dilshod' };
      const dto = { actualCashCounted: 500000 };
      const res = await controller.closeCashierShift(orgId, user as any, dto);
      expect(res).toEqual(mockClose);
      expect((service as any).closeCashierShift).toHaveBeenCalledWith(orgId, user, dto);
    });
  });
});