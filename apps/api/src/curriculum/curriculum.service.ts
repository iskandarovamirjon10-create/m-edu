import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCurriculumDto, UpdateCurriculumDto, CreateModuleDto, CreateTopicDto, CreateObjectiveDto } from './curriculum.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: { subjectId?: string; courseId?: string }) {
    const where: Prisma.CurriculumWhereInput = {
      organizationId,
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
    };

    return this.prisma.curriculum.findMany({
      where,
      include: {
        Course: { select: { id: true, name: true } },
        Subject: { select: { id: true, name: true, code: true } },
        _count: { select: { CurriculumModule: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const curriculum = await this.prisma.curriculum.findFirst({
      where: { id, organizationId },
      include: {
        Course: { select: { id: true, name: true } },
        Subject: { select: { id: true, name: true, code: true } },
        CurriculumModule: {
          orderBy: { order: 'asc' },
          include: {
            Topic: {
              orderBy: { order: 'asc' },
              include: {
                LearningObjective: true,
                _count: { select: { Assignment: true, Question: true } },
              },
            },
          },
        },
      },
    });

    if (!curriculum) throw new NotFoundException('Curriculum not found');
    return curriculum;
  }

  async create(organizationId: string, dto: CreateCurriculumDto) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, organizationId },
    });
    if (!subject) throw new NotFoundException('Associated Subject not found');

    if (dto.courseId) {
      const course = await this.prisma.course.findFirst({
        where: { id: dto.courseId, organizationId },
      });
      if (!course) throw new NotFoundException('Associated Course not found');
    }

    return this.prisma.curriculum.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        subjectId: dto.subjectId,
        courseId: dto.courseId,
        name: dto.name.trim(),
        version: Number(dto.version) || 1,
        description: dto.description?.trim(),
        status: dto.status ?? 'DRAFT',
        updatedAt: new Date(),
      },
      include: {
        Course: { select: { id: true, name: true } },
        Subject: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateCurriculumDto) {
    await this.findOne(organizationId, id);

    if (dto.courseId) {
      const course = await this.prisma.course.findFirst({
        where: { id: dto.courseId, organizationId },
      });
      if (!course) throw new NotFoundException('Associated Course not found');
    }

    return this.prisma.curriculum.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.version ? { version: Number(dto.version) || 1 } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.courseId !== undefined ? { courseId: dto.courseId } : {}),
        updatedAt: new Date(),
      },
      include: {
        Course: { select: { id: true, name: true } },
        Subject: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async addModule(organizationId: string, curriculumId: string, dto: CreateModuleDto) {
    await this.findOne(organizationId, curriculumId);

    return this.prisma.curriculumModule.create({
      data: {
        id: crypto.randomUUID(),
        curriculumId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        order: dto.orderIndex ?? 1,
        updatedAt: new Date(),
      },
    });
  }

  async addTopic(organizationId: string, curriculumId: string, moduleId: string, dto: CreateTopicDto) {
    const curriculum = await this.findOne(organizationId, curriculumId);
    const mod = curriculum.CurriculumModule.find(m => m.id === moduleId);
    if (!mod) throw new NotFoundException('Curriculum module not found');

    return this.prisma.topic.create({
      data: {
        id: crypto.randomUUID(),
        moduleId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        order: dto.orderIndex ?? 1,
        estimatedMinutes: dto.durationMin ?? 45,
        updatedAt: new Date(),
      },
    });
  }

  async addObjective(organizationId: string, curriculumId: string, topicId: string, dto: CreateObjectiveDto) {
    await this.findOne(organizationId, curriculumId);
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Topic not found');

    return this.prisma.learningObjective.create({
      data: {
        id: crypto.randomUUID(),
        topicId,
        code: dto.code.trim().toUpperCase(),
        title: dto.description.trim().slice(0, 50),
        description: dto.description.trim(),
        updatedAt: new Date(),
      },
    });
  }
}
