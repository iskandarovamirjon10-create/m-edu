import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeacherWorkloadService } from '../teacher-workload.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TeacherWorkloadService', () => {
  let service: TeacherWorkloadService;
  let prisma: {
    teacher: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const orgId = 'org-1';

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      teacher: {
        findMany: vi.fn(),
      },
    };
    service = new TeacherWorkloadService(prisma as unknown as PrismaService);
  });

  it('calculates workload correctly across teachers and groups', async () => {
    prisma.teacher.findMany.mockResolvedValue([
      {
        id: 't1',
        organizationId: orgId,
        user: { firstName: 'Jasur', lastName: 'Akbarov' },
        groups: [
          {
            isActive: true,
            enrollments: [{ isActive: true }, { isActive: true }],
            schedules: [
              { isActive: true, startTime: '09:00', endTime: '11:00' }, // 120 mins = 2 hrs
            ],
          },
        ],
      },
      {
        id: 't2',
        organizationId: orgId,
        user: { firstName: 'Nilufar', lastName: 'Karimova' },
        groups: [
          {
            isActive: true,
            enrollments: [{ isActive: true }],
            schedules: [
              { isActive: true, startTime: '09:00', endTime: '17:00' }, // 480 mins = 8 hrs/day * 5 (simulated 40 hrs if 5 schedules)
              { isActive: true, startTime: '09:00', endTime: '17:00' },
              { isActive: true, startTime: '09:00', endTime: '17:00' },
              { isActive: true, startTime: '09:00', endTime: '17:00' },
              { isActive: true, startTime: '09:00', endTime: '17:00' }, // 40 hrs total -> 100% BALANCED
            ],
          },
        ],
      },
      {
        id: 't3',
        organizationId: orgId,
        user: { firstName: 'Dilshod', lastName: 'Rahimov' },
        groups: [
          {
            isActive: true,
            enrollments: [],
            schedules: [
              { isActive: true, startTime: '08:00', endTime: '18:00' }, // 600 mins = 10 hrs * 5 = 50 hrs -> OVERLOADED
              { isActive: true, startTime: '08:00', endTime: '18:00' },
              { isActive: true, startTime: '08:00', endTime: '18:00' },
              { isActive: true, startTime: '08:00', endTime: '18:00' },
              { isActive: true, startTime: '08:00', endTime: '18:00' },
            ],
          },
        ],
      },
    ]);

    const result = await service.findAll(orgId, { page: 1, limit: 10 });
    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(3);

    const [t1, t2, t3] = result.items;
    expect(t1.status).toBe('UNDERUTILIZED');
    expect(t1.hoursPerWeek).toBe(2);
    expect(t1.studentsCount).toBe(2);

    expect(t2.status).toBe('BALANCED');
    expect(t2.hoursPerWeek).toBe(40);

    expect(t3.status).toBe('OVERLOADED');
    expect(t3.hoursPerWeek).toBe(50);
  });

  it('filters by status when provided in query', async () => {
    prisma.teacher.findMany.mockResolvedValue([
      {
        id: 't1',
        organizationId: orgId,
        user: { firstName: 'Jasur', lastName: 'Akbarov' },
        groups: [],
      },
    ]);

    const result = await service.findAll(orgId, { status: 'OVERLOADED', page: 1, limit: 10 });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('generates summary aggregation metrics', async () => {
    prisma.teacher.findMany.mockResolvedValue([
      {
        id: 't1',
        organizationId: orgId,
        user: { firstName: 'Jasur', lastName: 'Akbarov' },
        groups: [], // 0 hrs -> UNDERUTILIZED
      },
    ]);

    const summary = await service.getSummary(orgId);
    expect(summary.total).toBe(1);
    expect(summary.underutilized).toBe(1);
    expect(summary.balanced).toBe(0);
    expect(summary.overloaded).toBe(0);
    expect(summary.avgUtilization).toBe(0);
  });
});
