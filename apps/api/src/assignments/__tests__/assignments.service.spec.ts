import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssignmentsService } from '../assignments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
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
});
