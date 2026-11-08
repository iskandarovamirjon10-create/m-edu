import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { RequestUser } from '../../../auth/types';
import {
  ArenaQuestionSource,
  ArenaQuestionStatus,
  ArenaSubjectCategory,
  Prisma,
  QuestionDifficulty,
} from '@prisma/client';
import {
  CreateArenaQuestionDto,
  QueryArenaQuestionsDto,
  RejectArenaQuestionDto,
  UpdateArenaQuestionDto,
} from '../dto/arena-question.dto';
import { ArenaQuestionVerifierService } from './arena-question-verifier.service';

@Injectable()
export class ArenaQuestionsService {
  private readonly logger = new Logger(ArenaQuestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verifier: ArenaQuestionVerifierService,
  ) {}

  /**
   * Creates a new question manually by teacher or admin.
   */
  async createQuestion(user: RequestUser, dto: CreateArenaQuestionDto) {
    const isPlatformAdmin =
      user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN';

    // Global questions (organizationId = null) can only be created by platform admins
    if (dto.isGlobal && !isPlatformAdmin) {
      throw new ForbiddenException(
        "Global savollarni faqat platforma ma'murlari (SUPER_ADMIN) yarata oladi.",
      );
    }

    const organizationId = dto.isGlobal ? null : user.organizationId;

    // Run verifier
    const verification = await this.verifier.verifyQuestion({
      subjectCategory: dto.subjectCategory,
      questionText: dto.questionText,
      codeSnippet: dto.codeSnippet,
      codeLanguage: dto.codeLanguage,
      explanation: dto.explanation,
      options: dto.options,
    });

    if (!verification.passed) {
      throw new BadRequestException(
        `Savol ilmiy tekshiruvdan o'tmadi: ${verification.errors.join('; ')}`,
      );
    }

    const source = isPlatformAdmin
      ? ArenaQuestionSource.ADMIN
      : ArenaQuestionSource.TEACHER;

    // AI questions are never auto-approved. In-person admins can auto-approve only if platform admin.
    const status: ArenaQuestionStatus = isPlatformAdmin
      ? ArenaQuestionStatus.APPROVED
      : ArenaQuestionStatus.PENDING_REVIEW;

    return this.prisma.arenaQuestion.create({
      data: {
        organizationId,
        subjectCategory: dto.subjectCategory,
        difficulty: dto.difficulty,
        status,
        source,
        questionText: dto.questionText,
        codeSnippet: dto.codeSnippet,
        codeLanguage: dto.codeLanguage,
        imageUrl: dto.imageUrl,
        explanation: dto.explanation,
        timeLimitSec: dto.timeLimitSec ?? 15,
        tags: dto.tags ?? [],
        createdById: user.id,
        approvedById: status === ArenaQuestionStatus.APPROVED ? user.id : null,
        approvedAt: status === ArenaQuestionStatus.APPROVED ? new Date() : null,
        verificationLog: {
          score: verification.score,
          details: verification.details,
          warnings: verification.warnings,
        },
        options: {
          create: dto.options.map((opt, idx) => ({
            optionKey: opt.optionKey,
            optionText: opt.optionText,
            isCorrect: opt.isCorrect,
            explanation: opt.explanation,
            orderIndex: opt.orderIndex ?? idx,
          })),
        },
      },
      include: {
        options: {
          orderBy: { orderIndex: 'asc' },
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Lists questions with strict multi-tenant isolation and rich filtering.
   */
  async listQuestions(user: RequestUser, query: QueryArenaQuestionsDto) {
    const isPlatformAdmin =
      user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN';

    const where: Prisma.ArenaQuestionWhereInput = {};

    // Multi-tenant isolation filter
    if (isPlatformAdmin) {
      if (query.scope === 'global') {
        where.organizationId = null;
      } else if (query.scope === 'tenant') {
        where.organizationId = { not: null };
      }
    } else {
      // Regular tenant staff can see their own tenant's questions + approved global questions
      if (query.scope === 'global') {
        where.organizationId = null;
        where.status = ArenaQuestionStatus.APPROVED;
      } else if (query.scope === 'tenant') {
        where.organizationId = user.organizationId;
      } else {
        where.OR = [
          { organizationId: user.organizationId },
          { organizationId: null, status: ArenaQuestionStatus.APPROVED },
        ];
      }
    }

    if (query.subjectCategory) {
      where.subjectCategory = query.subjectCategory;
    }
    if (query.difficulty) {
      where.difficulty = query.difficulty;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.source) {
      where.source = query.source;
    }
    if (query.search) {
      where.OR = [
        { questionText: { contains: query.search, mode: 'insensitive' } },
        { tags: { has: query.search.toLowerCase() } },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.arenaQuestion.count({ where }),
      this.prisma.arenaQuestion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          options: {
            orderBy: { orderIndex: 'asc' },
          },
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          approvedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single question with tenant security verification.
   */
  async getQuestionById(user: RequestUser, id: string) {
    const question = await this.prisma.arenaQuestion.findUnique({
      where: { id },
      include: {
        options: { orderBy: { orderIndex: 'asc' } },
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        approvedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    if (!question) {
      throw new NotFoundException(`Savol topilmadi (ID: ${id})`);
    }

    this.assertTenantAccess(user, question.organizationId);
    return question;
  }

  /**
   * Updates question text, options or metadata.
   * Increments version and resets status to PENDING_REVIEW if previously approved.
   */
  async updateQuestion(user: RequestUser, id: string, dto: UpdateArenaQuestionDto) {
    const existing = await this.getQuestionById(user, id);

    // Permission check
    const isPlatformAdmin =
      user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN';
    const isOrgAdmin =
      user.role === 'ORG_ADMIN' &&
      existing.organizationId === user.organizationId;
    const isAuthor = existing.createdById === user.id;

    if (!isPlatformAdmin && !isOrgAdmin && !isAuthor) {
      throw new ForbiddenException(
        "Sizda ushbu savolni tahrirlash huquqi mavjud emas.",
      );
    }

    // If options are updated, verify them
    if (dto.options) {
      const verification = await this.verifier.verifyQuestion({
        subjectCategory: dto.subjectCategory || existing.subjectCategory,
        questionText: dto.questionText || existing.questionText,
        codeSnippet: dto.codeSnippet !== undefined ? dto.codeSnippet : existing.codeSnippet,
        codeLanguage: dto.codeLanguage || existing.codeLanguage,
        explanation: dto.explanation || existing.explanation || '',
        options: dto.options,
      });

      if (!verification.passed) {
        throw new BadRequestException(
          `Yangilangan variantlar tekshiruvdan o'tmadi: ${verification.errors.join('; ')}`,
        );
      }
    }

    // Version increment & status reset logic
    const nextVersion = existing.version + 1;
    let nextStatus = existing.status;

    // Critical Architecture Rule: If an APPROVED question is modified, reset to PENDING_REVIEW!
    if (existing.status === ArenaQuestionStatus.APPROVED) {
      nextStatus = ArenaQuestionStatus.PENDING_REVIEW;
      this.logger.warn(
        `Question ${id} was APPROVED but modified. Reset to PENDING_REVIEW (v${nextVersion}).`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // If options are replaced, delete old and recreate
      if (dto.options) {
        await tx.arenaQuestionOption.deleteMany({
          where: { questionId: id },
        });
        await tx.arenaQuestionOption.createMany({
          data: dto.options.map((opt, idx) => ({
            questionId: id,
            optionKey: opt.optionKey,
            optionText: opt.optionText,
            isCorrect: opt.isCorrect,
            explanation: opt.explanation,
            orderIndex: opt.orderIndex ?? idx,
          })),
        });
      }

      return tx.arenaQuestion.update({
        where: { id },
        data: {
          questionText: dto.questionText,
          subjectCategory: dto.subjectCategory,
          difficulty: dto.difficulty,
          codeSnippet: dto.codeSnippet,
          codeLanguage: dto.codeLanguage,
          explanation: dto.explanation,
          timeLimitSec: dto.timeLimitSec,
          tags: dto.tags,
          version: nextVersion,
          status: nextStatus,
          approvedById: nextStatus === ArenaQuestionStatus.PENDING_REVIEW ? null : existing.approvedById,
          approvedAt: nextStatus === ArenaQuestionStatus.PENDING_REVIEW ? null : existing.approvedAt,
        },
        include: {
          options: { orderBy: { orderIndex: 'asc' } },
        },
      });
    });
  }

  /**
   * Approves question for active duels (RBAC restricted).
   */
  async approveQuestion(user: RequestUser, id: string) {
    const question = await this.prisma.arenaQuestion.findUnique({
      where: { id },
    });
    if (!question) {
      throw new NotFoundException(`Savol topilmadi (ID: ${id})`);
    }

    const isPlatformAdmin =
      user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN';
    const isOrgAdminOrManager =
      (user.role === 'ORG_ADMIN' || user.role === 'MANAGER') &&
      question.organizationId === user.organizationId;

    // RBAC: Global questions require Platform Admin
    if (question.organizationId === null && !isPlatformAdmin) {
      throw new ForbiddenException(
        "Global savollarni faqat platforma ma'murlari (SUPER_ADMIN) tasdiqlay oladi.",
      );
    }

    // Tenant questions require either Platform Admin or that tenant's Org Admin / Manager
    if (question.organizationId !== null && !isPlatformAdmin && !isOrgAdminOrManager) {
      throw new ForbiddenException(
        "Sizda ushbu savolni tasdiqlash uchun yetarli vakolat (RBAC) yo'q.",
      );
    }

    return this.prisma.arenaQuestion.update({
      where: { id },
      data: {
        status: ArenaQuestionStatus.APPROVED,
        approvedById: user.id,
        approvedAt: new Date(),
        rejectionReason: null,
      },
      include: {
        options: { orderBy: { orderIndex: 'asc' } },
      },
    });
  }

  /**
   * Rejects question with mandatory pedagogical reason.
   */
  async rejectQuestion(user: RequestUser, id: string, dto: RejectArenaQuestionDto) {
    const question = await this.prisma.arenaQuestion.findUnique({
      where: { id },
    });
    if (!question) {
      throw new NotFoundException(`Savol topilmadi (ID: ${id})`);
    }

    const isPlatformAdmin =
      user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN';
    const isOrgAdminOrManager =
      (user.role === 'ORG_ADMIN' || user.role === 'MANAGER') &&
      question.organizationId === user.organizationId;

    if (!isPlatformAdmin && !isOrgAdminOrManager) {
      throw new ForbiddenException(
        "Sizda ushbu savolni rad etish uchun yetarli vakolat yo'q.",
      );
    }

    return this.prisma.arenaQuestion.update({
      where: { id },
      data: {
        status: ArenaQuestionStatus.REJECTED,
        rejectionReason: dto.reason,
      },
      include: {
        options: { orderBy: { orderIndex: 'asc' } },
      },
    });
  }

  /**
   * Archives question so it is no longer served in live duels.
   */
  async archiveQuestion(user: RequestUser, id: string) {
    await this.getQuestionById(user, id);

    return this.prisma.arenaQuestion.update({
      where: { id },
      data: { status: ArenaQuestionStatus.ARCHIVED },
    });
  }

  /**
   * Concurrency-safe atomic increment of question usage and correct answers.
   */
  async recordQuestionUsage(questionId: string, isCorrect: boolean) {
    return this.prisma.arenaQuestion.update({
      where: { id: questionId },
      data: {
        timesUsed: { increment: 1 },
        correctCount: { increment: isCorrect ? 1 : 0 },
      },
    });
  }

  /**
   * Retrieves random approved questions for matchmaking round generation.
   */
  async getBattleQuestions(
    organizationId: string | null,
    subjectCategory: ArenaSubjectCategory,
    difficulty: QuestionDifficulty,
    count = 5,
  ) {
    const where: Prisma.ArenaQuestionWhereInput = {
      status: ArenaQuestionStatus.APPROVED,
      subjectCategory,
      difficulty,
      OR: [
        { organizationId },
        { organizationId: null },
      ],
    };

    const questions = await this.prisma.arenaQuestion.findMany({
      where,
      take: count * 3, // Overfetch candidate pool for pseudo-random shuffling
      orderBy: { timesUsed: 'asc' }, // Prioritize less frequently used questions
      include: {
        options: { orderBy: { orderIndex: 'asc' } },
      },
    });

    // Shuffle candidate pool
    const shuffled = questions.sort(() => 0.5 - Math.random());

    // Fallback 1: If difficulty-specific pool has fewer than count questions, top up from the same subject
    if (shuffled.length < count) {
      const existingIds = shuffled.map((q) => q.id);
      const fallbackQuestions = await this.prisma.arenaQuestion.findMany({
        where: {
          status: ArenaQuestionStatus.APPROVED,
          subjectCategory,
          id: { notIn: existingIds },
          OR: [{ organizationId }, { organizationId: null }],
        },
        take: (count - shuffled.length) * 2,
        orderBy: { timesUsed: 'asc' },
        include: {
          options: { orderBy: { orderIndex: 'asc' } },
        },
      });
      const fallbackShuffled = fallbackQuestions.sort(() => 0.5 - Math.random());
      shuffled.push(...fallbackShuffled.slice(0, count - shuffled.length));
    }

    // Fallback 2: If still under count, top up from any approved questions
    if (shuffled.length < count) {
      const existingIds = shuffled.map((q) => q.id);
      const anyQuestions = await this.prisma.arenaQuestion.findMany({
        where: {
          status: ArenaQuestionStatus.APPROVED,
          id: { notIn: existingIds },
          OR: [{ organizationId }, { organizationId: null }],
        },
        take: count - shuffled.length,
        include: {
          options: { orderBy: { orderIndex: 'asc' } },
        },
      });
      shuffled.push(...anyQuestions);
    }

    return shuffled.slice(0, count);
  }

  private assertTenantAccess(user: RequestUser, targetOrgId: string | null) {
    if (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN') {
      return;
    }
    if (targetOrgId !== null && targetOrgId !== user.organizationId) {
      throw new ForbiddenException(
        "Boshqa tashkilotga tegishli savollarni ko'rish taqiqlangan.",
      );
    }
  }
}
