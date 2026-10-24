import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InvoicesService } from '../invoices.service';

function createMockPrisma() {
  const tx = {
    invoice: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    invoiceItem: { create: vi.fn(), count: vi.fn() },
    receiptCounter: { upsert: vi.fn().mockResolvedValue({ lastNumber: 1, year: new Date().getFullYear() }) },
    payment: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(),
      count: vi.fn(async () => 0),
    },
    refund: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), aggregate: vi.fn() },
    auditLog: { create: vi.fn(async (args: unknown) => args) },
    student: { findFirst: vi.fn(), update: vi.fn(async () => ({})) },
    // getPeriodWithLock() uses the tagged-template form tx.$queryRaw`...`.
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  return {
    tx,
    invoice: tx.invoice,
    invoiceItem: tx.invoiceItem,
    payment: tx.payment,
    refund: tx.refund,
    student: tx.student,
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  };
}

function createMockAudit() {
  return { record: vi.fn(async (args: unknown) => args) };
}

const orgId = 'org-1';
const actorId = 'admin-1';

function draftInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    organizationId: orgId,
    studentId: 'stu-1',
    number: 'INV-2026-000001',
    status: 'DRAFT',
    subtotal: 100,
    discount: 0,
    penalty: 0,
    total: 100,
    paidAmount: 0,
    refundedAmount: 0,
    dueDate: null,
    items: [],
    ...overrides,
  };
}

describe('InvoicesService — createInvoice', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    audit = createMockAudit();
  });

  it('rejects when student belongs to another organization (tenant isolation)', async () => {
    prisma.student.findFirst.mockResolvedValue(null);
    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(
      svc.createInvoice(orgId, actorId, {
        studentId: 'stu-other',
        number: 'INV-1',
        items: [{ description: 'Course', unitPrice: 100 }],
      } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects an invoice whose items total to zero', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'stu-1' });
    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(
      svc.createInvoice(orgId, actorId, {
        studentId: 'stu-1',
        number: 'INV-1',
        items: [{ description: 'Free', unitPrice: 0 }],
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('computes totals in integer minor units: 0.1 + 0.2 drift is impossible', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'stu-1' });
    prisma.invoice.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);
    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    const inv = (await svc.createInvoice(orgId, actorId, {
      studentId: 'stu-1',
      number: 'INV-FLOAT',
      items: [
        { description: 'A', unitPrice: 0.1 },
        { description: 'B', unitPrice: 0.2 },
      ],
    } as never)) as unknown as Record<string, unknown>;
    expect(inv.subtotal).toBe(0.3);
    expect(inv.total).toBe(0.3);
  });

  it('maps duplicate invoice number to 409', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'stu-1' });
    prisma.invoice.create.mockRejectedValue({ code: 'P2002' });
    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(
      svc.createInvoice(orgId, actorId, {
        studentId: 'stu-1',
        number: 'INV-DUP',
        items: [{ description: 'A', unitPrice: 10 }],
      } as never),
    ).rejects.toThrow(/already exists/);
  });

  it('discount that zeroes the total is rejected (never negative)', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'stu-1' });
    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(
      svc.createInvoice(orgId, actorId, {
        studentId: 'stu-1',
        number: 'INV-DISC',
        items: [{ description: 'A', unitPrice: 50 }],
        discount: 999,
      } as never),
    ).rejects.toThrow(/total must be positive/);
  });
});

describe('InvoicesService — recordPayment', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    audit = createMockAudit();
  });

  it('rejects payment on a CANCELLED invoice', async () => {
    prisma.invoice.findFirst.mockResolvedValue(draftInvoice({ status: 'CANCELLED' }));
    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(
      svc.recordPayment(orgId, actorId, { invoiceId: 'inv-1', amount: 50 } as never),
    ).rejects.toThrow(/cannot accept payments/);
  });

  it('rejects overpayment beyond remaining balance', async () => {
    prisma.invoice.findFirst.mockResolvedValue(draftInvoice({ status: 'ISSUED', total: 100, paidAmount: 80 }));
    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(
      svc.recordPayment(orgId, actorId, { invoiceId: 'inv-1', amount: 30 } as never),
    ).rejects.toThrow(/exceeds remaining balance/);
  });

  it('partial payment sets PARTIALLY_PAID and issues a receipt', async () => {
    prisma.invoice.findFirst.mockResolvedValue(draftInvoice({ status: 'ISSUED', total: 100, paidAmount: 0 }));
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
    prisma.invoice.findUniqueOrThrow.mockResolvedValue({ ...draftInvoice({ status: 'ISSUED' }), paidAmount: 40 });
    prisma.invoice.update.mockResolvedValue({});
    prisma.payment.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);

    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    const result = (await svc.recordPayment(orgId, actorId, {
      invoiceId: 'inv-1',
      amount: 40,
      method: 'CASH',
    } as never)) as unknown as Record<string, unknown>;

    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Atomic optimistic-concurrency guard: the update only lands if the
        // invoice still has the snapshot the balance was computed from.
        where: expect.objectContaining({
          id: 'inv-1',
          organizationId: orgId,
          status: 'ISSUED',
          paidAmount: 0,
          refundedAmount: 0,
        }),
        data: expect.objectContaining({ paidAmount: { increment: 40 } }),
      }),
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIALLY_PAID' }) }),
    );
    expect(result.receiptNumber).toMatch(/^RCP-\d{4}-\d{6}$/);
  });

  it('final payment flips invoice to PAID', async () => {
    prisma.invoice.findFirst.mockResolvedValue(draftInvoice({ status: 'PARTIALLY_PAID', total: 100, paidAmount: 60 }));
    prisma.payment.create.mockResolvedValue({ id: 'pay-2' });
    prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
    prisma.invoice.findUniqueOrThrow.mockResolvedValue({ ...draftInvoice({ status: 'PARTIALLY_PAID' }), paidAmount: 100 });
    prisma.invoice.update.mockResolvedValue({});
    prisma.payment.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);

    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await svc.recordPayment(orgId, actorId, { invoiceId: 'inv-1', amount: 40 } as never);

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }),
    );
  });

  it('concurrent second payment that would exceed total is rejected via atomic guard', async () => {
    prisma.invoice.findFirst.mockResolvedValue(draftInvoice({ status: 'ISSUED', total: 100, paidAmount: 80 }));
    prisma.payment.create.mockResolvedValue({ id: 'pay-3' });
    prisma.invoice.updateMany.mockResolvedValue({ count: 0 }); // guard fails
    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(
      svc.recordPayment(orgId, actorId, { invoiceId: 'inv-1', amount: 20 } as never),
    ).rejects.toThrow(/concurrently|exceeds remaining balance/);
  });

  it('duplicate payment reference maps to 409 (idempotency)', async () => {
    prisma.invoice.findFirst.mockResolvedValue(draftInvoice({ status: 'ISSUED' }));
    prisma.payment.create.mockRejectedValue({ code: 'P2002' });
    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(
      svc.recordPayment(orgId, actorId, { invoiceId: 'inv-1', amount: 10, reference: 'DUP-REF' } as never),
    ).rejects.toThrow(/already exists \(duplicate\)/);
  });
});

describe('InvoicesService — refunds', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    audit = createMockAudit();
  });

  it('refund target must be a PAID payment (wrong invoice / unpaid target)', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(
      svc.requestRefund(orgId, actorId, { paymentId: 'pay-x', amount: 10 } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('refund cannot exceed refundable (paid minus existing refunds)', async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', amount: 100, invoiceId: 'inv-1', studentId: 'stu-1' });
    prisma.tx.$queryRaw.mockResolvedValue([{ id: 'pay-1', amount: 100 }]);
    prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 60 } });
    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(
      svc.requestRefund(orgId, actorId, { paymentId: 'pay-1', amount: 50 } as never),
    ).rejects.toThrow(/exceeds refundable/);
  });

  it('rejecting a non-REQUESTED refund is a conflict', async () => {
    prisma.refund.updateMany.mockResolvedValue({ count: 0 });
    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(svc.rejectRefund(orgId, actorId, 'r1', 'no')).rejects.toThrow(ConflictException);
  });

  it('processing increments invoice refundedAmount and audits', async () => {
    prisma.refund.findFirst.mockResolvedValue({
      id: 'r1', organizationId: orgId, status: 'REQUESTED',
      paymentId: 'pay-1', invoiceId: 'inv-1', amount: 40,
    });
    prisma.refund.updateMany.mockResolvedValue({ count: 1 });
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', refundedAmount: 0 });
    prisma.invoice.findUniqueOrThrow.mockResolvedValue({
      ...draftInvoice({ status: 'PAID' }),
      paidAmount: 40,
      refundedAmount: 40,
      dueDate: null,
    });
    prisma.payment.findUnique.mockResolvedValue({ studentId: 'stu-1' });
    prisma.tx.$queryRaw.mockResolvedValue([
      { id: 'pay-1', amount: 100, status: 'PAID', studentId: 'stu-1' },
    ]);
    prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.refund.findUnique.mockResolvedValue({ id: 'r1', status: 'PROCESSED' });

    const svc = new InvoicesService(prisma as never, audit as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await svc.processRefund(orgId, actorId, 'r1', 'GW-REF-1');

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refundedAmount: { increment: 40 } }),
      }),
    );
    expect(prisma.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'REFUND_PROCESSED' }),
      }),
    );
    expect(prisma.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { balance: { decrement: 40 } },
      }),
    );
  });
});

describe('InvoicesService — student scoping', () => {
  it('student cannot read another student invoice (no existence leak)', async () => {
    const prisma = createMockPrisma();
    prisma.student.findFirst.mockResolvedValue({ id: 'stu-me' });
    prisma.invoice.findFirst.mockResolvedValue(null); // not mine
    const svc = new InvoicesService(prisma as never, createMockAudit() as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(svc.getInvoiceForStudent(orgId, 'user-1', 'inv-other')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getBalanceForUser requires a linked student profile', async () => {
    const prisma = createMockPrisma();
    prisma.student.findFirst.mockResolvedValue(null);
    const svc = new InvoicesService(prisma as never, createMockAudit() as never, { emit: vi.fn().mockResolvedValue(undefined) } as never, { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(svc.getBalanceForUser(orgId, 'user-no-student')).rejects.toThrow(
      /No student profile linked/,
    );
  });
});


describe('InvoicesService — tuition proration accuracy', () => {
  it('proratePreview does not lose rounding sums when remainingLessons equals totalLessons', async () => {
    const prisma = createMockPrisma();
    prisma.student.findFirst.mockResolvedValue({
      id: 'stu-1',
      user: { firstName: 'Ali', lastName: 'Valiyev' },
    });
    const svc = new InvoicesService(
      prisma as never,
      createMockAudit() as never,
      { emit: vi.fn().mockResolvedValue(undefined) } as never,
      { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never,
    );

    const res = await svc.proratePreview(orgId, {
      studentId: 'stu-1',
      startDate: '2026-10-01',
      fullMonthlyAmount: 1_000_000,
      totalLessonsInMonth: 12,
      remainingLessons: 12,
    });

    expect(res.proratedTotal).toBe(1_000_000);
    expect(res.remainingLessons).toBe(12);
  });

  it('proratePreview calculates partial month with high precision without premature division truncation', async () => {
    const prisma = createMockPrisma();
    prisma.student.findFirst.mockResolvedValue({
      id: 'stu-1',
      user: { firstName: 'Ali', lastName: 'Valiyev' },
    });
    const svc = new InvoicesService(
      prisma as never,
      createMockAudit() as never,
      { emit: vi.fn().mockResolvedValue(undefined) } as never,
      { ensureNotClosedTx: vi.fn(), ensureNotClosed: vi.fn().mockResolvedValue(undefined) } as never,
    );

    const res = await svc.proratePreview(orgId, {
      studentId: 'stu-1',
      startDate: '2026-10-15',
      fullMonthlyAmount: 1_000_000,
      totalLessonsInMonth: 12,
      remainingLessons: 5,
    });

    expect(res.proratedTotal).toBe(416667);
  });
});
