import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LessonsService } from '../lessons.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { LessonStatus } from '@prisma/client';

describe('LessonsService (Pedagogical Lifecycle)', () => {
  let service: LessonsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      lesson: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      topic: { findUnique: vi.fn() },
      material: { findFirst: vi.fn() },
      lessonMaterial: { create: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LessonsService>(LessonsService);
  });

  it('updates lesson status from PLANNED to CONDUCTED', async () => {
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'les-1',
      organizationId: 'org-1',
      status: LessonStatus.PLANNED,
    });
    prisma.lesson.update.mockResolvedValue({
      id: 'les-1',
      status: LessonStatus.CONDUCTED,
    });

    const res = await service.updateStatus('org-1', 'les-1', {
      status: LessonStatus.CONDUCTED,
    });

    expect(res.status).toBe(LessonStatus.CONDUCTED);
    expect(prisma.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'les-1' },
        data: expect.objectContaining({ status: LessonStatus.CONDUCTED }),
      }),
    );
  });

  it('records cancelReason and cancelledAt timestamp when CANCELLED', async () => {
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'les-1',
      organizationId: 'org-1',
      status: LessonStatus.PLANNED,
    });
    prisma.lesson.update.mockResolvedValue({
      id: 'les-1',
      status: LessonStatus.CANCELLED,
      cancelReason: 'Weather condition',
    });

    await service.updateStatus('org-1', 'les-1', {
      status: LessonStatus.CANCELLED,
      cancelReason: 'Weather condition',
    });

    expect(prisma.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: LessonStatus.CANCELLED,
          cancelReason: 'Weather condition',
          cancelledAt: expect.any(Date),
        }),
      }),
    );
  });
});
