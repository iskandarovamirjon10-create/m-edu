import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingService } from '../billing.service';
import { PaymeAdapter } from '../adapters/payme.adapter';
import { ClickAdapter } from '../adapters/click.adapter';
import { SubscriptionStatus } from '@prisma/client';

describe('BillingService', () => {
  let service: BillingService;
  let paymeAdapter: PaymeAdapter;
  let clickAdapter: ClickAdapter;
  let prismaMock: any;

  beforeEach(() => {
    process.env.PAYME_MERCHANT_KEY = 'test_payme_key';
    process.env.CLICK_SECRET_KEY = 'test_click_secret';

    paymeAdapter = new PaymeAdapter();
    clickAdapter = new ClickAdapter();

    prismaMock = {
      subscriptionInvoice: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      subscriptionPayment: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      subscription: {
        update: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((arg) => typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)),
    };

    service = new BillingService(prismaMock, paymeAdapter, clickAdapter);
  });

  describe('Payme Webhook', () => {
    const validAuthHeader = `Basic ${Buffer.from('Paycom:test_payme_key').toString('base64')}`;

    it('rejects unauthorized Payme requests', async () => {
      const res = await service.handlePaymeWebhook({
        method: 'CheckPerformTransaction',
        params: { amount: 10000000 },
        id: 123,
      }, 'Basic invalid_header');

      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe(-32504);
    });

    it('validates CheckPerformTransaction for a valid invoice', async () => {
      prismaMock.subscriptionInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-202610-0001',
        amountUzs: 549000,
        status: 'ISSUED',
      });

      const res = await service.handlePaymeWebhook({
        method: 'CheckPerformTransaction',
        params: {
          account: { invoice_number: 'INV-202610-0001' },
          amount: 54900000, // in tiyin
        },
        id: 1,
      }, validAuthHeader);

      expect(res.result).toEqual({ allow: true });
      expect(res.error).toBeUndefined();
    });

    it('rejects CheckPerformTransaction when amount does not match', async () => {
      prismaMock.subscriptionInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-202610-0001',
        amountUzs: 549000,
        status: 'ISSUED',
      });

      const res = await service.handlePaymeWebhook({
        method: 'CheckPerformTransaction',
        params: {
          account: { invoice_number: 'INV-202610-0001' },
          amount: 10000000, // incorrect
        },
        id: 1,
      }, validAuthHeader);

      expect(res.error?.code).toBe(-31001);
    });

    it('handles CreateTransaction idempotently', async () => {
      prismaMock.subscriptionInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-202610-0001',
        amountUzs: 549000,
      });

      const createdDate = new Date();
      prismaMock.subscriptionPayment.findFirst.mockResolvedValue(null);
      prismaMock.subscriptionPayment.create.mockResolvedValue({
        id: 'pay-1',
        createdAt: createdDate,
      });

      const res = await service.handlePaymeWebhook({
        method: 'CreateTransaction',
        params: {
          id: 'payme-trans-99',
          account: { invoice_number: 'INV-202610-0001' },
          amount: 54900000,
          time: Date.now(),
        },
        id: 2,
      }, validAuthHeader);

      expect(res.result?.transaction).toBe('pay-1');
      expect(res.result?.state).toBe(1);
    });

    it('handles PerformTransaction and marks subscription active', async () => {
      const performedDate = new Date();
      prismaMock.subscriptionPayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
        status: 'PENDING',
        externalTransactionId: 'payme-trans-99',
        invoice: {
          id: 'inv-1',
          subscriptionId: 'sub-1',
          invoiceNumber: 'INV-202610-0001',
        },
      });

      prismaMock.subscriptionPayment.update.mockResolvedValue({
        id: 'pay-1',
        status: 'PAID',
        performedAt: performedDate,
      });

      const res = await service.handlePaymeWebhook({
        method: 'PerformTransaction',
        params: {
          id: 'payme-trans-99',
        },
        id: 3,
      }, validAuthHeader);

      expect(res.result?.transaction).toBe('pay-1');
      expect(res.result?.state).toBe(2);
      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            status: SubscriptionStatus.ACTIVE,
          }),
        }),
      );
    });

    it('cancels pending Payme transaction with state -1', async () => {
      prismaMock.subscriptionPayment.findFirst.mockResolvedValueOnce({
        id: 'pay-pending',
        externalTransactionId: 'payme-tx-99',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.handlePaymeWebhook({
        method: 'CancelTransaction',
        params: { id: 'payme-tx-99', reason: 1 },
        id: 777,
      }, validAuthHeader);

      expect(res.result?.transaction).toBe('pay-pending');
      expect(res.result?.state).toBe(-1);
      expect(prismaMock.subscriptionPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-pending' },
          data: { status: 'CANCELLED' },
        }),
      );
    });

    it('cancels completed Payme transaction with state -2 and reverts subscription', async () => {
      prismaMock.subscriptionPayment.findFirst.mockResolvedValueOnce({
        id: 'pay-paid',
        externalTransactionId: 'payme-tx-100',
        status: 'PAID',
        performedAt: new Date(),
        invoiceId: 'inv-1',
        invoice: { subscriptionId: 'sub-1' },
      });

      const res = await service.handlePaymeWebhook({
        method: 'CancelTransaction',
        params: { id: 'payme-tx-100', reason: 2 },
        id: 778,
      }, validAuthHeader);

      expect(res.result?.transaction).toBe('pay-paid');
      expect(res.result?.state).toBe(-2);
      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            status: SubscriptionStatus.CANCELLED,
          }),
        }),
      );
    });
  });

  describe('Click Webhook', () => {
    const serviceId = '12345';
    const secretKey = 'test_click_secret';

    it('rejects invalid MD5 signature', async () => {
      const res = await service.handleClickWebhook({
        click_trans_id: '999',
        service_id: serviceId,
        click_paydoc_id: '888',
        merchant_trans_id: 'INV-001',
        amount: '549000',
        action: '0',
        error: '0',
        error_note: '',
        sign_time: '2026-10-30 12:00:00',
        sign_string: 'invalid_md5',
      });

      expect(res.error).toBe(-1);
      expect(res.error_note).toBe('SIGN CHECK FAILED');
    });

    it('approves Prepare phase with valid MD5 signature', async () => {
      const signString = clickAdapter.generateSignature({
        clickTransId: '999',
        serviceId,
        secretKey,
        merchantTransId: 'INV-001',
        amount: 549000,
        action: 0,
        signTime: '2026-10-30 12:00:00',
      });

      prismaMock.subscriptionInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        amountUzs: 549000,
      });

      const res = await service.handleClickWebhook({
        click_trans_id: '999',
        service_id: serviceId,
        click_paydoc_id: '888',
        merchant_trans_id: 'INV-001',
        amount: '549000',
        action: '0',
        error: '0',
        error_note: '',
        sign_time: '2026-10-30 12:00:00',
        sign_string: signString,
      });

      expect(res.error).toBe(0);
      expect(res.merchant_prepare_id).toBe('inv-1');
    });

    it('completes payment and activates subscription on Complete phase', async () => {
      const signString = clickAdapter.generateSignature({
        clickTransId: '999',
        serviceId,
        secretKey,
        merchantTransId: 'INV-001',
        amount: 549000,
        action: 1,
        signTime: '2026-10-30 12:00:00',
      });

      prismaMock.subscriptionInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        amountUzs: 549000,
        subscriptionId: 'sub-1',
      });

      const res = await service.handleClickWebhook({
        click_trans_id: '999',
        service_id: serviceId,
        click_paydoc_id: '888',
        merchant_trans_id: 'INV-001',
        merchant_prepare_id: 'inv-1',
        amount: '549000',
        action: '1',
        error: '0',
        error_note: '',
        sign_time: '2026-10-30 12:00:00',
        sign_string: signString,
      });

      expect(res.error).toBe(0);
      expect(res.merchant_confirm_id).toBe('inv-1');
      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            status: SubscriptionStatus.ACTIVE,
          }),
        }),
      );
    });

    it('rejects Click Prepare when invoice is already PAID', async () => {
      const signString = clickAdapter.generateSignature({
        clickTransId: '1001',
        serviceId,
        secretKey,
        merchantTransId: 'INV-001',
        amount: 549000,
        action: 0,
        signTime: '2026-10-30 12:00:00',
      });

      prismaMock.subscriptionInvoice.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        amountUzs: 549000,
        status: 'PAID',
      });

      const res = await service.handleClickWebhook({
        click_trans_id: '1001',
        service_id: serviceId,
        click_paydoc_id: '888',
        merchant_trans_id: 'INV-001',
        amount: '549000',
        action: '0',
        error: '0',
        error_note: '',
        sign_time: '2026-10-30 12:00:00',
        sign_string: signString,
      });

      expect(res.error).toBe(-4);
      expect(res.error_note).toBe('Already paid');
    });

    it('handles Click Complete idempotently on duplicate callback without re-extending', async () => {
      const signString = clickAdapter.generateSignature({
        clickTransId: '999',
        serviceId,
        secretKey,
        merchantTransId: 'INV-001',
        merchantPrepareId: 'inv-1',
        amount: 549000,
        action: 1,
        signTime: '2026-10-30 12:00:00',
      });

      prismaMock.subscriptionInvoice.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        amountUzs: 549000,
        status: 'PAID',
      });

      prismaMock.subscriptionPayment.findFirst.mockResolvedValueOnce({
        id: 'pay-existing',
        externalTransactionId: '999',
        status: 'PAID',
      });

      const res = await service.handleClickWebhook({
        click_trans_id: '999',
        service_id: serviceId,
        click_paydoc_id: '888',
        merchant_trans_id: 'INV-001',
        merchant_prepare_id: 'inv-1',
        amount: '549000',
        action: '1',
        error: '0',
        error_note: '',
        sign_time: '2026-10-30 12:00:00',
        sign_string: signString,
      });

      expect(res.error).toBe(0);
      expect(res.merchant_confirm_id).toBe('inv-1');
      // Should NOT call subscription.update again
      expect(prismaMock.subscriptionPayment.create).not.toHaveBeenCalled();
    });
  });

  describe('Payment Links', () => {
    it('generates valid Payme and Click URLs for an invoice', async () => {
      prismaMock.subscriptionInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        amountUzs: 549000,
      });

      const links = await service.getPaymentLinks('org-1', 'INV-001');

      expect(links.invoiceNumber).toBe('INV-001');
      expect(links.amountUzs).toBe(549000);
      expect(links.paymeUrl).toContain('https://checkout.paycom.uz/');
      expect(links.clickUrl).toContain('https://my.click.uz/services/pay');
    });
  });
});
