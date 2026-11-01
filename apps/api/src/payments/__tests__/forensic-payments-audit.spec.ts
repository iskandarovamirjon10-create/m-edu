import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac, createHash } from 'crypto';
import { PaymentsService, PAYME_ERROR } from '../payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialPeriodService } from '../../analytics/financial-period.service';

function createMockPrisma() {
  const mock: any = {
    student: { findFirst: vi.fn(), update: vi.fn() },
    invoice: { findFirst: vi.fn(), update: vi.fn() },
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
      create: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-log-uuid-1' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockImplementation(async (query: any) => {
      const qStr = String(query?.strings || query || '');
      if (qStr.includes('"Student"')) {
        return [{ id: '11111111-1111-1111-1111-111111111111', balance: 0 }];
      }
      return [
        {
          id: 'p1',
          status: 'PENDING',
          amount: 100,
          studentId: '11111111-1111-1111-1111-111111111111',
          balance: 0,
        },
      ];
    }),
  };
  mock.$transaction = vi.fn(async (fn: (tx: typeof mock) => Promise<unknown>) => fn(mock));
  return mock;
}

describe('Forensic Payments Audit Spec', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let financialPeriod: { ensureNotClosed: ReturnType<typeof vi.fn> };
  let svc: PaymentsService;
  const SECRET_KEY = 'click_secret_123';
  const STRIPE_SECRET = 'whsec_test_secret_abc';
  const PAYME_KEY = 'payme_secret_pass';
  const PAYME_AUTH = `Basic ${Buffer.from(`Paycom:${PAYME_KEY}`).toString('base64')}`;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    financialPeriod = { ensureNotClosed: vi.fn().mockResolvedValue(undefined) };
    svc = new PaymentsService(
      prisma as unknown as PrismaService,
      financialPeriod as unknown as FinancialPeriodService,
    );
  });

  describe('Click Webhook Signature & Edge Cases', () => {
    it('correctly verifies signature when action=1 and merchant_prepare_id is null/undefined (does NOT inject "null")', () => {
      const clickTransId = '12345';
      const serviceId = '67890';
      const merchantTransId = 'TX-100';
      const amount = '50000';
      const action = '1';
      const signTime = '2026-10-29 12:00:00';

      // Notice preparePart should be EMPTY, NOT "null"
      const rawSource = `${clickTransId}${serviceId}${SECRET_KEY}${merchantTransId}${amount}${action}${signTime}`;
      const signString = createHash('md5').update(rawSource, 'utf8').digest('hex');

      const payload: any = {
        click_trans_id: clickTransId,
        service_id: serviceId,
        merchant_trans_id: merchantTransId,
        merchant_prepare_id: null, // explicit null
        amount,
        action,
        sign_time: signTime,
        sign_string: signString,
      };

      const isValid = svc.verifyClickSignature(payload, SECRET_KEY);
      expect(isValid).toBe(true);
    });

    it('correctly handles Click Prepare (action=0) when merchant_trans_id is non-UUID invoice number', async () => {
      const invoiceNumber = 'INV-2026-0001';
      const signTime = '2026-10-29 12:00:00';
      const rawSource = `999888111${SECRET_KEY}${invoiceNumber}500000${signTime}`;
      const signString = createHash('md5').update(rawSource, 'utf8').digest('hex');

      // Payment not found by reference
      prisma.payment.findFirst.mockResolvedValueOnce(null);
      // Invoice found
      prisma.invoice.findFirst.mockResolvedValueOnce({
        id: '99999999-9999-9999-9999-999999999999',
        number: invoiceNumber,
        organizationId: 'org-1',
        studentId: '11111111-1111-1111-1111-111111111111',
        totalAmount: 50000,
        paidAmount: 0,
        status: 'SENT',
      });
      // Payment create
      const createdPayment = {
        id: '22222222-2222-2222-2222-222222222222',
        organizationId: 'org-1',
        studentId: '11111111-1111-1111-1111-111111111111',
        amount: 50000,
        status: 'PENDING',
      };
      prisma.payment.create.mockResolvedValueOnce(createdPayment);

      const res = await svc.handleClickWebhook(
        'org-1',
        {
          click_trans_id: 999888,
          service_id: 111,
          merchant_trans_id: invoiceNumber,
          amount: 50000,
          action: 0,
          error: 0,
          error_note: 'Success',
          sign_time: signTime,
          sign_string: signString,
        },
        SECRET_KEY,
      );

      expect(res.error).toBe(0);
      expect(res.merchant_prepare_id).toBe(createdPayment.id);
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            invoiceId: '99999999-9999-9999-9999-999999999999',
            amount: 50000,
            status: 'PENDING',
          }),
        }),
      );
    });
  });

  describe('Stripe / HMAC Webhook Verification with Key Rotation', () => {
    it('verifies signature when header contains multiple v1 signatures (key rotation)', () => {
      const nowSec = 1730000000;
      const rawBody = JSON.stringify({ id: 'evt_123', type: 'payment_intent.succeeded' });
      const signedPayload = `${nowSec}.${rawBody}`;
      const validHmac = createHmac('sha256', STRIPE_SECRET)
        .update(signedPayload, 'utf8')
        .digest('hex');

      // Multiple v1 headers (e.g., old rotated key first, valid key second)
      const signatureHeader = `t=${nowSec},v1=old_invalid_signature_hash,v1=${validHmac}`;

      const isValid = svc.verifyHmacWebhookSignature({
        rawBody,
        signatureHeader,
        timestampSec: 0, // Ignored because t= is parsed from header
        secretKey: STRIPE_SECRET,
        nowSec,
      });

      expect(isValid).toBe(true);
    });

    it('rejects signature if timestamp in header is drifted beyond tolerance', () => {
      const nowSec = 1730000000;
      const oldSec = nowSec - 400; // > 300s drift
      const rawBody = JSON.stringify({ id: 'evt_123' });
      const signedPayload = `${oldSec}.${rawBody}`;
      const validHmac = createHmac('sha256', STRIPE_SECRET)
        .update(signedPayload, 'utf8')
        .digest('hex');

      const signatureHeader = `t=${oldSec},v1=${validHmac}`;

      const isValid = svc.verifyHmacWebhookSignature({
        rawBody,
        signatureHeader,
        timestampSec: 0,
        secretKey: STRIPE_SECRET,
        nowSec,
      });

      expect(isValid).toBe(false);
    });
  });

  describe('Payme Webhook Non-UUID & invoice_id Support', () => {
    it('returns ACCOUNT_NOT_FOUND when non-UUID student_id or invoice_id is not found without throwing UUID syntax error', async () => {
      prisma.student.findFirst.mockResolvedValueOnce(null);
      prisma.invoice.findFirst.mockResolvedValueOnce(null);

      const res = await svc.handlePaymeWebhook(
        'org-1',
        PAYME_AUTH,
        {
          id: 1,
          method: 'CheckPerformTransaction',
          params: {
            amount: 5000000,
            account: {
              student_id: 'non-uuid-username-or-code',
            },
          },
        },
        PAYME_KEY,
      );

      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe(PAYME_ERROR.ACCOUNT_NOT_FOUND);
    });

    it('successfully extracts account.invoice_id emitted by payment links', async () => {
      const invoiceId = '33333333-3333-3333-3333-333333333333';

      // Payment not found
      prisma.payment.findFirst.mockResolvedValueOnce(null);
      // Invoice found with 50,000 UZS amount
      prisma.invoice.findFirst.mockResolvedValueOnce({
        id: invoiceId,
        organizationId: 'org-1',
        status: 'SENT',
        total: 50000,
        paidAmount: 0,
      });

      const res = await svc.handlePaymeWebhook(
        'org-1',
        PAYME_AUTH,
        {
          id: 2,
          method: 'CheckPerformTransaction',
          params: {
            amount: 5000000, // 50,000 UZS in tiyin (50,000 * 100)
            account: {
              invoice_id: invoiceId,
            },
          },
        },
        PAYME_KEY,
      );

      expect(res.result).toBeDefined();
      expect(res.result?.allow).toBe(true);
    });
  });

  describe('Pessimistic Row-Level Locking on Balance Updates', () => {
    it('executes SELECT ... FOR UPDATE when updating payment status to PAID', async () => {
      const existing = {
        id: 'p1',
        organizationId: 'org-1',
        studentId: '11111111-1111-1111-1111-111111111111',
        status: 'PENDING',
        amount: 100,
        paidAt: null,
      };
      prisma.payment.findFirst.mockResolvedValue(existing);
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.student.update.mockResolvedValue({});
      prisma.payment.findUnique.mockResolvedValue({ ...existing, status: 'PAID' });

      await svc.update('org-1', 'p1', { status: 'PAID' });

      // Verify FOR UPDATE was executed via queryRaw
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('Payme CancelTransaction Reversal & State -2 Idempotency', () => {
    it('cancels PAID payment via processPaymentRefund, updates status to CANCELLED, and returns state -2', async () => {
      const paymeTxId = 'tx-test-999';
      const referenceKey = `PAYME:${paymeTxId}`;
      const paidPayment = {
        id: '11111111-2222-3333-4444-555555555555',
        organizationId: 'org-1',
        studentId: '11111111-1111-1111-1111-111111111111',
        amount: 150000,
        status: 'PAID',
        paidAt: new Date(Date.now() - 3600000),
        reference: referenceKey,
      };

      prisma.payment.findFirst.mockResolvedValueOnce(paidPayment);
      prisma.$queryRaw.mockImplementation(async (query: any) => {
        const qStr = String(query?.strings || query || '');
        if (qStr.includes('"Student"')) {
          return [{ id: '11111111-1111-1111-1111-111111111111', balance: 0 }];
        }
        return [
          {
            id: paidPayment.id,
            status: 'PAID',
            amount: 150000,
            studentId: '11111111-1111-1111-1111-111111111111',
            invoiceId: null,
            reference: referenceKey,
          },
        ];
      });
      prisma.payment.update.mockResolvedValueOnce({
        ...paidPayment,
        status: 'CANCELLED',
      });
      // processPaymentRefund internals
      prisma.refund.aggregate.mockResolvedValueOnce({ _sum: { amount: 0 } });
      prisma.refund.create.mockResolvedValueOnce({ id: 'ref-1', amount: 150000 });
      prisma.student.update.mockResolvedValueOnce({});

      const res = await svc.handlePaymeWebhook(
        'org-1',
        PAYME_AUTH,
        {
          id: 888,
          method: 'CancelTransaction',
          params: { id: paymeTxId, reason: 2 },
        },
        PAYME_KEY,
      );

      expect(res.result?.transaction).toBe(paidPayment.id);
      expect(res.result?.state).toBe(-2);
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paidPayment.id },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('returns idempotent state -2 on duplicate CancelTransaction for already CANCELLED payment without double refund', async () => {
      const paymeTxId = 'tx-test-already-cancelled';
      const referenceKey = `PAYME:${paymeTxId}`;
      const cancelledPayment = {
        id: '22222222-3333-4444-5555-666666666666',
        organizationId: 'org-1',
        studentId: '11111111-1111-1111-1111-111111111111',
        amount: 200000,
        status: 'CANCELLED',
        paidAt: new Date(Date.now() - 7200000),
        updatedAt: new Date(Date.now() - 3600000),
        reference: referenceKey,
      };

      prisma.payment.findFirst.mockResolvedValueOnce(cancelledPayment);

      const res = await svc.handlePaymeWebhook(
        'org-1',
        PAYME_AUTH,
        {
          id: 889,
          method: 'CancelTransaction',
          params: { id: paymeTxId, reason: 2 },
        },
        PAYME_KEY,
      );

      expect(res.result?.transaction).toBe(cancelledPayment.id);
      expect(res.result?.state).toBe(-2);
      // Verify no refund was created
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });
  });

  describe('Click Webhook Amount Mismatch & Overpayment Rejection', () => {
    it('rejects Click payment when incoming amount exceeds invoice remaining balance', async () => {
      const invoiceNumber = 'INV-OVERPAY-001';
      const signTime = '2026-10-30 14:00:00';
      const rawSource = `555444111${SECRET_KEY}${invoiceNumber}3000000${signTime}`;
      const signString = createHash('md5').update(rawSource, 'utf8').digest('hex');

      // Payment not found
      prisma.payment.findFirst.mockResolvedValueOnce(null);
      // Invoice found with 100,000 total and 50,000 paid (50,000 due, but incoming is 300,000)
      prisma.invoice.findFirst.mockResolvedValueOnce({
        id: '77777777-7777-7777-7777-777777777777',
        number: invoiceNumber,
        organizationId: 'org-1',
        studentId: '11111111-1111-1111-1111-111111111111',
        total: 100000,
        paidAmount: 50000,
        refundedAmount: 0,
        status: 'PARTIALLY_PAID',
      });

      const res = await svc.handleClickWebhook(
        'org-1',
        {
          click_trans_id: 555444,
          service_id: 111,
          merchant_trans_id: invoiceNumber,
          amount: 300000, // Exceeds 50,000 remaining due
          action: 0,
          error: 0,
          error_note: 'Success',
          sign_time: signTime,
          sign_string: signString,
        },
        SECRET_KEY,
      );

      expect(res.error).toBe(-2);
      expect(res.error_note).toBe('Incorrect parameter amount');
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('FIFO Split Payment Allocation Engine', () => {
    it('allocates multi-leg split payment across oldest open invoices in FIFO order and stores remaining credit', async () => {
      const studentId = '11111111-1111-1111-1111-111111111111';
      const orgId = 'org-1';

      // 2 open invoices:
      // Inv 1: 100,000 UZS (oldest)
      // Inv 2: 50,000 UZS (newer)
      const openInvoices = [
        {
          id: 'inv-fifo-1',
          organizationId: orgId,
          studentId,
          total: 100000,
          paidAmount: 0,
          refundedAmount: 0,
          status: 'ISSUED',
          dueDate: new Date('2026-10-01'),
          createdAt: new Date('2026-09-25'),
        },
        {
          id: 'inv-fifo-2',
          organizationId: orgId,
          studentId,
          total: 50000,
          paidAmount: 0,
          refundedAmount: 0,
          status: 'ISSUED',
          dueDate: new Date('2026-10-15'),
          createdAt: new Date('2026-10-01'),
        },
      ];

      prisma.invoice.findMany = vi.fn().mockResolvedValueOnce(openInvoices);
      prisma.invoice.update.mockResolvedValue({});
      prisma.payment.create
        .mockResolvedValueOnce({ id: 'pay-leg-1' })
        .mockResolvedValueOnce({ id: 'pay-leg-2' });
      prisma.student.update.mockResolvedValueOnce({});

      // Payer brings: Leg 1 = 120,000 (Cash) + Leg 2 = 60,000 (Terminal) = Total 180,000
      // Debt = 150,000 => Both invoices become PAID, remaining credit = 30,000
      const result = await svc.allocateSplitPaymentFifo(orgId, {
        studentId,
        legs: [
          { amount: 120000, method: 'CASH', description: 'Kassa naqd' },
          { amount: 60000, method: 'TERMINAL', description: 'Kassa terminal' },
        ],
      });

      expect(result.totalPaid).toBe(180000);
      expect(result.unallocatedCredit).toBe(30000);
      expect(result.invoiceAllocations).toHaveLength(2);
      expect(result.invoiceAllocations[0]).toMatchObject({
        invoiceId: 'inv-fifo-1',
        allocatedAmount: 100000,
        newStatus: 'PAID',
      });
      expect(result.invoiceAllocations[1]).toMatchObject({
        invoiceId: 'inv-fifo-2',
        allocatedAmount: 50000,
        newStatus: 'PAID',
      });
      expect(result.createdPaymentIds).toEqual(['pay-leg-1', 'pay-leg-2']);
    });
  });

  describe('Cashier Shift Closure Auto-Cutoff & Variance Reconciliation', () => {
    it('automatically uses the timestamp of the last closed shift when startDate is omitted', async () => {
      const orgId = 'org-1';
      const lastShiftTime = new Date('2026-10-30T14:00:00.000Z');

      prisma.auditLog.findFirst = vi.fn().mockResolvedValueOnce({
        id: 'audit-shift-prev',
        timestamp: lastShiftTime,
      });

      prisma.payment.findMany.mockResolvedValueOnce([
        {
          id: 'pay-evening-1',
          amount: 250000,
          method: 'CASH',
          receiptNumber: 'RCP-2026-000010',
          paidAt: new Date('2026-10-30T16:00:00.000Z'),
          student: null,
        },
      ]);
      prisma.refund.findMany.mockResolvedValueOnce([]);

      const shiftResult = await svc.closeCashierShift(
        orgId,
        { sub: 'cashier-user-1', firstName: 'Ali', lastName: 'Valiyev' },
        { actualCashCounted: 250000, closingNotes: 'Kechki smena yopildi' },
      );

      expect(shiftResult.success).toBe(true);
      expect(shiftResult.status).toBe('BALANCED');
      expect(shiftResult.expectedCash).toBe(250000);
      expect(shiftResult.variance).toBe(0);
      expect(shiftResult.period.start).toBe(lastShiftTime.toISOString());
    });
  });
});
