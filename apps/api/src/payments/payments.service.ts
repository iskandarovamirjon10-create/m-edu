import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialPeriodService } from '../analytics/financial-period.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreatePaymentDto, UpdatePaymentDto } from '../common/dto';
import { PaymentQuery } from '../common/dto/query';

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

    // Dual-ledger cache (Student.balance): only Payment rows in status PAID
    // count as money-in. Adjust the cache when this write changes PAID-ness
    // or the amount of an already-PAID row. Invoice-linked payments already
    // maintain the cache in InvoicesService.recordPayment/processRefund —
    // those rows never pass through this standalone CRUD path with a status
    // flip from/to PAID after creation, so there is no double-count.
    const wasPaid = existing.status === 'PAID';
    const willBePaid = newStatus === 'PAID' || (newStatus === undefined && wasPaid);
    const nextAmount = data.amount !== undefined ? data.amount : Number(existing.amount);
    let balanceDelta = 0;
    if (!wasPaid && willBePaid) balanceDelta = nextAmount;
    else if (wasPaid && !willBePaid) balanceDelta = -Number(existing.amount);
    else if (wasPaid && willBePaid && data.amount !== undefined) {
      balanceDelta = nextAmount - Number(existing.amount);
    }

    // CAS on status (and amount when present): a concurrent writer that
    // already moved this payment out of `snapshot.status` makes count=0, so
    // we re-read and retry with the fresh snapshot instead of clobbering.
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const snapshot =
        attempt === 1
          ? existing
          : await this.findOne(organizationId, id);

      const guardWhere: Prisma.PaymentWhereInput = {
        id,
        organizationId,
        status: snapshot.status,
      };
      if (data.amount !== undefined) guardWhere.amount = snapshot.amount;

      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const { count } = await tx.payment.updateMany({
            where: guardWhere,
            data: updateData,
          });
          if (count !== 1) return { count, updated: null };

          if (balanceDelta !== 0 && snapshot.studentId) {
            await tx.student.update({
              where: { id: snapshot.studentId },
              data: { balance: { increment: balanceDelta } },
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
        if (error instanceof ConflictException && attempt < maxAttempts) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Payment was modified concurrently, retry');
  }
}
