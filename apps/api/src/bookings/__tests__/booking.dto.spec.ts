import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBookingDto, BookingQueryDto } from '../dto/booking.dto';

describe('Booking DTOs', () => {
  describe('CreateBookingDto', () => {
    it('should validate valid CreateBookingDto', async () => {
      const plain = {
        resourceId: 'res-123',
        title: 'Science Lab',
        description: 'Physics experiment',
        startAt: '2026-09-20T10:00:00.000Z',
        endAt: '2026-09-20T11:00:00.000Z',
        status: 'PENDING',
        bookedBy: 'Teacher John',
        attendees: 30,
        notes: 'Needs glassware',
      };

      const dto = plainToInstance(CreateBookingDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when required fields are missing', async () => {
      const plain = {};
      const dto = plainToInstance(CreateBookingDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const errorProps = errors.map((e) => e.property);
      expect(errorProps).toContain('resourceId');
      expect(errorProps).toContain('title');
      expect(errorProps).toContain('startAt');
      expect(errorProps).toContain('endAt');
    });

    it('should fail when startAt/endAt are not valid ISO date strings', async () => {
      const plain = {
        resourceId: 'res-123',
        title: 'Science Lab',
        startAt: 'invalid-date',
        endAt: '2026-99-99',
      };

      const dto = plainToInstance(CreateBookingDto, plain);
      const errors = await validate(dto);

      const errorProps = errors.map((e) => e.property);
      expect(errorProps).toContain('startAt');
      expect(errorProps).toContain('endAt');
    });

    it('should fail when attendees is less than 1 or not an integer', async () => {
      const plain = {
        resourceId: 'res-123',
        title: 'Science Lab',
        startAt: '2026-09-20T10:00:00.000Z',
        endAt: '2026-09-20T11:00:00.000Z',
        attendees: 0,
      };

      const dto = plainToInstance(CreateBookingDto, plain);
      const errors = await validate(dto);

      const attendeesError = errors.find((e) => e.property === 'attendees');
      expect(attendeesError).toBeDefined();
    });
  });

  describe('BookingQueryDto', () => {
    it('should transform and validate numeric skip and take', async () => {
      const plain = {
        resourceId: 'res-1',
        status: 'CONFIRMED',
        skip: '10',
        take: '25',
      };

      const dto = plainToInstance(BookingQueryDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
      expect(dto.skip).toBe(10);
      expect(dto.take).toBe(25);
    });

    it('should fail when skip is negative', async () => {
      const plain = {
        skip: '-5',
      };

      const dto = plainToInstance(BookingQueryDto, plain);
      const errors = await validate(dto);

      const skipError = errors.find((e) => e.property === 'skip');
      expect(skipError).toBeDefined();
    });
  });
});
