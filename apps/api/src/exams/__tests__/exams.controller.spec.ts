import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExamsController } from '../exams.controller';
import { ExamsService } from '../exams.service';
import { ExamType, Role } from '@prisma/client';
import type { RequestUser } from '../../auth/types';

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

  const adminUser: RequestUser = {
    id: 'admin-1',
    sub: 'admin-1',
    email: 'admin@medu.uz',
    role: Role.ORG_ADMIN,
    organizationId: 'org-1',
    sid: 'session-1',
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
    it('calls service.findAllExams with orgId, params and requester', async () => {
      service.findAllExams.mockResolvedValue({ exams: [], total: 0 });
      const res = await controller.findAllExams(adminUser, { page: 1, limit: 10 });
      expect(service.findAllExams).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 }, {
        id: 'admin-1',
        role: Role.ORG_ADMIN,
      });
      expect(res.total).toBe(0);
    });
  });

  describe('getExamStats', () => {
    it('calls service.getExamStats with orgId', async () => {
      service.getExamStats.mockResolvedValue({ totalExams: 5 });
      const res = await controller.getExamStats(adminUser);
      expect(service.getExamStats).toHaveBeenCalledWith('org-1');
      expect(res.totalExams).toBe(5);
    });
  });

  describe('getStudentExamResults', () => {
    it('calls service.getStudentExamResults with requester', async () => {
      service.getStudentExamResults.mockResolvedValue({ results: [] });
      const res = await controller.getStudentExamResults(adminUser, 'st-1');
      expect(service.getStudentExamResults).toHaveBeenCalledWith('org-1', 'st-1', {
        id: 'admin-1',
        role: Role.ORG_ADMIN,
      });
      expect(res.results).toEqual([]);
    });
  });

  describe('findExamById', () => {
    it('calls service.findExamById with requester', async () => {
      service.findExamById.mockResolvedValue({ id: 'ex-1' });
      const res = await controller.findExamById(adminUser, 'ex-1');
      expect(service.findExamById).toHaveBeenCalledWith('org-1', 'ex-1', {
        id: 'admin-1',
        role: Role.ORG_ADMIN,
      });
      expect(res.id).toBe('ex-1');
    });
  });

  describe('createExam', () => {
    it('calls service.createExam with requester', async () => {
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
      const res = await controller.createExam(adminUser, dto);
      expect(service.createExam).toHaveBeenCalledWith('org-1', dto, {
        id: 'admin-1',
        role: Role.ORG_ADMIN,
      });
      expect(res.id).toBe('ex-1');
    });
  });

  describe('updateExam', () => {
    it('calls service.updateExam with requester', async () => {
      service.updateExam.mockResolvedValue({ id: 'ex-1', title: 'Updated' });
      const res = await controller.updateExam(adminUser, 'ex-1', { title: 'Updated' });
      expect(service.updateExam).toHaveBeenCalledWith('org-1', 'ex-1', { title: 'Updated' }, {
        id: 'admin-1',
        role: Role.ORG_ADMIN,
      });
      expect(res.title).toBe('Updated');
    });
  });

  describe('deleteExam', () => {
    it('calls service.deleteExam with requester', async () => {
      service.deleteExam.mockResolvedValue({ id: 'ex-1' });
      const res = await controller.deleteExam(adminUser, 'ex-1');
      expect(service.deleteExam).toHaveBeenCalledWith('org-1', 'ex-1', {
        id: 'admin-1',
        role: Role.ORG_ADMIN,
      });
      expect(res.id).toBe('ex-1');
    });
  });

  describe('publishExam', () => {
    it('calls service.publishExam with requester', async () => {
      service.publishExam.mockResolvedValue({ id: 'ex-1', isPublished: true });
      const res = await controller.publishExam(adminUser, 'ex-1', { isPublished: true });
      expect(service.publishExam).toHaveBeenCalledWith('org-1', 'ex-1', { isPublished: true }, {
        id: 'admin-1',
        role: Role.ORG_ADMIN,
      });
      expect(res.isPublished).toBe(true);
    });
  });

  describe('getExamResults', () => {
    it('calls service.getExamResults with requester', async () => {
      service.getExamResults.mockResolvedValue({ results: [] });
      const res = await controller.getExamResults(adminUser, 'ex-1', 'st-1');
      expect(service.getExamResults).toHaveBeenCalledWith('org-1', 'ex-1', 'st-1', {
        id: 'admin-1',
        role: Role.ORG_ADMIN,
      });
      expect(res.results).toEqual([]);
    });
  });

  describe('createExamResult', () => {
    it('calls service.createExamResult with requester', async () => {
      service.createExamResult.mockResolvedValue({ id: 'r1' });
      const dto = { studentId: 'st-1', marksObtained: 80 };
      const res = await controller.createExamResult(adminUser, 'ex-1', dto);
      expect(service.createExamResult).toHaveBeenCalledWith('org-1', 'ex-1', dto, {
        id: 'admin-1',
        role: Role.ORG_ADMIN,
      });
      expect(res.id).toBe('r1');
    });
  });
});
