import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PayrollService } from '../payroll.service';
import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  const mock: any = {
    teacher: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    payrollPeriod: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    payrollRun: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn().mockImplementation((args: any) => ({ ...args.data, id: 'run-created-1' })),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    payrollAdjustment: { create: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-uuid-1' }) },
    attendance: { findMany: vi.fn().mockResolvedValue([]) },
    grade: { findMany: vi.fn().mockResolvedValue([]) },
    lesson: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    group: { findMany: vi.fn().mockResolvedValue([]) },
    groupEnrollment: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn() },
    payment: { aggregate: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  };
  mock.$transaction = vi.fn(async (fn: (tx: typeof mock) => Promise<unknown>) => fn(mock));
  return mock;
}

describe('Forensic Payroll Audit Spec', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let financialPeriod: { ensureNotClosedTx: ReturnType<typeof vi.fn>; ensureNotClosed: ReturnType<typeof vi.fn> };
  let svc: PayrollService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    financialPeriod = {
      ensureNotClosedTx: vi.fn().mockResolvedValue(undefined),
      ensureNotClosed: vi.fn().mockResolvedValue(undefined),
    };
    svc = new PayrollService(
      prisma as unknown as PrismaService,
      audit as any,
      financialPeriod as any,
    );
  });

  describe('Zero-Lessons Teacher Smart KPI Edge Case', () => {
    it('awards 0 KPI bonuses when a teacher has 0 conducted lessons and 0 hours worked in period', async () => {
      prisma.teacher.findFirst.mockResolvedValueOnce({
        id: 'teacher-zero-1',
        organizationId: 'org-1',
        salaryType: 'MONTHLY',
        baseSalary: 6_000_000,
        user: { firstName: 'NoLessons', lastName: 'Teacher', email: 'nolessons@medu.uz' },
        groups: [
          {
            id: 'grp-1',
            name: 'Inactive Group',
            course: { name: 'English' },
            enrollments: [], // No enrolled students
          },
        ],
      });

      // No attendance records
      prisma.attendance.findMany.mockResolvedValueOnce([]);
      // No grade records
      prisma.grade.findMany.mockResolvedValueOnce([]);
      // 0 conducted lessons
      prisma.lesson.count.mockResolvedValueOnce(0);
      // 0 completed lessons list
      prisma.lesson.findMany.mockResolvedValueOnce([]);

      const result = await svc.calculateTeacherSmartKpi('org-1', {
        teacherId: 'teacher-zero-1',
        year: 2026,
        month: 10,
      });

      // Verification: no phantom 12 conducted lessons or 20 hours worked!
      expect(result.pillars.discipline.conductedLessons).toBe(0);
      expect(result.pillars.discipline.hoursWorked).toBe(0);

      // Attendance rate and bonus must evaluate to 0
      expect(result.pillars.attendance.rate).toBe(0);
      expect(result.pillars.attendance.bonusEarned).toBe(0);

      // Retention rate and bonus must evaluate to 0 (no enrolled students)
      expect(result.pillars.retention.rate).toBe(0);
      expect(result.pillars.retention.bonusEarned).toBe(0);

      // Academic average and bonus must evaluate to 0
      expect(result.pillars.academic.averageScore).toBe(0);
      expect(result.pillars.academic.bonusEarned).toBe(0);

      // Total bonus must be strictly 0
      expect(result.totalRecommendedBonus).toBe(0);
    });
  });

  describe('Payroll Run Validation & Fallbacks', () => {
    it('falls back safely to MONTHLY salary type when neither DTO nor teacher has salaryType', async () => {
      prisma.teacher.findFirst.mockResolvedValueOnce({
        id: 't-nosalarytype',
        organizationId: 'org-1',
        salaryType: null, // missing on teacher
        baseSalary: 3_000_000,
        user: { id: 'u1', isActive: true },
        Employee: { salary: 3_000_000 },
      });
      prisma.lesson.count.mockResolvedValueOnce(10);
      prisma.lesson.findMany.mockResolvedValueOnce([]);
      prisma.attendance.findMany.mockResolvedValueOnce([]);

      const run = await svc.calculateRun('org-1', 'admin-1', {
        teacherId: 't-nosalarytype',
        periodYear: 2026,
        periodMonth: 10,
      });

      expect(run.salaryType).toBe('MONTHLY');
      expect(run.grossAmount).toBe(3_000_000);
    });

    it('rejects invalid salaryType with BadRequestException', async () => {
      prisma.teacher.findFirst.mockResolvedValueOnce({
        id: 't-invalid',
        organizationId: 'org-1',
        user: { id: 'u1', isActive: true },
        Employee: null,
      });

      await expect(
        svc.calculateRun('org-1', 'admin-1', {
          teacherId: 't-invalid',
          periodYear: 2026,
          periodMonth: 10,
          salaryType: 'INVALID_TYPE' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects negative bonus in calculateRun with BadRequestException', async () => {
      prisma.teacher.findFirst.mockResolvedValueOnce({
        id: 't-1',
        organizationId: 'org-1',
        salaryType: 'MONTHLY',
        user: { id: 'u1', isActive: true },
        Employee: null,
      });

      await expect(
        svc.calculateRun('org-1', 'admin-1', {
          teacherId: 't-1',
          periodYear: 2026,
          periodMonth: 10,
          bonus: -1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects negative deduction in calculateRun with BadRequestException', async () => {
      prisma.teacher.findFirst.mockResolvedValueOnce({
        id: 't-1',
        organizationId: 'org-1',
        salaryType: 'MONTHLY',
        user: { id: 'u1', isActive: true },
        Employee: null,
      });

      await expect(
        svc.calculateRun('org-1', 'admin-1', {
          teacherId: 't-1',
          periodYear: 2026,
          periodMonth: 10,
          deduction: -500,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Multi-Group Revenue Share Isolation & Retention Edge Cases', () => {
    it('isolates revenue share calculation to specified group when groupId is supplied', async () => {
      prisma.teacher.findFirst.mockResolvedValueOnce({
        id: 't-rev-1',
        organizationId: 'org-1',
        user: { firstName: 'Jasur', lastName: 'Aliyev' },
        groups: [
          {
            id: 'grp-isolated',
            name: 'Group A',
            enrollments: [
              { studentId: 's1', isActive: true },
              { studentId: 's2', isActive: true },
            ],
          },
          {
            id: 'grp-other',
            name: 'Group B',
            enrollments: [{ studentId: 's3', isActive: true }],
          },
        ],
      });

      prisma.payment.findMany.mockResolvedValueOnce([
        { amount: 10_000_000 },
      ]);

      const res = await svc.calculateRevenueShare('org-1', {
        teacherId: 't-rev-1',
        year: 2026,
        month: 10,
        revenueSharePercentage: 20,
        groupId: 'grp-isolated',
      });

      // Only Group A (2 students) should be considered, base share is 20% of 10M
      expect(res.baseShareAmount).toBe(2_000_000);
      const grpA = res.groups.find((g) => g.id === 'grp-isolated');
      expect(grpA?.studentsCount).toBe(2);
    });

    it('returns 0% retention rate and 0 retention bonus when teacher has 0 enrolled students', async () => {
      prisma.teacher.findFirst.mockResolvedValueOnce({
        id: 't-empty-groups',
        organizationId: 'org-1',
        user: { firstName: 'Nodira', lastName: 'Ismoilova' },
        groups: [
          {
            id: 'grp-empty',
            name: 'Empty Group',
            enrollments: [], // 0 students
          },
        ],
      });

      prisma.payment.findMany.mockResolvedValueOnce([]);

      const res = await svc.calculateRevenueShare('org-1', {
        teacherId: 't-empty-groups',
        year: 2026,
        month: 10,
        revenueSharePercentage: 20,
      });

      expect(res.retentionRate).toBe(0);
      expect(res.retentionBonusEarned).toBe(0);
    });
  });
});
