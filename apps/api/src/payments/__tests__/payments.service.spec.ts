import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialPeriodService } from '../../analytics/financial-period.service';

function createMockPrisma() {
  const mock: any = {
    student: { findFirst: vi.fn(), update: vi.fn() },
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
  });
});
