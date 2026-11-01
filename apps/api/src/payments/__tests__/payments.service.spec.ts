import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
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
    refund: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-log-uuid-1' }),
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

  describe('findOne', () => {
    it('returns payment if found', async () => {
      const mockPay = { id: 'p1', amount: 100 };
      prisma.payment.findFirst.mockResolvedValue(mockPay);
      const result = await svc.findOne('org-1', 'p1');
      expect(result).toEqual(mockPay);
    });

    it('throws NotFoundException if not found', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);
      await expect(svc.findOne('org-1', 'p2')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

describe('findAll', () => {
    it('returns paginated payments', async () => {
      prisma.payment.findMany.mockResolvedValue([{ id: 'p1' }]);
      prisma.payment.count.mockResolvedValue(1);

      const result = await svc.findAll('org-1', { page: 1, limit: 10 });
      expect(result.items.length).toBe(1);
      expect(result.total).toBe(1);
    });
  });

  describe('create', () => {
    it('creates a PENDING payment for an existing student', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's1' });
      prisma.payment.findFirst.mockResolvedValue(null);
      const created = { id: 'p1', status: 'PENDING', amount: 100 };
      prisma.payment.create.mockResolvedValue(created);

      const result = await svc.create('org-1', {
        studentId: 's1',
        amount: 100,
        method: 'CASH',
      });

      expect(financialPeriod.ensureNotClosed).toHaveBeenCalled();
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            studentId: 's1',
            amount: 100,
            status: 'PENDING',
            method: 'CASH',
          }),
        }),
      );
      expect(result).toEqual(created);
    });

    it('throws NotFoundException when student belongs to another org', async () => {
      prisma.student.findFirst.mockResolvedValue(null);
      await expect(
        svc.create('org-1', { studentId: 'other', amount: 10 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('returns existing payment when called with identical reference, studentId, and amount (idempotent replay)', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's1' });
      const existingPayment = {
        id: 'p-existing',
        organizationId: 'org-1',
        studentId: 's1',
        amount: 150,
        reference: 'ref-custom-123',
        status: 'PENDING',
      };
      prisma.payment.findFirst.mockResolvedValue(existingPayment);

      const result = await svc.create('org-1', {
        studentId: 's1',
        amount: 150,
        reference: 'ref-custom-123',
      });

      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', reference: 'ref-custom-123' },
        include: expect.any(Object),
      });
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingPayment);
    });

    it('throws ConflictException when called with existing reference but different amount or student', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's1' });
      const existingPayment = {
        id: 'p-existing',
        organizationId: 'org-1',
        studentId: 's1',
        amount: 150,
        reference: 'ref-custom-123',
      };
      prisma.payment.findFirst.mockResolvedValue(existingPayment);

      await expect(
        svc.create('org-1', {
          studentId: 's1',
          amount: 200, // Different amount
          reference: 'ref-custom-123',
        }),
      ).rejects.toThrow('A payment with this reference already exists with different parameters');
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('sets paidAt when status transitions to PAID', async () => {
      const existing = {
        id: 'p1',
        organizationId: 'org-1',
        studentId: 's1',
        status: 'PENDING',
        amount: 100,
        dueDate: null,
        createdAt: new Date(),
        reference: null,
      };
      prisma.payment.findFirst.mockResolvedValue(existing);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'p1', status: 'PENDING', amount: 100, studentId: 's1' },
      ]);
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.student.update.mockResolvedValue({});
      prisma.payment.findUnique.mockResolvedValue({ ...existing, status: 'PAID', paidAt: new Date() });

      await svc.update('org-1', 'p1', { status: 'PAID' });

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'p1', organizationId: 'org-1', status: 'PENDING' }),
          data: expect.objectContaining({
            status: 'PAID',
            paidAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1' },
          data: { balance: { increment: 100 } },
        }),
      );
    });

    it('clears paidAt when status leaves PAID', async () => {
      const existing = {
        id: 'p1',
        organizationId: 'org-1',
        studentId: 's1',
        status: 'PAID',
        amount: 100,
        paidAt: new Date(),
        dueDate: null,
        createdAt: new Date(),
        reference: null,
      };
      prisma.payment.findFirst.mockResolvedValue(existing);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'p1', status: 'PAID', amount: 100, studentId: 's1' },
      ]);
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.student.update.mockResolvedValue({});
      prisma.payment.findUnique.mockResolvedValue({ ...existing, status: 'CANCELLED', paidAt: null });

      await svc.update('org-1', 'p1', { status: 'CANCELLED' });

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CANCELLED',
            paidAt: null,
          }),
        }),
      );
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: { increment: -100 } },
        }),
      );
    });

    it('rolls back invoice paidAmount and recomputes status when paid payment linked to invoice is cancelled', async () => {
      const existing = {
        id: 'p-inv-1',
        organizationId: 'org-1',
        studentId: 's1',
        invoiceId: 'inv-123',
        status: 'PAID',
        amount: 500000,
        paidAt: new Date(),
        dueDate: null,
        createdAt: new Date(),
        reference: null,
      };
      prisma.payment.findFirst.mockResolvedValue(existing);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'p-inv-1', status: 'PAID', amount: 500000, studentId: 's1' },
      ]);
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.student.update.mockResolvedValue({});
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-123',
        total: 500000,
        paidAmount: 500000,
        refundedAmount: 0,
        dueDate: new Date(Date.now() + 86400000), // tomorrow -> ISSUED
        paidAt: new Date(),
      });
      prisma.invoice.update.mockResolvedValue({});
      prisma.payment.findUnique.mockResolvedValue({ ...existing, status: 'CANCELLED', paidAt: null });

      await svc.update('org-1', 'p-inv-1', { status: 'CANCELLED' }, { userId: 'GATEWAY_SETTLEMENT' });

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-123' },
          data: expect.objectContaining({
            paidAmount: 0,
            status: 'ISSUED',
            paidAt: null,
          }),
        }),
      );
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: { increment: -500000 } },
        }),
      );
    });

    it('throws BadRequestException when reducing payment amount below active/processed refunds (M-EDU-FIN-004)', async () => {
      const existing = {
        id: 'p1',
        organizationId: 'org-1',
        studentId: 's1',
        status: 'PAID',
        amount: 100,
        paidAt: new Date(),
        dueDate: null,
        createdAt: new Date(),
        reference: null,
      };
      prisma.payment.findFirst.mockResolvedValue(existing);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'p1', status: 'PAID', amount: 100, studentId: 's1' },
      ]);
      // Active refunds sum to 60
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 60 } });

      await expect(
        svc.update('org-1', 'p1', { amount: 50 }),
      ).rejects.toThrow('Cannot reduce payment amount below active or processed refunds');
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException when attempting to change payment status away from PAID when refunds exist (M-EDU-FIN-004)', async () => {
      const existing = {
        id: 'p1',
        organizationId: 'org-1',
        studentId: 's1',
        status: 'PAID',
        amount: 100,
        paidAt: new Date(),
        dueDate: null,
        createdAt: new Date(),
        reference: null,
      };
      prisma.payment.findFirst.mockResolvedValue(existing);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'p1', status: 'PAID', amount: 100, studentId: 's1' },
      ]);
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 20 } });

      await expect(
        svc.update('org-1', 'p1', { status: 'CANCELLED' }),
      ).rejects.toThrow('Cannot change status of payment with active or processed refunds away from PAID');
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
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

    it('finalizes cashier shift and detects cash discrepancy (variance)', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { id: 'p1', amount: 400000, method: 'CASH', receiptNumber: 'RCP-001', paidAt: new Date() },
      ]);
      prisma.refund.findMany.mockResolvedValue([]);
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-z-1' });

      // Expected cash is 400,000, cashier counts 390,000 -> -10,000 shortage
      const res = await svc.closeCashierShift(
        'org-1',
        { sub: 'cashier-uuid-1', firstName: 'Dilnoza', lastName: 'Karimova' },
        { actualCashCounted: 390000, closingNotes: '10000 qaytim yetishmadi' },
      );

      expect(res.success).toBe(true);
      expect(res.reportNumber).toMatch(/^Z-\d{8}-\d{4}$/);
      expect(res.expectedCash).toBe(400000);
      expect(res.actualCashCounted).toBe(390000);
      expect(res.variance).toBe(-10000);
      expect(res.status).toBe('SHORTAGE');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });
});