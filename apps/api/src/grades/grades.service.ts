import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateGradeDto, UpdateGradeDto } from '../common/dto';
import { GradeQuery } from '../common/dto/query';

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: GradeQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.GradeWhereInput = { organizationId };

    if (query.studentId) where.studentId = query.studentId;
    if (query.groupId) where.groupId = query.groupId;

    const [items, total] = await Promise.all([
      this.prisma.grade.findMany({
        where,
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          group: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.grade.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const grade = await this.prisma.grade.findFirst({
      where: { id, organizationId },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
        group: { select: { id: true, name: true } },
      },
    });
    if (!grade) throw new NotFoundException('Grade not found');
    return grade;
  }

  async update(organizationId: string, id: string, data: UpdateGradeDto) {
    await this.findOne(organizationId, id);

    const updateData: Prisma.GradeUpdateInput = {};
    if (data.value !== undefined) updateData.value = data.value;
    if (data.maxValue !== undefined) updateData.maxValue = data.maxValue;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (Object.keys(updateData).length === 0) return this.findOne(organizationId, id);

    return this.prisma.grade.update({ where: { id, organizationId }, data: updateData });
  }

  async create(organizationId: string, data: CreateGradeDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, organizationId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const group = await this.prisma.group.findFirst({
      where: { id: data.groupId, organizationId },
    });
    if (!group) throw new NotFoundException('Group not found');

    // A grade is only meaningful for a student actually enrolled in the
    // group — same invariant as attendance. Prevents grading a student who
    // is not a member of the group.
    const membership = await this.prisma.studentGroup.findFirst({
      where: { studentId: data.studentId, groupId: data.groupId, organizationId, isActive: true },
    });
    if (!membership) {
      throw new BadRequestException(
        `Student ${data.studentId} is not enrolled in group ${data.groupId}`,
      );
    }

    return this.prisma.grade.create({
      data: {
        organizationId,
        studentId: data.studentId,
        groupId: data.groupId,
        value: data.value,
        maxValue: data.maxValue,
        label: data.label,
        notes: data.notes,
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const grade = await this.prisma.grade.findFirst({ where: { id, organizationId } });
    if (!grade) throw new NotFoundException('Grade not found');
    return this.prisma.grade.delete({ where: { id, organizationId } });
  }
}
