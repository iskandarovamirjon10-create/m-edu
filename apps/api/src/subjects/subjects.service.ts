import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto, UpdateSubjectDto, QuerySubjectDto } from './subject.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: QuerySubjectDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SubjectWhereInput = {
      organizationId,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.subject.findMany({
        where,
        include: {
          Course: { select: { id: true, name: true } },
          _count: { select: { Curriculum: true, Material: true, Question: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subject.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, organizationId },
      include: {
        Course: { select: { id: true, name: true } },
        Curriculum: { select: { id: true, name: true, version: true, status: true } },
        _count: { select: { Material: true, Question: true, StudentObjectiveMastery: true } },
      },
    });

    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  async create(organizationId: string, dto: CreateSubjectDto) {
    const existing = await this.prisma.subject.findFirst({
      where: { organizationId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new BadRequestException(`Subject with code "${dto.code}" already exists in this organization`);
    }

    return this.prisma.subject.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        description: dto.description?.trim(),
        isActive: dto.isActive ?? true,
        updatedAt: new Date(),
      },
      include: { Course: { select: { id: true, name: true } } },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateSubjectDto) {
    await this.findOne(organizationId, id);

    if (dto.code) {
      const existing = await this.prisma.subject.findFirst({
        where: {
          organizationId,
          code: dto.code.trim().toUpperCase(),
          NOT: { id },
        },
      });
      if (existing) {
        throw new BadRequestException(`Subject with code "${dto.code}" already exists in this organization`);
      }
    }

    return this.prisma.subject.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        updatedAt: new Date(),
      },
      include: { Course: { select: { id: true, name: true } } },
    });
  }

  async remove(organizationId: string, id: string) {
    const subject = await this.findOne(organizationId, id);
    return this.prisma.subject.update({
      where: { id: subject.id },
      data: { isActive: false },
    });
  }
}
