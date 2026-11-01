import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeacherKpiPayrollService } from '../teacher-kpi-payroll.service';

describe('TeacherKpiPayrollService', () => {
  let service: TeacherKpiPayrollService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      teacher: {
        findMany: vi.fn(),
      },
      lesson: {
        findMany: vi.fn(),
      },
      payment: {
        findMany: vi.fn(),
      },
      payrollRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    };
    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new TeacherKpiPayrollService(mockPrisma, mockAudit);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculates hourly teacher payroll proposal with conducted lessons and attendance rate', async () => {
    const mockTeacher = {
      id: 'teacher-1',
      organizationId: 'org-1',
      salaryType: 'HOURLY',
      hourlyRate: 100_000,
      baseSalary: null,
      user: { firstName: 'Anvar', lastName: 'Saidov' },
      Employee: { salary: null },
      groups: [
        {
          id: 'group-1',
          isActive: true,
          enrollments: [{ studentId: 'st-1' }, { studentId: 'st-2' }],
        },
      ],
    };

    const mockLessons = [
      {
        id: 'lesson-1',
        startTime: '10:00',
        endTime: '12:00', // 2 hours
        attendances: [{ status: 'PRESENT' }, { status: 'PRESENT' }],
      },
      {
        id: 'lesson-2',
        startTime: '14:00',
        endTime: '16:00', // 2 hours
        attendances: [{ status: 'PRESENT' }, { status: 'LATE' }],
      },
    ];

    mockPrisma.teacher.findMany.mockResolvedValue([mockTeacher]);
    mockPrisma.lesson.findMany.mockResolvedValue(mockLessons);
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const result = await service.calculateBatchTeacherProposals('org-1', {
      periodYear: 2026,
      periodMonth: 10,
    });

    expect(result.teachersCount).toBe(1);
    const p = result.proposals[0];
    expect(p.teacherId).toBe('teacher-1');
    expect(p.conductedLessonsCount).toBe(2);
    expect(p.totalTeachingHours).toBe(4);
    expect(p.calculatedGrossUz).toBeGreaterThanOrEqual(400_000);
    expect(p.calculatedNetUz).toBeLessThan(p.calculatedGrossUz);
  });

  it('atomically commits batch payroll runs with transaction and audit trail', async () => {
    mockPrisma.payrollRun.findFirst.mockResolvedValue(null);
    mockPrisma.payrollRun.create.mockResolvedValue({ id: 'pr-new-1' });

    const batchResult = await service.batchApproveAndCommit('org-1', 'admin-1', {
      periodYear: 2026,
      periodMonth: 10,
      proposals: [
        {
          teacherId: 'teacher-1',
          grossAmount: 5_000_000,
          netAmount: 4_400_000,
          bonus: 600_000,
          deduction: 600_000,
        },
      ],
    });

    expect(batchResult.success).toBe(true);
    expect(batchResult.committedRunsCount).toBe(1);
    expect(batchResult.totalGrossUz).toBe(5_000_000);
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'BATCH_PAYROLL_APPROVED',
      }),
    );
  });
});
