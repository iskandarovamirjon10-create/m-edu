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
      studentGroup: { findUnique: vi.fn() },
      assignmentSubmission: {
        count: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
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
    prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
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
    prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
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
});
