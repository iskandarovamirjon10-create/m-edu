import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateHomeworkDto, UpdateHomeworkDto } from '../common/dto';
import { HomeworkQuery } from '../common/dto/query';

@Injectable()
export class HomeworkService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: HomeworkQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.HomeworkWhereInput = { organizationId };

    if (query.groupId) where.groupId = query.groupId;

    const [items, total] = await Promise.all([
      this.prisma.homework.findMany({
        where,
        include: { group: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.homework.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const homework = await this.prisma.homework.findFirst({
      where: { id, organizationId },
      include: { group: { select: { id: true, name: true } } },
    });
    if (!homework) throw new NotFoundException('Homework not found');
    return homework;
  }

  async create(organizationId: string, data: CreateHomeworkDto) {
    const group = await this.prisma.group.findFirst({
      where: { id: data.groupId, organizationId },
    });
    if (!group) throw new NotFoundException('Group not found');

    return this.prisma.homework.create({
      data: {
        organizationId,
        groupId: data.groupId,
        title: data.title,
        description: data.description,
        deadline: data.deadline ? new Date(data.deadline) : null,
        maxScore: data.maxScore,
      },
    });
  }

  async update(organizationId: string, id: string, data: UpdateHomeworkDto) {
    await this.findOne(organizationId, id);

    const updateData: Prisma.HomeworkUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.deadline !== undefined) updateData.deadline = new Date(data.deadline);
    if (data.maxScore !== undefined) updateData.maxScore = data.maxScore;

    if (Object.keys(updateData).length === 0) return this.findOne(organizationId, id);

    return this.prisma.homework.update({ where: { id, organizationId }, data: updateData });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.homework.delete({ where: { id, organizationId } });
  }
}
