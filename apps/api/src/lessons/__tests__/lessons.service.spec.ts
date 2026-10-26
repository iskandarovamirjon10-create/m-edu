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
      assignment: { findMany: vi.fn() },
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

  describe('getLessonCopilotAnalysis', () => {
    it('throws NotFoundException when lesson does not exist', async () => {
      prisma.lesson.findFirst.mockResolvedValue(null);

      await expect(
        service.getLessonCopilotAnalysis('org-1', 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns copilot intelligence, at-risk students and pedagogical checkpoints', async () => {
      const mockLesson = {
        id: 'les-1',
        groupId: 'grp-1',
        topic: "Kvadrat tenglamalar",
        notes: "Diskriminant formulasi",
        date: new Date('2026-10-26T09:00:00Z'),
        Group: {
          name: 'Algebra 9-A',
          course: { id: 'crs-1', name: 'Algebra' },
          enrollments: [
            {
              studentId: 'stud-1',
              student: {
                id: 'stud-1',
                user: { firstName: 'Ali', lastName: 'Valiyev', phone: '+998901234567' },
              },
            },
            {
              studentId: 'stud-2',
              student: {
                id: 'stud-2',
                user: { firstName: 'Zarina', lastName: 'Karimova', phone: '+998909876543' },
              },
            },
          ],
        },
        Topic: { id: 'top-1', title: 'Kvadrat tenglamalar', LearningObjective: [] },
        Assignment: [],
        attendances: [
          { id: 'att-1', studentId: 'stud-1', status: 'PRESENT' },
          { id: 'att-2', studentId: 'stud-2', status: 'ABSENT' },
        ],
      };

      prisma.lesson.findFirst.mockResolvedValue(mockLesson);

      // Past lessons
      prisma.lesson.findMany.mockResolvedValue([
        {
          id: 'past-1',
          attendances: [
            { studentId: 'stud-1', status: 'PRESENT' },
            { studentId: 'stud-2', status: 'ABSENT' },
          ],
        },
      ]);

      // Past assignments
      prisma.assignment.findMany.mockResolvedValue([
        {
          id: 'asg-1',
          maxScore: 100,
          AssignmentSubmission: [
            { studentId: 'stud-1', score: 90, status: 'SUBMITTED' },
            { studentId: 'stud-2', score: 40, status: 'SUBMITTED' },
          ],
        },
      ]);

      const res = await service.getLessonCopilotAnalysis('org-1', 'les-1');

      expect(res.lessonId).toBe('les-1');
      expect(res.courseName).toBe('Algebra');
      expect(res.groupName).toBe('Algebra 9-A');
      expect(res.groupMetrics.totalStudents).toBe(2);
      expect(res.groupMetrics.presentToday).toBe(1);
      expect(res.groupMetrics.absentToday).toBe(1);
      expect(res.groupMetrics.attendanceRateToday).toBe(50);

      // Zarina should be detected as at-risk due to absence streak (absent in past-1 and today)
      expect(res.atRiskStudents.length).toBeGreaterThanOrEqual(1);
      const zarina = res.atRiskStudents.find((s) => s.studentId === 'stud-2');
      expect(zarina).toBeDefined();
      expect(zarina?.riskType).toBe('ABSENCE_STREAK');
      expect(zarina?.level).toBe('HIGH');

      // Check checkpoints and differentiated tasks
      expect(res.pedagogicalCheckpoints).toHaveLength(4);
      expect(res.differentiatedTasks).toHaveLength(3);
      expect(res.differentiatedTasks[0].tier).toBe('FOUNDATION');
      expect(res.differentiatedTasks[1].tier).toBe('CORE');
      expect(res.differentiatedTasks[2].tier).toBe('ADVANCED');
    });
  });
});
