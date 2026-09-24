import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingsController } from '../bookings.controller';
import { BookingsService } from '../bookings.service';
import { BookingQueryDto, CreateBookingDto } from '../dto/booking.dto';

describe('BookingsController', () => {
  let controller: BookingsController;
  let service: BookingsService;

  const mockService = {
    findAll: vi.fn(),
    create: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
    service = module.get<BookingsService>(BookingsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should delegate to bookingsService.findAll with orgId and query', async () => {
      const orgId = 'org-uuid-1';
      const query: BookingQueryDto = { resourceId: 'res-1', skip: 0, take: 10 };
      const expectedResult = { items: [], total: 0 };
      mockService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(orgId, query);

      expect(mockService.findAll).toHaveBeenCalledWith(orgId, query);
      expect(result).toBe(expectedResult);
    });
  });

  describe('create', () => {
    it('should delegate to bookingsService.create with orgId and dto', async () => {
      const orgId = 'org-uuid-1';
      const dto: CreateBookingDto = {
        resourceId: 'res-1',
        title: 'Team Meeting',
        startAt: '2026-09-20T10:00:00Z',
        endAt: '2026-09-20T11:00:00Z',
      };
      const expectedBooking = { id: 'b-1', ...dto, organizationId: orgId };
      mockService.create.mockResolvedValue(expectedBooking);

      const result = await controller.create(orgId, dto);

      expect(mockService.create).toHaveBeenCalledWith(orgId, dto);
      expect(result).toBe(expectedBooking);
    });
  });
});
