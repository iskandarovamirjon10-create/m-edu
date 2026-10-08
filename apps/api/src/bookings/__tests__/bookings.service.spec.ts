import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingsService } from '../bookings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookingDto, BookingQueryDto } from '../dto/booking.dto';

type MockPrismaService = {
  resourceBooking: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  resource: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('BookingsService', () => {
  let service: BookingsService;
  let mockPrisma: MockPrismaService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      resourceBooking: {
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      resource: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: MockPrismaService) => Promise<unknown>) => {
        return cb(mockPrisma);
      }),
    };

    service = new BookingsService(mockPrisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('should query bookings with organizationId and flatten resource name', async () => {
      const orgId = 'org-1';
      const query: BookingQueryDto = {
        resourceId: 'res-1',
        status: 'CONFIRMED',
        bookedBy: 'user-1',
        skip: 10,
        take: 5,
      };

      const mockBookings = [
        {
          id: 'b-1',
          organizationId: orgId,
          resourceId: 'res-1',
          title: 'Class A',
          resource: { name: 'Room 101' },
        },
        {
          id: 'b-2',
          organizationId: orgId,
          resourceId: 'res-1',
          title: 'Class B',
          resource: null,
        },
      ];

      mockPrisma.resourceBooking.findMany.mockResolvedValue(mockBookings);
      mockPrisma.resourceBooking.count.mockResolvedValue(2);

      const result = await service.findAll(orgId, query);

      expect(mockPrisma.resourceBooking.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          resourceId: 'res-1',
          status: 'CONFIRMED',
          bookedBy: 'user-1',
        },
        orderBy: { startAt: 'desc' },
        skip: 10,
        take: 5,
        include: { resource: { select: { name: true } } },
      });
      expect(mockPrisma.resourceBooking.count).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          resourceId: 'res-1',
          status: 'CONFIRMED',
          bookedBy: 'user-1',
        },
      });

      expect(result).toEqual({
        items: [
          {
            id: 'b-1',
            organizationId: orgId,
            resourceId: 'res-1',
            title: 'Class A',
            resourceName: 'Room 101',
          },
          {
            id: 'b-2',
            organizationId: orgId,
            resourceId: 'res-1',
            title: 'Class B',
            resourceName: undefined,
          },
        ],
        total: 2,
      });
    });

    it('should use default pagination values when skip/take are not provided', async () => {
      const orgId = 'org-1';
      const query: BookingQueryDto = {};

      mockPrisma.resourceBooking.findMany.mockResolvedValue([]);
      mockPrisma.resourceBooking.count.mockResolvedValue(0);

      await service.findAll(orgId, query);

      expect(mockPrisma.resourceBooking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });
  });

  describe('create', () => {
    const orgId = 'org-1';
    const validDto: CreateBookingDto = {
      resourceId: 'res-1',
      title: 'Math Lab',
      description: 'Exam preparation',
      startAt: '2026-09-20T10:00:00.000Z',
      endAt: '2026-09-20T11:00:00.000Z',
      bookedBy: 'Teacher Alice',
      attendees: 25,
      notes: 'Projector needed',
    };

    it('should throw BadRequestException if startAt is invalid', async () => {
      await expect(
        service.create(orgId, { ...validDto, startAt: 'invalid-date' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if endAt is invalid', async () => {
      await expect(
        service.create(orgId, { ...validDto, endAt: 'not-a-date' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if endAt <= startAt', async () => {
      await expect(
        service.create(orgId, {
          ...validDto,
          startAt: '2026-09-20T11:00:00.000Z',
          endAt: '2026-09-20T10:00:00.000Z',
        }),
      ).rejects.toThrow('endAt must be after startAt');
    });

    it('should throw NotFoundException if resource does not exist in the tenant organization', async () => {
      mockPrisma.resource.findFirst.mockResolvedValue(null);

      await expect(service.create(orgId, validDto)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.resource.findFirst).toHaveBeenCalledWith({
        where: { id: validDto.resourceId, organizationId: orgId },
      });
    });

    it('should throw BadRequestException if overlapping booking conflict exists', async () => {
      mockPrisma.resource.findFirst.mockResolvedValue({ id: 'res-1', organizationId: orgId });
      mockPrisma.resourceBooking.findMany.mockResolvedValue([
        { id: 'existing-conflict-1' },
      ]);

      await expect(service.create(orgId, validDto)).rejects.toThrow(
        /Booking conflict: 1 overlapping booking\(s\)/,
      );

      expect(mockPrisma.resourceBooking.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          resourceId: validDto.resourceId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          AND: [
            { startAt: { lt: new Date(validDto.endAt) } },
            { endAt: { gt: new Date(validDto.startAt) } },
          ],
        },
      });
    });

    it('should successfully create booking when no conflicts exist', async () => {
      mockPrisma.resource.findFirst.mockResolvedValue({ id: 'res-1', organizationId: orgId });
      mockPrisma.resourceBooking.findMany.mockResolvedValue([]);
      const createdRecord = { id: 'booking-new-1', ...validDto, organizationId: orgId };
      mockPrisma.resourceBooking.create.mockResolvedValue(createdRecord);

      // Creator identity now comes from the authenticated principal (JWT),
      // never from the request body (bookedBy spoofing — release gate fix).
      const result = await service.create(orgId, validDto, 'user-123');

      expect(mockPrisma.resourceBooking.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          resourceId: validDto.resourceId,
          title: validDto.title,
          description: validDto.description,
          startAt: new Date(validDto.startAt),
          endAt: new Date(validDto.endAt),
          status: 'PENDING',
          bookedBy: 'user-123',
          attendees: 25,
          notes: 'Projector needed',
        },
      });
      expect(result).toBe(createdRecord);
    });

    it('ignores a client-supplied bookedBy (no attribution spoofing)', async () => {
      mockPrisma.resource.findFirst.mockResolvedValue({ id: 'res-1', organizationId: orgId });
      mockPrisma.resourceBooking.findMany.mockResolvedValue([]);
      mockPrisma.resourceBooking.create.mockResolvedValue({ id: 'booking-3' });

      await service.create(orgId, { ...validDto, bookedBy: 'administrator@evil.example' });

      expect(mockPrisma.resourceBooking.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ bookedBy: 'UNKNOWN' }) }),
      );
    });

    it('should fallback bookedBy to UNKNOWN and status to PENDING if not provided', async () => {
      mockPrisma.resource.findFirst.mockResolvedValue({ id: 'res-1', organizationId: orgId });
      mockPrisma.resourceBooking.findMany.mockResolvedValue([]);
      mockPrisma.resourceBooking.create.mockResolvedValue({ id: 'booking-2' });

      const minimalDto: CreateBookingDto = {
        resourceId: 'res-1',
        title: 'Quick Meeting',
        startAt: '2026-09-20T14:00:00.000Z',
        endAt: '2026-09-20T15:00:00.000Z',
      };

      await service.create(orgId, minimalDto);

      expect(mockPrisma.resourceBooking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'PENDING',
          bookedBy: 'UNKNOWN',
        }),
      });
    });
  });
});
