import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarService } from '../calendar.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { CalendarEventType } from '@prisma/client';

describe('CalendarService (Double-Booking Conflict Detection)', () => {
  let service: CalendarService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      calendarEvent: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  it('rejects event creation when room/location has an overlapping booking', async () => {
    prisma.calendarEvent.findFirst.mockResolvedValue({
      id: 'conflict-1',
      title: 'Math Exam',
      location: 'Hall A',
    });

    await expect(
      service.create('org-1', 'user-1', {
        title: 'English Exam',
        type: CalendarEventType.EXAM,
        startDate: '2026-10-20T10:00:00.000Z',
        endDate: '2026-10-20T12:00:00.000Z',
        room: 'Hall A',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects event when teacher is already booked in overlapping time slot', async () => {
    prisma.calendarEvent.findFirst.mockResolvedValue({
      id: 'teacher-busy',
      title: 'Physics Lab',
      teacherId: 'teacher-1',
    });

    await expect(
      service.create('org-1', 'user-1', {
        title: 'Remedial Class',
        type: CalendarEventType.LESSON,
        startDate: '2026-10-20T10:00:00.000Z',
        endDate: '2026-10-20T12:00:00.000Z',
        teacherId: 'teacher-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
