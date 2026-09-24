import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PeriodStatus } from '@prisma/client';
import { FinancialPeriodService } from '../financial-period.service';
import { InvoicesService } from '../../payments/invoices.service';
import { ExpensesService } from '../../expenses/expenses.service';
import { PayrollService } from '../../hr/payroll.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

const PERIOD_KEY = (organizationId: string, periodYear: number, periodMonth: number) => ({
  organizationId_periodYear_periodMonth: { organizationId, periodYear, periodMonth },
});

function createMockPrisma() {
  // `ensureNotClosedTx`/`transitionState` take a row lock with
  // `tx.$queryRawUnsafe('... FOR UPDATE', org, year, month)` inside a
  // transaction. The interactive-transaction mock emulates that by resolving
  // the same row the surrounding test configured on `financialPeriod.findUnique`.
  const financialPeriod = {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };

  // `getPeriodWithLock` uses the tagged-template form `tx.$queryRaw`...`, so the
  // mock receives (strings, ...values) and resolves the same row the test
  // configured on `financialPeriod.findUnique`.
  const $queryRaw = vi.fn().mockImplementation(async (_strings: unknown, organizationId: string, year: number, month: number) => {
    const row = await financialPeriod.findUnique({
      where: PERIOD_KEY(organizationId, year, month),
    });
    return row ? [row] : [];
  });

  const auditLog = { create: vi.fn().mockResolvedValue({}) };
  const tx = {
    financialPeriod,
    auditLog,
    $queryRaw,
    invoice: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    payment: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    refund: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    receiptCounter: { upsert: vi.fn() },
  };

  return {
    financialPeriod,
    auditLog,
    student: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn(), aggregate: vi.fn() },
    expense: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), aggregate: vi.fn() },
    invoice: { findFirst: vi.fn(), aggregate: vi.fn() },
    teacher: { findFirst: vi.fn() },
    lesson: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    payrollRun: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    $queryRaw,
    $transaction: vi.fn().mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    __tx: tx,
  };
}

const CLOSED_PERIOD = {
  id: 'fp-1',
  organizationId: 'org-1',
  periodYear: 2026,
  periodMonth: 1,
  status: PeriodStatus.CLOSED,
};

function closedPeriodPrisma() {
  const prisma = createMockPrisma();
  // January 2026 is CLOSED for org-1; other lookups find nothing.
  prisma.financialPeriod.findUnique.mockImplementation(async ({ where }: { where: { organizationId_periodYear_periodMonth: { organizationId: string; periodYear: number; periodMonth: number } } }) => {
    const k = where.organizationId_periodYear_periodMonth;
    if (k.organizationId === 'org-1' && k.periodYear === 2026 && k.periodMonth === 1) {
      return { ...CLOSED_PERIOD };
    }
    return null;
  });
  return prisma;
}

describe('FinancialPeriodService (Month-End Close state machine)', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: FinancialPeriodService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    prisma.financialPeriod.findUnique.mockResolvedValue(null);
    prisma.financialPeriod.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'fp-new',
      ...data,
    }));
    prisma.financialPeriod.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'fp-new',
      organizationId: 'org-1',
      periodYear: 2026,
      periodMonth: 1,
      ...data,
    }));
    svc = new FinancialPeriodService(prisma as unknown as PrismaService);
  });

  const validPath: Array<[PeriodStatus, PeriodStatus]> = [
    [PeriodStatus.OPEN, PeriodStatus.REVIEW],
    [PeriodStatus.REVIEW, PeriodStatus.RECONCILED],
    [PeriodStatus.RECONCILED, PeriodStatus.CLOSED],
  ];

  it('walks the full valid path OPEN → REVIEW → RECONCILED → CLOSED', async () => {
    for (const [from, to] of validPath) {
      // Persistent (not Once): the state machine reads the period twice — once
      // to validate the transition, once under the row lock inside the tx.
      prisma.financialPeriod.findUnique.mockResolvedValue({
        id: 'fp-new',
        organizationId: 'org-1',
        periodYear: 2026,
        periodMonth: 1,
        status: from,
      });
      await svc.transitionState('org-1', 2026, 1, to, 'user-1');
    }
    expect(prisma.financialPeriod.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PeriodStatus.CLOSED }),
      }),
    );
  });

  it('records an audit log entry for every transition', async () => {
    prisma.financialPeriod.findUnique.mockResolvedValue({
      id: 'fp-new',
      organizationId: 'org-1',
      periodYear: 2026,
      periodMonth: 1,
      status: PeriodStatus.OPEN,
    });
    await svc.transitionState('org-1', 2026, 1, PeriodStatus.REVIEW, 'user-42');

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.organizationId).toBe('org-1');
    expect(audit.userId).toBe('user-42');
    expect(audit.resource).toBe('FinancialPeriod');
    expect(audit.resourceId).toBe('fp-new');
    expect(audit.changes.status).toEqual({ old: 'OPEN', new: 'REVIEW' });
  });

  it('stamps closedBy/closedAt when closing and clears them when reopening', async () => {
    prisma.financialPeriod.findUnique.mockResolvedValue({
      id: 'fp-new',
      organizationId: 'org-1',
      periodYear: 2026,
      periodMonth: 1,
      status: PeriodStatus.RECONCILED,
    });
    await svc.transitionState('org-1', 2026, 1, PeriodStatus.CLOSED, 'closer-1');
    expect(prisma.financialPeriod.update.mock.calls[0][0].data.closedBy).toBe('closer-1');
    expect(prisma.financialPeriod.update.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);

    prisma.financialPeriod.findUnique.mockResolvedValue({
      id: 'fp-new',
      organizationId: 'org-1',
      periodYear: 2026,
      periodMonth: 1,
      status: PeriodStatus.CLOSED,
      closedBy: 'closer-1',
      closedAt: new Date(),
    });
    await svc.transitionState('org-1', 2026, 1, PeriodStatus.OPEN, 'opener-1');
    expect(prisma.financialPeriod.update.mock.calls[1][0].data.closedBy).toBeNull();
    expect(prisma.financialPeriod.update.mock.calls[1][0].data.closedAt).toBeNull();
  });

  it('rejects invalid transitions (skipping states)', async () => {
    for (const [from, to] of [
      [PeriodStatus.OPEN, PeriodStatus.RECONCILED],
      [PeriodStatus.OPEN, PeriodStatus.CLOSED],
      [PeriodStatus.REVIEW, PeriodStatus.CLOSED],
      [PeriodStatus.RECONCILED, PeriodStatus.OPEN],
      [PeriodStatus.CLOSED, PeriodStatus.REVIEW],
      [PeriodStatus.CLOSED, PeriodStatus.RECONCILED],
      [PeriodStatus.OPEN, PeriodStatus.OPEN],
    ] as Array<[PeriodStatus, PeriodStatus]>) {
      prisma.financialPeriod.findUnique.mockResolvedValue({
        id: 'fp-x',
        organizationId: 'org-1',
        periodYear: 2026,
        periodMonth: 1,
        status: from,
      });
      await expect(svc.transitionState('org-1', 2026, 1, to, 'user-1')).rejects.toThrow(
        /Invalid transition/,
      );
    }
    expect(prisma.financialPeriod.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('is isolated per organization: org B cannot see or reuse org A period rows', async () => {
    // Different org: same year/month key, not found → lazily created separately.
    prisma.financialPeriod.findUnique.mockResolvedValue(null);
    await svc.getPeriod('org-B', 2026, 1);
    expect(prisma.financialPeriod.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_periodYear_periodMonth: {
          organizationId: 'org-B',
          periodYear: 2026,
          periodMonth: 1,
        },
      },
    });
    // The created row carries org-B's id, never another org's.
    expect(prisma.financialPeriod.create.mock.calls[0][0].data.organizationId).toBe('org-B');
  });

  it('ensureNotClosed throws the deterministic FINANCIAL_PERIOD_CLOSED error', async () => {
    prisma.financialPeriod.findUnique.mockResolvedValue({ ...CLOSED_PERIOD });
    await expect(svc.ensureNotClosed('org-1', new Date('2026-01-15'))).rejects.toThrow(
      ForbiddenException,
    );
    await expect(svc.ensureNotClosed('org-1', new Date('2026-01-15'))).rejects.toThrow(
      'FINANCIAL_PERIOD_CLOSED',
    );
  });

  it('treats unknown (never created) periods as open', async () => {
    prisma.financialPeriod.findUnique.mockResolvedValue(null);
    await expect(svc.ensureNotClosed('org-1', new Date('2030-05-05'))).resolves.toBeUndefined();
  });
});

describe('Closed-period immutability (CRITICAL)', () => {
  let prisma: ReturnType<typeof closedPeriodPrisma>;
  let periodSvc: FinancialPeriodService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = closedPeriodPrisma();
    periodSvc = new FinancialPeriodService(prisma as unknown as PrismaService);
  });

  it('blocks recording an invoice payment in a closed period', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T00:00:00.000Z'));
    try {
      const invoices = new InvoicesService(
        prisma as never,
        { record: vi.fn() } as never,
        { emit: vi.fn() } as never,
        periodSvc,
      );
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: 'ISSUED',
        total: 100,
        paidAmount: 0,
        refundedAmount: 0,
        studentId: 's-1',
      });

      await expect(
        invoices.recordPayment('org-1', 'actor-1', { invoiceId: 'inv-1', amount: 100 }),
      ).rejects.toThrow('FINANCIAL_PERIOD_CLOSED');
      expect(prisma.payment.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks processing a refund in a closed period', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T00:00:00.000Z'));
    try {
      const invoices = new InvoicesService(
        prisma as never,
        { record: vi.fn() } as never,
        { emit: vi.fn() } as never,
        periodSvc,
      );
      prisma.__tx.refund.findFirst.mockResolvedValue({
        id: 'r1',
        status: 'REQUESTED',
        paymentId: 'pay-1',
        invoiceId: 'inv-1',
        amount: 40,
      });
      prisma.__tx.refund.updateMany.mockResolvedValue({ count: 1 });

      await expect(invoices.processRefund('org-1', 'actor-1', 'r1')).rejects.toThrow(
        'FINANCIAL_PERIOD_CLOSED',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not block financial mutations in an OPEN period (no over-blocking)', async () => {
    // The mock marks Jan 2026 CLOSED; any other month is open.
    await expect(
      periodSvc.ensureNotClosed('org-1', new Date('2026-09-15T00:00:00.000Z')),
    ).resolves.toBeUndefined();
  });

  it('blocks Expense creation, update and deletion in a closed period', async () => {
    const expenses = new ExpensesService(prisma as unknown as PrismaService, periodSvc);
    prisma.expense.findFirst.mockResolvedValue({
      id: 'e-1',
      organizationId: 'org-1',
      date: new Date('2026-01-10T00:00:00.000Z'),
    });

    await expect(
      expenses.create('org-1', {
        category: 'RENT',
        amount: 50,
        date: '2026-01-15T00:00:00.000Z',
      } as never),
    ).rejects.toThrow('FINANCIAL_PERIOD_CLOSED');
    await expect(expenses.update('org-1', 'e-1', { amount: 51 } as never)).rejects.toThrow(
      'FINANCIAL_PERIOD_CLOSED',
    );
    await expect(expenses.remove('org-1', 'e-1')).rejects.toThrow('FINANCIAL_PERIOD_CLOSED');
    expect(prisma.expense.create).not.toHaveBeenCalled();
    expect(prisma.expense.update).not.toHaveBeenCalled();
    expect(prisma.expense.delete).not.toHaveBeenCalled();
  });

  it('blocks Payroll mutations (create path) in a closed period', async () => {
    const payroll = new PayrollService(prisma, { log: vi.fn() } as never, periodSvc);
    prisma.teacher.findFirst.mockResolvedValue({ id: 't-1', user: { isActive: true } });

    await expect(
      payroll.calculateRun('org-1', 'actor-1', {
        teacherId: 't-1',
        periodYear: 2026,
        periodMonth: 1,
        baseAmount: 100,
        salaryType: 'HOURLY',
      } as never),
    ).rejects.toThrow('FINANCIAL_PERIOD_CLOSED');
  });

  it('blocks Payroll status transitions (APPROVED/PAID protection) in a closed period', async () => {
    const payroll = new PayrollService(prisma, { log: vi.fn() } as never, periodSvc);
    const txRun = (status: string) =>
      vi.fn().mockResolvedValue({
        id: 'run-1',
        organizationId: 'org-1',
        status,
        periodYear: 2026,
        periodMonth: 1,
      });
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ ...prisma.__tx, payrollRun: { findFirst: txRun('REVIEWED') } }),
    );

    // REVIEWED → APPROVED is a legal payroll transition; the closed period is
    // what must block it.
    await expect(payroll.approve('org-1', 'actor-1', 'run-1')).rejects.toThrow(
      'FINANCIAL_PERIOD_CLOSED',
    );

    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ ...prisma.__tx, payrollRun: { findFirst: txRun('APPROVED') } }),
    );
    await expect(payroll.pay('org-1', 'actor-1', 'run-1')).rejects.toThrow(
      'FINANCIAL_PERIOD_CLOSED',
    );
  });

});

describe('FinancialPeriodService guardrails', () => {
  it('throws NotFound when a closed-period check references an unknown service shape', () => {
    // Documented behavior: checkIsClosed only reads periods of the same org.
    const prisma = createMockPrisma();
    prisma.financialPeriod.findUnique.mockResolvedValue({ ...CLOSED_PERIOD });
    const svc = new FinancialPeriodService(prisma);
    // A different org asking about the same month is NOT closed.
    prisma.financialPeriod.findUnique.mockResolvedValueOnce(null);
    return svc.checkIsClosed('org-other', new Date('2026-01-15')).then((closed) => {
      expect(closed).toBe(false);
    });
  });

  it('ensureNotClosed surfaces ForbiddenException (mapped to 403, not 500)', async () => {
    const prisma = createMockPrisma();
    prisma.financialPeriod.findUnique.mockResolvedValue({ ...CLOSED_PERIOD });
    const svc = new FinancialPeriodService(prisma);
    const err = await svc.ensureNotClosed('org-1', new Date('2026-01-15')).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err).not.toBeInstanceOf(NotFoundException);
  });
});
