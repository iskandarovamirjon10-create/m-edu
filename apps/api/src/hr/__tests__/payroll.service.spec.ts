import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PayrollService } from '../payroll.service';

function createMockPrisma() {
  const tx = {
    payrollRun: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(async (args: unknown) => args.data),
    },
    auditLog: { create: vi.fn(async (args: unknown) => args) },
  };
  return {
    tx,
    teacher: { findFirst: vi.fn() },
    group: { findMany: vi.fn(async () => []) },
    attendance: { findMany: vi.fn(async () => []), groupBy: vi.fn(async () => []) },
    grade: { findMany: vi.fn(async () => []) },
    lesson: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    payrollRun: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(async (args: unknown) => args.data),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  };
}

function createMockAudit() {
  return { record: vi.fn(async (args: unknown) => args) };
}

const teacherRow = {
  id: 'teacher-1',
  organizationId: 'org-1',
  salaryType: 'MONTHLY',
  hourlyRate: null,
  lessonRate: null,
  user: { id: 'u1', isActive: true },
};

const runRow = (status: string) => ({
  id: 'run-1',
  organizationId: 'org-1',
  teacherId: 'teacher-1',
  status,
  netAmount: 100,
  bonus: 0,
  otherDeduction: 0,
  absenceDays: 0,
  lateCount: 0,
  salaryType: 'MONTHLY',
  baseAmount: 1_000_000,
  hoursWorked: 0,
  lessonsCount: 0,
  overtimeHours: 0,
});

describe('PayrollService — calculateRun', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    audit = createMockAudit();
  });

  it('rejects when teacher does not belong to organization (tenant isolation)', async () => {
    prisma.teacher.findFirst.mockResolvedValue(null);
    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    await expect(
      svc.calculateRun('org-1', 'admin-1', {
        teacherId: 't-other',
        periodYear: 2026,
        periodMonth: 9,
        baseAmount: 1_000_000,
      } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects inactive teacher', async () => {
    prisma.teacher.findFirst.mockResolvedValue({ ...teacherRow, user: { id: 'u1', isActive: false } });
    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    await expect(
      svc.calculateRun('org-1', 'admin-1', {
        teacherId: 'teacher-1',
        periodYear: 2026,
        periodMonth: 9,
        baseAmount: 1_000_000,
      } as never),
    ).rejects.toThrow(ConflictException);
  });

  it('requires baseAmount for MONTHLY when teacher has no configured salary', async () => {
    prisma.teacher.findFirst.mockResolvedValue(teacherRow);
    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    await expect(
      svc.calculateRun('org-1', 'admin-1', {
        teacherId: 'teacher-1',
        periodYear: 2026,
        periodMonth: 9,
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps duplicate period calculation to 409 Conflict', async () => {
    prisma.teacher.findFirst.mockResolvedValue(teacherRow);
    prisma.tx.payrollRun.create.mockRejectedValue({ code: 'P2002' });
    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    await expect(
      svc.calculateRun('org-1', 'admin-1', {
        teacherId: 'teacher-1',
        periodYear: 2026,
        periodMonth: 9,
        baseAmount: 1_000_000,
      } as never),
    ).rejects.toThrow(/already exists/);
  });

  it('creates a CALCULATED run with engine breakdown and audit trail', async () => {
    prisma.teacher.findFirst.mockResolvedValue(teacherRow);
    prisma.tx.payrollRun.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);
    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    const run = (await svc.calculateRun('org-1', 'admin-1', {
      teacherId: 'teacher-1',
      periodYear: 2026,
      periodMonth: 9,
      baseAmount: 1_000_000,
      bonus: 100_000,
    } as never)) as unknown as Record<string, unknown>;

    expect(run.status).toBe('CALCULATED');
    expect(run.netAmount).toBe(968_000); // (1,000,000 + 100,000) × 0.88
    expect(prisma.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'PAYROLL_CALCULATE', resource: 'PayrollRun' }) }),
    );
  });
});

describe('PayrollService — lifecycle transitions (negative testing)', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    audit = createMockAudit();
  });

  it('CALCULATED -> REVIEWED succeeds and audits with actor', async () => {
    // First read validates the transition; the method re-reads after the
    // guarded update to return the persisted row.
    prisma.tx.payrollRun.findFirst
      .mockResolvedValueOnce(runRow('CALCULATED'))
      .mockResolvedValueOnce(runRow('REVIEWED'));
    prisma.tx.payrollRun.updateMany.mockResolvedValue({ count: 1 });

    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    const run = (await svc.review('org-1', 'manager-1', 'run-1')) as unknown as Record<string, unknown>;

    expect(run.status).toBe('REVIEWED');
    expect(prisma.tx.payrollRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'CALCULATED' }),
        data: expect.objectContaining({ status: 'REVIEWED', reviewedBy: 'manager-1' }),
      }),
    );
  });

  it('CALCULATED -> APPROVED is illegal (review required)', async () => {
    prisma.tx.payrollRun.findFirst.mockResolvedValueOnce(runRow('CALCULATED'));
    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    await expect(svc.approve('org-1', 'admin-1', 'run-1')).rejects.toThrow(
      /Illegal payroll status transition: CALCULATED -> APPROVED/,
    );
  });

  it('PAID run can never be modified (terminal state)', async () => {
    prisma.tx.payrollRun.findFirst.mockResolvedValue(runRow('PAID'));
    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    await expect(svc.cancel('org-1', 'admin-1', 'run-1', 'mistake')).rejects.toThrow(
      ConflictException,
    );
    await expect(svc.review('org-1', 'admin-1', 'run-1')).rejects.toThrow(ConflictException);
  });

  it('cancel requires a reason', async () => {
    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    await expect(svc.cancel('org-1', 'admin-1', 'run-1', '   ')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('DRAFT -> PAID is illegal (must pass full review chain)', async () => {
    prisma.tx.payrollRun.findFirst.mockResolvedValue(runRow('DRAFT'));
    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    await expect(svc.pay('org-1', 'admin-1', 'run-1')).rejects.toThrow(ConflictException);
  });

  it('concurrent modification (guard count 0) is surfaced as 409, not silent success', async () => {
    prisma.tx.payrollRun.findFirst.mockResolvedValueOnce(runRow('REVIEWED'));
    prisma.tx.payrollRun.updateMany.mockResolvedValue({ count: 0 });
    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    await expect(svc.approve('org-1', 'admin-1', 'run-1')).rejects.toThrow(
      /modified concurrently/,
    );
  });

  it('paying records the paid net amount in the audit trail', async () => {
    prisma.tx.payrollRun.findFirst.mockResolvedValueOnce(runRow('APPROVED'));
    prisma.tx.payrollRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.tx.payrollRun.findUnique.mockResolvedValueOnce(runRow('PAID'));

    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    await svc.pay('org-1', 'admin-1', 'run-1');

    expect(prisma.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PAYROLL_PAID',
          changes: expect.objectContaining({ paidNet: { old: null, new: 100 } }),
        }),
      }),
    );
  });
});

describe('PayrollService — adjust', () => {
  it('rejects adjusting an APPROVED run', async () => {
    const prisma = createMockPrisma();
    const audit = createMockAudit();
    prisma.payrollRun.findFirst.mockResolvedValueOnce(runRow('APPROVED'));

    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    await expect(
      svc.adjust('org-1', 'admin-1', 'run-1', { bonus: 50_000 } as never),
    ).rejects.toThrow(/Only DRAFT or CALCULATED runs can be adjusted/);
  });

  it('recomputes net with new bonus and writes PAYROLL_ADJUST audit', async () => {
    const prisma = createMockPrisma();
    const audit = createMockAudit();
    prisma.payrollRun.findFirst
      .mockResolvedValueOnce(runRow('CALCULATED')) // adjust() getRun
      .mockResolvedValueOnce(runRow('CALCULATED')); // final getRun
    prisma.tx.payrollRun.updateMany.mockResolvedValue({ count: 1 });

    const svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    await svc.adjust('org-1', 'admin-1', 'run-1', { bonus: 100_000 } as never);

    expect(prisma.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'PAYROLL_ADJUST' }) }),
    );
    // updated data flows through updateMany with new net (1,000,000+100,000)*0.88
    expect(prisma.tx.payrollRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ netAmount: 968_000, bonus: 100_000 }),
      }),
    );
  });

  it('adjust preserves late penalty, overtime rate and absence inputs when recomputing', async () => {
    const prisma = createMockPrisma();
    const audit = createMockAudit();

    // Existing calculated run with late penalty, overtime and absence that
    // a naive recompute (dropping those inputs) would silently zero out.
    const withInputs = {
      ...runRow('CALCULATED'),
      lateCount: 2,
      latePenalty: 50_000, // 2 × 25_000
      overtimeHours: 10,
      overtimeRate: 1.5,
      absenceDays: 2,
      absencePenalty: 200_000, // (2,100,000 / 21) × 2 — but baseAmount below is 1_000_000
      baseAmount: 2_100_000,
      bonus: 0,
      otherDeduction: 0,
      hoursWorked: 0,
      lessonsCount: 0,
      salaryType: 'MONTHLY',
    };

    // Fix absence derivation: base 2,100,000 / workdays W × 2 = 200,000 → W = 21
    prisma.payrollRun.findFirst
      .mockResolvedValueOnce(withInputs)
      .mockResolvedValueOnce(withInputs);
    prisma.tx.payrollRun.updateMany.mockResolvedValue({ count: 1 });

    const svc = new PayrollService(
      prisma as never,
      audit as never,
      { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never,
    );
    await svc.adjust('org-1', 'admin-1', 'run-1', { bonus: 100_000 } as never);

    // Recompute must include the restored late penalty deduction:
    // base 2,100,000 + overtime (if any) + bonus 100,000, minus late 50,000, minus absence 200,000
    // With overtimeHours=10: monthlyHourlyValue = 2,100,000/160 ≈ 13,125; OT = 13,125 × 10 × 1.5 = 196,875
    // gross = 2,100,000 + 196,875 + 100,000 = 2,396,875
    // deductions = 50,000 (late) + 200,000 (absence) = 250,000
    // taxable = 2,146,875; tax = round(2,146,875 × 0.12) = 257,625
    // net = 1,889,250
    const call = prisma.tx.payrollRun.updateMany.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    // latePenalty must be re-persisted from restored inputs (not dropped to 0)
    expect(call.data.latePenalty).toBe(50_000);
    expect(call.data.absencePenalty).toBe(200_000);
    expect(call.data.bonus).toBe(100_000);

    // Without restored late/overtime/absence, net would equal the old
    // (1,000,000+100,000)×0.88-style baseline — assert the recompute differs
    // because those inputs were restored.
    const net = Number(call.data.netAmount);
    expect(net).not.toBe(968_000);
    expect(net).toBeGreaterThan(0);

    const breakdown = call.data.breakdown as { lines: Array<{ key: string }> };
    const keys = breakdown.lines.map((l) => l.key);
    expect(keys).toContain('LATE_PENALTY');
    expect(keys).toContain('ABSENCE');
    expect(keys).toContain('OVERTIME');
  });
});

describe('Payroll Golden Scenarios (P0-01 Verification)', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;
  let svc: PayrollService;

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = createMockAudit();
    svc = new PayrollService(prisma as never, audit as never, { ensureNotClosed: vi.fn(), ensureNotClosedTx: vi.fn() } as never);
    prisma.tx.payrollRun.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);
  });

  const setupTeacher = (salaryType: 'HOURLY' | 'PER_LESSON' | 'MONTHLY', rate: number) => {
    prisma.teacher.findFirst.mockResolvedValue({
      id: 'teacher-1',
      organizationId: 'org-1',
      salaryType,
      hourlyRate: salaryType === 'HOURLY' ? rate : null,
      lessonRate: salaryType === 'PER_LESSON' ? rate : null,
      user: { id: 'u1', isActive: true },
    });
  };

  const mockLessons = (count: number, start = '09:00', end = '10:00') => {
    prisma.lesson.count.mockResolvedValue(count);
    prisma.lesson.findMany.mockResolvedValue(Array(count).fill({ startTime: start, endTime: end, id: 'l1' }));
  };

  const mockAbsences = (absent: number, late: number) => {
    prisma.attendance.groupBy.mockResolvedValue([
      { status: 'ABSENT', _count: absent },
      { status: 'LATE', _count: late },
    ]);
  };

  it('Golden 1: Zero conducted lessons (HOURLY)', async () => {
    setupTeacher('HOURLY', 50_000);
    mockLessons(0);
    mockAbsences(0, 0);
    
    const run = (await svc.calculateRun('org-1', 'admin-1', {
      teacherId: 'teacher-1',
      periodYear: 2026,
      periodMonth: 9,
    } as never)) as Record<string, unknown>;

    expect(run.hoursWorked).toBe(0);
    expect(run.grossAmount).toBe(0);
    expect(run.netAmount).toBe(0);
  });

  it('Golden 2: One conducted lesson (PER_LESSON)', async () => {
    setupTeacher('PER_LESSON', 100_000);
    mockLessons(1);
    mockAbsences(0, 0);

    const run = (await svc.calculateRun('org-1', 'admin-1', {
      teacherId: 'teacher-1',
      periodYear: 2026,
      periodMonth: 9,
    } as never)) as Record<string, unknown>;

    expect(run.lessonsCount).toBe(1);
    expect(run.grossAmount).toBe(100_000);
    // tax 12% -> 88_000
    expect(run.netAmount).toBe(88_000);
  });

  it('Golden 3: Multiple lessons with exact hours + bonus - penalty (HOURLY)', async () => {
    setupTeacher('HOURLY', 60_000); // 60k per hour
    mockLessons(10, '10:00', '11:30'); // 1.5 hours per lesson, 10 lessons = 15 hours
    mockAbsences(0, 2); // 2 late arrivals

    const run = (await svc.calculateRun('org-1', 'admin-1', {
      teacherId: 'teacher-1',
      periodYear: 2026,
      periodMonth: 9,
      bonus: 200_000,
      lateCount: 2,
      latePenaltyPerEvent: 25_000,
    } as never)) as Record<string, unknown>;

    expect(run.hoursWorked).toBe(15);
    
    // Base: 15h * 60,000 = 900,000
    // Gross: 900,000 + 200,000 bonus = 1,100,000
    // Deductions: 2 lates * 25,000 = 50,000
    // Taxable: 1,100,000 - 50,000 = 1,050,000
    // Tax: 12% of 1,050,000 = 126,000
    // Net: 1,050,000 - 126,000 = 924,000

    expect(run.grossAmount).toBe(1_100_000);
    expect(run.latePenalty).toBe(50_000);
    expect(run.tax).toBe(126_000);
    expect(run.netAmount).toBe(924_000);
  });

  it('Golden 4: Monthly salary + advance (otherDeduction) + absence', async () => {
    setupTeacher('MONTHLY', null as unknown as number); // monthly salary must be provided in dto
    mockLessons(0); // monthly doesn't depend on lessons
    mockAbsences(2, 0); // 2 absences

    const run = (await svc.calculateRun('org-1', 'admin-1', {
      teacherId: 'teacher-1',
      periodYear: 2026,
      periodMonth: 9,
      baseAmount: 2_100_000, // 2.1M monthly
      otherDeduction: 500_000, // Advance
      workdaysInMonth: 21,
      absenceDays: 2,
    } as never)) as Record<string, unknown>;

    // Base gross = 2,100,000
    // Absence penalty: (2,100,000 / 21) * 2 = 200,000
    // Gross = 2,100,000 (Gross is before absences in the engine, wait, engine says absence is deducted from gross? Let's check engine)
    // In engine: "Unpaid absence: pro-rata daily rate, deducted from gross... amountMinor: -absenceMinor"
    // Wait, let's verify if grossAmount is 2.1M.
    // Yes, engine: gross is base + overtime + bonus. Absences are in deductions.
    // Taxable: 2,100,000 - 200,000 (absence) - 500,000 (otherDeduction) = 1,400,000
    // Tax (12%): 168,000
    // Net: 1,400,000 - 168,000 = 1,232,000

    expect(run.grossAmount).toBe(2_100_000);
    expect(run.absencePenalty).toBe(200_000);
    expect(run.otherDeduction).toBe(500_000);
    expect(run.tax).toBe(168_000);
    expect(run.netAmount).toBe(1_232_000);
  });

  describe('PayrollService — Smart KPI & Performance Bonus Engine', () => {
    it('calculates comprehensive multi-pillar KPI scorecard for high performing teacher', async () => {
      prisma.teacher.findFirst.mockResolvedValueOnce({
        id: 'teacher-kpi-1',
        organizationId: 'org-1',
        salaryType: 'MONTHLY',
        baseSalary: 5_000_000,
        user: { firstName: 'Aziz', lastName: 'Rahimov', email: 'aziz@medu.uz', phone: '+998901234567' },
        groups: [
          {
            id: 'grp-1',
            name: 'IELTS Band 7.5',
            course: { name: 'IELTS Advanced' },
            enrollments: [
              { studentId: 's1', isActive: true },
              { studentId: 's2', isActive: true },
              { studentId: 's3', isActive: true },
              { studentId: 's4', isActive: false }, // 3 active out of 4 = 75% or with grp 2
            ],
          },
          {
            id: 'grp-2',
            name: 'General English C1',
            course: { name: 'English C1' },
            enrollments: [
              { studentId: 's5', isActive: true },
              { studentId: 's6', isActive: true },
              { studentId: 's7', isActive: true },
              { studentId: 's8', isActive: true },
              { studentId: 's9', isActive: true },
              { studentId: 's10', isActive: true }, // 6 active out of 6
            ],
          },
        ],
      });

      // Attendance: 9 PRESENT, 1 LATE -> rate = 95%
      prisma.attendance.findMany.mockResolvedValueOnce([
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'LATE' },
      ]);

      // Grades: avg = 90%
      prisma.grade.findMany.mockResolvedValueOnce([
        { value: 90, maxValue: 100 },
        { value: 95, maxValue: 100 },
        { value: 85, maxValue: 100 },
      ]);

      prisma.lesson.count.mockResolvedValueOnce(16);
      prisma.lesson.findMany.mockResolvedValueOnce([
        { startTime: '10:00', endTime: '12:00' }, // 2 hours
      ]);

      const kpi = await svc.calculateTeacherSmartKpi('org-1', {
        teacherId: 'teacher-kpi-1',
        year: 2026,
        month: 10,
      });

      expect(kpi.teacherName).toBe('Aziz Rahimov');
      // Total enrolled = 10, active = 9 -> retention = 90% (>=88% threshold earned 10% bonus)
      expect(kpi.pillars.retention.rate).toBe(90);
      expect(kpi.pillars.retention.bonusEarned).toBe(500_000); // 10% of 5M

      // Attendance = 95% (>=92% threshold earned 10% bonus)
      expect(kpi.pillars.attendance.rate).toBe(95);
      expect(kpi.pillars.attendance.bonusEarned).toBe(500_000); // 10% of 5M

      // Academic = 90% (>=88% threshold earned 10% bonus)
      expect(kpi.pillars.academic.averageScore).toBe(90);
      expect(kpi.pillars.academic.bonusEarned).toBe(500_000); // 10% of 5M

      // Total bonus = 1,500,000
      expect(kpi.totalRecommendedBonus).toBe(1_500_000);
      // Composite Score: (95*0.35) + (90*0.35) + (90*0.30) = 33.25 + 31.5 + 27 = 92
      expect(kpi.compositeScore).toBeGreaterThanOrEqual(90);
      expect(kpi.tier).toBe('EXEMPLARY');
    });

    it('throws NotFoundException when teacher does not exist in organization', async () => {
      prisma.teacher.findFirst.mockResolvedValueOnce(null);

      await expect(
        svc.calculateTeacherSmartKpi('org-1', {
          teacherId: 'non-existent',
          year: 2026,
          month: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates payroll run incorporating smart KPI recommendations', async () => {
      // Mock teacher for KPI calculation
      prisma.teacher.findFirst.mockResolvedValueOnce({
        id: 'teacher-kpi-1',
        organizationId: 'org-1',
        salaryType: 'MONTHLY',
        baseSalary: 4_000_000,
        user: { firstName: 'Malika', lastName: 'Sobirova', email: 'malika@medu.uz' },
        groups: [],
      });
      prisma.attendance.findMany.mockResolvedValueOnce([]);
      prisma.grade.findMany.mockResolvedValueOnce([]);
      prisma.lesson.count.mockResolvedValueOnce(12);
      prisma.lesson.findMany.mockResolvedValueOnce([]);

      // Mock teacher for calculateRun
      prisma.teacher.findFirst.mockResolvedValueOnce({
        id: 'teacher-kpi-1',
        organizationId: 'org-1',
        salaryType: 'MONTHLY',
        user: { id: 'u1', isActive: true },
      });

      const run = (await svc.createSmartKpiRun('org-1', 'admin-1', {
        teacherId: 'teacher-kpi-1',
        year: 2026,
        month: 10,
      })) as Record<string, unknown>;

      expect(run).toBeDefined();
      expect(run.teacherId).toBe('teacher-kpi-1');
      expect(run.periodYear).toBe(2026);
      expect(run.periodMonth).toBe(10);
    });
  });

});