import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto, GradeSubmissionDto, SubmitAssignmentDto } from './assignment.dto';
import { parsePagination } from '../lib/pagination';

export interface AssignmentQuery {
  page?: string | number;
  limit?: string | number;
  groupId?: string;
  lessonId?: string;
  status?: string;
}

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: AssignmentQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: any = { organizationId };

    if (query.groupId) where.groupId = query.groupId;
    if (query.lessonId) where.lessonId = query.lessonId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.assignment.findMany({
        where,
        include: {
          Group: { select: { id: true, name: true } },
          Lesson: { select: { id: true, date: true, topic: true } },
          _count: { select: { AssignmentSubmission: true } },
        },
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.assignment.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, organizationId },
      include: {
        Group: { select: { id: true, name: true } },
        Lesson: { select: { id: true, date: true, topic: true } },
        Topic: { select: { id: true, title: true } },
        AssignmentSubmission: {
          include: {
            Student: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  async create(organizationId: string, dto: CreateAssignmentDto) {
    const group = await this.prisma.group.findFirst({
      where: { id: dto.groupId, organizationId },
    });
    if (!group) throw new NotFoundException('Group not found');

    if (dto.lessonId) {
      const lesson = await this.prisma.lesson.findFirst({
        where: { id: dto.lessonId, organizationId, groupId: dto.groupId },
      });
      if (!lesson) throw new NotFoundException('Lesson not found in this group');
    }

    return this.prisma.assignment.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        groupId: dto.groupId,
        lessonId: dto.lessonId,
        topicId: dto.topicId,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        dueDate: new Date(dto.dueDate),
        maxScore: dto.maxScore ?? 100.0,
        maxAttempts: dto.maxAttempts ?? 1,
        status: dto.status ?? 'PUBLISHED',
        attachments: dto.attachments ?? [],
        updatedAt: new Date(),
      },
    });
  }

  async submit(organizationId: string, assignmentId: string, studentUserId: string, dto: SubmitAssignmentDto) {
    const assignment = await this.findOne(organizationId, assignmentId);

    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Student profile not found');

    // Check enrollment
    const enrollment = await this.prisma.studentGroup.findUnique({
      where: {
        studentId_groupId: {
          studentId: student.id,
          groupId: assignment.groupId,
        },
      },
    });
    if (!enrollment || !enrollment.isActive) {
      throw new ForbiddenException('Student is not enrolled in this assignment group');
    }

    const previousAttempts = await this.prisma.assignmentSubmission.count({
      where: { assignmentId, studentId: student.id },
    });

    if (previousAttempts >= assignment.maxAttempts) {
      throw new BadRequestException(`Maximum submission attempts (${assignment.maxAttempts}) exceeded`);
    }

    const now = new Date();
    const isLate = now > assignment.dueDate;

    return this.prisma.assignmentSubmission.create({
      data: {
        id: crypto.randomUUID(),
        assignmentId,
        studentId: student.id,
        attemptNumber: previousAttempts + 1,
        status: isLate ? 'LATE' : 'SUBMITTED',
        content: dto.content?.trim(),
        attachments: dto.attachments ?? [],
        submittedAt: now,
        updatedAt: now,
      },
    });
  }

  async gradeSubmission(
    organizationId: string,
    submissionId: string,
    graderUserId: string,
    dto: GradeSubmissionDto,
  ) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { Assignment: true },
    });
    if (!submission || submission.Assignment.organizationId !== organizationId) {
      throw new NotFoundException('Submission not found');
    }

    if (dto.score > submission.Assignment.maxScore) {
      throw new BadRequestException(`Score cannot exceed maxScore (${submission.Assignment.maxScore})`);
    }

    return this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score: dto.score,
        feedback: dto.feedback?.trim(),
        status: 'GRADED',
        gradedBy: graderUserId,
        gradedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}
