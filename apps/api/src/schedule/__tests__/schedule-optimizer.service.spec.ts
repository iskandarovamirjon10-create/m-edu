import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScheduleOptimizerService } from '../schedule-optimizer.service';
import { DayOfWeek } from '@prisma/client';

describe('ScheduleOptimizerService', () => {
  let service: ScheduleOptimizerService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      schedule: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      group: {
        findMany: vi.fn(),
      },
    };
    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new ScheduleOptimizerService(mockPrisma, mockAudit);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('detects room collision and teacher collision between overlapping schedules', async () => {
    const s1 = {
      id: 'sch-1',
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: '10:00',
      endTime: '11:30',
      room: 'Room 101',
      group: {
        id: 'g-1',
        name: 'Group Alpha',
        room: 'Room 101',
        capacity: 20,
        teacherId: 'teacher-1',
        teacher: { user: { firstName: 'Sardor', lastName: 'Aliyev' } },
        enrollments: [{ studentId: 'st-1' }],
      },
    };

    const s2 = {
      id: 'sch-2',
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: '10:30',
      endTime: '12:00',
      room: 'Room 101',
      group: {
        id: 'g-2',
        name: 'Group Beta',
        room: 'Room 101',
        capacity: 20,
        teacherId: 'teacher-1',
        teacher: { user: { firstName: 'Sardor', lastName: 'Aliyev' } },
        enrollments: [{ studentId: 'st-2' }],
      },
    };

    mockPrisma.schedule.findMany.mockResolvedValue([s1, s2]);

    const result = await service.auditAllConflicts('org-1', {});

    expect(result.totalConflicts).toBeGreaterThanOrEqual(2);
    expect(result.byType.ROOM_COLLISION).toBe(1);
    expect(result.byType.TEACHER_COLLISION).toBe(1);
    expect(result.criticalCount).toBeGreaterThanOrEqual(2);
  });

  it('suggests collision-free alternative slots', async () => {
    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'sch-1',
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: '10:00',
      endTime: '11:30',
      group: {
        id: 'g-1',
        name: 'Group Alpha',
        teacherId: 'teacher-1',
        capacity: 20,
        enrollments: [{ studentId: 'st-1' }],
      },
    });

    mockPrisma.group.findMany.mockResolvedValue([
      { room: 'Room 202', capacity: 25 },
      { room: 'Room 203', capacity: 20 },
    ]);

    mockPrisma.schedule.findMany.mockResolvedValue([]);

    const result = await service.suggestResolvedSlots('org-1', {
      scheduleId: 'sch-1',
      preferredDays: [DayOfWeek.MONDAY],
    });

    expect(result.scheduleId).toBe('sch-1');
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.options[0].room).toBeDefined();
    expect(result.options[0].score).toBeGreaterThan(80);
  });
});
