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
      attendance: { groupBy: vi.fn().mockResolvedValue([]) },
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
});
