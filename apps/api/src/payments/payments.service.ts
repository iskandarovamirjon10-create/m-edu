import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialPeriodService } from '../analytics/financial-period.service';
import { parsePagination } from '../lib/pagination';
import { PaymentStatus, Prisma } from '@prisma/client';
import { CreatePaymentDto, UpdatePaymentDto } from '../common/dto';
import { CloseCashierShiftDto, ZReportQueryDto } from './dto/z-report.dto';
import { PaymentQuery } from '../common/dto/query';
import { toMinor, fromMinor, DecimalLike } from '@medu/financial-engine';
import {
  isLegalPaymentTransition,
  paymentStatusBalanceDeltaMinor,
} from './balance-contribution';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialPeriod: FinancialPeriodService,
  ) {}

  async findAll(organizationId: string, query: PaymentQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.PaymentWhereInput = { organizationId };

    if (query.studentId) where.studentId = query.studentId;
    if (query.status) where.status = query.status as Prisma.PaymentWhereInput['status'];
    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        {
          student: {
            user: {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
                { phone: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
        },
        { student: { parentPhone: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId },
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async create(organizationId: string, data: CreatePaymentDto) {
    const now = new Date();
    // Period guard must cover BOTH the booking date and the due date — a
    // payment dated into an open month but due in a closed month used to
    // bypass the closed-period check entirely.
    await this.financialPeriod.ensureNotClosed(organizationId, now);
    if (data.dueDate) {
      await this.financialPeriod.ensureNotClosed(organizationId, new Date(data.dueDate));
    }

    if (data.amount <= 0) throw new BadRequestException('Payment amount must be greater than zero');

    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, organizationId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (data.reference) {
      const existing = await this.prisma.payment.findFirst({
        where: { organizationId, reference: data.reference },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      });
      if (existing) {
        if (existing.studentId === data.studentId && Number(existing.amount) === Number(data.amount)) {
          return existing;
        }
        throw new ConflictException('A payment with this reference already exists with different parameters');
      }
    }

    const reference = data.reference || `PAY-${Date.now()}-${randomUUID().slice(0, 8)}`;

    try {
      const created = await this.prisma.payment.create({
        data: {
          organizationId,
          studentId: data.studentId,
          amount: data.amount,
          status: 'PENDING',
          description: data.description,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          method: data.method,
          reference,
        },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      });
      return created;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A payment with this reference already exists');
      }
      throw error;
    }
  }

  async update(organizationId: string, id: string, data: UpdatePaymentDto) {
    const existing = await this.findOne(organizationId, id);
    if (existing.invoiceId) {
      throw new ConflictException('Payments linked to an invoice cannot be modified directly. Use the Invoices API to process refunds or adjustments.');
    }
    const newStatus = data.status;

    // Reject illegal status transitions before any balance math.
    // PAID → PENDING is not a valid reverse path (use refund / CANCELLED);
    // this is the confirmed P0 transition that double-decremented after refund.
    if (newStatus !== undefined && newStatus !== existing.status) {
      if (!isLegalPaymentTransition(existing.status, newStatus)) {
        throw new ConflictException(
          `Illegal payment status transition ${existing.status} → ${newStatus}`,
        );
      }
    }

    // Check the period of the existing booking AND any new dueDate the
    // caller is moving the payment into.
    await this.financialPeriod.ensureNotClosed(
      organizationId,
      existing.dueDate || existing.createdAt || new Date(),
    );
    if (data.dueDate !== undefined) {
      await this.financialPeriod.ensureNotClosed(organizationId, new Date(data.dueDate));
    }
    if (newStatus === 'PAID' && existing.status !== 'PAID') {
      await this.financialPeriod.ensureNotClosed(organizationId, new Date());
    }

    if (data.amount !== undefined && data.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const updateData: Prisma.PaymentUpdateInput = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.description !== undefined) updateData.description = data.description;
    if (data.method !== undefined) updateData.method = data.method;
    if (data.reference !== undefined) updateData.reference = data.reference;

    // Keep paidAt in sync with PAID status transitions.
    if (newStatus === 'PAID' && existing.status !== 'PAID') {
      updateData.paidAt = new Date();
    } else if (newStatus !== undefined && newStatus !== 'PAID' && existing.status === 'PAID') {
      updateData.paidAt = null;
    }

    if (Object.keys(updateData).length === 0) return existing;

    // Dual-ledger cache (Student.balance): contribution = PAID ? amount -
    // processedRefunds : 0. Deltas come from that single formula so a
    // refund already applied is never reversed again by a status leave.
    // FOR UPDATE on Payment serializes with InvoicesService.processRefund.
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // snapshot is no longer needed as we use locked row inside transaction

      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<
            Array<{ id: string; status: PaymentStatus; amount: DecimalLike; studentId: string | null }>
          >`
            SELECT id, status, amount, "studentId"
            FROM "Payment"
            WHERE id = ${id}::uuid AND "organizationId" = ${organizationId}::uuid
            FOR UPDATE
          `;
          if (locked.length !== 1) return { count: 0, updated: null };
          const row = locked[0];

          // Re-validate transition against the locked row (not the pre-tx snapshot).
          if (newStatus !== undefined && newStatus !== row.status) {
            if (!isLegalPaymentTransition(row.status, newStatus)) {
              throw new ConflictException(
                `Illegal payment status transition ${row.status} → ${newStatus}`,
              );
            }
          }

          // TOCTOU guard (M-EDU-FIN-004): check all active/processed refunds before amount or status modification
          const allRefundsAgg = await tx.refund.aggregate({
            where: { paymentId: id, status: { in: ['REQUESTED', 'APPROVED', 'PROCESSED'] } },
            _sum: { amount: true },
          });
          const totalRefundsMinor = toMinor(allRefundsAgg._sum.amount ?? 0);

          const wasPaid = row.status === 'PAID';
          const willBePaid = newStatus === 'PAID' || (newStatus === undefined && wasPaid);
          const oldAmountMinor = toMinor(row.amount);
          const newAmountMinor =
            data.amount !== undefined ? toMinor(data.amount) : oldAmountMinor;

          if (data.amount !== undefined && newAmountMinor < totalRefundsMinor) {
            throw new BadRequestException(
              `Cannot reduce payment amount below active or processed refunds (refunds: ${fromMinor(totalRefundsMinor)})`,
            );
          }

          if (newStatus !== undefined && newStatus !== 'PAID' && totalRefundsMinor > 0) {
            throw new ConflictException(
              `Cannot change status of payment with active or processed refunds away from PAID`,
            );
          }

          const processedRefundAgg = await tx.refund.aggregate({
            where: { paymentId: id, status: 'PROCESSED' },
            _sum: { amount: true },
          });
          const processedRefundMinor = toMinor(processedRefundAgg._sum.amount ?? 0);

          const balanceDeltaMinor = paymentStatusBalanceDeltaMinor({
            wasPaid,
            willBePaid,
            oldAmountMinor,
            newAmountMinor,
            processedRefundMinor,
          });

          const guardWhere: Prisma.PaymentWhereInput = {
            id,
            organizationId,
            status: row.status,
          };
          if (data.amount !== undefined) {
            const lockedAmount = row.amount;
            if (typeof lockedAmount === 'number') guardWhere.amount = lockedAmount;
            else if (typeof lockedAmount === 'string') guardWhere.amount = lockedAmount;
            else if (lockedAmount && typeof (lockedAmount as { toNumber?: unknown }).toNumber === 'function') {
              guardWhere.amount = (lockedAmount as { toNumber(): number }).toNumber();
            }
          }

          const { count } = await tx.payment.updateMany({
            where: guardWhere,
            data: updateData,
          });
          if (count !== 1) return { count, updated: null };

          if (balanceDeltaMinor !== 0 && row.studentId) {
            await tx.student.update({
              where: { id: row.studentId },
              data: { balance: { increment: fromMinor(balanceDeltaMinor) } },
            });
          }

          const updated = await tx.payment.findUnique({
            where: { id },
            include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
          });
          return { count, updated };
        });

        if (result.count === 1 && result.updated) return result.updated;
        if (attempt === maxAttempts) {
          throw new ConflictException('Payment was modified concurrently, retry');
        }
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('A payment with this reference already exists');
        }
        // Illegal transition / concurrent conflict: do not retry a rejected transition.
        if (error instanceof ConflictException) {
          const msg = String(error.message ?? '');
          if (msg.startsWith('Illegal payment status transition')) throw error;
          if (attempt < maxAttempts) continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Payment was modified concurrently, retry');
  }

  /**
   * Generates a live cashier shift & reconciliation summary (Z-Hisobot).
   * Aggregates completed payments, payment methods (Cash/Terminal/Bank),
   * processed refunds, and calculates net expected cash in the drawer.
   */
  async getZReportSummary(
    organizationId: string,
    params?: ZReportQueryDto,
  ) {
    const now = new Date();
    const start = params?.startDate
      ? new Date(params.startDate)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = params?.endDate ? new Date(params.endDate) : now;

    const [payments, refunds] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          organizationId,
          status: 'PAID',
          paidAt: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          amount: true,
          method: true,
          receiptNumber: true,
          paidAt: true,
          student: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { paidAt: 'asc' },
      }),
      this.prisma.refund.findMany({
        where: {
          organizationId,
          status: 'PROCESSED',
          processedAt: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          amount: true,
          reason: true,
          processedAt: true,
          Payment: { select: { method: true } },
        },
      }),
    ]);

    let totalCollectedMinor = 0;
    const byMethod: Record<string, { count: number; amountMinor: number; amount: number }> = {
      CASH: { count: 0, amountMinor: 0, amount: 0 },
      TERMINAL: { count: 0, amountMinor: 0, amount: 0 },
      BANK: { count: 0, amountMinor: 0, amount: 0 },
      OTHER: { count: 0, amountMinor: 0, amount: 0 },
    };

    let receiptsIssuedCount = 0;

    for (const p of payments) {
      const amtMinor = toMinor(p.amount);
      totalCollectedMinor += amtMinor;
      if (p.receiptNumber) receiptsIssuedCount++;

      const methodKey = (p.method || '').toUpperCase();
      let bucket = 'OTHER';
      if (methodKey.includes('CASH') || methodKey.includes('NAQD')) bucket = 'CASH';
      else if (
        methodKey.includes('TERMINAL') ||
        methodKey.includes('CARD') ||
        methodKey.includes('UZCARD') ||
        methodKey.includes('HUMO')
      ) {
        bucket = 'TERMINAL';
      } else if (
        methodKey.includes('BANK') ||
        methodKey.includes('WIRE') ||
        methodKey.includes('TRANSFER')
      ) {
        bucket = 'BANK';
      }

      byMethod[bucket].count++;
      byMethod[bucket].amountMinor += amtMinor;
      byMethod[bucket].amount = fromMinor(byMethod[bucket].amountMinor);
    }

    let totalRefundsMinor = 0;
    let cashRefundsMinor = 0;
    for (const r of refunds) {
      const rAmtMinor = toMinor(r.amount);
      totalRefundsMinor += rAmtMinor;
      const refMethod = (r.Payment?.method || '').toUpperCase();
      if (refMethod.includes('CASH') || refMethod.includes('NAQD')) {
        cashRefundsMinor += rAmtMinor;
      }
    }

    const netCashDrawerExpectedMinor = byMethod.CASH.amountMinor - cashRefundsMinor;

    return {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totalPaymentsCount: payments.length,
      totalCollected: fromMinor(totalCollectedMinor),
      byMethod: {
        cash: { count: byMethod.CASH.count, amount: byMethod.CASH.amount },
        terminal: { count: byMethod.TERMINAL.count, amount: byMethod.TERMINAL.amount },
        bankTransfer: { count: byMethod.BANK.count, amount: byMethod.BANK.amount },
        other: { count: byMethod.OTHER.count, amount: byMethod.OTHER.amount },
      },
      receiptsIssuedCount,
      refunds: {
        count: refunds.length,
        totalAmount: fromMinor(totalRefundsMinor),
        cashRefundsAmount: fromMinor(cashRefundsMinor),
      },
      netCashDrawerExpected: fromMinor(netCashDrawerExpectedMinor),
      firstPaymentTime: payments[0]?.paidAt?.toISOString() || null,
      lastPaymentTime: payments[payments.length - 1]?.paidAt?.toISOString() || null,
    };
  }

  /**
   * Finalizes and closes a cashier shift, generates an immutable Z-Report
   * with discrepancy calculation (variance between physical cash counted and
   * ledger balance), and writes to the audit log.
   */
  async closeCashierShift(
    organizationId: string,
    user: { sub: string; firstName?: string; lastName?: string },
    dto: CloseCashierShiftDto,
  ) {
    if (dto.actualCashCounted < 0) {
      throw new BadRequestException('Kassadagi naqd pul manfiy bo‘lishi mumkin emas');
    }

    const summary = await this.getZReportSummary(organizationId, {
      startDate: dto.startDate,
      endDate: dto.endDate,
    });

    const expectedMinor = toMinor(summary.netCashDrawerExpected);
    const actualMinor = toMinor(dto.actualCashCounted);
    const varianceMinor = actualMinor - expectedMinor;
    const variance = fromMinor(varianceMinor);

    let status: 'BALANCED' | 'SHORTAGE' | 'SURPLUS' = 'BALANCED';
    if (varianceMinor < 0) status = 'SHORTAGE';
    else if (varianceMinor > 0) status = 'SURPLUS';

    const now = new Date();
    const dateCode = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const reportNumber = `Z-${dateCode}-${randomSuffix}`;

    const cashierName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Kassir';

    const zReportData = {
      reportNumber,
      closedAt: now.toISOString(),
      closedByUserId: user.sub,
      cashierName,
      period: summary.period,
      summary,
      actualCashCounted: dto.actualCashCounted,
      expectedCash: summary.netCashDrawerExpected,
      variance,
      status,
      closingNotes: (dto.closingNotes || '').trim(),
    };

    const auditRecord = await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: user.sub,
        action: 'CASHIER_SHIFT_CLOSED',
        resource: 'PAYMENT_REGISTER',
        resourceId: reportNumber,
        changes: zReportData,
      },
    });

    return {
      success: true,
      reportId: auditRecord.id,
      ...zReportData,
    };
  }

  /**
   * Fetches the recent Z-Reports audit log for this organization.
   */
  async getRecentZReports(organizationId: string, limit = 20) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        action: 'CASHIER_SHIFT_CLOSED',
        resource: 'PAYMENT_REGISTER',
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        resourceId: true,
        timestamp: true,
        changes: true,
      },
    });

    return logs.map((log) => ({
      id: log.id,
      reportNumber: log.resourceId,
      timestamp: log.timestamp,
      ...(log.changes as object),
    }));
  }
}
