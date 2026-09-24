import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinancialCronService } from '../financial-cron.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationEventService } from '../../notifications/events/notification-event.service';

function createMockPrisma() {
  return {
    invoice: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    payment: {
      updateMany: vi.fn(),
    },
  };
}

function createMockNotificationEvents(): { emit: ReturnType<typeof vi.fn> } {
  return { emit: vi.fn().mockResolvedValue(undefined) };
}

describe('FinancialCronService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let notificationEvents: ReturnType<typeof createMockNotificationEvents>;
  let svc: FinancialCronService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    notificationEvents = createMockNotificationEvents();
    svc = new FinancialCronService(
      prisma as unknown as PrismaService,
      notificationEvents as unknown as NotificationEventService,
    );
  });

  it('marks ISSUED invoices past due date as OVERDUE', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.updateMany.mockResolvedValue({ count: 2 });
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });

    await svc.markOverdueInvoices();

    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: expect.objectContaining({ lt: expect.any(Date) }),
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        }),
        data: { status: 'OVERDUE' },
      }),
    );
  });

  it('marks PENDING payments past due date as OVERDUE', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.updateMany.mockResolvedValue({ count: 0 });
    prisma.payment.updateMany.mockResolvedValue({ count: 3 });

    await svc.markOverdueInvoices();

    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: expect.objectContaining({ lt: expect.any(Date) }),
          status: 'PENDING',
        }),
        data: { status: 'OVERDUE' },
      }),
    );
  });

  it('emits PAYMENT_OVERDUE notification for each overdue invoice', async () => {
    const overdueInvoices = [
      {
        id: 'inv-1',
        organizationId: 'org-1',
        studentId: 'stu-1',
        total: 100000,
        paidAmount: 30000,
        dueDate: new Date('2026-09-01'),
        student: { user: { firstName: 'Ali', lastName: 'Valiyev' } },
      },
      {
        id: 'inv-2',
        organizationId: 'org-1',
        studentId: 'stu-2',
        total: 50000,
        paidAmount: 0,
        dueDate: new Date('2026-09-10'),
        student: { user: { firstName: 'Dilnoza', lastName: 'Karimova' } },
      },
    ];

    prisma.invoice.findMany.mockResolvedValue(overdueInvoices);
    prisma.invoice.updateMany.mockResolvedValue({ count: 2 });
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });

    await svc.markOverdueInvoices();

    expect(notificationEvents.emit).toHaveBeenCalledTimes(2);
    expect(notificationEvents.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PAYMENT_OVERDUE',
        entityType: 'Invoice',
        entityId: 'inv-1',
        data: expect.objectContaining({
          studentId: 'stu-1',
          studentName: 'Ali Valiyev',
          amount: 70000,
        }),
      }),
    );
    expect(notificationEvents.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PAYMENT_OVERDUE',
        entityId: 'inv-2',
        data: expect.objectContaining({
          studentId: 'stu-2',
          studentName: 'Dilnoza Karimova',
          amount: 50000,
        }),
      }),
    );
  });

  it('is idempotent — does not re-mark already OVERDUE invoices', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.updateMany.mockResolvedValue({ count: 0 });
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });

    await svc.markOverdueInvoices();

    // The WHERE clause excludes OVERDUE status, so count=0 means nothing changed
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        }),
      }),
    );
  });

  it('does not touch PAID or CANCELLED invoices', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.updateMany.mockResolvedValue({ count: 0 });
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });

    await svc.markOverdueInvoices();

    const whereClause = prisma.invoice.updateMany.mock.calls[0][0].where;
    expect(whereClause.status.in).not.toContain('PAID');
    expect(whereClause.status.in).not.toContain('CANCELLED');
  });

  it('catches and logs errors without crashing the process', async () => {
    prisma.invoice.findMany.mockRejectedValue(new Error('DB connection lost'));

    // Should NOT throw — the cron must be resilient
    await expect(svc.markOverdueInvoices()).resolves.toBeUndefined();
  });

  it('continues notification emission even if one notification fails (Promise.allSettled)', async () => {
    const overdueInvoices = [
      {
        id: 'inv-1',
        organizationId: 'org-1',
        studentId: 'stu-1',
        total: 100000,
        paidAmount: 0,
        dueDate: new Date('2026-09-01'),
        student: { user: { firstName: 'A', lastName: 'B' } },
      },
      {
        id: 'inv-2',
        organizationId: 'org-1',
        studentId: 'stu-2',
        total: 50000,
        paidAmount: 0,
        dueDate: new Date('2026-09-05'),
        student: { user: { firstName: 'C', lastName: 'D' } },
      },
    ];

    prisma.invoice.findMany.mockResolvedValue(overdueInvoices);
    prisma.invoice.updateMany.mockResolvedValue({ count: 2 });
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });

    // First notification fails, second succeeds
    notificationEvents.emit
      .mockRejectedValueOnce(new Error('SMS gateway down'))
      .mockResolvedValueOnce(undefined);

    // Should NOT throw — Promise.allSettled handles individual failures
    await expect(svc.markOverdueInvoices()).resolves.toBeUndefined();

    // Both were attempted despite the first failure
    expect(notificationEvents.emit).toHaveBeenCalledTimes(2);
  });

  it('computes remaining amount correctly (total - paidAmount, floored at 0)', async () => {
    const overdueInvoice = {
      id: 'inv-overpaid',
      organizationId: 'org-1',
      studentId: 'stu-1',
      total: 100,
      paidAmount: 150, // edge case: paidAmount > total
      dueDate: new Date('2026-09-01'),
      student: { user: { firstName: 'X', lastName: 'Y' } },
    };

    prisma.invoice.findMany.mockResolvedValue([overdueInvoice]);
    prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });

    await svc.markOverdueInvoices();

    expect(notificationEvents.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 0, // Math.max(0, remaining) floors negative to 0
        }),
      }),
    );
  });
});
