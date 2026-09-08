import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreatePaymentDto, UpdatePaymentDto } from '../common/dto';
import { PaymentQuery } from '../common/dto/query';


@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, organizationId },
    });
    if (!student) throw new NotFoundException('Student not found');

    try {
      return await this.prisma.payment.create({
        data: {
          organizationId,
          studentId: data.studentId,
          amount: data.amount,
          description: data.description,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          method: data.method,
          reference: data.reference || null,
        },
      });
    } catch (err: unknown) {
      // P2002 = (organizationId, reference) unique — duplicate invoice ref.
      if ((err as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('A payment with this reference already exists');
      }
      throw err;
    }
  }

  /**
   * Legal payment status transitions. PAID and CANCELLED are terminal: a
   * cancelled payment must not be resurrected to PAID (double-counting
   * revenue) and a paid invoice must not be flipped back to PENDING.
   */
  private static readonly ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
    PENDING: ['PAID', 'OVERDUE', 'CANCELLED'],
    OVERDUE: ['PAID', 'CANCELLED', 'PENDING'],
    PAID: [],
    CANCELLED: [],
  };

  async update(organizationId: string, id: string, data: UpdatePaymentDto) {
    const existing = await this.findOne(organizationId, id);

    if (data.status !== undefined && data.status !== existing.status) {
      const allowed = PaymentsService.ALLOWED_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(data.status)) {
        throw new BadRequestException(
          `Invalid payment status transition: ${existing.status} -> ${data.status}`,
        );
      }
    }

    // Protect paid amounts from retroactive changes (audit integrity).
    if (data.amount !== undefined && data.amount !== Number(existing.amount) && existing.status === 'PAID') {
      throw new BadRequestException(
        'To\'langan to\'lov miqdorini o\'zgartirib bo\'lmaydi — avval bekor qiling.',
      );
    }

    const updateData: Prisma.PaymentUpdateInput = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.method !== undefined) updateData.method = data.method;
    if (data.reference !== undefined) updateData.reference = data.reference || null;

    if (Object.keys(updateData).length === 0) return this.findOne(organizationId, id);

    try {
      return await this.prisma.payment.update({ where: { id, organizationId }, data: updateData });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('A payment with this reference already exists');
      }
      throw err;
    }
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.payment.update({ where: { id, organizationId }, data: { status: 'CANCELLED' } });
  }
}
