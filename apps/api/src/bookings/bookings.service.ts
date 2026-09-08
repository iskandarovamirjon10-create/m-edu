import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: any) {
    const where: any = { organizationId: orgId };
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.status) where.status = query.status;
    if (query.bookedBy) where.bookedBy = query.bookedBy;
    const [items, total] = await Promise.all([
      this.prisma.resourceBooking.findMany({
        where,
        orderBy: { startAt: 'desc' },
        skip: query.skip ? parseInt(query.skip, 10) : 0,
        take: query.take ? parseInt(query.take, 10) : 20,
        include: { resource: { select: { name: true } } },
      }),
      this.prisma.resourceBooking.count({ where }),
    ]);
    // Flatten resource.name → resourceName so the UI can display it directly
    return {
      items: items.map(({ resource, ...b }) => ({ ...b, resourceName: resource?.name })),
      total,
    };
  }

  async create(orgId: string, dto: any) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
      throw new BadRequestException('Invalid startAt or endAt');
    }
    if (endAt <= startAt) {
      throw new BadRequestException('endAt must be after startAt');
    }

    return this.prisma.$transaction(async (tx) => {
      const conflicts = await tx.resourceBooking.findMany({
        where: {
          resourceId: dto.resourceId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          AND: [
            { startAt: { lt: endAt } },
            { endAt: { gt: startAt } },
          ],
        },
      });

      if (conflicts.length > 0) {
        throw new BadRequestException(
          `Booking conflict: ${conflicts.length} overlapping booking(s) for this resource in the requested time window`,
        );
      }

      return tx.resourceBooking.create({
        data: {
          organizationId: orgId,
          resourceId: dto.resourceId,
          title: dto.title,
          description: dto.description,
          startAt,
          endAt,
          status: dto.status ?? 'PENDING',
          bookedBy: dto.bookedBy,
          attendees: dto.attendees,
          notes: dto.notes,
        },
      });
    });
  }
}
