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
      student: {
        findUnique: vi.fn(),
      },
      studentGroup: {
        findMany: vi.fn(),
      },
      parentStudent: {
        findMany: vi.fn(),
      },
    };

    service = new CalendarService(prisma as unknown as PrismaService);
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

  describe('findAll (Confidential Staff Event Filtering)', () => {
    it('filters out confidential staff/admin events when accessed by STUDENT', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 'student-1',
        organizationId: 'org-1',
      });
      prisma.studentGroup.findMany.mockResolvedValue([{ groupId: 'group-1' }]);
      prisma.calendarEvent.findMany.mockResolvedValue([
        {
          id: 'ev-1',
          title: 'Math Exam',
          type: 'EXAM',
          Group: { id: 'group-1', name: 'Math 101' },
          Teacher: null,
          User: { firstName: 'Admin', lastName: 'User' },
        },
      ]);

      const res = await service.findAll(
        'org-1',
        {},
        { id: 'user-student-1', role: 'STUDENT' },
      );

      expect(res).toHaveLength(1);
      const queryWhere = prisma.calendarEvent.findMany.mock.calls[0][0].where;
      expect(queryWhere.type).toEqual({ notIn: ['TEACHER_MEETING', 'MEETING'] });
    });

    it('returns empty array when student explicitly requests confidential staff event type', async () => {
      const res = await service.findAll(
        'org-1',
        { type: 'TEACHER_MEETING' },
        { id: 'user-student-1', role: 'STUDENT' },
      );

      expect(res).toEqual([]);
      expect(prisma.calendarEvent.findMany).not.toHaveBeenCalled();
    });

    it('filters out confidential staff events when accessed by PARENT', async () => {
      prisma.parentStudent.findMany.mockResolvedValue([{ studentId: 'student-child-1' }]);
      prisma.studentGroup.findMany.mockResolvedValue([{ groupId: 'group-1' }]);
      prisma.calendarEvent.findMany.mockResolvedValue([]);

      await service.findAll(
        'org-1',
        {},
        { id: 'user-parent-1', role: 'PARENT' },
      );

      const queryWhere = prisma.calendarEvent.findMany.mock.calls[0][0].where;
      expect(queryWhere.type).toEqual({ notIn: ['TEACHER_MEETING', 'MEETING'] });
    });

    it('allows staff members (TEACHER) to receive staff meetings', async () => {
      prisma.calendarEvent.findMany.mockResolvedValue([
        {
          id: 'meeting-1',
          title: 'Staff Weekly Sync',
          type: 'TEACHER_MEETING',
          Group: null,
          Teacher: null,
          User: { firstName: 'Principal', lastName: 'Lead' },
        },
      ]);

      const res = await service.findAll(
        'org-1',
        { type: 'TEACHER_MEETING' },
        { id: 'user-teacher-1', role: 'TEACHER' },
      );

      expect(res).toHaveLength(1);
      const queryWhere = prisma.calendarEvent.findMany.mock.calls[0][0].where;
      expect(queryWhere.type).toBe('TEACHER_MEETING');
    });
  });
});
