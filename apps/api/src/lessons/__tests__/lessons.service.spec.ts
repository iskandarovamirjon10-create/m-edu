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
      topic: { findUnique: vi.fn(), findFirst: vi.fn() },
      material: { findFirst: vi.fn() },
      lessonMaterial: { create: vi.fn() },
    };

    service = new LessonsService(prisma as any);
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

  describe('updateContent tenant isolation', () => {
    beforeEach(() => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'les-1',
        organizationId: 'org-1',
        status: LessonStatus.PLANNED,
      });
    });

    it('scopes the linked topic to the lesson organization', async () => {
      prisma.topic.findFirst.mockResolvedValue({ id: 'top-1' });
      prisma.lesson.update.mockResolvedValue({ id: 'les-1', topicId: 'top-1' });

      await service.updateContent('org-1', 'les-1', { topicId: 'top-1' } as never);

      expect(prisma.topic.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'top-1',
          CurriculumModule: { Curriculum: { organizationId: 'org-1' } },
        },
      });
    });

    it('rejects linking a topic owned by another organization', async () => {
      // A foreign topic resolves to null under the tenant-scoped filter.
      prisma.topic.findFirst.mockResolvedValue(null);

      await expect(
        service.updateContent('org-1', 'les-1', { topicId: 'foreign-topic' } as never),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.lesson.update).not.toHaveBeenCalled();
    });
  });

  describe('findAll querying and teacher scoping', () => {
    it('queries lessons for a specific date and matches teacher by teacherId or userId', async () => {
      prisma.lesson.findMany.mockResolvedValue([
        { id: 'les-1', startTime: '09:00', endTime: '10:30', status: 'PLANNED' },
      ]);
      prisma.lesson.count.mockResolvedValue(1);

      const result = await service.findAll('org-1', {
        date: '2026-10-13',
        teacherId: 'teacher-or-user-uuid',
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.lesson.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            OR: [
              { teacherId: 'teacher-or-user-uuid' },
              { teacher: { userId: 'teacher-or-user-uuid' } },
            ],
            date: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });
});
