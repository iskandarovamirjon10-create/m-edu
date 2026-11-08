import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssignmentsService } from '../assignments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('AssignmentsService (Submissions & Deadlines)', () => {
  let service: AssignmentsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      assignment: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      group: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      teacher: {
        findFirst: vi.fn(),
      },
      student: { findUnique: vi.fn() },
      studentGroup: { findUnique: vi.fn(), findMany: vi.fn() },
      assignmentSubmission: {
        count: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      parentStudent: { findMany: vi.fn() },
    };

    service = new AssignmentsService(prisma as unknown as PrismaService);
  });

  it('rejects submissions exceeding maxAttempts', async () => {
    prisma.assignment.findFirst.mockResolvedValue({
      id: 'assign-1',
      organizationId: 'org-1',
      maxAttempts: 1,
      dueDate: new Date(Date.now() + 100000),
    });
    prisma.student.findUnique.mockResolvedValue({ id: 'student-1', organizationId: 'org-1' });
    prisma.studentGroup.findUnique.mockResolvedValue({ isActive: true });
    prisma.assignmentSubmission.count.mockResolvedValue(1);

    await expect(
      service.submit('org-1', 'assign-1', 'user-1', { content: 'My essay' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks submission as LATE when submitted after dueDate', async () => {
    const pastDueDate = new Date(Date.now() - 100000);
    prisma.assignment.findFirst.mockResolvedValue({
      id: 'assign-1',
      organizationId: 'org-1',
      maxAttempts: 2,
      dueDate: pastDueDate,
    });
    prisma.student.findUnique.mockResolvedValue({ id: 'student-1', organizationId: 'org-1' });
    prisma.studentGroup.findUnique.mockResolvedValue({ isActive: true });
    prisma.assignmentSubmission.count.mockResolvedValue(0);
    prisma.assignmentSubmission.create.mockResolvedValue({
      id: 'sub-1',
      status: 'LATE',
      attemptNumber: 1,
    });

    const res = await service.submit('org-1', 'assign-1', 'user-1', { content: 'Late essay' });
    expect(res.status).toBe('LATE');
    expect(prisma.assignmentSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'LATE', attemptNumber: 1 }),
      }),
    );
  });

  // ---- Anti-IDOR regression: family roles only see their OWN groups ----
  it('STUDENT findAll is scoped to their enrolled groups only', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 'stu-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    prisma.studentGroup.findMany.mockResolvedValue([{ groupId: 'group-a' }]);
    prisma.assignment.findMany.mockResolvedValue([
      { id: 'assign-1', groupId: 'group-a', title: 'Homework 1' },
    ]);
    prisma.assignment.count.mockResolvedValue(1);

    const res = await service.findAll(
      'org-1',
      { page: 1, limit: 20 },
      { id: 'user-1', role: 'STUDENT' },
    );

    expect(res.items).toHaveLength(1);
    const call = prisma.assignment.findMany.mock.calls[0][0] as { where: any };
    expect(call.where.groupId).toEqual({ in: ['group-a'] });
  });

  it('student with no profile sees zero assignments', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const res = await service.findAll(
      'org-1',
      { page: 1, limit: 20 },
      { id: 'user-nope', role: 'STUDENT' },
    );

    expect(res.items).toEqual([]);
    expect(prisma.assignment.findMany).not.toHaveBeenCalled();
  });

  // ---- Anti-Spoofing: Submissions strictly tied to authenticated student ----
  it('rejects submission if someone attempts to spoof another studentId in payload', async () => {
    prisma.assignment.findFirst.mockResolvedValue({
      id: 'assign-1',
      organizationId: 'org-1',
      maxAttempts: 2,
      dueDate: new Date(Date.now() + 100000),
      groupId: 'grp-1',
    });
    prisma.student.findUnique.mockResolvedValue({ id: 'student-own-id', organizationId: 'org-1' });

    await expect(
      service.submit('org-1', 'assign-1', 'user-1', {
        content: 'Spoofed essay',
        studentId: 'student-victim-id',
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ensures student submission is strictly tied to authenticated student record', async () => {
    prisma.assignment.findFirst.mockResolvedValue({
      id: 'assign-1',
      organizationId: 'org-1',
      maxAttempts: 2,
      dueDate: new Date(Date.now() + 100000),
      groupId: 'grp-1',
    });
    prisma.student.findUnique.mockResolvedValue({ id: 'student-own-id', organizationId: 'org-1' });
    prisma.studentGroup.findUnique.mockResolvedValue({ isActive: true });
    prisma.assignmentSubmission.count.mockResolvedValue(0);
    prisma.assignmentSubmission.create.mockResolvedValue({
      id: 'sub-1',
      studentId: 'student-own-id',
    });

    await service.submit('org-1', 'assign-1', 'user-1', { content: 'Legit essay' });

    expect(prisma.assignmentSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'student-own-id',
        }),
      }),
    );
  });

  // ---- Teacher Object-Level Authorization for Grading ----
  it('rejects teacher attempting to grade submission for group taught by another teacher', async () => {
    prisma.assignmentSubmission.findUnique.mockResolvedValue({
      id: 'sub-1',
      Assignment: {
        organizationId: 'org-1',
        groupId: 'grp-other',
        maxScore: 100,
      },
    });
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' });
    prisma.group.findFirst.mockResolvedValue({ id: 'grp-other', teacherId: 'teacher-2' });

    await expect(
      service.gradeSubmission(
        'org-1',
        'sub-1',
        'teacher-user-1',
        { score: 90, feedback: 'Great job' },
        { id: 'teacher-user-1', role: 'TEACHER' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows teacher to grade submission for student in their assigned group', async () => {
    prisma.assignmentSubmission.findUnique.mockResolvedValue({
      id: 'sub-1',
      Assignment: {
        organizationId: 'org-1',
        groupId: 'grp-1',
        maxScore: 100,
      },
    });
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' });
    prisma.group.findFirst.mockResolvedValue({ id: 'grp-1', teacherId: 'teacher-1' });
    prisma.assignmentSubmission.update.mockResolvedValue({
      id: 'sub-1',
      status: 'GRADED',
      score: 95,
    });

    const res = await service.gradeSubmission(
      'org-1',
      'sub-1',
      'teacher-user-1',
      { score: 95, feedback: 'Excellent' },
      { id: 'teacher-user-1', role: 'TEACHER' },
    );

    expect(res.status).toBe('GRADED');
    expect(prisma.assignmentSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          score: 95,
          status: 'GRADED',
          gradedBy: 'teacher-user-1',
        }),
      }),
    );
  });

  it('allows admin to grade submission regardless of teacher assignment', async () => {
    prisma.assignmentSubmission.findUnique.mockResolvedValue({
      id: 'sub-1',
      Assignment: {
        organizationId: 'org-1',
        groupId: 'grp-1',
        maxScore: 100,
      },
    });
    prisma.assignmentSubmission.update.mockResolvedValue({
      id: 'sub-1',
      status: 'GRADED',
      score: 88,
    });

    const res = await service.gradeSubmission(
      'org-1',
      'sub-1',
      'admin-user-1',
      { score: 88 },
      { id: 'admin-user-1', role: 'ORG_ADMIN' },
    );

    expect(res.status).toBe('GRADED');
  });

  // ---- Teacher Assignment Creation ----
  it('rejects teacher creating assignment for another teacher group', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'grp-2', teacherId: 'teacher-2' });
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' });

    await expect(
      service.create(
        'org-1',
        {
          groupId: 'grp-2',
          title: 'Math Quiz',
          dueDate: '2026-12-01T00:00:00Z',
        },
        { id: 'teacher-user-1', role: 'TEACHER' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
