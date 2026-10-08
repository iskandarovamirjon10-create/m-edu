import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLessonContentDto, UpdateLessonStatusDto } from './lesson.dto';
import { parsePagination } from '../lib/pagination';

export interface LessonQuery {
  page?: string | number;
  limit?: string | number;
  groupId?: string;
  teacherId?: string;
  date?: string;
  status?: string;
}

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: LessonQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: any = { organizationId };

    if (query.groupId) where.groupId = query.groupId;
    if (query.teacherId) where.teacherId = query.teacherId;
    if (query.status) where.status = query.status;
    if (query.date) {
      const d = new Date(query.date);
      d.setUTCHours(0, 0, 0, 0);
      where.date = d;
    }

    const [items, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where,
        include: {
          Group: { select: { id: true, name: true, courseId: true } },
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          Topic: { select: { id: true, title: true } },
          _count: { select: { attendances: true, LessonMaterial: true, Assignment: true } },
        },
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
      }),
      this.prisma.lesson.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, organizationId },
      include: {
        Group: { select: { id: true, name: true } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        Topic: {
          include: {
            LearningObjective: true,
          },
        },
        LessonMaterial: {
          include: {
            Material: true,
          },
        },
        Assignment: {
          include: {
            _count: { select: { AssignmentSubmission: true } },
          },
        },
        attendances: {
          include: {
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });

    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async updateStatus(organizationId: string, id: string, dto: UpdateLessonStatusDto) {
    const lesson = await this.findOne(organizationId, id);

    const updateData: any = { status: dto.status };
    if (dto.status === 'CANCELLED') {
      updateData.cancelledAt = new Date();
      updateData.cancelReason = dto.cancelReason ?? 'Cancelled by teacher/administrator';
    } else {
      updateData.cancelledAt = null;
      updateData.cancelReason = null;
    }

    return this.prisma.lesson.update({
      where: { id: lesson.id },
      data: updateData,
    });
  }

  async updateContent(organizationId: string, id: string, dto: UpdateLessonContentDto) {
    const lesson = await this.findOne(organizationId, id);

    if (dto.topicId) {
      // Tenant isolation: only a topic that resolves back to the caller's
      // organization (Topic → CurriculumModule → Curriculum) may be linked.
      // A bare `findUnique({ id })` let one tenant attach another tenant's
      // topic to its own lesson.
      const topic = await this.prisma.topic.findFirst({
        where: {
          id: dto.topicId,
          CurriculumModule: { Curriculum: { organizationId } },
        },
      });
      if (!topic) throw new NotFoundException('Topic not found');
    }

    return this.prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        ...(dto.topicId !== undefined ? { topicId: dto.topicId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.room !== undefined ? { room: dto.room } : {}),
      },
    });
  }

  async linkMaterial(organizationId: string, lessonId: string, materialId: string) {
    await this.findOne(organizationId, lessonId);

    const material = await this.prisma.material.findFirst({
      where: { id: materialId, organizationId },
    });
    if (!material) throw new NotFoundException('Material not found');

    return this.prisma.lessonMaterial.upsert({
      where: {
        lessonId_materialId: { lessonId, materialId },
      },
      create: { id: crypto.randomUUID(), lessonId, materialId },
      update: {},
    });
  }

  async unlinkMaterial(organizationId: string, lessonId: string, materialId: string) {
    await this.findOne(organizationId, lessonId);

    return this.prisma.lessonMaterial.deleteMany({
      where: { lessonId, materialId },
    });
  }
}
