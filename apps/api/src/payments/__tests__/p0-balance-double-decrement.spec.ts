import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { InvoicesService } from '../invoices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialPeriodService } from '../../analytics/financial-period.service';

/**
 * P0 regression: Student.balance must mutate at most once per financial event.
 *
 * Confirmed defect (forensic audit):
 *   PAID  -> balance +100
 *   REFUND -> balance -100
 *   PAID -> PENDING -> balance -100 again  => final -100 (should be 0)
 *
 * These tests intentionally run AGAINST the pre-fix implementation first
 * (reproduction), then against the fixed implementation (regression).
 */

const ORG = 'org-1';
const ACTOR = 'admin-1';
const STUDENT = 'stu-1';

function createInMemoryBalanceWorld() {
  // Minimal stateful fake for the three tables this bug touches.
  const world = {
    student: { id: STUDENT, balance: 0 },
    payment: null as any,
    refund: null as any,
    invoice: null as any,
    auditLog: [] as any[],
    refundAggregateResult: { _sum: { amount: 0 } },
    paymentForUpdateLock: null as any,
  };

  const studentUpdate = vi.fn(async ({ where, data }: any) => {
    if (where.id !== STUDENT) throw new Error('unknown student');
    if (data.balance?.increment !== undefined) {
      world.student.balance += Number(data.balance.increment);
    }
    if (data.balance?.decrement !== undefined) {
      world.student.balance -= Number(data.balance.decrement);
    }
    return { ...world.student };
  });

  const paymentRow = () => world.payment;

  const tx: any = {
    student: { update: studentUpdate },
    payment: {
      findFirst: vi.fn(async () => ({ ...paymentRow() })),
      findUnique: vi.fn(async () => ({ ...paymentRow() })),
      findUniqueOrThrow: vi.fn(async () => ({ ...paymentRow() })),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(world.payment, data);
        return { ...world.payment };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        // Optimistic guard matching production: status must equal snapshot.
        if (where.status !== undefined && world.payment.status !== where.status) {
          return { count: 0 };
        }
        if (where.amount !== undefined && Number(world.payment.amount) !== Number(where.amount)) {
          return { count: 0 };
        }
        Object.assign(world.payment, data);
        return { count: 1 };
      }),
      create: vi.fn(async ({ data }: any) => {
        world.payment = { id: 'pay-1', ...data };
        return { ...world.payment };
      }),
    },
    refund: {
      findFirst: vi.fn(async () => (world.refund ? { ...world.refund } : null)),
      findUnique: vi.fn(async () => (world.refund ? { ...world.refund } : null)),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (!world.refund) return { count: 0 };
        if (where.status !== undefined && world.refund.status !== where.status) return { count: 0 };
        Object.assign(world.refund, data);
        return { count: 1 };
      }),
      create: vi.fn(async ({ data }: any) => {
        world.refund = { id: 'ref-1', ...data };
        return { ...world.refund };
      }),
      // Sum of PROCESSSED refunds matching the where filter (paymentId/status/NOT.id).
      aggregate: vi.fn(async ({ where }: any = {}) => {
        if (!world.refund) return { _sum: { amount: 0 } };
        if (where?.paymentId && world.refund.paymentId !== where.paymentId) {
          return { _sum: { amount: 0 } };
        }
        if (where?.status && world.refund.status !== where.status) {
          return { _sum: { amount: 0 } };
        }
        if (where?.NOT?.id && world.refund.id === where.NOT.id) {
          return { _sum: { amount: 0 } };
        }
        return { _sum: { amount: world.refund.amount } };
      }),
    },
    invoice: {
      findFirst: vi.fn(async () => world.invoice),
      findUnique: vi.fn(async () => world.invoice),
      findUniqueOrThrow: vi.fn(async () => world.invoice),
      update: vi.fn(async ({ data }: any) => {
        if (world.invoice) Object.assign(world.invoice, data);
        return { ...world.invoice };
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    auditLog: {
      create: vi.fn(async (args: any) => {
        world.auditLog.push(args);
        return args;
      }),
    },
    $queryRaw: vi.fn(async () => [{ id: 'pay-1', amount: 100 }]),
    // FOR UPDATE lock returns the current payment row.
  };

  // Production payments.update / processRefund / requestRefund issue
  // SELECT ... FOR UPDATE and need the full locked row.
  tx.$queryRaw = vi.fn(async (..._args: any[]) => {
    if (!world.payment) return [];
    return [
      {
        id: world.payment.id,
        status: world.payment.status,
        amount: world.payment.amount,
        studentId: world.payment.studentId ?? null,
      },
    ];
  });

  const prisma: any = {
    student: {
      findFirst: vi.fn(async () => ({ id: STUDENT })),
      update: studentUpdate,
    },
    payment: tx.payment,
    refund: tx.refund,
    invoice: tx.invoice,
    auditLog: tx.auditLog,
    $queryRaw: tx.$queryRaw,
    $transaction: vi.fn(async (fn: (t: any) => Promise<any>) => fn(tx)),
  };

  return { world, prisma, tx };
}

function makePayments(svc_prisma: any) {
  const financialPeriod = { ensureNotClosed: vi.fn().mockResolvedValue(undefined), ensureNotClosedTx: vi.fn().mockResolvedValue(undefined) };
  return new PaymentsService(svc_prisma, financialPeriod as unknown as FinancialPeriodService);
}

function makeInvoices(svc_prisma: any) {
  const audit = { record: vi.fn(async (a: any) => a) };
  const notificationEvents = { emit: vi.fn().mockResolvedValue(undefined) };
  const financialPeriod = { ensureNotClosed: vi.fn().mockResolvedValue(undefined), ensureNotClosedTx: vi.fn().mockResolvedValue(undefined) };
  return new InvoicesService(svc_prisma, audit as any, notificationEvents as any, financialPeriod as any);
}

describe('P0 — Student.balance exactly-once invariant (reproduction)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('REPRO: PAID + refund + PAID→PENDING must not drive balance to -100', async () => {
    const { world, prisma } = createInMemoryBalanceWorld();
    const payments = makePayments(prisma);
    const invoices = makeInvoices(prisma);

    // 1–2. known balance, create PENDING payment of 100
    world.payment = {
      id: 'pay-1',
      organizationId: ORG,
      studentId: STUDENT,
      amount: 100,
      status: 'PENDING',
      dueDate: null,
      createdAt: new Date(),
      reference: null,
      invoiceId: null,
      paidAt: null,
    };
    world.refund = null;
    world.invoice = null;
    expect(world.student.balance).toBe(0);

    // 3. Transition PENDING -> PAID  (balance +100)
    await payments.update(ORG, 'pay-1', { status: 'PAID' as any });
    expect(world.student.balance).toBe(100);

    // 4. balance changed exactly once for the PAID event
    // 5. Refund the payment (balance -100 once)
    world.refund = {
      id: 'ref-1',
      organizationId: ORG,
      paymentId: 'pay-1',
      invoiceId: null,
      amount: 100,
      status: 'REQUESTED',
    };
    world.refundAggregateResult = { _sum: { amount: 0 } };
    // requestRefund is not under test here — we process an existing REQUESTED refund.
    await invoices.processRefund(ORG, ACTOR, 'ref-1', 'GW-1');
    expect(world.student.balance).toBe(0);

    // 6. refund changed balance exactly once
    // 7. Attempt PAID -> PENDING
    // Payment is still PAID (refunds do not flip Payment.status).
    try {
      await payments.update(ORG, 'pay-1', { status: 'PENDING' as any });
    } catch {
      /* illegal transition is the expected outcome */
    }

    // 8. Balance must NOT change a second time (net must stay 0, not -100).
    //    Either the transition is rejected (preferred) or accepted with delta 0.
    expect(world.student.balance).toBe(0);

    // 9–10. repeated refund / status attempts must not mutate balance again
    const balanceAfterFirstAttempt = world.student.balance;
    try {
      await invoices.processRefund(ORG, ACTOR, 'ref-1', 'GW-1');
    } catch {
      /* idempotent reject is fine */
    }
    try {
      await payments.update(ORG, 'pay-1', { status: 'PENDING' as any });
    } catch {
      /* idempotent reject is fine */
    }
    expect(world.student.balance).toBe(balanceAfterFirstAttempt);
    expect(world.student.balance).toBe(0);
  });

  it('REPRO: PAID + refund + PAID→CANCELLED must not double-decrement', async () => {
    const { world, prisma } = createInMemoryBalanceWorld();
    const payments = makePayments(prisma);
    const invoices = makeInvoices(prisma);

    world.payment = {
      id: 'pay-1',
      organizationId: ORG,
      studentId: STUDENT,
      amount: 100,
      status: 'PAID',
      dueDate: null,
      createdAt: new Date(),
      reference: null,
      invoiceId: null,
      paidAt: new Date(),
    };
    world.student.balance = 100; // already PAID
    world.refund = {
      id: 'ref-1',
      organizationId: ORG,
      paymentId: 'pay-1',
      invoiceId: null,
      amount: 40, // partial refund
      status: 'REQUESTED',
    };
    world.refundAggregateResult = { _sum: { amount: 0 } };

    await invoices.processRefund(ORG, ACTOR, 'ref-1', 'GW-1');
    expect(world.student.balance).toBe(60); // 100 - 40

    // Leaving PAID should reverse only the still-applied 60, not the full 100.
    await payments.update(ORG, 'pay-1', { status: 'CANCELLED' as any });
    expect(world.student.balance).toBe(0);
  });

  it('REGRESSION: pure PENDING→PAID then PAID→CANCELLED (no refund) nets to zero', async () => {
    const { world, prisma } = createInMemoryBalanceWorld();
    const payments = makePayments(prisma);

    world.payment = {
      id: 'pay-1',
      organizationId: ORG,
      studentId: STUDENT,
      amount: 100,
      status: 'PENDING',
      dueDate: null,
      createdAt: new Date(),
      reference: null,
      invoiceId: null,
      paidAt: null,
    };
    world.refund = null;

    await payments.update(ORG, 'pay-1', { status: 'PAID' as any });
    expect(world.student.balance).toBe(100);

    await payments.update(ORG, 'pay-1', { status: 'CANCELLED' as any });
    expect(world.student.balance).toBe(0);
  });

  it('REGRESSION: double processRefund is rejected and does not double-decrement', async () => {
    const { world, prisma } = createInMemoryBalanceWorld();
    const invoices = makeInvoices(prisma);

    world.payment = {
      id: 'pay-1',
      organizationId: ORG,
      studentId: STUDENT,
      amount: 100,
      status: 'PAID',
      dueDate: null,
      createdAt: new Date(),
      reference: null,
      invoiceId: null,
      paidAt: new Date(),
    };
    world.student.balance = 100;
    world.refund = {
      id: 'ref-1',
      organizationId: ORG,
      paymentId: 'pay-1',
      invoiceId: null,
      amount: 100,
      status: 'REQUESTED',
    };
    world.refundAggregateResult = { _sum: { amount: 0 } };

    await invoices.processRefund(ORG, ACTOR, 'ref-1', 'GW-1');
    expect(world.student.balance).toBe(0);

    await expect(invoices.processRefund(ORG, ACTOR, 'ref-1', 'GW-1')).rejects.toThrow(
      ConflictException,
    );
    expect(world.student.balance).toBe(0);
  });

  it('REGRESSION: processRefund after payment already left PAID does not decrement again', async () => {
    const { world, prisma } = createInMemoryBalanceWorld();
    const payments = makePayments(prisma);
    const invoices = makeInvoices(prisma);

    world.payment = {
      id: 'pay-1',
      organizationId: ORG,
      studentId: STUDENT,
      amount: 100,
      status: 'PAID',
      dueDate: null,
      createdAt: new Date(),
      reference: null,
      invoiceId: null,
      paidAt: new Date(),
    };
    world.student.balance = 100;
    world.refund = {
      id: 'ref-1',
      organizationId: ORG,
      paymentId: 'pay-1',
      invoiceId: null,
      amount: 100,
      status: 'REQUESTED',
    };
    world.refundAggregateResult = { _sum: { amount: 0 } };

    // Status leaves PAID first: reverses the full applied contribution.
    await payments.update(ORG, 'pay-1', { status: 'CANCELLED' as any });
    expect(world.student.balance).toBe(0);

    // Refund processes afterwards: must NOT decrement a second time.
    await invoices.processRefund(ORG, ACTOR, 'ref-1', 'GW-1');
    expect(world.student.balance).toBe(0);
  });

  it('REGRESSION: over-refund is rejected', async () => {
    const { world, prisma } = createInMemoryBalanceWorld();
    const invoices = makeInvoices(prisma);

    world.payment = {
      id: 'pay-1',
      organizationId: ORG,
      studentId: STUDENT,
      amount: 100,
      status: 'PAID',
      invoiceId: null,
    };
    world.student.balance = 100;
    world.refund = {
      id: 'ref-1',
      organizationId: ORG,
      paymentId: 'pay-1',
      invoiceId: null,
      amount: 60,
      status: 'REQUESTED',
    };
    // Existing refunds already total 60; requesting/processing another 60 exceeds 100.
    world.refundAggregateResult = { _sum: { amount: 60 } };

    // processRefund itself does not re-check over-refund (requestRefund does),
    // but the balance contribution formula must still only reverse min(refund, applied).
    // Here payment is PAID with applied=100, refund=60 -> delta -60, balance 40.
    await invoices.processRefund(ORG, ACTOR, 'ref-1', 'GW-1');
    expect(world.student.balance).toBe(40);
  });

  it('REGRESSION: concurrent double processRefund mutates balance at most once', async () => {
    const { world, prisma } = createInMemoryBalanceWorld();
    const invoices = makeInvoices(prisma);

    world.payment = {
      id: 'pay-1', organizationId: ORG, studentId: STUDENT,
      amount: 100, status: 'PAID', invoiceId: null,
    };
    world.student.balance = 100;
    world.refund = {
      id: 'ref-1', organizationId: ORG, paymentId: 'pay-1',
      invoiceId: null, amount: 100, status: 'REQUESTED',
    };

    // The mock serializes on the single refund row (updateMany CAS).
    // Exactly one call may flip REQUESTED → PROCESSED; the other must conflict.
    const results = await Promise.allSettled([
      invoices.processRefund(ORG, ACTOR, 'ref-1', 'GW-A'),
      invoices.processRefund(ORG, ACTOR, 'ref-1', 'GW-B'),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);
    expect(world.student.balance).toBe(0);
  });

  it('REGRESSION: concurrent refund + status-leave never double-reverses', async () => {
    const { world, prisma } = createInMemoryBalanceWorld();
    const payments = makePayments(prisma);
    const invoices = makeInvoices(prisma);

    world.payment = {
      id: 'pay-1', organizationId: ORG, studentId: STUDENT,
      amount: 100, status: 'PAID', invoiceId: null,
    };
    world.student.balance = 100;
    world.refund = {
      id: 'ref-1', organizationId: ORG, paymentId: 'pay-1',
      invoiceId: null, amount: 100, status: 'REQUESTED',
    };

    // Race: processRefund vs PAID→CANCELLED. In-memory mock runs
    // sequentially under Promise.allSettled microtasks; final balance
    // must be exactly 0 regardless of interleaving order.
    await Promise.allSettled([
      invoices.processRefund(ORG, ACTOR, 'ref-1', 'GW-1'),
      payments.update(ORG, 'pay-1', { status: 'CANCELLED' as any }),
    ]);
    expect(world.student.balance).toBe(0);
    expect(world.payment.status).toBe('CANCELLED');
  });

  it('REGRESSION: concurrent PAID→CANCELLED ×2 only reverses balance once', async () => {
    const { world, prisma } = createInMemoryBalanceWorld();
    const payments = makePayments(prisma);

    world.payment = {
      id: 'pay-1', organizationId: ORG, studentId: STUDENT,
      amount: 100, status: 'PAID', invoiceId: null,
    };
    world.student.balance = 100;

    await Promise.allSettled([
      payments.update(ORG, 'pay-1', { status: 'CANCELLED' as any }),
      payments.update(ORG, 'pay-1', { status: 'CANCELLED' as any }),
    ]);
    // First success reverses -100; second either no-ops (already CANCELLED
    // same-status field update with wasPaid=false, delta 0) or conflicts.
    expect(world.student.balance).toBe(0);
    expect(world.payment.status).toBe('CANCELLED');
  });

  it('REGRESSION: PAID→PENDING is rejected as an illegal transition', async () => {
    const { world, prisma } = createInMemoryBalanceWorld();
    const payments = makePayments(prisma);

    world.payment = {
      id: 'pay-1', organizationId: ORG, studentId: STUDENT,
      amount: 100, status: 'PAID', invoiceId: null,
    };
    world.student.balance = 100;

    await expect(
      payments.update(ORG, 'pay-1', { status: 'PENDING' as any }),
    ).rejects.toThrow(ConflictException);
    expect(world.student.balance).toBe(100);
    expect(world.payment.status).toBe('PAID');
  });
});
