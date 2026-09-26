import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialPeriodService } from '../analytics/financial-period.service';
import { parsePagination } from '../lib/pagination';
import { PaymentStatus, Prisma } from '@prisma/client';
import { CreatePaymentDto, UpdatePaymentDto } from '../common/dto';
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
              ],
            },
          },
        },
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
          reference: data.reference,
        },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      });
      return created;
    } catch (error: any) {
      if (error.code === 'P2002') {
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
      const snapshot =
        attempt === 1
          ? existing
          : await this.findOne(organizationId, id);

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

          const refundAgg = await tx.refund.aggregate({
            where: { paymentId: id, status: 'PROCESSED' },
            _sum: { amount: true },
          });
          const processedRefundMinor = toMinor(refundAgg._sum.amount ?? 0);

          const wasPaid = row.status === 'PAID';
          const willBePaid = newStatus === 'PAID' || (newStatus === undefined && wasPaid);
          const oldAmountMinor = toMinor(row.amount);
          const newAmountMinor =
            data.amount !== undefined ? toMinor(data.amount) : oldAmountMinor;

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
      } catch (error: any) {
        if (error.code === 'P2002') {
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
}

