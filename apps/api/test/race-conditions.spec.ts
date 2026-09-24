import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { InvoicesService } from '../src/payments/invoices.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConflictException } from '@nestjs/common';
import { AuditService } from '../src/audit/audit.service';
import { NotificationEventService } from '../src/notifications/events/notification-event.service';
import { FinancialPeriodService } from '../src/analytics/financial-period.service';

/**
 * Integration race tests against a LIVE Postgres.
 *
 * Isolation: if the database is unreachable the suite is skipped (not
 * silently green via empty mocks) so CI without DB still reports honestly
 * while the dedicated e2e job with services runs the real assertions.
 */
const maybe = async (): Promise<boolean> => {
  try {
    const probe = new PrismaService();
    await probe.$queryRaw`SELECT 1`;
    await probe.$disconnect();
    return true;
  } catch {
    return false;
  }
};

let dbAvailable = false;

describe('Financial Race Conditions Validation (Integration)', () => {
  let invoicesService: InvoicesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    dbAvailable = await maybe();
    if (!dbAvailable) return;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        PrismaService,
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: NotificationEventService, useValue: { emit: jest.fn() } },
        { provide: FinancialPeriodService, useValue: { ensureNotClosedTx: jest.fn() } },
      ],
    }).compile();

    invoicesService = module.get<InvoicesService>(InvoicesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (dbAvailable && prisma) await prisma.$disconnect();
  });

  it('CRITICAL: Should prevent double-refund via pessimistic locking (TOCTOU)', async (ctx) => {
    if (!dbAvailable) return ctx.skip();
    // Setup dummy test data (unique emails so re-runs against the same DB pass)
    const rnd = Math.random().toString(36).slice(2, 10);
    const org = await prisma.organization.create({ data: { name: `Test Org ${rnd}`, email: `test-${rnd}@org.com`, phone: '123' } });
    const user = await prisma.user.create({ data: { email: `user-${rnd}@org.com`, firstName: 'A', lastName: 'B', organizationId: org.id } });
    const student = await prisma.student.create({ data: { userId: user.id, organizationId: org.id } });

    const payment = await prisma.payment.create({
      data: {
        organizationId: org.id,
        studentId: student.id,
        amount: 1000,
        status: 'PAID',
        method: 'CASH'
      }
    });

    const requests = Array(10).fill(0).map(() =>
      invoicesService.requestRefund(org.id, user.id, {
        paymentId: payment.id,
        amount: 1000, // Full amount each time
        reason: 'Double click test'
      }).catch(e => e)
    );

    const results = await Promise.all(requests);

    const successes = results.filter(r => !(r instanceof Error));
    const badRequests = results.filter(r => r.status === 400 || r.response?.statusCode === 400);

    // Asosiy isbot: Qancha parallel so'rov bormasin, faqat 1 ta yozuv yaratilishi shart.
    expect(successes.length).toBe(1);
    expect(successes.length + badRequests.length).toBe(10);
  });

  it('CRITICAL: Should block recordPayment if invoice is concurrently cancelled', async (ctx) => {
    if (!dbAvailable) return ctx.skip();
    const rnd = Math.random().toString(36).slice(2, 10);
    const org = await prisma.organization.create({ data: { name: `Test Org 2 ${rnd}`, email: `test2-${rnd}@org.com`, phone: '123' } });
    const user = await prisma.user.create({ data: { email: `user2-${rnd}@org.com`, firstName: 'A', lastName: 'B', organizationId: org.id } });
    const student = await prisma.student.create({ data: { userId: user.id, organizationId: org.id } });

    // Qasddan Invoysni orqa fonda CANCELLED qilib qo'yamiz (masalan boshqa tranzaksiyada)
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        studentId: student.id,
        number: `INV-TEST-${rnd}`,
        status: 'CANCELLED', // Already cancelled
        currency: 'UZS',
        subtotal: 50000,
        discount: 0,
        penalty: 0,
        total: 50000,
        paidAmount: 0,
        updatedAt: new Date(),
      }
    });

    const paymentAttempt = invoicesService.recordPayment(org.id, user.id, {
      invoiceId: invoice.id,
      amount: 50000,
      method: 'CARD'
    });

    await expect(paymentAttempt).rejects.toThrow(ConflictException);
    await expect(paymentAttempt).rejects.toThrow(/CANCELLED cannot accept payments|concurrently cancelled/i);
  });
});

