import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  async findAll(
    organizationId: string,
    query: AssignmentQuery,
    requester?: { id: string; role: string },
  ) {
    const { page, limit, skip } = parsePagination(query);
    const where: any = { organizationId };

    // SECURITY: family roles must never list every assignment in the org
    // (titles, due dates, submission counts of other groups). Scope them to
    // their own enrolled groups (student) / linked children's groups (parent).
    // Teachers are scoped to their assigned groups.
    let allowedGroupIds: string[] | undefined;
    if (requester?.role === 'STUDENT') {
      const student = await this.prisma.student.findUnique({
        where: { userId: requester.id },
      });
      if (!student || student.organizationId !== organizationId) {
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
      const enrollments = await this.prisma.studentGroup.findMany({
        where: { studentId: student.id, isActive: true },
        select: { groupId: true },
      });
      allowedGroupIds = enrollments.map((e) => e.groupId);
      where.groupId = { in: allowedGroupIds };
    } else if (requester?.role === 'PARENT') {
      const children = await this.prisma.parentStudent.findMany({
        where: { parentId: requester.id },
        select: { studentId: true },
      });
      const enrollments = await this.prisma.studentGroup.findMany({
        where: {
          studentId: { in: children.map((c) => c.studentId) },
          isActive: true,
        },
        select: { groupId: true },
      });
      allowedGroupIds = enrollments.map((e) => e.groupId);
      where.groupId = { in: allowedGroupIds };
    } else if (requester?.role === 'TEACHER' || requester?.role === 'ASSISTANT') {
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId: requester.id, organizationId },
        select: { id: true },
      });
      const teacherGroups = await this.prisma.group.findMany({
        where: { teacherId: teacher?.id || '00000000-0000-0000-0000-000000000000', organizationId },
        select: { id: true },
      });
      allowedGroupIds = teacherGroups.map((g) => g.id);
      where.groupId = { in: allowedGroupIds };
    }

    // SECURITY: intersect the requested group with the allowed set instead of
    // overwriting it, otherwise `?groupId=other` bypasses the scoping.
    if (query.groupId) {
      where.groupId =
        allowedGroupIds !== undefined
          ? allowedGroupIds.includes(query.groupId)
            ? query.groupId
            : { in: [] }
          : query.groupId;
    }
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

    return { items, total, page, limit, totalPages: Math.ceil(total / (limit || 1)) };
  }

  async findOne(organizationId: string, id: string, requester?: { id: string; role: string }) {
    // SECURITY: submissions contain classmates' names, content, scores and
    // feedback. FAMILY roles may only ever see their own submissions.
    let submissionFilter: Prisma.AssignmentSubmissionWhereInput | undefined;
    if (requester?.role === 'STUDENT') {
      const student = await this.prisma.student.findUnique({ where: { userId: requester.id } });
      submissionFilter =
        student && student.organizationId === organizationId
          ? { studentId: student.id }
          : { studentId: { in: [] } }; // no profile → see nothing
    } else if (requester?.role === 'PARENT') {
      const children = await this.prisma.parentStudent.findMany({
        where: { parentId: requester.id },
        select: { studentId: true },
      });
      submissionFilter = { studentId: { in: children.map((c) => c.studentId) } };
    }

    const assignment = await this.prisma.assignment.findFirst({
      where: { id, organizationId },
      include: {
        Group: { select: { id: true, name: true } },
        Lesson: { select: { id: true, date: true, topic: true } },
        Topic: { select: { id: true, title: true } },
        AssignmentSubmission: {
          ...(submissionFilter ? { where: submissionFilter } : {}),
          include: {
            Student: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!assignment) throw new NotFoundException('Assignment not found');

    if (requester?.role === 'TEACHER' || requester?.role === 'ASSISTANT') {
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId: requester.id, organizationId },
        select: { id: true },
      });
      const group = await this.prisma.group.findFirst({
        where: { id: assignment.groupId, organizationId },
        select: { teacherId: true },
      });
      if (!teacher || group?.teacherId !== teacher.id) {
        throw new ForbiddenException('Teachers can only view assignments for their assigned groups');
      }
    }

    return assignment;
  }

  async create(organizationId: string, dto: CreateAssignmentDto, requester?: { id: string; role: string }) {
    const group = await this.prisma.group.findFirst({
      where: { id: dto.groupId, organizationId },
    });
    if (!group) throw new NotFoundException('Group not found');

    if (requester?.role === 'TEACHER' || requester?.role === 'ASSISTANT') {
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId: requester.id, organizationId },
        select: { id: true },
      });
      if (!teacher || group.teacherId !== teacher.id) {
        throw new ForbiddenException('Teachers can only create assignments for their assigned groups');
      }
    }

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
    if (!student || student.organizationId !== organizationId) {
      throw new NotFoundException('Student profile not found');
    }

    // Security: ensure student submissions are strictly tied to the authenticated student's record
    if ((dto as any).studentId && (dto as any).studentId !== student.id) {
      throw new ForbiddenException('Cannot submit assignment on behalf of another student');
    }

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
    requester?: { id: string; role: string },
  ) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { Assignment: true },
    });
    if (!submission || submission.Assignment.organizationId !== organizationId) {
      throw new NotFoundException('Submission not found');
    }

    // Object-level authorization: Teachers can only grade submissions for students in their assigned groups
    if (requester?.role === 'TEACHER' || requester?.role === 'ASSISTANT') {
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId: requester.id, organizationId },
        select: { id: true },
      });
      const group = await this.prisma.group.findFirst({
        where: { id: submission.Assignment.groupId, organizationId },
        select: { teacherId: true },
      });
      if (!teacher || group?.teacherId !== teacher.id) {
        throw new ForbiddenException('Teachers can only grade submissions for students in their assigned groups');
      }
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
