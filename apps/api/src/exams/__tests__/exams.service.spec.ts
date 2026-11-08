import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExamsService } from '../exams.service';
import { ExamType, Role } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    exam: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    group: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    teacher: {
      findFirst: vi.fn(),
    },
    student: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    parentStudent: {
      findMany: vi.fn(),
    },
    studentGroup: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    examResult: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
  };
}

describe('ExamsService', () => {
  let svc: ExamsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new ExamsService(prisma as unknown as PrismaService);
    vi.clearAllMocks();
  });

  describe('findAllExams', () => {
    it('queries exams scoped by organizationId and returns pagination', async () => {
      prisma.exam.findMany.mockResolvedValue([]);
      prisma.exam.count.mockResolvedValue(10);

      const res = await svc.findAllExams('org-1', {
        page: 1,
        limit: 10,
        search: 'Math',
        examType: ExamType.MIDTERM,
        // Query params arrive from the wire as strings — model the real input.
        isPublished: 'true',
      });

      expect(prisma.exam.findMany).toHaveBeenCalled();
      const where = prisma.exam.findMany.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-1');
      expect(where.examType).toBe(ExamType.MIDTERM);
      expect(where.isPublished).toBe(true);
      expect(res.total).toBe(10);
    });
  });

  describe('findExamById', () => {
    it('returns exam when found', async () => {
      prisma.exam.findFirst.mockResolvedValue({ id: 'ex-1', title: 'Math Final' });
      const exam = await svc.findExamById('org-1', 'ex-1');
      expect(exam.id).toBe('ex-1');
      expect(prisma.exam.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ex-1', organizationId: 'org-1' },
        }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      prisma.exam.findFirst.mockResolvedValue(null);
      await expect(svc.findExamById('org-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createExam', () => {
    it('creates exam if group belongs to organization', async () => {
      prisma.group.findFirst.mockResolvedValue({ id: 'grp-1', organizationId: 'org-1' });
      prisma.exam.create.mockResolvedValue({ id: 'ex-1', title: 'Midterm' });

      const res = await svc.createExam('org-1', {
        groupId: 'grp-1',
        subject: 'Math',
        title: 'Midterm',
        examDate: '2026-10-01T09:00:00Z',
        duration: 90,
        totalMarks: 100,
        passingMarks: 60,
        examType: ExamType.MIDTERM,
      });

      expect(prisma.group.findFirst).toHaveBeenCalledWith({
        where: { id: 'grp-1', organizationId: 'org-1' },
      });
      expect(prisma.exam.create).toHaveBeenCalled();
      expect(res.id).toBe('ex-1');
    });

    it('throws NotFoundException if group does not exist in tenant', async () => {
      prisma.group.findFirst.mockResolvedValue(null);
      await expect(
        svc.createExam('org-1', {
          groupId: 'other-org-grp',
          subject: 'Math',
          title: 'Midterm',
          examDate: '2026-10-01T09:00:00Z',
          duration: 90,
          totalMarks: 100,
          passingMarks: 60,
          examType: ExamType.MIDTERM,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateExam', () => {
    it('updates unpublished exam', async () => {
      prisma.exam.findFirst.mockResolvedValue({ id: 'ex-1', isPublished: false });
      prisma.exam.update.mockResolvedValue({ id: 'ex-1', title: 'Updated' });

      const res = await svc.updateExam('org-1', 'ex-1', { title: 'Updated' });
      expect(prisma.exam.update).toHaveBeenCalledWith({
        where: { id: 'ex-1' },
        data: { title: 'Updated' },
      });
      expect(res.id).toBe('ex-1');
    });

    it('throws BadRequestException if exam is already published', async () => {
      prisma.exam.findFirst.mockResolvedValue({ id: 'ex-1', isPublished: true });
      await expect(svc.updateExam('org-1', 'ex-1', { title: 'Updated' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteExam', () => {
    it('deletes unpublished exam with no results', async () => {
      prisma.exam.findFirst.mockResolvedValue({ id: 'ex-1', isPublished: false });
      prisma.examResult.count.mockResolvedValue(0);
      prisma.exam.delete.mockResolvedValue({ id: 'ex-1' });

      const res = await svc.deleteExam('org-1', 'ex-1');
      expect(prisma.exam.delete).toHaveBeenCalledWith({ where: { id: 'ex-1' } });
      expect(res.id).toBe('ex-1');
    });

    it('throws BadRequestException if published or has results', async () => {
      prisma.exam.findFirst.mockResolvedValue({ id: 'ex-1', isPublished: true });
      await expect(svc.deleteExam('org-1', 'ex-1')).rejects.toThrow(BadRequestException);

      prisma.exam.findFirst.mockResolvedValue({ id: 'ex-1', isPublished: false });
      prisma.examResult.count.mockResolvedValue(3);
      await expect(svc.deleteExam('org-1', 'ex-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('publishExam', () => {
    it('publishes exam when results exist', async () => {
      prisma.exam.findFirst.mockResolvedValue({ id: 'ex-1' });
      prisma.examResult.findMany.mockResolvedValue([{ id: 'r1' }]);
      prisma.exam.update.mockResolvedValue({ id: 'ex-1', isPublished: true });

      const res = await svc.publishExam('org-1', 'ex-1', { isPublished: true });
      expect(res.isPublished).toBe(true);
    });

    it('throws BadRequestException when publishing without results and not forced', async () => {
      prisma.exam.findFirst.mockResolvedValue({ id: 'ex-1' });
      prisma.examResult.findMany.mockResolvedValue([]);

      await expect(svc.publishExam('org-1', 'ex-1', { isPublished: true })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createExamResult', () => {
    it('creates result with calculated grade and pass flag', async () => {
      prisma.exam.findFirst.mockResolvedValue({
        id: 'ex-1',
        groupId: 'grp-1',
        passingMarks: 60,
        totalMarks: 100,
      });
      prisma.student.findFirst.mockResolvedValue({ id: 'st-1' });
      prisma.studentGroup.findFirst.mockResolvedValue({ studentId: 'st-1' });
      prisma.examResult.findFirst.mockResolvedValue(null);
      prisma.examResult.create.mockResolvedValue({ id: 'res-1', grade: 'A', isPassed: true });

      const res = await svc.createExamResult('org-1', 'ex-1', {
        studentId: 'st-1',
        marksObtained: 85,
      });

      expect(prisma.examResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            examId: 'ex-1',
            studentId: 'st-1',
            organizationId: 'org-1',
            marksObtained: 85,
            grade: 'A',
            isPassed: true,
          }),
        }),
      );
      expect(res.isPassed).toBe(true);
    });

    it('rejects duplicate result for same student', async () => {
      prisma.exam.findFirst.mockResolvedValue({
        id: 'ex-1',
        groupId: 'grp-1',
        passingMarks: 50,
        totalMarks: 100,
      });
      prisma.student.findFirst.mockResolvedValue({ id: 'st-1' });
      prisma.studentGroup.findFirst.mockResolvedValue({ studentId: 'st-1' });
      prisma.examResult.findFirst.mockResolvedValue({ id: 'res-existing' });

      await expect(
        svc.createExamResult('org-1', 'ex-1', { studentId: 'st-1', marksObtained: 70 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a student who is not enrolled in the exam group', async () => {
      prisma.exam.findFirst.mockResolvedValue({
        id: 'ex-1',
        groupId: 'grp-1',
        passingMarks: 50,
        totalMarks: 100,
      });
      prisma.student.findFirst.mockResolvedValue({ id: 'st-1' });
      prisma.studentGroup.findFirst.mockResolvedValue(null);

      await expect(
        svc.createExamResult('org-1', 'ex-1', { studentId: 'st-1', marksObtained: 70 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.examResult.create).not.toHaveBeenCalled();
    });

    it('rejects a student from another organization', async () => {
      prisma.exam.findFirst.mockResolvedValue({
        id: 'ex-1',
        groupId: 'grp-1',
        passingMarks: 50,
        totalMarks: 100,
      });
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(
        svc.createExamResult('org-1', 'ex-1', { studentId: 'other-org-st', marksObtained: 70 }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.examResult.create).not.toHaveBeenCalled();
    });

    it('rejects teacher attempting to grade/create result for another teacher group', async () => {
      prisma.exam.findFirst.mockResolvedValue({
        id: 'ex-1',
        groupId: 'grp-other',
        group: { teacherId: 'teacher-2' },
        passingMarks: 50,
        totalMarks: 100,
      });
      prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' });
      prisma.group.findFirst.mockResolvedValue({ id: 'grp-other', teacherId: 'teacher-2' });

      await expect(
        svc.createExamResult(
          'org-1',
          'ex-1',
          { studentId: 'st-1', marksObtained: 75 },
          { id: 'user-teacher-1', role: Role.TEACHER },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.examResult.create).not.toHaveBeenCalled();
    });

    it('allows teacher assigned to group to grade/create result', async () => {
      prisma.exam.findFirst.mockResolvedValue({
        id: 'ex-1',
        groupId: 'grp-1',
        group: { teacherId: 'teacher-1' },
        passingMarks: 50,
        totalMarks: 100,
      });
      prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' });
      prisma.group.findFirst.mockResolvedValue({ id: 'grp-1', teacherId: 'teacher-1' });
      prisma.student.findFirst.mockResolvedValue({ id: 'st-1' });
      prisma.studentGroup.findFirst.mockResolvedValue({ studentId: 'st-1' });
      prisma.examResult.findFirst.mockResolvedValue(null);
      prisma.examResult.create.mockResolvedValue({ id: 'res-1', grade: 'B', isPassed: true });

      const res = await svc.createExamResult(
        'org-1',
        'ex-1',
        { studentId: 'st-1', marksObtained: 75 },
        { id: 'user-teacher-1', role: Role.TEACHER },
      );

      expect(prisma.examResult.create).toHaveBeenCalled();
      expect(res.id).toBe('res-1');
    });
  });

  describe('getExamResults', () => {
    it('rejects teacher attempting to view results for another teacher group', async () => {
      prisma.exam.findFirst.mockResolvedValue({
        id: 'ex-1',
        groupId: 'grp-other',
        group: { id: 'grp-other', teacherId: 'teacher-2' },
      });
      prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' });

      await expect(
        svc.getExamResults('org-1', 'ex-1', undefined, { id: 'user-teacher-1', role: Role.TEACHER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('restricts student to only their own result, preventing viewing other students results', async () => {
      prisma.exam.findFirst.mockResolvedValue({
        id: 'ex-1',
        groupId: 'grp-1',
        isPublished: true,
      });
      prisma.student.findUnique.mockResolvedValue({ id: 'student-own-id', organizationId: 'org-1' });
      prisma.studentGroup.findFirst.mockResolvedValue({ studentId: 'student-own-id', groupId: 'grp-1' });
      prisma.examResult.findMany.mockResolvedValue([
        { id: 'res-own', studentId: 'student-own-id', marksObtained: 90 },
      ]);

      const res = await svc.getExamResults('org-1', 'ex-1', 'other-student-id', {
        id: 'user-student-1',
        role: Role.STUDENT,
      });

      expect(prisma.examResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            examId: 'ex-1',
            organizationId: 'org-1',
            studentId: 'student-own-id',
          }),
        }),
      );
      expect(res.results).toHaveLength(1);
    });
  });

  describe('getExamStats', () => {
    it('aggregates stats for organization', async () => {
      prisma.exam.count.mockResolvedValueOnce(10).mockResolvedValueOnce(5);
      prisma.examResult.aggregate
        .mockResolvedValueOnce({ _avg: { marksObtained: 75 } })
        .mockResolvedValueOnce({ _count: { _all: 20 } })
        .mockResolvedValueOnce({ _max: { marksObtained: 100 } })
        .mockResolvedValueOnce({ _min: { marksObtained: 40 } });
      prisma.examResult.count.mockResolvedValue(16);

      const stats = await svc.getExamStats('org-1');
      expect(stats.totalExams).toBe(10);
      expect(stats.publishedExams).toBe(5);
      expect(stats.totalResults).toBe(20);
      expect(stats.passedCount).toBe(16);
      expect(stats.passRate).toBe(80);
      expect(stats.averageScore).toBe(75);
      expect(stats.highestScore).toBe(100);
      expect(stats.lowestScore).toBe(40);
    });
  });

  describe('getStudentExamResults', () => {
    it('returns student results and summary stats', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'st-1', organizationId: 'org-1' });
      prisma.examResult.findMany.mockResolvedValue([
        { id: 'r1', marksObtained: 80, isPassed: true },
        { id: 'r2', marksObtained: 50, isPassed: false },
      ]);

      const res = await svc.getStudentExamResults('org-1', 'st-1');
      expect(res.statistics.totalExams).toBe(2);
      expect(res.statistics.passedExams).toBe(1);
      expect(res.statistics.failedExams).toBe(1);
      expect(res.statistics.averageScore).toBe(65);
      expect(res.statistics.passingRate).toBe(50);
      expect(res.statistics.gpa).toBeDefined();
    });

    it('throws NotFoundException if student does not exist', async () => {
      prisma.student.findFirst.mockResolvedValue(null);
      await expect(svc.getStudentExamResults('org-1', 'st-missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('handles GPA calculation safely when total exams is 0', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'st-1', organizationId: 'org-1' });
      prisma.examResult.findMany.mockResolvedValue([]);

      const res = await svc.getStudentExamResults('org-1', 'st-1');
      expect(res.statistics.totalExams).toBe(0);
      expect(res.statistics.averageScore).toBe(0);
      expect(res.statistics.passingRate).toBe(0);
      expect(res.statistics.gpa).toBe(0);
    });

    it('handles GPA calculation safely when exam totalMarks / weight is 0', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'st-1', organizationId: 'org-1' });
      prisma.examResult.findMany.mockResolvedValue([
        { id: 'r1', marksObtained: 0, isPassed: false, grade: 'F', exam: { totalMarks: 0 } },
      ]);

      const res = await svc.getStudentExamResults('org-1', 'st-1');
      expect(res.statistics.totalExams).toBe(1);
      expect(res.statistics.gpa).toBe(0);
      expect(Number.isNaN(res.statistics.gpa)).toBe(false);
    });

    it('rejects student attempting to view another student exam results', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'st-other',
        userId: 'user-other',
        organizationId: 'org-1',
        parentStudents: [],
      });

      await expect(
        svc.getStudentExamResults('org-1', 'st-other', { id: 'user-me', role: Role.STUDENT }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows student to view their own exam results', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'st-own',
        userId: 'user-me',
        organizationId: 'org-1',
        parentStudents: [],
      });
      prisma.examResult.findMany.mockResolvedValue([]);

      const res = await svc.getStudentExamResults('org-1', 'st-own', {
        id: 'user-me',
        role: Role.STUDENT,
      });

      expect(res.student.id).toBe('st-own');
    });

    it('rejects teacher viewing results of a student not in their groups', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'st-1',
        userId: 'user-st-1',
        organizationId: 'org-1',
        parentStudents: [],
      });
      prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' });
      prisma.studentGroup.findFirst.mockResolvedValue(null);

      await expect(
        svc.getStudentExamResults('org-1', 'st-1', { id: 'user-teacher-1', role: Role.TEACHER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows teacher to view results of a student in their assigned groups', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'st-1',
        userId: 'user-st-1',
        organizationId: 'org-1',
        parentStudents: [],
      });
      prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' });
      prisma.studentGroup.findFirst.mockResolvedValue({ studentId: 'st-1', groupId: 'grp-1' });
      prisma.examResult.findMany.mockResolvedValue([]);

      const res = await svc.getStudentExamResults('org-1', 'st-1', {
        id: 'user-teacher-1',
        role: Role.TEACHER,
      });

      expect(res.student.id).toBe('st-1');
    });
  });
});
