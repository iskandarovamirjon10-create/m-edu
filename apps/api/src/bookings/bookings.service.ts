import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingQueryDto, CreateBookingDto } from './dto/booking.dto';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: BookingQueryDto) {
    const where: Prisma.ResourceBookingWhereInput = { organizationId: orgId };
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.status) where.status = query.status;
    if (query.bookedBy) where.bookedBy = query.bookedBy;

    const takeRaw = Number(query.take ?? 20);
    const take = Math.min(
      Number.isFinite(takeRaw) && takeRaw > 0 ? Math.trunc(takeRaw) : 20,
      200,
    );
    const skip = Math.max(0, Number(query.skip) || 0);

    const [items, total] = await Promise.all([
      this.prisma.resourceBooking.findMany({
        where,
        orderBy: { startAt: 'desc' },
        skip,
        take,
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

  async create(orgId: string, dto: CreateBookingDto, bookerId?: string) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
      throw new BadRequestException('Invalid startAt or endAt');
    }
    if (endAt <= startAt) {
      throw new BadRequestException('endAt must be after startAt');
    }

    return this.prisma.$transaction(async (tx) => {
      // Validate that resource exists and belongs to the same organization
      const resource = await tx.resource.findFirst({
        where: {
          id: dto.resourceId,
          organizationId: orgId,
        },
      });

      if (!resource) {
        throw new NotFoundException(`Resource ${dto.resourceId} not found`);
      }

      // Check for overlapping bookings for this resource in this org
      const conflicts = await tx.resourceBooking.findMany({
        where: {
          organizationId: orgId,
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
          // SECURITY: the creator identity comes from the JWT, never from
          // the request body (a client-supplied bookedBy was previously
          // written verbatim - attribution spoofing).
          bookedBy: bookerId ?? 'UNKNOWN',
          attendees: dto.attendees,
          notes: dto.notes,
        },
      });
    });
  }
}
