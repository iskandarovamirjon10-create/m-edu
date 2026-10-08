import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto, CreateQuizDto, SubmitQuizAttemptDto } from './assessment.dto';
import { Prisma } from '@prisma/client';

export interface QuestionQuery {
  subjectId?: string;
  topicId?: string;
  objectiveId?: string;
  type?: string;
  difficulty?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface QuizQuery {
  groupId?: string;
  isPublished?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AssessmentService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== QUESTION BANK ====================

  async findAllQuestions(organizationId: string, query: QuestionQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.QuestionWhereInput = {
      organizationId,
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.topicId ? { topicId: query.topicId } : {}),
      ...(query.objectiveId ? { objectiveId: query.objectiveId } : {}),
      ...(query.type ? { type: query.type as any } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty as any } : {}),
    };

    if (query.search) {
      where.prompt = { contains: query.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: {
          Subject: { select: { id: true, name: true, code: true } },
          Topic: { select: { id: true, title: true } },
          LearningObjective: { select: { id: true, code: true, description: true } },
          QuestionOption: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.question.count({ where }),
    ]);

    const mapped = items.map((q) => ({
      ...q,
      text: q.prompt,
    }));

    return { items: mapped, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createQuestion(organizationId: string, dto: CreateQuestionDto) {
    if (dto.subjectId) {
      const subject = await this.prisma.subject.findFirst({ where: { id: dto.subjectId, organizationId } });
      if (!subject) throw new NotFoundException('Subject not found');
    }

    return this.prisma.question.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        subjectId: dto.subjectId,
        topicId: dto.topicId,
        objectiveId: dto.objectiveId,
        type: dto.type,
        difficulty: dto.difficulty ?? 'MEDIUM',
        prompt: dto.prompt.trim(),
        explanation: dto.explanation?.trim(),
        points: dto.points ?? 1.0,
        tags: dto.tags ?? [],
        updatedAt: new Date(),
        QuestionOption: {
          create: (dto.options ?? []).map((o, idx) => ({
            id: crypto.randomUUID(),
            text: o.text.trim(),
            isCorrect: o.isCorrect,
            order: o.order ?? idx + 1,
          })),
        },
      },
      include: { QuestionOption: true },
    });
  }

  // ==================== QUIZZES ====================

  async findAllQuizzes(organizationId: string, query: QuizQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.QuizWhereInput = {
      organizationId,
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.isPublished !== undefined ? { isPublished: query.isPublished === 'true' } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.quiz.findMany({
        where,
        include: {
          Group: { select: { id: true, name: true } },
          _count: { select: { QuizQuestion: true, QuizAttempt: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.quiz.count({ where }),
    ]);

    const mapped = items.map((q) => ({
      ...q,
      timeLimitMin: q.durationMinutes,
      passScore: q.passingScore,
      _count: {
        questions: q._count?.QuizQuestion ?? 0,
        attempts: q._count?.QuizAttempt ?? 0,
      },
    }));

    return { items: mapped, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findQuizForTeacher(organizationId: string, id: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id, organizationId },
      include: {
        Group: { select: { id: true, name: true } },
        QuizQuestion: {
          orderBy: { order: 'asc' },
          include: {
            Question: {
              include: { QuestionOption: true },
            },
          },
        },
        _count: { select: { QuizAttempt: true } },
      },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  async createQuiz(organizationId: string, dto: CreateQuizDto) {
    if (dto.groupId) {
      const group = await this.prisma.group.findFirst({ where: { id: dto.groupId, organizationId } });
      if (!group) throw new NotFoundException('Group not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.create({
        data: {
          id: crypto.randomUUID(),
          organizationId,
          groupId: dto.groupId,
          title: dto.title.trim(),
          description: dto.description?.trim(),
          durationMinutes: dto.durationMinutes ?? 30,
          passingScore: dto.passingScore ?? 60.0,
          maxAttempts: dto.maxAttempts ?? 1,
          randomizeQuestions: dto.randomizeQuestions ?? true,
          isPublished: true,
          updatedAt: new Date(),
        },
      });

      if (dto.questionIds && dto.questionIds.length > 0) {
        for (let i = 0; i < dto.questionIds.length; i++) {
          await tx.quizQuestion.create({
            data: {
              id: crypto.randomUUID(),
              quizId: quiz.id,
              questionId: dto.questionIds[i],
              order: i + 1,
            },
          });
        }
      }

      return quiz;
    });
  }

  // ==================== QUIZ ATTEMPTS (SERVER AUTHORITATIVE) ====================

  /**
   * SECURITY CRITICAL: Correct answers are STRIPPED from options when serving student test paper.
   */
  async startAttempt(organizationId: string, quizId: string, studentUserId: string) {
    const actualQuiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, organizationId },
      include: {
        QuizQuestion: {
          include: {
            Question: {
              include: {
                QuestionOption: {
                  select: { id: true, text: true, order: true },
                },
              },
            },
          },
        },
      },
    });

    if (!actualQuiz || !actualQuiz.isPublished) throw new NotFoundException('Quiz not found or not published');

    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });
    if (!student || student.organizationId !== organizationId) {
      throw new NotFoundException('Student profile not found');
    }

    const attemptCount = await this.prisma.quizAttempt.count({
      where: { quizId, studentId: student.id },
    });

    if (attemptCount >= actualQuiz.maxAttempts) {
      throw new BadRequestException(`Maximum attempts (${actualQuiz.maxAttempts}) reached for this quiz`);
    }

    const startedAt = new Date();

    const durationMinutes = actualQuiz.durationMinutes ?? (actualQuiz as any).timeLimitMin ?? 30;
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        organizationId,
        quizId,
        studentId: student.id,
        attemptNumber: attemptCount + 1,
        status: 'IN_PROGRESS',
        startedAt,
        expiresAt: new Date(startedAt.getTime() + durationMinutes * 60 * 1000),
      },
    });

    const rawQuestions = actualQuiz.QuizQuestion ?? (actualQuiz as any).questions ?? [];
    const questions = rawQuestions.map((q: any) => {
      const qEntity = q.Question ?? q.question ?? q;
      const rawOptions = qEntity.QuestionOption ?? qEntity.options ?? [];
      const safeOptions = rawOptions.map((opt: any) => ({
        id: opt.id,
        text: opt.text,
        order: opt.order ?? opt.orderIndex,
      }));
      return {
        ...qEntity,
        text: qEntity.prompt ?? qEntity.text,
        options: safeOptions,
      };
    });

    const shouldRandomize = actualQuiz.randomizeQuestions ?? (actualQuiz as any).shuffle ?? false;
    if (shouldRandomize) {
      // Unbiased Fisher-Yates shuffle (sort(() => Math.random() - 0.5) is
      // biased and non-reproducible).
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
    }

    return {
      attemptId: attempt.id,
      durationMinutes,
      startedAt,
      questions,
    };
  }

  async submitAttempt(
    organizationId: string,
    attemptId: string,
    studentUserId: string,
    dto: SubmitQuizAttemptDto,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });
    if (!student || student.organizationId !== organizationId) {
      throw new NotFoundException('Student profile not found');
    }

    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, studentId: student.id, organizationId },
      include: {
        quiz: {
          include: {
            QuizQuestion: {
              include: {
                Question: { include: { QuestionOption: true } },
              },
            },
          },
        },
      },
    });

    if (!attempt) throw new NotFoundException('Quiz attempt not found');
    if (attempt.status !== 'IN_PROGRESS' && attempt.status !== 'STARTED') {
      throw new BadRequestException('This attempt has already been submitted or finalized');
    }

    const now = new Date();
    const durationSec = Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000);
    // Server-side authoritative time limit check with 60 sec grace period
    const allowedSec = (attempt.quiz.durationMinutes * 60) + 60;
    const isExpired = durationSec > allowedSec;

    return this.prisma.$transaction(async (tx) => {
      let totalEarned = 0;
      let totalMax = 0;

      const questionsMap = new Map(attempt.quiz.QuizQuestion.map((q) => [q.Question.id, q.Question]));

      for (const ans of dto.answers) {
        const question = questionsMap.get(ans.questionId);
        if (!question) continue;

        totalMax += question.points;
        let isCorrect = false;
        let pointsEarned = 0;

        const selectedOptionId = ans.selectedOptionIds && ans.selectedOptionIds.length > 0 ? ans.selectedOptionIds[0] : null;

        if (question.type === 'SINGLE_CHOICE' || question.type === 'TRUE_FALSE') {
          const correctOption = question.QuestionOption.find((o) => o.isCorrect);
          if (correctOption && selectedOptionId === correctOption.id) {
            isCorrect = true;
            pointsEarned = question.points;
          }
        } else if (question.type === 'MULTIPLE_CHOICE') {
          const correctOptionIds = new Set(question.QuestionOption.filter((o) => o.isCorrect).map((o) => o.id));
          const selectedSet = new Set(ans.selectedOptionIds ?? []);
          if (
            correctOptionIds.size === selectedSet.size &&
            [...correctOptionIds].every((id) => selectedSet.has(id))
          ) {
            isCorrect = true;
            pointsEarned = question.points;
          }
        }

        totalEarned += pointsEarned;

        await tx.quizAttemptAnswer.create({
          data: {
            attemptId: attempt.id,
            questionId: question.id,
            selectedOptionIds: ans.selectedOptionIds ?? (selectedOptionId ? [selectedOptionId] : []),
            textAnswer: ans.textAnswer?.trim(),
            isCorrect,
            pointsAwarded: pointsEarned,
          },
        });
      }

      const scorePercent = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
      const isPassed = scorePercent >= attempt.quiz.passingScore;

      return tx.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: isExpired ? 'EXPIRED' : 'SUBMITTED',
          submittedAt: now,
          score: Math.round(scorePercent * 100) / 100,
          isPassed,
        },
      });
    });
  }
}
