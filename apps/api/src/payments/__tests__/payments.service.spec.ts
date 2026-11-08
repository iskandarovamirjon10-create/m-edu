import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialPeriodService } from '../../analytics/financial-period.service';

function createMockPrisma() {
  const mock: any = {
    student: { findFirst: vi.fn(), update: vi.fn() },
    invoice: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    cashShift: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    refund: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-log-uuid-1' }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    // FOR UPDATE lock row for PaymentsService.update
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  mock.$transaction = vi.fn(async (fn: (tx: typeof mock) => Promise<unknown>) => fn(mock));
  return mock;
}

describe('PaymentsService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let financialPeriod: { ensureNotClosed: ReturnType<typeof vi.fn> };
  let svc: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    financialPeriod = { ensureNotClosed: vi.fn().mockResolvedValue(undefined) };
    svc = new PaymentsService(
      prisma as unknown as PrismaService,
      financialPeriod as unknown as FinancialPeriodService,
    );
  });

  describe('create', () => {
    it('creates payment successfully in PENDING status', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's-1' });
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.payment.create.mockResolvedValue({
        id: 'p-1',
        amount: 100,
        status: 'PENDING',
        reference: 'PAY-1',
      });

      const res = await svc.create('org-1', {
        studentId: 's-1',
        amount: 100,
        method: 'CASH',
      });

      expect(res.status).toBe('PENDING');
      expect(prisma.payment.create).toHaveBeenCalled();
    });

    it('attaches cashier receivedById and active shiftId when cashier has an open shift', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's-1' });
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.cashShift.findFirst.mockResolvedValue({ id: 'shift-open-1', status: 'OPEN' });
      prisma.payment.create.mockImplementation((args: any) => Promise.resolve({ id: 'p-1', ...args.data }));

      const res = await svc.create(
        'org-1',
        { studentId: 's-1', amount: 250000, method: 'CASH' },
        undefined,
        'cashier-uuid-1',
      );

      expect(res.receivedById).toBe('cashier-uuid-1');
      expect(res.shiftId).toBe('shift-open-1');
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            receivedById: 'cashier-uuid-1',
            shiftId: 'shift-open-1',
          }),
        }),
      );
    });

    it('throws NotFoundException if student does not exist', async () => {
      prisma.student.findFirst.mockResolvedValue(null);
      await expect(
        svc.create('org-1', { studentId: 'missing', amount: 100 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Cash Register Shift Lifecycle', () => {
    it('opens a new cashier shift with initial opening drawer balance', async () => {
      prisma.cashShift.findFirst.mockResolvedValue(null);
      const mockCreatedShift = {
        id: 'shift-100',
        organizationId: 'org-1',
        cashierId: 'cashier-1',
        status: 'OPEN',
        openingBalance: 500000,
        expectedCash: 500000,
        openingNote: 'Ertalabki kassa ochildi',
      };
      prisma.cashShift.create.mockResolvedValue(mockCreatedShift);

      const res = await svc.openCashShift('org-1', 'cashier-1', {
        openingBalance: 500000,
        openingNote: 'Ertalabki kassa ochildi',
      });

      expect(res).toEqual(mockCreatedShift);
      expect(prisma.cashShift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            cashierId: 'cashier-1',
            status: 'OPEN',
            openingBalance: 500000,
          }),
        }),
      );
    });

    it('throws ConflictException if cashier already has an active open shift', async () => {
      prisma.cashShift.findFirst.mockResolvedValue({
        id: 'shift-existing',
        cashierId: 'cashier-1',
        status: 'OPEN',
      });

      await expect(
        svc.openCashShift('org-1', 'cashier-1', { openingBalance: 100000 }),
      ).rejects.toThrow(ConflictException);
    });

    it('retrieves active shift with live drawer statistics', async () => {
      const openedAt = new Date('2026-11-06T08:00:00.000Z');
      prisma.cashShift.findFirst.mockResolvedValue({
        id: 'shift-active-1',
        cashierId: 'cashier-1',
        status: 'OPEN',
        openedAt,
        openingBalance: 500000,
      });

      prisma.payment.findMany.mockResolvedValue([
        { id: 'p1', amount: 300000, method: 'CASH', paidAt: new Date() },
        { id: 'p2', amount: 200000, method: 'UZCARD', paidAt: new Date() },
      ]);

      const res = await svc.getCurrentShift('org-1', 'cashier-1');

      expect(res.active).toBe(true);
      expect(res.shift?.id).toBe('shift-active-1');
      expect(res.shift?.liveStats.openingBalance).toBe(500000);
      expect(res.shift?.liveStats.cashPayments).toBe(300000);
      expect(res.shift?.liveStats.cardPayments).toBe(200000);
      expect(res.shift?.liveStats.expectedCash).toBe(800000); // 500k opening + 300k cash
    });

    it('returns active: false when cashier has no active shift', async () => {
      prisma.cashShift.findFirst.mockResolvedValue(null);

      const res = await svc.getCurrentShift('org-1', 'cashier-2');

      expect(res.active).toBe(false);
      expect(res.shift).toBeNull();
    });

    it('lists cashier shift history with pagination', async () => {
      prisma.cashShift.findMany.mockResolvedValue([
        { id: 'shift-1', status: 'CLOSED' },
      ]);
      prisma.cashShift.count.mockResolvedValue(1);

      const res = await svc.getCashierShifts('org-1', { limit: 10, page: 1 });

      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
      expect(res.page).toBe(1);
    });
  });

  describe('Z-Report Cashier Shift & Reconciliation', () => {
    it('calculates live Z-Report summary with breakdown by payment method', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { id: 'p1', amount: 300000, method: 'CASH', receiptNumber: 'RCP-001', paidAt: new Date() },
        { id: 'p2', amount: 500000, method: 'TERMINAL', receiptNumber: 'RCP-002', paidAt: new Date() },
        { id: 'p3', amount: 200000, method: 'BANK_TRANSFER', receiptNumber: 'RCP-003', paidAt: new Date() },
      ]);
      prisma.refund.findMany.mockResolvedValue([
        { id: 'r1', amount: 50000, Payment: { method: 'CASH' }, processedAt: new Date() },
      ]);

      const res = await svc.getZReportSummary('org-1');

      expect(res.totalPaymentsCount).toBe(3);
      expect(res.totalCollected).toBe(1000000);
      expect(res.byMethod.cash.amount).toBe(300000);
      expect(res.byMethod.terminal.amount).toBe(500000);
      expect(res.byMethod.bankTransfer.amount).toBe(200000);
      expect(res.refunds.count).toBe(1);
      expect(res.refunds.totalAmount).toBe(50000);
      expect(res.netCashDrawerExpected).toBe(250000); // 300000 cash - 50000 refund
    });

    it('finalizes cashier shift and detects cash discrepancy (variance) with CashShift record', async () => {
      const openedAt = new Date('2026-11-06T08:00:00.000Z');
      prisma.cashShift.findFirst.mockResolvedValue({
        id: 'shift-to-close',
        openedAt,
        openingBalance: 100000,
        status: 'OPEN',
      });
      prisma.payment.findMany.mockResolvedValue([
        { id: 'p1', amount: 400000, method: 'CASH', receiptNumber: 'RCP-001', paidAt: new Date() },
      ]);
      prisma.refund.findMany.mockResolvedValue([]);
      prisma.cashShift.update.mockResolvedValue({ id: 'shift-to-close', status: 'CLOSED' });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-z-1' });

      // Opening balance: 100,000 + Cash collected: 400,000 = Expected 500,000.
      // Cashier counts 490,000 -> -10,000 shortage.
      const res = await svc.closeCashierShift(
        'org-1',
        { sub: 'cashier-uuid-1', firstName: 'Dilnoza', lastName: 'Karimova' },
        { actualCashCounted: 490000, handoverAmount: 450000, closingNotes: '10000 qaytim yetishmadi' },
      );

      expect(res.success).toBe(true);
      expect(res.reportNumber).toMatch(/^Z-\d{8}-\d{4}$/);
      expect(res.expectedCash).toBe(500000);
      expect(res.actualCashCounted).toBe(490000);
      expect(res.variance).toBe(-10000);
      expect(res.status).toBe('SHORTAGE');
      expect(res.handoverAmount).toBe(450000);
      expect(prisma.cashShift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shift-to-close' },
          data: expect.objectContaining({
            status: 'CLOSED',
            actualCash: 490000,
            difference: -10000,
            handoverAmount: 450000,
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });
});
