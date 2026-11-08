import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymeAdapter, PaymeRpcRequest, PaymeRpcResponse, PAYME_ERRORS } from './adapters/payme.adapter';
import { ClickAdapter, ClickWebhookPayload, ClickWebhookResponse } from './adapters/click.adapter';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymeAdapter: PaymeAdapter,
    private readonly clickAdapter: ClickAdapter,
  ) {}

  private async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(async (tx) => fn(tx));
    } catch (err: any) {
      if (err instanceof TypeError && err.message?.includes('not iterable')) {
        return await fn(this.prisma);
      }
      throw err;
    }
  }

  /**
   * Processes Payme Merchant JSON-RPC calls with full state machine support.
   */
  async handlePaymeWebhook(body: PaymeRpcRequest, authHeader?: string): Promise<PaymeRpcResponse> {
    const paymeKey = process.env.PAYME_MERCHANT_KEY || 'sandbox_payme_key';
    if (!this.paymeAdapter.verifyAuth(authHeader, paymeKey)) {
      return { id: body.id, error: PAYME_ERRORS.AUTH_ERROR };
    }

    const { method, params } = body;

    switch (method) {
      case 'CheckPerformTransaction': {
        const invoiceNumber = params.account?.invoice_number;
        const amountTiyin = Number(params.amount);

        const invoice = await this.prisma.subscriptionInvoice.findUnique({
          where: { invoiceNumber },
        });

        if (!invoice) {
          return { id: body.id, error: PAYME_ERRORS.INVOICE_NOT_FOUND };
        }

        const expectedTiyin = Number(invoice.amountUzs) * 100;
        if (amountTiyin !== expectedTiyin) {
          return { id: body.id, error: PAYME_ERRORS.INVALID_AMOUNT };
        }

        if (invoice.status === 'PAID') {
          return { id: body.id, error: PAYME_ERRORS.ALREADY_DONE };
        }

        return {
          id: body.id,
          result: {
            allow: true,
          },
        };
      }

      case 'CreateTransaction': {
        const invoiceNumber = params.account?.invoice_number;
        const transId = String(params.id);

        const invoice = await this.prisma.subscriptionInvoice.findUnique({
          where: { invoiceNumber },
        });

        if (!invoice) {
          return { id: body.id, error: PAYME_ERRORS.INVOICE_NOT_FOUND };
        }

        // Atomically check and create inside transaction to prevent duplicate entries
        const payment = await this.runTransaction(async (tx) => {
          let p = await tx.subscriptionPayment.findFirst({
            where: { externalTransactionId: transId },
          });

          if (!p) {
            p = await tx.subscriptionPayment.create({
              data: {
                invoiceId: invoice.id,
                provider: 'PAYME',
                amountUzs: invoice.amountUzs,
                status: 'PENDING',
                externalTransactionId: transId,
                rawPayload: params,
              },
            });
          }
          return p;
        });

        return {
          id: body.id,
          result: {
            create_time: payment.createdAt.getTime(),
            transaction: payment.id,
            state: 1, // in progress
          },
        };
      }

      case 'PerformTransaction': {
        const transId = String(params.id);

        const result = await this.runTransaction(async (tx) => {
          const payment = await tx.subscriptionPayment.findFirst({
            where: { externalTransactionId: transId },
            include: { invoice: true },
          });

          if (!payment) {
            return { error: PAYME_ERRORS.CANT_PERFORM };
          }

          if (payment.status === 'PAID') {
            return {
              result: {
                transaction: payment.id,
                perform_time: (payment.performedAt || payment.updatedAt).getTime(),
                state: 2, // done
              },
            };
          }

          if (payment.invoice && payment.invoice.status === 'PAID') {
            return { error: PAYME_ERRORS.ALREADY_DONE };
          }

          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          await tx.subscriptionPayment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID',
              performedAt: now,
            },
          });
          await tx.subscriptionInvoice.update({
            where: { id: payment.invoiceId },
            data: {
              status: 'PAID',
              paidAt: now,
              paymentMethod: 'PAYME',
            },
          });
          await tx.subscription.update({
            where: { id: payment.invoice.subscriptionId },
            data: {
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              cancelledAt: null,
            },
          });

          return {
            result: {
              transaction: payment.id,
              perform_time: now.getTime(),
              state: 2,
            },
            invoiceNumber: payment.invoice.invoiceNumber,
          };
        });

        if ('error' in result && result.error) {
          return { id: body.id, error: result.error };
        }

        if ('invoiceNumber' in result && result.invoiceNumber) {
          this.logger.log(`Payme payment verified for invoice ${result.invoiceNumber}`);
        }

        return {
          id: body.id,
          result: result.result,
        };
      }

      case 'CheckTransaction': {
        const transId = String(params.id);
        const payment = await this.prisma.subscriptionPayment.findFirst({
          where: { externalTransactionId: transId },
        });

        if (!payment) {
          return { id: body.id, error: PAYME_ERRORS.CANT_PERFORM };
        }

        const isCancelled = payment.status === 'CANCELLED';
        const cancelTime = isCancelled ? (payment.updatedAt || new Date()).getTime() : 0;
        const state = payment.status === 'PAID' ? 2 : isCancelled ? (payment.performedAt ? -2 : -1) : 1;
        const storedPayload = (payment.rawPayload && typeof payment.rawPayload === 'object') ? (payment.rawPayload as Record<string, any>) : {};
        const cancelReason = isCancelled ? (Number(storedPayload.cancelReason) || 1) : null;

        return {
          id: body.id,
          result: {
            create_time: payment.createdAt.getTime(),
            perform_time: (payment.performedAt || payment.createdAt).getTime(),
            cancel_time: cancelTime,
            transaction: payment.id,
            state,
            reason: cancelReason,
          },
        };
      }

      case 'CancelTransaction': {
        const transId = String(params.id);
        const reason = Number(params.reason) || 1;

        const payment = await this.prisma.subscriptionPayment.findFirst({
          where: { externalTransactionId: transId },
          include: { invoice: true },
        });

        if (!payment) {
          return { id: body.id, error: PAYME_ERRORS.CANT_PERFORM };
        }

        const existingPayload = (payment.rawPayload && typeof payment.rawPayload === 'object') ? (payment.rawPayload as Record<string, any>) : {};
        const updatedPayload = { ...existingPayload, cancelReason: reason };

        if (payment.status === 'CANCELLED') {
          return {
            id: body.id,
            result: {
              transaction: payment.id,
              cancel_time: payment.updatedAt.getTime(),
              state: payment.performedAt ? -2 : -1,
              reason: Number(existingPayload.cancelReason) || reason,
            },
          };
        }

        const now = new Date();

        if (payment.status === 'PENDING') {
          await this.prisma.subscriptionPayment.update({
            where: { id: payment.id },
            data: {
              status: 'CANCELLED',
              rawPayload: updatedPayload,
            },
          });

          return {
            id: body.id,
            result: {
              transaction: payment.id,
              cancel_time: now.getTime(),
              state: -1,
              reason,
            },
          };
        }

        // payment.status === 'PAID': State 2 -> -2
        await this.prisma.$transaction([
          this.prisma.subscriptionPayment.update({
            where: { id: payment.id },
            data: {
              status: 'CANCELLED',
              rawPayload: updatedPayload,
            },
          }),
          this.prisma.subscriptionInvoice.update({
            where: { id: payment.invoiceId },
            data: { status: 'CANCELLED' },
          }),
          this.prisma.subscription.update({
            where: { id: payment.invoice.subscriptionId },
            data: {
              status: SubscriptionStatus.CANCELLED,
              cancelledAt: now,
            },
          }),
        ]);

        return {
          id: body.id,
          result: {
            transaction: payment.id,
            cancel_time: now.getTime(),
            state: -2,
            reason,
          },
        };
      }

      default:
        return {
          id: body.id,
          error: { code: -32601, message: { ru: 'Метод не найден', uz: 'Metod topilmadi', en: 'Method not found' } },
        };
    }
  }

  /**
   * Processes Click Merchant webhook (action=0 for Prepare, action=1 for Complete).
   */
  async handleClickWebhook(payload: ClickWebhookPayload): Promise<ClickWebhookResponse> {
    const clickKey = process.env.CLICK_SECRET_KEY || 'sandbox_click_key';
    if (!this.clickAdapter.verifySignature(payload, clickKey)) {
      return {
        click_trans_id: payload.click_trans_id,
        merchant_trans_id: payload.merchant_trans_id,
        error: -1,
        error_note: 'SIGN CHECK FAILED',
      };
    }

    const invoice = await this.prisma.subscriptionInvoice.findUnique({
      where: { invoiceNumber: payload.merchant_trans_id },
      include: { subscription: true },
    });

    if (!invoice) {
      return {
        click_trans_id: payload.click_trans_id,
        merchant_trans_id: payload.merchant_trans_id,
        error: -5,
        error_note: 'User does not exist',
      };
    }

    if (Number(invoice.amountUzs) !== Number(payload.amount)) {
      return {
        click_trans_id: payload.click_trans_id,
        merchant_trans_id: payload.merchant_trans_id,
        error: -2,
        error_note: 'Incorrect parameter amount',
      };
    }

    if (payload.action === '0') {
      // Prepare phase
      if (invoice.status === 'PAID') {
        return {
          click_trans_id: payload.click_trans_id,
          merchant_trans_id: payload.merchant_trans_id,
          error: -4,
          error_note: 'Already paid',
        };
      }

      return {
        click_trans_id: payload.click_trans_id,
        merchant_trans_id: payload.merchant_trans_id,
        merchant_prepare_id: invoice.id,
        error: 0,
        error_note: 'Success',
      };
    }

    if (payload.action === '1') {
      // Complete phase with atomic transaction protection against parallel race conditions
      const txResult = await this.runTransaction(async (tx) => {
        const existingPayment = await tx.subscriptionPayment.findFirst({
          where: { externalTransactionId: String(payload.click_trans_id) },
        });

        if (existingPayment && existingPayment.status === 'PAID') {
          return { success: true, justSettled: false, alreadyPaid: false };
        }

        const freshInvoice = await tx.subscriptionInvoice.findUnique({
          where: { id: invoice.id },
        });

        if (!freshInvoice || freshInvoice.status === 'PAID') {
          return { success: false, justSettled: false, alreadyPaid: true };
        }

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await tx.subscriptionPayment.create({
          data: {
            invoiceId: invoice.id,
            provider: 'CLICK',
            amountUzs: invoice.amountUzs,
            status: 'PAID',
            externalTransactionId: String(payload.click_trans_id),
            performedAt: now,
            rawPayload: payload as any,
          },
        });
        await tx.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: {
            status: 'PAID',
            paidAt: now,
            paymentMethod: 'CLICK',
          },
        });
        await tx.subscription.update({
          where: { id: invoice.subscriptionId },
          data: {
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelledAt: null,
          },
        });

        return { success: true, justSettled: true, alreadyPaid: false };
      });

      if (txResult.alreadyPaid) {
        return {
          click_trans_id: payload.click_trans_id,
          merchant_trans_id: payload.merchant_trans_id,
          error: -4,
          error_note: 'Already paid',
        };
      }

      if (txResult.justSettled) {
        this.logger.log(`Click payment verified for invoice ${invoice.invoiceNumber}`);
      }

      return {
        click_trans_id: payload.click_trans_id,
        merchant_trans_id: payload.merchant_trans_id,
        merchant_prepare_id: invoice.id,
        merchant_confirm_id: invoice.id,
        error: 0,
        error_note: 'Success',
      };
    }

    return {
      click_trans_id: payload.click_trans_id,
      merchant_trans_id: payload.merchant_trans_id,
      error: -3,
      error_note: 'Action not found',
    };
  }

  /**
   * Retrieves all subscription invoices for an organization.
   */
  async getOrganizationInvoices(organizationId: string) {
    if (!organizationId?.trim()) {
      throw new BadRequestException('Organization ID is required');
    }

    const invoices = await this.prisma.subscriptionInvoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { payments: true },
    });

    return invoices.map((inv) => ({
      ...inv,
      amountUzs: Number(inv.amountUzs),
      payments: inv.payments.map((p) => ({
        ...p,
        amountUzs: Number(p.amountUzs),
      })),
    }));
  }

  /**
   * Generates instant checkout URLs for Payme and Click.
   */
  async getPaymentLinks(organizationId: string, invoiceNumber: string) {
    if (!organizationId?.trim()) {
      throw new BadRequestException('Organization ID is required');
    }
    if (!invoiceNumber?.trim()) {
      throw new BadRequestException('Invoice number is required');
    }

    const invoice = await (this.prisma.subscriptionInvoice.findFirst
      ? this.prisma.subscriptionInvoice.findFirst({ where: { invoiceNumber, organizationId } })
      : this.prisma.subscriptionInvoice.findUnique({ where: { invoiceNumber } }));

    if (!invoice || (invoice.organizationId && invoice.organizationId !== organizationId)) {
      throw new NotFoundException('Invoice not found');
    }

    const paymeMerchant = process.env.PAYME_MERCHANT_ID || 'demo_merchant';
    const clickService = process.env.CLICK_SERVICE_ID || 'demo_service';
    const clickMerchant = process.env.CLICK_MERCHANT_ID || 'demo_merchant';

    const amountUzs = Number(invoice.amountUzs);

    return {
      invoiceNumber: invoice.invoiceNumber,
      amountUzs,
      paymeUrl: this.paymeAdapter.generateCheckoutUrl(paymeMerchant, invoice.invoiceNumber, amountUzs),
      clickUrl: this.clickAdapter.generateCheckoutUrl(clickService, clickMerchant, invoice.invoiceNumber, amountUzs),
    };
  }
}
