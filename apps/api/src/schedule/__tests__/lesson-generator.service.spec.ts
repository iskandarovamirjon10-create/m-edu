import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LessonGeneratorService } from '../lesson-generator.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DayOfWeek } from '@prisma/client';

function createMockPrisma() {
  return {
    schedule: {
      findMany: vi.fn(),
    },
    group: {
      findFirst: vi.fn(),
    },
    lesson: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    organizationHoliday: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $executeRaw: vi.fn().mockResolvedValue(0),
  };
}

describe('LessonGeneratorService Unit Tests', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: LessonGeneratorService;

  const orgId = 'org-1';

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = new LessonGeneratorService(prisma as unknown as PrismaService);
  });

  it('rejects invalid dates or negative range', async () => {
    await expect(
      service.generate(orgId, new Date('invalid'), new Date('2026-09-10')),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.generate(orgId, new Date('2026-09-10'), new Date('2026-09-01')),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects date range exceeding 62 days', async () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-04-01'); // 90 days
    await expect(service.generate(orgId, from, to)).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when specific group does not exist', async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.group.findFirst.mockResolvedValue(null);

    await expect(
      service.generate(orgId, new Date('2026-09-01'), new Date('2026-09-07'), 'g-missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('generates lessons idempotently for schedules in range', async () => {
    const from = new Date('2026-09-01T00:00:00.000Z'); // Tuesday
    const to = new Date('2026-09-07T23:59:59.999Z');   // Monday

    prisma.schedule.findMany.mockResolvedValue([
      {
        id: 'sch-1',
        groupId: 'g-1',
        dayOfWeek: DayOfWeek.TUESDAY,
        startTime: '09:00',
        endTime: '10:30',
        room: '101',
        group: { id: 'g-1', teacherId: 't-1', room: '101' },
      },
    ]);

    prisma.lesson.createMany.mockResolvedValue({ count: 1 });
    prisma.lesson.findMany.mockResolvedValue([]);
    prisma.lesson.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.generate(orgId, from, to);
    expect(result.created).toBe(1);
    expect(result.schedulesMatched).toBe(1);
    expect(prisma.lesson.createMany).toHaveBeenCalled();
  });
});
