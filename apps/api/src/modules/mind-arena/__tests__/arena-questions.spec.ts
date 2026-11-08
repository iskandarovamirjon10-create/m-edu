import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ArenaQuestionsService } from '../services/arena-questions.service';
import { ArenaQuestionVerifierService } from '../services/arena-question-verifier.service';
import {
  ArenaQuestionSource,
  ArenaQuestionStatus,
  ArenaSubjectCategory,
  QuestionDifficulty,
} from '@prisma/client';
import type { RequestUser } from '../../../auth/types';

describe('ArenaQuestionsService — RBAC, Tenant Isolation & Versioning Tests', () => {
  let service: ArenaQuestionsService;
  let verifier: ArenaQuestionVerifierService;
  let prisma: any;

  const orgAId = 'org-aaaa-aaaa-aaaa';
  const orgBId = 'org-bbbb-bbbb-bbbb';
  const teacherId = 'user-teacher-1111';
  const orgAdminId = 'user-orgadmin-2222';
  const superAdminId = 'user-superadmin-3333';
  const studentId = 'user-student-4444';

  const teacherUser: RequestUser = {
    id: teacherId,
    sub: teacherId,
    email: 'teacher@org-a.medu',
    role: 'TEACHER',
    organizationId: orgAId,
    username: 'teacher_a',
    sid: 's-1',
  };

  const orgAdminUser: RequestUser = {
    id: orgAdminId,
    sub: orgAdminId,
    email: 'admin@org-a.medu',
    role: 'ORG_ADMIN',
    organizationId: orgAId,
    username: 'admin_a',
    sid: 's-2',
  };

  const superAdminUser: RequestUser = {
    id: superAdminId,
    sub: superAdminId,
    email: 'superadmin@medu.global',
    role: 'SUPER_ADMIN',
    organizationId: orgAId,
    username: 'platform_owner',
    sid: 's-3',
  };

  const studentUser: RequestUser = {
    id: studentId,
    sub: studentId,
    email: 'student@org-a.medu',
    role: 'STUDENT',
    organizationId: orgAId,
    username: 'student_1',
    sid: 's-4',
  };

  const validQuestionDto: any = {
    subjectCategory: ArenaSubjectCategory.MATHEMATICS,
    difficulty: QuestionDifficulty.MEDIUM,
    questionText: 'Agar 2x + 6 = 14 boʻlsa, x ning qiymatini toping.',
    explanation: '2x = 8, demak x = 4 boʻladi.',
    timeLimitSec: 15,
    tags: ['algebra'],
    options: [
      { optionKey: 'A', optionText: 'x = 2', isCorrect: false },
      { optionKey: 'B', optionText: 'x = 4', isCorrect: true },
      { optionKey: 'C', optionText: 'x = 6', isCorrect: false },
      { optionKey: 'D', optionText: 'x = 8', isCorrect: false },
    ],
  };

  beforeEach(() => {
    prisma = {
      arenaQuestion: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      arenaQuestionOption: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };

    verifier = new ArenaQuestionVerifierService();
    service = new ArenaQuestionsService(prisma, verifier);
  });

  // ==========================================================================
  // 1. GLOBAL VS TENANT QUESTION CREATION
  // ==========================================================================
  describe('Global vs Tenant Question Creation', () => {
    it('should allow SUPER_ADMIN to create a global question (organizationId = null)', async () => {
      prisma.arenaQuestion.create.mockResolvedValue({
        id: 'q-global-1',
        organizationId: null,
        status: ArenaQuestionStatus.APPROVED,
      });

      const result = await service.createQuestion(superAdminUser, {
        ...validQuestionDto,
        isGlobal: true,
      });

      expect(prisma.arenaQuestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: null,
            status: ArenaQuestionStatus.APPROVED,
          }),
        }),
      );
    });

    it('should forbid TEACHER from creating a global question', async () => {
      await expect(
        service.createQuestion(teacherUser, {
          ...validQuestionDto,
          isGlobal: true,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should assign teacher organizationId and PENDING_REVIEW status to tenant questions', async () => {
      prisma.arenaQuestion.create.mockResolvedValue({
        id: 'q-tenant-1',
        organizationId: orgAId,
        status: ArenaQuestionStatus.PENDING_REVIEW,
      });

      await service.createQuestion(teacherUser, {
        ...validQuestionDto,
        isGlobal: false,
      });

      expect(prisma.arenaQuestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgAId,
            status: ArenaQuestionStatus.PENDING_REVIEW,
            source: ArenaQuestionSource.TEACHER,
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // 2. TENANT ISOLATION IN LISTING & RETRIEVAL
  // ==========================================================================
  describe('Tenant Isolation', () => {
    it('should reject access if user tries to get a question from another organization', async () => {
      prisma.arenaQuestion.findUnique.mockResolvedValue({
        id: 'q-org-b',
        organizationId: orgBId, // Belongs to Org B!
        questionText: 'Org B Secret Question',
      });

      await expect(
        service.getQuestionById(teacherUser, 'q-org-b'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow user to access an approved global question (organizationId = null)', async () => {
      prisma.arenaQuestion.findUnique.mockResolvedValue({
        id: 'q-global-approved',
        organizationId: null,
        status: ArenaQuestionStatus.APPROVED,
      });

      const result = await service.getQuestionById(teacherUser, 'q-global-approved');
      expect(result.id).toBe('q-global-approved');
    });
  });

  // ==========================================================================
  // 3. VERSIONING & EDITING RULES
  // ==========================================================================
  describe('Question Versioning & Mutation Audit', () => {
    it('should increment version and reset APPROVED status to PENDING_REVIEW when edited', async () => {
      prisma.arenaQuestion.findUnique.mockResolvedValue({
        id: 'q-approved-1',
        organizationId: orgAId,
        createdById: teacherId,
        version: 1,
        status: ArenaQuestionStatus.APPROVED,
        questionText: 'Old question text',
        options: [],
      });

      prisma.arenaQuestion.update.mockResolvedValue({
        id: 'q-approved-1',
        version: 2,
        status: ArenaQuestionStatus.PENDING_REVIEW,
      });

      await service.updateQuestion(teacherUser, 'q-approved-1', {
        questionText: 'Tahrirlangan yangi savol matni kamida 15 ta belgi.',
      });

      expect(prisma.arenaQuestion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 2,
            status: ArenaQuestionStatus.PENDING_REVIEW,
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // 4. RBAC APPROVAL POLICY
  // ==========================================================================
  describe('RBAC Approval Policy', () => {
    it('should forbid STUDENT from approving questions', async () => {
      prisma.arenaQuestion.findUnique.mockResolvedValue({
        id: 'q-1',
        organizationId: orgAId,
        status: ArenaQuestionStatus.PENDING_REVIEW,
      });

      await expect(service.approveQuestion(studentUser, 'q-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should forbid TEACHER from approving questions', async () => {
      prisma.arenaQuestion.findUnique.mockResolvedValue({
        id: 'q-1',
        organizationId: orgAId,
        status: ArenaQuestionStatus.PENDING_REVIEW,
      });

      await expect(service.approveQuestion(teacherUser, 'q-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow ORG_ADMIN to approve questions for their own organization', async () => {
      prisma.arenaQuestion.findUnique.mockResolvedValue({
        id: 'q-org-a',
        organizationId: orgAId,
        status: ArenaQuestionStatus.PENDING_REVIEW,
      });

      prisma.arenaQuestion.update.mockResolvedValue({
        id: 'q-org-a',
        status: ArenaQuestionStatus.APPROVED,
        approvedById: orgAdminId,
      });

      const approved = await service.approveQuestion(orgAdminUser, 'q-org-a');
      expect(prisma.arenaQuestion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ArenaQuestionStatus.APPROVED,
            approvedById: orgAdminId,
          }),
        }),
      );
    });

    it('should forbid ORG_ADMIN from approving a global question (organizationId = null)', async () => {
      prisma.arenaQuestion.findUnique.mockResolvedValue({
        id: 'q-global',
        organizationId: null, // Global!
        status: ArenaQuestionStatus.PENDING_REVIEW,
      });

      await expect(service.approveQuestion(orgAdminUser, 'q-global')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ==========================================================================
  // 5. ATOMIC USAGE & ACCURACY METRICS
  // ==========================================================================
  describe('Concurrency-Safe Atomic Counter Increments', () => {
    it('should issue an atomic increment for timesUsed and correctCount', async () => {
      prisma.arenaQuestion.update.mockResolvedValue({
        id: 'q-battle',
        timesUsed: 1,
        correctCount: 1,
      });

      await service.recordQuestionUsage('q-battle', true);

      expect(prisma.arenaQuestion.update).toHaveBeenCalledWith({
        where: { id: 'q-battle' },
        data: {
          timesUsed: { increment: 1 },
          correctCount: { increment: 1 },
        },
      });
    });
  });
});
