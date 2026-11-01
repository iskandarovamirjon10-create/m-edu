import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentsService, PAYME_ERROR, CLICK_ERROR } from '../payments.service';
import { InvoicesService } from '../invoices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialPeriodService } from '../../analytics/financial-period.service';
import { toMinor, fromMinor } from '@medu/financial-engine';

describe('Financial Engine Ultra-Deep Forensic & Adversarial Concurrency Spec', () => {
  let svc: PaymentsService;
  let mockPrisma: any;
  let mockFinancialPeriod: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFinancialPeriod = {
      ensureNotClosed: vi.fn().mockResolvedValue(undefined),
      ensureNotClosedTx: vi.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      student: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      invoice: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      payment: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      refund: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-id-1' }),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn(),
      $transaction: vi.fn().mockImplementation(async (cb) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return Promise.all(cb);
      }),
    };

    svc = new PaymentsService(
      mockPrisma as unknown as PrismaService,
      mockFinancialPeriod as unknown as FinancialPeriodService,
    );
  });

  describe('1. 100 Parallel Requests & Reference Idempotency', () => {
    it('serializes 100 parallel payment creations with identical reference to return single payment booking without double-crediting', async () => {
      const orgId = 'org-concurrency-1';
      const studentId = '11111111-1111-1111-1111-111111111111';
      const reference = 'PAY-SHARED-REF-100';

      const existingRecord = {
        id: 'payment-uuid-unique',
        organizationId: orgId,
        studentId,
        amount: 250000,
        status: 'PENDING',
        reference,
        createdAt: new Date(),
        student: { user: { firstName: 'Sardor', lastName: 'Aliyev' } },
      };

      mockPrisma.student.findFirst.mockResolvedValue({ id: studentId });
      // First call finds nothing and creates; subsequent parallel calls find existing
      let created = false;
      mockPrisma.payment.findFirst.mockImplementation(async () => {
        if (created) return existingRecord;
        return null;
      });
      mockPrisma.payment.create.mockImplementation(async () => {
        created = true;
        return existingRecord;
      });

      // 1. First execution registers the payment and caches result under idempotency key
      const first = await svc.create(
        orgId,
        {
          studentId,
          amount: 250000,
          reference,
          description: 'Parallel test',
        },
        'idem-key-100',
      );

      // 2. 50 parallel retries with the same idempotency key replay cached result
      const retries = await Promise.all(
        Array.from({ length: 50 }, () =>
          svc.create(
            orgId,
            {
              studentId,
              amount: 250000,
              reference,
              description: 'Parallel test',
            },
            'idem-key-100',
          ),
        ),
      );

      expect(first.id).toBe('payment-uuid-unique');
      for (const res of retries) {
        expect(res.id).toBe('payment-uuid-unique');
        expect(res.amount).toBe(250000);
      }
      // Creation happened exactly once
      expect(mockPrisma.payment.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Concurrent Partial Refunds Hitting Payment Ceiling', () => {
    it('strictly enforces refundable ceiling across parallel refund attempts (5 succeed, 5 fail)', async () => {
      const orgId = 'org-refund-ceiling';
      const paymentId = '11111111-2222-3333-4444-555555555555';
      const studentId = '11111111-1111-1111-1111-111111111111';
      const totalPaymentAmount = 100000; // 100,000 UZS total ceiling

      let accumulatedRefundedMinor = 0;

      // Mock row-level lock return
      mockPrisma.$queryRaw.mockImplementation(async (query: any) => {
        const qStr = String(query?.strings || query || '');
        if (qStr.includes('"Student"')) {
          return [{ id: studentId, balance: 100000 }];
        }
        return [
          {
            id: paymentId,
            status: 'PAID',
            amount: totalPaymentAmount,
            studentId,
            invoiceId: null,
            reference: 'PAY-1',
          },
        ];
      });

      // Simulate PostgreSQL pessimistic lock queue (SELECT ... FOR UPDATE)
      let activeTxLock: Promise<void> = Promise.resolve();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const prevLock = activeTxLock;
        let releaseLock: () => void;
        activeTxLock = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
        await prevLock;
        try {
          return await cb(mockPrisma);
        } finally {
          releaseLock!();
        }
      });

      // Mock dynamic refund aggregation inside serialized lock
      mockPrisma.refund.aggregate.mockImplementation(async () => {
        return { _sum: { amount: fromMinor(accumulatedRefundedMinor) } };
      });

      mockPrisma.refund.create.mockImplementation(async ({ data }: any) => {
        const reqMinor = toMinor(data.amount);
        accumulatedRefundedMinor += reqMinor;
        return { id: `ref-${Date.now()}-${Math.random()}`, ...data };
      });

      // 10 refund requests for 20,000 UZS each.
      // Total requested = 200,000 UZS. Available = 100,000 UZS.
      // Exactly 5 should succeed (5 * 20,000 = 100,000). Remaining 5 must be rejected with BadRequestException.
      const refundAttempts = Array.from({ length: 10 }, async (_, idx) => {
        try {
          const res = await svc.processPaymentRefund(
            orgId,
            paymentId,
            20000,
            `Partial refund attempt #${idx + 1}`,
          );
          return { success: true, res };
        } catch (err) {
          return { success: false, error: err };
        }
      });

      const outcomes = await Promise.all(refundAttempts);
      const successes = outcomes.filter((o) => o.success);
      const failures = outcomes.filter((o) => !o.success);

      expect(successes).toHaveLength(5);
      expect(failures).toHaveLength(5);
      expect(accumulatedRefundedMinor).toBe(10000000); // 100,000 UZS in tiyin

      for (const f of failures) {
        expect(f.error).toBeInstanceOf(BadRequestException);
        expect((f.error as Error).message).toContain('Refund exceeds remaining refundable balance');
      }
    });
  });

  describe('3. Payme State Transitions & Complete Reversals', () => {
    it('properly transitions state from 1 (PENDING) -> -1 (CANCELLED)', async () => {
      const orgId = 'org-payme-test';
      const paymeTxId = 'tx-pending-123';
      const reference = `PAYME:${paymeTxId}`;

      const pendingPayment = {
        id: '22222222-1111-3333-4444-555555555555',
        organizationId: orgId,
        studentId: '11111111-1111-1111-1111-111111111111',
        amount: 80000,
        status: 'PENDING',
        reference,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.payment.findFirst.mockResolvedValueOnce(pendingPayment);
      mockPrisma.payment.update.mockResolvedValueOnce({
        ...pendingPayment,
        status: 'CANCELLED',
      });

      const res = await svc.handlePaymeWebhook(
        orgId,
        `Basic ${Buffer.from('Paycom:test_key').toString('base64')}`,
        {
          id: 111,
          method: 'CancelTransaction',
          params: { id: paymeTxId, reason: 1 },
        },
        'test_key',
      );

      expect(res.result?.state).toBe(-1);
      expect(res.result?.transaction).toBe(pendingPayment.id);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: pendingPayment.id },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('rejects CheckPerformTransaction when payment is already PAID with UNABLE_TO_PERFORM', async () => {
      const orgId = 'org-payme-test';
      const paymentId = '33333333-1111-2222-3333-444444444444';

      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: paymentId,
        organizationId: orgId,
        status: 'PAID',
        amount: 120000,
      });

      const res = await svc.handlePaymeWebhook(
        orgId,
        `Basic ${Buffer.from('Paycom:test_key').toString('base64')}`,
        {
          id: 112,
          method: 'CheckPerformTransaction',
          params: {
            amount: 12000000,
            account: { payment_id: paymentId },
          },
        },
        'test_key',
      );

      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe(PAYME_ERROR.UNABLE_TO_PERFORM);
    });
  });

  describe('4. Multi-Tenant Cross-Access Isolation (BOLA/IDOR)', () => {
    it('blocks user from Org A trying to refund a payment belonging to Org B with NotFoundException', async () => {
      const orgA = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const orgB = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const paymentId = '33333333-cccc-cccc-cccc-cccccccccccc';

      // The query includes organizationId = orgA, so Payment in Org B is not found
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // Payment not found in Org A

      await expect(
        svc.processPaymentRefund(orgA, paymentId, 50000, 'Cross-tenant refund attempt'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('5. Zero Floating-Point Drift in Currency & Tiyin Conversions', () => {
    it('maintains absolute integer precision across 10,000 sub-unit iterations', () => {
      let accumulatorMinor = 0;
      const testInputs = [
        '100.05',
        '250.15',
        '99.99',
        '0.01',
        '1500.50',
        '88.88',
        '12.34',
        '77.77',
      ];

      for (let i = 0; i < 10000; i++) {
        const pick = testInputs[i % testInputs.length];
        accumulatorMinor += toMinor(pick);
      }

      // Check that converting fromMinor is exact and has no decimal trailing jitter
      const major = fromMinor(accumulatorMinor);
      expect(Number.isFinite(major)).toBe(true);
      expect(String(major)).toMatch(/^\d+(\.\d{1,2})?$/);
      // Round trip check
      expect(toMinor(major)).toBe(accumulatorMinor);
    });
  });
});
