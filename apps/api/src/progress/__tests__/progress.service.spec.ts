import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressService } from '../progress.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ProgressService (Student 360 Aggregation & Risk Engine)', () => {
  let service: ProgressService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      student: { findFirst: vi.fn() },
      attendance: {
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
      },
      studentObjectiveMastery: { upsert: vi.fn() },
      studentProgressSnapshot: { create: vi.fn() },
      parentStudent: { findUnique: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
  });

  it('aggregates Student 360 profile in a single query and detects attendance risk', async () => {
    prisma.attendance.groupBy.mockResolvedValue([
      { status: 'ABSENT', _count: { _all: 4 } },
    ]);
    prisma.student.findFirst.mockResolvedValue({
      id: 'stu-1',
      organizationId: 'org-1',
      user: { firstName: 'Ali', lastName: 'Valiyev', email: 'ali@test.com' },
      groups: [],
      grades: [],
      assignmentSubmissions: [],
      quizAttempts: [],
      objectiveMasteries: [],
    });

    const p = await service.getStudent360('org-1', 'stu-1');

    expect(p.student.id).toBe('stu-1');
    expect(prisma.attendance.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { organizationId: 'org-1', studentId: 'stu-1' },
      _count: { _all: true },
    });
    expect(p.attendance.rate).toBe(0);
    expect(p.risk.signals[0].reason).toContain('Attendance rate below acceptable threshold');
    expect(p.risk.level).toBe('MEDIUM');
  });

  it('throws NotFoundException when student does not belong to organization', async () => {
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(
      service.getStudent360('org-1', 'nonexistent'),
    ).rejects.toThrow(NotFoundException);
  });

  // ---- Anti-IDOR regression: family roles may only read OWN data ----
  it('STUDENT cannot read another student 360 profile (IDOR regression)', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: 'stu-2',
      organizationId: 'org-1',
      userId: 'other-user-id',
      user: { firstName: 'Bob', lastName: 'Smith', email: 'b@x.com' },
      groups: [],
      attendance: [],
      grades: [],
      assignmentSubmissions: [],
      quizAttempts: [],
      objectiveMasteries: [],
    });

    await expect(
      service.getStudent360('org-1', 'stu-2', { id: 'student-me', role: 'STUDENT' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('STUDENT can read their OWN 360 profile', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: 'stu-1',
      organizationId: 'org-1',
      userId: 'student-me',
      user: { firstName: 'Ali', lastName: 'Valiyev', email: 'ali@test.com' },
      groups: [],
      attendance: [],
      grades: [],
      assignmentSubmissions: [],
      quizAttempts: [],
      objectiveMasteries: [],
    });

    const p = await service.getStudent360('org-1', 'stu-1', {
      id: 'student-me',
      role: 'STUDENT',
    });
    expect(p.student.id).toBe('stu-1');
  });

  it('PARENT without a link to the student cannot read their 360 profile (IDOR regression)', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: 'stu-3',
      organizationId: 'org-1',
      userId: 'some-user',
      user: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
      groups: [],
      attendance: [],
      grades: [],
      assignmentSubmissions: [],
      quizAttempts: [],
      objectiveMasteries: [],
    });
    prisma.parentStudent.findUnique.mockResolvedValue(null);

    await expect(
      service.getStudent360('org-1', 'stu-3', { id: 'parent-x', role: 'PARENT' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('PARENT linked to the student can read their 360 profile', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: 'stu-4',
      organizationId: 'org-1',
      userId: 'some-user',
      user: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
      groups: [],
      attendance: [],
      grades: [],
      assignmentSubmissions: [],
      quizAttempts: [],
      objectiveMasteries: [],
    });
    prisma.parentStudent.findUnique.mockResolvedValue({
      parentId: 'parent-y',
      studentId: 'stu-4',
    });

    const p = await service.getStudent360('org-1', 'stu-4', {
      id: 'parent-y',
      role: 'PARENT',
    });
    expect(p.student.id).toBe('stu-4');
  });

  it('builds unified chronological timeline, monthly trends, and diagnostic interventions', async () => {
    prisma.attendance.groupBy.mockResolvedValue([
      { status: 'PRESENT', _count: { _all: 10 } },
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 'att-1',
        date: new Date('2026-10-25'),
        status: 'PRESENT',
        markedAt: new Date('2026-10-25T08:50:00.000Z'),
        source: 'RFID_TURNSTILE',
        group: { name: 'English C1' },
      },
    ]);
    prisma.student.findFirst.mockResolvedValue({
      id: 'stu-5',
      organizationId: 'org-1',
      user: { firstName: 'Sardor', lastName: 'Karimov', email: 's@k.uz' },
      groups: [],
      grades: [
        { id: 'g-1', value: 95, label: 'Midterm', createdAt: new Date('2026-10-20') },
      ],
      AssignmentSubmission: [
        {
          id: 'as-1',
          score: 90,
          status: 'GRADED',
          createdAt: new Date('2026-10-22'),
          Assignment: { title: 'Essay Writing', maxScore: 100, Group: { name: 'English C1' } },
        },
      ],
      QuizAttempt: [
        {
          id: 'qa-1',
          score: 85,
          isPassed: true,
          status: 'GRADED',
          createdAt: new Date('2026-10-24'),
          quiz: { title: 'Grammar Unit 4', passingScore: 60 },
        },
      ],
      ExamResult: [
        {
          id: 'er-1',
          marksObtained: 92,
          isPassed: true,
          createdAt: new Date('2026-10-26'),
          exam: { title: 'Final Placement Exam', totalMarks: 100 },
        },
      ],
      objectiveMasteries: [],
    });

    const res = await service.getStudent360('org-1', 'stu-5');

    expect(res.timeline).toBeDefined();
    expect(res.timeline!.length).toBeGreaterThan(0);
    expect(res.monthlyTrends).toBeDefined();
    expect(res.monthlyTrends!.length).toBe(6);
    expect(res.interventions).toBeDefined();
    expect(res.interventions!.length).toBeGreaterThan(0);
    expect(res.attendanceHistory).toBeDefined();
    expect(res.attendanceHistory![0].status).toBe('PRESENT');
  });
});
