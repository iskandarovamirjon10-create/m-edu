import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateInvoiceDto, AddInvoiceItemDto, RecordPaymentDto, CreateRefundDto, ProrateInvoiceDto } from './dto/invoice.dto';
import { generatePaymentLinks } from './payment-links.util';
import { toMinor, fromMinor, DecimalLike } from '@medu/financial-engine';
import { computeInvoiceOutstanding } from './invoice-outstanding';
import { NotificationEventService } from '../notifications/events/notification-event.service';
import { FinancialPeriodService } from '../analytics/financial-period.service';
import { withPrismaRetry } from '../lib/prisma-retry.util';
import { refundBalanceReverseMinor } from './balance-contribution';

/**
 * Student billing: invoices -> payments -> receipts -> refunds.
 *
 * Financial integrity rules enforced here:
 *  - Invoice totals are ALWAYS recomputed from items + adjustments inside the
 *    same transaction that mutates them (no manual total edits).
 *  - Money is handled in integer minor units (tiyin) inside the service;
 *    floating-point arithmetic never touches a total.
 *  - Payment allocation is race-safe: the paid-amount increment happens via a
 *    guarded UPDATE inside a transaction, and the invoice status is derived
 *    from the recomputed paid amount, never trusted from the client.
 *  - Payments are idempotent per (organizationId, reference).
 *  - Refunds can never exceed the paid amount of their payment.
 *  - Every financial mutation writes an audit record.
 */

const INVOICE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
  PARTIALLY_PAID: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  PAID: [], // terminal apart from refunds, which do not change status
  OVERDUE: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  CANCELLED: [],
  REFUNDED: [],
};



@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notificationEvents: NotificationEventService,
    private readonly financialPeriod: FinancialPeriodService,
  ) {}

  // ------------------------------------------------------------------
  // Queries
  // ------------------------------------------------------------------

  async findAll(organizationId: string, query: { status?: string; studentId?: string; overdue?: boolean; page?: number; limit?: number }) {
    const where: Prisma.InvoiceWhereInput = { organizationId };
    if (query.status) where.status = query.status as InvoiceStatus;
    if (query.studentId) where.studentId = query.studentId;
    if (query.overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] };
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const [items, agg] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          _count: { select: { items: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.aggregate({
        where,
        _sum: { total: true, paidAmount: true, refundedAmount: true },
        _count: true,
      }),
    ]);
    const total = agg._count;

    const outstanding =
      toMinor(agg._sum.total ?? 0) -
      toMinor(agg._sum.paidAmount ?? 0) +
      toMinor(agg._sum.refundedAmount ?? 0);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totals: {
        invoiced: fromMinor(toMinor(agg._sum.total ?? 0)),
        paid: fromMinor(toMinor(agg._sum.paidAmount ?? 0)),
        refunded: fromMinor(toMinor(agg._sum.refundedAmount ?? 0)),
        outstanding: fromMinor(Math.max(0, outstanding)),
      },
    };
  }

  async findOne(organizationId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: {
        items: true,
        student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, amount: true, status: true, method: true, reference: true,
            receiptNumber: true, receiptIssuedAt: true, paidAt: true, createdAt: true,
          },
        },
        refunds: {
          orderBy: { requestedAt: 'desc' },
          select: {
            id: true, amount: true, status: true, reason: true,
            requestedBy: true, processedBy: true, requestedAt: true, processedAt: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // remaining = total - paid + refunded (refunded money is collectable again)
    const remainingMinor = Math.max(
      0,
      toMinor(invoice.total) -
        toMinor(invoice.paidAmount) +
        toMinor(invoice.refundedAmount ?? 0),
    );
    return {
      ...invoice,
      remaining: fromMinor(remainingMinor),
      isOverdue:
        invoice.dueDate !== null &&
        invoice.dueDate < new Date() &&
        !['PAID', 'CANCELLED', 'REFUNDED'].includes(invoice.status),
    };
  }

  /**
   * Resolve the Student profile for the current user and return their own
   * balance. Students may only ever see their own financial data.
   */
  async getBalanceForUser(organizationId: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { organizationId, userId },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('No student profile linked to this account');
    }
    return this.getStudentBalance(organizationId, student.id);
  }

  /**
   * Student-safe invoice detail: the invoice must belong to the requesting
   * student, otherwise it is reported as not found (no existence leak).
   */
  async getInvoiceForStudent(organizationId: string, userId: string, invoiceId: string) {
    const student = await this.prisma.student.findFirst({
      where: { organizationId, userId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Invoice not found');

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId, studentId: student.id },
      select: { id: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.findOne(organizationId, invoiceId);
  }

  /** Student-facing balance: outstanding invoices + payment history. */
  async getStudentBalance(organizationId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId, studentId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, number: true, status: true, total: true, paidAmount: true,
        refundedAmount: true, dueDate: true, issueDate: true,
      },
    });

    // remaining = total - paid + refunded (refunded money is collectable
    // again) — must match findOne()'s remaining formula. Shared with the
    // camera entry gate so the two can never disagree (F-009).
    const { outstanding, overdue } = computeInvoiceOutstanding(invoices);

    const payments = await this.prisma.payment.findMany({
      where: { organizationId, studentId, status: { in: ['PAID', 'PARTIALLY_PAID', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, amount: true, status: true, method: true, reference: true,
        receiptNumber: true, paidAt: true, createdAt: true, invoiceId: true,
      },
    });

    return {
      studentId,
      invoiceCount: invoices.length,
      outstanding,
      overdue,
      invoices,
      payments,
    };
  }

  // ------------------------------------------------------------------
  // Invoice lifecycle
  // ------------------------------------------------------------------

  async createInvoice(organizationId: string, actorId: string, dto: CreateInvoiceDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, organizationId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    // Items are validated and totaled in minor units before any write.
    let subtotalMinor = 0;
    for (const item of dto.items) {
      const qty = item.quantity ?? 1;
      if (qty <= 0) throw new BadRequestException('Item quantity must be positive');
      const unitMinor = toMinor(item.unitPrice);
      if (unitMinor < 0) throw new BadRequestException('Item price must be non-negative');
      const lineMinor = Math.round(unitMinor * qty);
      if (lineMinor <= 0) throw new BadRequestException('Item amount must be positive');
      subtotalMinor += lineMinor;
    }
    if (subtotalMinor <= 0) throw new BadRequestException('Invoice must have at least one item');

    const discountMinor = Math.min(toMinor(dto.discount ?? 0), subtotalMinor);
    const penaltyMinor = toMinor(dto.penalty ?? 0);
    const totalMinor = subtotalMinor - discountMinor + penaltyMinor;
    if (totalMinor <= 0) throw new BadRequestException('Invoice total must be positive');

    try {
      const invoice = await withPrismaRetry(() => this.prisma.$transaction(async (tx) => {
        const created = await tx.invoice.create({
          data: {
            organizationId,
            studentId: dto.studentId,
            number: dto.number,
            status: 'DRAFT',
            currency: dto.currency ?? 'UZS',
            subtotal: fromMinor(subtotalMinor),
            discount: fromMinor(discountMinor),
            penalty: fromMinor(penaltyMinor),
            total: fromMinor(totalMinor),
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            notes: dto.notes,
            updatedAt: new Date(),
            items: {
              create: dto.items.map((item) => ({
                organizationId,
                description: item.description,
                quantity: item.quantity ?? 1,
                unitPrice: fromMinor(toMinor(item.unitPrice)),
                amount: fromMinor(Math.round(toMinor(item.unitPrice) * (item.quantity ?? 1))),
              })),
            },
          },
          include: { items: true },
        });

        await tx.auditLog.create({
          data: {
            organizationId,
            userId: actorId,
            action: 'INVOICE_CREATE',
            resource: 'Invoice',
            resourceId: created.id,
            changes: {
              number: { old: null, new: created.number },
              total: { old: null, new: Number(created.total) },
              items: { old: null, new: dto.items.length },
            } as Prisma.InputJsonValue,
          },
        });
        return created;
      }), { logger: new Logger('InvoicesService') });

      this.logger.log(`invoice_created org=${organizationId} invoice=${invoice.id} total=${invoice.total}`);
      return invoice;
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2002') {
        throw new ConflictException(`Invoice number "${dto.number}" already exists`);
      }
      throw err;
    }
  }

  /** Add a line item to a DRAFT invoice and recompute totals. */
  async addItem(organizationId: string, actorId: string, invoiceId: string, dto: AddInvoiceItemDto) {
    const qty = dto.quantity ?? 1;
    const unitMinor = toMinor(dto.unitPrice);
    const lineMinor = Math.round(unitMinor * qty);
    if (lineMinor <= 0) throw new BadRequestException('Item amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        select: { id: true, status: true },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== 'DRAFT') {
        throw new ConflictException('Items can only be added to DRAFT invoices');
      }

      await tx.invoiceItem.create({
        data: {
          organizationId,
          invoiceId,
          description: dto.description,
          quantity: qty,
          unitPrice: fromMinor(unitMinor),
          amount: fromMinor(lineMinor),
        },
      });

      return this.recomputeInvoice(tx, organizationId, invoiceId, actorId, 'INVOICE_ADD_ITEM');
    });
  }

  /**
   * Recompute denormalized totals from line items (inside the caller's
   * transaction) and append an audit record. Single source of truth for
   * invoice math.
   */
  private async recomputeInvoice(
    tx: Prisma.TransactionClient,
    organizationId: string,
    invoiceId: string,
    actorId: string,
    auditAction: string,
  ) {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: { items: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    let subtotalMinor = 0;
    for (const item of invoice.items) {
      subtotalMinor += Math.round(toMinor(item.unitPrice) * Number(item.quantity));
    }
    const discountMinor = Math.min(toMinor(invoice.discount), subtotalMinor);
    const penaltyMinor = toMinor(invoice.penalty);
    const totalMinor = subtotalMinor - discountMinor + penaltyMinor;

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotal: fromMinor(subtotalMinor),
        discount: fromMinor(discountMinor),
        total: fromMinor(totalMinor),
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId,
        userId: actorId,
        action: auditAction,
        resource: 'Invoice',
        resourceId: invoiceId,
        changes: {
          subtotal: { old: Number(invoice.subtotal), new: fromMinor(subtotalMinor) },
          total: { old: Number(invoice.total), new: fromMinor(totalMinor) },
        } as Prisma.InputJsonValue,
      },
    });

    return tx.invoice.findFirst({ where: { id: invoiceId, organizationId }, include: { items: true } });
  }

  async issueInvoice(organizationId: string, actorId: string, invoiceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        select: { id: true, status: true, number: true },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== 'DRAFT') {
        throw new ConflictException(`Only DRAFT invoices can be issued (current: ${invoice.status})`);
      }
      const itemCount = await tx.invoiceItem.count({ where: { invoiceId, organizationId } });
      if (itemCount === 0) throw new BadRequestException('Cannot issue an invoice without items');

      const updated = await tx.invoice.updateMany({
        where: { id: invoiceId, organizationId, status: 'DRAFT' },
        data: { status: 'ISSUED', issueDate: new Date() },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Invoice was modified concurrently, retry');
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorId,
          action: 'INVOICE_ISSUE',
          resource: 'Invoice',
          resourceId: invoiceId,
          changes: { status: { old: 'DRAFT', new: 'ISSUED' } } as Prisma.InputJsonValue,
        },
      });
      this.logger.log(`invoice_issued org=${organizationId} invoice=${invoiceId}`);
      return tx.invoice.findFirst({ where: { id: invoiceId, organizationId } });
    });
  }

  async cancelInvoice(organizationId: string, actorId: string, invoiceId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('A cancellation reason is required');
    return withPrismaRetry(() => this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        select: { id: true, status: true, paidAmount: true },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (toMinor(invoice.paidAmount) > 0) {
        throw new ConflictException('Cannot cancel an invoice with recorded payments — refund first');
      }
      const allowed = INVOICE_TRANSITIONS[invoice.status] ?? [];
      if (!allowed.includes('CANCELLED')) {
        throw new ConflictException(`Cannot cancel an invoice in status ${invoice.status}`);
      }

      const updated = await tx.invoice.updateMany({
        where: { id: invoiceId, organizationId, status: invoice.status },
        data: { status: 'CANCELLED', notes: reason.trim() },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Invoice was modified concurrently, retry');
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorId,
          action: 'INVOICE_CANCEL',
          resource: 'Invoice',
          resourceId: invoiceId,
          changes: {
            status: { old: invoice.status, new: 'CANCELLED' },
            reason: { old: null, new: reason.trim() },
          } as Prisma.InputJsonValue,
        },
      });
      return tx.invoice.findFirst({ where: { id: invoiceId, organizationId } });
    }), { logger: new Logger('InvoicesService') });
  }

  // ------------------------------------------------------------------
  // Payments against invoices
  // ------------------------------------------------------------------

  /**
   * Record a payment against an invoice. Race-safe and idempotent:
   *  - duplicate reference -> 409 (unique index backstop)
   *  - concurrent payments serialize on the invoice row update inside the
   *    transaction; the final status is derived from recomputed totals.
   */
  async recordPayment(organizationId: string, actorId: string, dto: RecordPaymentDto) {
    if (toMinor(dto.amount) <= 0) {
      throw new BadRequestException('Payment amount must be positive');
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, organizationId },
      select: { id: true, status: true, total: true, paidAmount: true, refundedAmount: true, studentId: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)) {
      throw new ConflictException(`Invoice in status ${invoice.status} cannot accept payments`);
    }

    const amountMinor = toMinor(dto.amount);
    const netPaidMinor = toMinor(invoice.paidAmount) - toMinor(invoice.refundedAmount ?? 0);
    const totalMinor = toMinor(invoice.total);
    if (netPaidMinor + amountMinor > totalMinor) {
      throw new BadRequestException(
        `Payment exceeds remaining balance (remaining: ${fromMinor(totalMinor - netPaidMinor)})`,
      );
    }

    const transactionDate = new Date();

  try {
    const payment = await withPrismaRetry(() => this.prisma.$transaction(async (tx) => {
      await this.financialPeriod.ensureNotClosedTx(tx, organizationId, transactionDate);

      const created = await tx.payment.create({
        data: {
          organizationId,
          studentId: invoice.studentId,
          invoiceId: invoice.id,
          amount: fromMinor(amountMinor),
          status: 'PAID',
          method: dto.method,
          reference: dto.reference ?? null,
          description: dto.description,
          paidAt: new Date(),
        },
      });

      // ATOMIC balance mutation: exact match on paidAmount and refundedAmount
      // prevents race conditions without needing raw SQL.
      const guard = await tx.invoice.updateMany({
        where: { 
          id: invoice.id, 
          organizationId, 
          status: invoice.status,
          paidAmount: invoice.paidAmount,
          refundedAmount: invoice.refundedAmount,
        },
        data: { paidAmount: { increment: fromMinor(amountMinor) } },
      });
      if (guard.count !== 1) {
        throw new ConflictException('Payment exceeds remaining balance or invoice was concurrently cancelled/modified');
      }

      const fresh = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      const netPaidMinor = toMinor(fresh.paidAmount) - toMinor(fresh.refundedAmount ?? 0);
      const newStatus: InvoiceStatus = netPaidMinor >= toMinor(fresh.total) ? 'PAID' : 'PARTIALLY_PAID';
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: newStatus,
          paidAt: ['PAID', 'PARTIALLY_PAID'].includes(newStatus) ? new Date() : null,
        },
      });

      // Receipt issuance using atomic counter to prevent duplicate receipt numbers
      const receiptNumber = await this.nextReceiptNumber(tx, organizationId);
      const withReceipt = await tx.payment.update({
        where: { id: created.id },
        data: { receiptNumber, receiptIssuedAt: new Date() },
      });

      // Balance cache: money IN for the student (ledger is source of truth;
      // this field powers lists/dashboards without full aggregation).
      await tx.student.update({
        where: { id: invoice.studentId },
        data: { balance: { increment: fromMinor(amountMinor) } },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorId,
          action: 'PAYMENT_RECORDED',
          resource: 'Payment',
          resourceId: created.id,
          changes: {
            invoiceId: { old: null, new: invoice.id },
            amount: { old: null, new: fromMinor(amountMinor) },
            invoiceStatus: { old: invoice.status, new: newStatus },
            receiptNumber: { old: null, new: receiptNumber },
          } as Prisma.InputJsonValue,
        },
      });
      return withReceipt;
    }), { logger: new Logger('InvoicesService') });

      this.logger.log(
        `payment_recorded org=${organizationId} payment=${payment.id} invoice=${dto.invoiceId} amount=${payment.amount} receipt=${payment.receiptNumber}`,
      );

      // Post-transaction event emission (delivery must never block or fail
      // the financial write that already committed).
      await this.notificationEvents.emit({
        organizationId,
        type: 'PAYMENT_RECORDED',
        occurredAt: new Date().toISOString(),
        entityType: 'Payment',
        entityId: payment.id,
        data: {
          studentId: invoice.studentId,
          amount: fromMinor(amountMinor),
          invoiceId: invoice.id,
        },
      });

      return payment;
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2002') {
        throw new ConflictException('A payment with this reference already exists (duplicate)');
      }
      throw err;
    }
  }

  private async nextReceiptNumber(tx: Prisma.TransactionClient, organizationId: string): Promise<string> {
    const year = new Date().getFullYear();

    // Single atomic upsert: concurrent payments serialize on the counter row
    // and can never mint the same receipt number. `lastNumber` resets to 1 when
    // the stored year rolls over, otherwise it increments.
    const rows = await tx.$queryRaw<Array<{ lastNumber: number }>>`
      INSERT INTO "ReceiptCounter" ("organizationId", "lastNumber", "year", "createdAt", "updatedAt")
      VALUES (${organizationId}::uuid, 1, ${year}, now(), now())
      ON CONFLICT ("organizationId") DO UPDATE
      SET "lastNumber" = CASE
            WHEN "ReceiptCounter"."year" = EXCLUDED."year"
              THEN "ReceiptCounter"."lastNumber" + 1
            ELSE 1
          END,
          "year" = EXCLUDED."year",
          "updatedAt" = now()
      RETURNING "lastNumber"
    `;

    const counter = rows[0];
    return `RCP-${year}-${String(counter?.lastNumber ?? 1).padStart(6, '0')}`;
  }

  // ------------------------------------------------------------------
  // Refunds
  // ------------------------------------------------------------------

  /**
   * Two-step refund: REQUESTED by finance staff, PROCESSED by an admin.
   * A refund can never exceed the paid amount of its payment, and the
   * externalId unique constraint makes gateway retries idempotent.
   */
  async requestRefund(organizationId: string, actorId: string, dto: CreateRefundDto) {
    if (toMinor(dto.amount) <= 0) throw new BadRequestException('Refund amount must be positive');

    const payment = await this.prisma.payment.findFirst({
      where: { id: dto.paymentId, organizationId, status: 'PAID' },
      select: { id: true, amount: true, invoiceId: true, studentId: true },
    });
    if (!payment) {
      throw new NotFoundException('Refund target must be an existing PAID payment');
    }

    const transactionDate = new Date();

    const refund = await withPrismaRetry(() => this.prisma.$transaction(async (tx) => {
      // 1. Pessimistic Lock on the Payment row to serialize concurrent refund requests
      const lockedPayments = await tx.$queryRaw<any[]>`
        SELECT id, amount 
        FROM "Payment" 
        WHERE id = ${payment.id}::uuid 
        FOR UPDATE
      `;
      if (!lockedPayments.length) throw new NotFoundException('Payment not found during lock');

      // 2. Aggregate existing refunds inside the transaction AFTER acquiring the lock
      const existingRefunds = await tx.refund.aggregate({
        where: { paymentId: payment.id, status: { in: ['REQUESTED', 'APPROVED', 'PROCESSED'] } },
        _sum: { amount: true },
      });

      const refundedMinor = toMinor(existingRefunds._sum.amount ?? 0);
      const paymentMinor = toMinor(lockedPayments[0].amount);

      if (refundedMinor + toMinor(dto.amount) > paymentMinor) {
        throw new BadRequestException(
          `Refund exceeds refundable amount (refundable: ${fromMinor(paymentMinor - refundedMinor)})`,
        );
      }
      await this.financialPeriod.ensureNotClosedTx(tx, organizationId, transactionDate);

      const created = await tx.refund.create({
        data: {
          organizationId,
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          amount: fromMinor(toMinor(dto.amount)),
          reason: dto.reason,
          status: 'REQUESTED',
          requestedBy: actorId,
          externalId: dto.externalId ?? null,
          updatedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorId,
          action: 'REFUND_REQUEST',
          resource: 'Refund',
          resourceId: created.id,
          changes: {
            paymentId: { old: null, new: payment.id },
            amount: { old: null, new: fromMinor(toMinor(dto.amount)) },
            reason: { old: null, new: dto.reason ?? null },
          } as Prisma.InputJsonValue,
        },
      });
      return created;
    }), { logger: new Logger('InvoicesService') });

    this.logger.log(`refund_requested org=${organizationId} refund=${refund.id} amount=${refund.amount}`);
    return refund;
  }

  async processRefund(organizationId: string, actorId: string, refundId: string, gatewayExternalId?: string) {
    const refund = await withPrismaRetry(() => this.prisma.$transaction(async (tx) => {
      const existing = await tx.refund.findFirst({
        where: { id: refundId, organizationId },
        select: { id: true, status: true, paymentId: true, invoiceId: true, amount: true },
      });
      if (!existing) throw new NotFoundException('Refund not found');
      if (existing.status !== 'REQUESTED' && existing.status !== 'APPROVED') {
        throw new ConflictException(`Refund in status ${existing.status} cannot be processed`);
      }

      // Pessimistic lock on Payment serializes with PaymentsService.update
      // status transitions so refund + status-leave cannot both reverse balance.
      const lockedPayments = await tx.$queryRaw<
        Array<{ id: string; amount: DecimalLike; status: PaymentStatus; studentId: string | null }>
      >`
        SELECT id, amount, status, "studentId"
        FROM "Payment"
        WHERE id = ${existing.paymentId}::uuid
        FOR UPDATE
      `;
      if (!lockedPayments.length) throw new NotFoundException('Payment not found during lock');
      const paymentRow = lockedPayments[0];

      // Prior PROCESSSED refunds (this one is still REQUESTED/APPROVED).
      const priorAgg = await tx.refund.aggregate({
        where: {
          paymentId: existing.paymentId,
          status: 'PROCESSED',
          NOT: { id: existing.id },
        },
        _sum: { amount: true },
      });
      const priorProcessedRefundMinor = toMinor(priorAgg._sum.amount ?? 0);

      const updated = await tx.refund.updateMany({
        where: { id: refundId, organizationId, status: existing.status },
        data: {
          status: 'PROCESSED',
          processedBy: actorId,
          processedAt: new Date(),
          externalId: gatewayExternalId ?? undefined,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Refund was modified concurrently, retry');
      }

      await this.financialPeriod.ensureNotClosedTx(tx, organizationId, new Date());

      // Reduce the invoice balance: refund moves money out.
      if (existing.invoiceId) {
        const invoice = await tx.invoice.findFirst({
          where: { id: existing.invoiceId, organizationId },
          select: { id: true, studentId: true },
        });
        if (invoice) {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { refundedAmount: { increment: existing.amount } },
          });

          const fresh = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
          const netPaidMinor = toMinor(fresh.paidAmount) - toMinor(fresh.refundedAmount ?? 0);
          const totalMinor = toMinor(fresh.total);

          let newStatus = fresh.status;
          if (netPaidMinor < totalMinor) {
            newStatus = (fresh.dueDate && fresh.dueDate < new Date()) ? 'OVERDUE' : 'PARTIALLY_PAID';
            if (netPaidMinor <= 0) {
              newStatus = (fresh.dueDate && fresh.dueDate < new Date()) ? 'OVERDUE' : 'ISSUED';
            }
          }

          if (newStatus !== fresh.status) {
            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                status: newStatus,
                paidAt: ['PAID', 'PARTIALLY_PAID'].includes(newStatus) ? fresh.paidAt : null,
              },
            });
          }
        }
      }

      // Balance cache: reverse ONLY the still-applied share of this refund.
      // If the payment already left PAID (status-leave already reversed
      // money-in), or the share was already reversed, reverse 0.
      const reverseMinor = refundBalanceReverseMinor({
        paymentIsPaid: paymentRow.status === 'PAID',
        paymentAmountMinor: toMinor(paymentRow.amount),
        refundAmountMinor: toMinor(existing.amount),
        priorProcessedRefundMinor,
      });
      if (reverseMinor !== 0 && paymentRow.studentId) {
        await tx.student.update({
          where: { id: paymentRow.studentId },
          data: { balance: { decrement: fromMinor(reverseMinor) } },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorId,
          action: 'REFUND_PROCESSED',
          resource: 'Refund',
          resourceId: refundId,
          changes: {
            status: { old: existing.status, new: 'PROCESSED' },
            amount: { old: null, new: Number(existing.amount) },
            externalId: { old: null, new: gatewayExternalId ?? null },
          } as Prisma.InputJsonValue,
        },
      });
      return tx.refund.findFirst({ where: { id: refundId, organizationId } });
    }), { logger: new Logger('InvoicesService') });

    this.logger.log(`refund_processed org=${organizationId} refund=${refundId} actor=${actorId}`);
    return refund;
  }

  async rejectRefund(organizationId: string, actorId: string, refundId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('A rejection reason is required');
    const updated = await this.prisma.refund.updateMany({
      where: { id: refundId, organizationId, status: 'REQUESTED' },
      data: { status: 'REJECTED', processedBy: actorId, processedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Refund not found or not in REQUESTED status');
    }
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'REFUND_REJECT',
      resource: 'Refund',
      resourceId: refundId,
      changes: { reason: { old: null, new: reason.trim() } },
    });
    return this.prisma.refund.findFirst({ where: { id: refundId, organizationId } });
  }

  // ------------------------------------------------------------------
  // Payment Links & Uzbekistan Local Providers (Click, Payme)
  // ------------------------------------------------------------------

  async getPaymentLinks(organizationId: string, invoiceId: string) {
    const invoice = await this.findOne(organizationId, invoiceId);
    const outstandingMinor =
      toMinor(invoice.total) -
      toMinor(invoice.paidAmount ?? 0) +
      toMinor(invoice.refundedAmount ?? 0);
    const amountUzs = fromMinor(Math.max(0, outstandingMinor));

    const studentName = invoice.student?.user
      ? `${invoice.student.user.firstName} ${invoice.student.user.lastName ?? ''}`.trim()
      : undefined;

    return generatePaymentLinks({
      invoiceId: invoice.id,
      amountUzs: Number(amountUzs),
      organizationId,
      studentName,
    });
  }

  // ------------------------------------------------------------------
  // Prorated Tuition Billing (Kunbay hisoblash)
  // ------------------------------------------------------------------

  async proratePreview(organizationId: string, dto: ProrateInvoiceDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, organizationId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');

    const totalLessons = dto.totalLessonsInMonth ?? 12;
    const start = new Date(dto.startDate);

    let remainingLessons = dto.remainingLessons;
    if (remainingLessons === undefined || remainingLessons === null) {
      const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      const remainingDays = Math.max(1, daysInMonth - start.getDate() + 1);
      const ratio = remainingDays / daysInMonth;
      remainingLessons = Math.max(1, Math.min(totalLessons, Math.round(totalLessons * ratio)));
    }

    const lessonRate = Math.round(dto.fullMonthlyAmount / totalLessons);
    const proratedTotal = Math.round(lessonRate * remainingLessons);

    return {
      studentId: dto.studentId,
      studentName: `${student.user.firstName} ${student.user.lastName ?? ''}`.trim(),
      groupId: dto.groupId,
      startDate: dto.startDate,
      fullMonthlyAmount: dto.fullMonthlyAmount,
      totalLessonsInMonth: totalLessons,
      remainingLessons,
      lessonRate,
      proratedTotal,
    };
  }

  async createProratedInvoice(organizationId: string, actorId: string, dto: ProrateInvoiceDto) {
    const preview = await this.proratePreview(organizationId, dto);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-PRORATE-${Date.now().toString().slice(-4)}${randomSuffix}`;

    const invoiceDto: CreateInvoiceDto = {
      studentId: dto.studentId,
      number: invoiceNumber,
      currency: 'UZS',
      notes: dto.notes ?? `Prorated tuition starting from ${dto.startDate}`,
      items: [
        {
          description: `Prorated Tuition: ${preview.remainingLessons}/${preview.totalLessonsInMonth} lessons from ${dto.startDate}`,
          quantity: preview.remainingLessons,
          unitPrice: preview.lessonRate,
        },
      ],
    };

    const invoice = await this.createInvoice(organizationId, actorId, invoiceDto);
    return this.issueInvoice(organizationId, actorId, invoice.id);
  }

  // ------------------------------------------------------------------
  // Debtor Lockout Policy (Qarzdorlik nazorati)
  // ------------------------------------------------------------------

  async checkStudentDebtorStatus(organizationId: string, studentId: string, graceDays = 5) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
      include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - graceDays);

    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        studentId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        dueDate: { lt: cutoff },
      },
      select: {
        id: true,
        number: true,
        dueDate: true,
        total: true,
        paidAmount: true,
        refundedAmount: true,
      },
    });

    let totalOverdueMinor = 0;
    for (const inv of overdueInvoices) {
      const outstanding =
        toMinor(inv.total) - toMinor(inv.paidAmount ?? 0) + toMinor(inv.refundedAmount ?? 0);
      if (outstanding > 0) {
        totalOverdueMinor += outstanding;
      }
    }

    const overdueAmount = fromMinor(totalOverdueMinor);
    const isDebtor = totalOverdueMinor > 0;

    return {
      studentId,
      studentName: `${student.user.firstName} ${student.user.lastName ?? ''}`.trim(),
      isDebtor,
      overdueAmount: Number(overdueAmount),
      overdueCount: overdueInvoices.length,
      graceDays,
      cutoffDate: cutoff.toISOString().slice(0, 10),
      message: isDebtor
        ? `To'lov muddati o'tgan qarzdorlik: ${new Intl.NumberFormat('uz-UZ').format(Number(overdueAmount))} so'm (${overdueInvoices.length} ta hisob-faktura)`
        : "Qarzdorlik yo'q — barcha to'lovlar o'z vaqtida amalga oshirilgan",
    };
  }
}



