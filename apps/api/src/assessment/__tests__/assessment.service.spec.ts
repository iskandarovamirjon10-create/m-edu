import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssessmentService } from '../assessment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('AssessmentService (Server-Authoritative Test Engine)', () => {
  let service: AssessmentService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      quiz: {
        findFirst: vi.fn(),
      },
      student: {
        findUnique: vi.fn(),
      },
      quizAttempt: {
        count: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      quizAttemptAnswer: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };

    service = new AssessmentService(prisma as unknown as PrismaService);
  });

  it('strips correct answers (isCorrect) when student starts a quiz attempt', async () => {
    prisma.quiz.findFirst.mockResolvedValue({
      id: 'quiz-1',
      isPublished: true,
      maxAttempts: 2,
      timeLimitMin: 30,
      shuffle: false,
      questions: [
        {
          question: {
            id: 'q-1',
            text: '2 + 2 = ?',
            options: [
              { id: 'opt-1', text: '4', orderIndex: 1 },
              { id: 'opt-2', text: '5', orderIndex: 2 },
            ],
          },
        },
      ],
    });
    prisma.student.findUnique.mockResolvedValue({ id: 'stu-1', organizationId: 'org-1' });
    prisma.quizAttempt.count.mockResolvedValue(0);
    prisma.quizAttempt.create.mockResolvedValue({ id: 'att-1', attemptNumber: 1 });

    const paper = await service.startAttempt('org-1', 'quiz-1', 'user-1');

    expect(paper.attemptId).toBe('att-1');
    expect(paper.questions[0].options[0]).not.toHaveProperty('isCorrect');
  });

  it('enforces max attempt limit and rejects extra starts', async () => {
    prisma.quiz.findFirst.mockResolvedValue({
      id: 'quiz-1',
      isPublished: true,
      maxAttempts: 1,
    });
    prisma.student.findUnique.mockResolvedValue({ id: 'stu-1', organizationId: 'org-1' });
    prisma.quizAttempt.count.mockResolvedValue(1);

    await expect(
      service.startAttempt('org-1', 'quiz-1', 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
