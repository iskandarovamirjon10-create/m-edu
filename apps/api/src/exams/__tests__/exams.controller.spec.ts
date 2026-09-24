import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExamsController } from '../exams.controller';
import { ExamsService } from '../exams.service';
import { ExamType } from '@prisma/client';

describe('ExamsController', () => {
  let controller: ExamsController;
  let service: {
    findAllExams: ReturnType<typeof vi.fn>;
    getExamStats: ReturnType<typeof vi.fn>;
    getStudentExamResults: ReturnType<typeof vi.fn>;
    findExamById: ReturnType<typeof vi.fn>;
    createExam: ReturnType<typeof vi.fn>;
    updateExam: ReturnType<typeof vi.fn>;
    deleteExam: ReturnType<typeof vi.fn>;
    publishExam: ReturnType<typeof vi.fn>;
    getExamResults: ReturnType<typeof vi.fn>;
    createExamResult: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      findAllExams: vi.fn(),
      getExamStats: vi.fn(),
      getStudentExamResults: vi.fn(),
      findExamById: vi.fn(),
      createExam: vi.fn(),
      updateExam: vi.fn(),
      deleteExam: vi.fn(),
      publishExam: vi.fn(),
      getExamResults: vi.fn(),
      createExamResult: vi.fn(),
    };
    controller = new ExamsController(service as unknown as ExamsService);
  });

  describe('findAllExams', () => {
    it('calls service.findAllExams with orgId and params', async () => {
      service.findAllExams.mockResolvedValue({ exams: [], total: 0 });
      const res = await controller.findAllExams({ organizationId: 'org-1' }, { page: 1, limit: 10 });
      expect(service.findAllExams).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
      expect(res.total).toBe(0);
    });
  });

  describe('getExamStats', () => {
    it('calls service.getExamStats with orgId', async () => {
      service.getExamStats.mockResolvedValue({ totalExams: 5 });
      const res = await controller.getExamStats({ organizationId: 'org-1' });
      expect(service.getExamStats).toHaveBeenCalledWith('org-1');
      expect(res.totalExams).toBe(5);
    });
  });

  describe('getStudentExamResults', () => {
    it('calls service.getStudentExamResults', async () => {
      service.getStudentExamResults.mockResolvedValue({ results: [] });
      const res = await controller.getStudentExamResults({ organizationId: 'org-1' }, 'st-1');
      expect(service.getStudentExamResults).toHaveBeenCalledWith('org-1', 'st-1');
      expect(res.results).toEqual([]);
    });
  });

  describe('findExamById', () => {
    it('calls service.findExamById', async () => {
      service.findExamById.mockResolvedValue({ id: 'ex-1' });
      const res = await controller.findExamById({ organizationId: 'org-1' }, 'ex-1');
      expect(service.findExamById).toHaveBeenCalledWith('org-1', 'ex-1');
      expect(res.id).toBe('ex-1');
    });
  });

  describe('createExam', () => {
    it('calls service.createExam', async () => {
      service.createExam.mockResolvedValue({ id: 'ex-1' });
      const dto = {
        groupId: 'grp-1',
        subject: 'Physics',
        title: 'Midterm',
        examDate: '2026-10-01T09:00:00Z',
        duration: 90,
        totalMarks: 100,
        passingMarks: 50,
        examType: ExamType.MIDTERM,
      };
      const res = await controller.createExam({ organizationId: 'org-1' }, dto);
      expect(service.createExam).toHaveBeenCalledWith('org-1', dto);
      expect(res.id).toBe('ex-1');
    });
  });

  describe('updateExam', () => {
    it('calls service.updateExam', async () => {
      service.updateExam.mockResolvedValue({ id: 'ex-1', title: 'Updated' });
      const res = await controller.updateExam({ organizationId: 'org-1' }, 'ex-1', { title: 'Updated' });
      expect(service.updateExam).toHaveBeenCalledWith('org-1', 'ex-1', { title: 'Updated' });
      expect(res.title).toBe('Updated');
    });
  });

  describe('deleteExam', () => {
    it('calls service.deleteExam', async () => {
      service.deleteExam.mockResolvedValue({ id: 'ex-1' });
      const res = await controller.deleteExam({ organizationId: 'org-1' }, 'ex-1');
      expect(service.deleteExam).toHaveBeenCalledWith('org-1', 'ex-1');
      expect(res.id).toBe('ex-1');
    });
  });

  describe('publishExam', () => {
    it('calls service.publishExam', async () => {
      service.publishExam.mockResolvedValue({ id: 'ex-1', isPublished: true });
      const res = await controller.publishExam({ organizationId: 'org-1' }, 'ex-1', { isPublished: true });
      expect(service.publishExam).toHaveBeenCalledWith('org-1', 'ex-1', { isPublished: true });
      expect(res.isPublished).toBe(true);
    });
  });

  describe('getExamResults', () => {
    it('calls service.getExamResults', async () => {
      service.getExamResults.mockResolvedValue({ results: [] });
      const res = await controller.getExamResults({ organizationId: 'org-1' }, 'ex-1', 'st-1');
      expect(service.getExamResults).toHaveBeenCalledWith('org-1', 'ex-1', 'st-1');
      expect(res.results).toEqual([]);
    });
  });

  describe('createExamResult', () => {
    it('calls service.createExamResult', async () => {
      service.createExamResult.mockResolvedValue({ id: 'r1' });
      const dto = { studentId: 'st-1', marksObtained: 80 };
      const res = await controller.createExamResult({ organizationId: 'org-1' }, 'ex-1', dto);
      expect(service.createExamResult).toHaveBeenCalledWith('org-1', 'ex-1', dto);
      expect(res.id).toBe('r1');
    });
  });
});
