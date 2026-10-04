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
      studentObjectiveMastery: { upsert: vi.fn() },
      studentProgressSnapshot: { create: vi.fn() },
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
    prisma.student.findFirst.mockResolvedValue({
      id: 'stu-1',
      organizationId: 'org-1',
      user: { firstName: 'Ali', lastName: 'Valiyev', email: 'ali@test.com' },
      groups: [],
      attendance: [
        { status: 'ABSENT', date: new Date() },
        { status: 'ABSENT', date: new Date() },
        { status: 'ABSENT', date: new Date() },
        { status: 'ABSENT', date: new Date() },
      ],
      grades: [],
      assignmentSubmissions: [],
      quizAttempts: [],
      objectiveMasteries: [],
    });

    const p = await service.getStudent360('org-1', 'stu-1');

    expect(p.student.id).toBe('stu-1');
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
});
