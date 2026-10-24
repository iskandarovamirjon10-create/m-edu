import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateGradeDto, UpdateGradeDto } from '../common/dto';
import { GradeQuery } from '../common/dto/query';

/** Mirrors the Prisma default for `Grade.maxValue` (Float? @default(100)). */
const DEFAULT_MAX_VALUE = 100;

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
    const existing = await this.findOne(organizationId, id);

    const updateData: Prisma.GradeUpdateInput = {};
    if (data.value !== undefined) updateData.value = data.value;
    if (data.maxValue !== undefined) updateData.maxValue = data.maxValue;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (Object.keys(updateData).length === 0) return this.findOne(organizationId, id);

    // `maxValue` is nullable in the schema, so a legacy row may have no max —
    // fall back to the database default instead of comparing against null.
    const nextValue = data.value ?? existing.value;
    const nextMax = data.maxValue ?? existing.maxValue ?? DEFAULT_MAX_VALUE;
    if (nextMax <= 0) throw new BadRequestException('maxValue must be greater than zero');
    if (nextValue > nextMax) {
      throw new BadRequestException(`Grade value (${nextValue}) cannot exceed maxValue (${nextMax})`);
    }

    return this.prisma.grade.update({ where: { id, organizationId }, data: updateData });
  }

  async create(organizationId: string, data: CreateGradeDto) {
    const maxValue = data.maxValue ?? DEFAULT_MAX_VALUE;
    if (maxValue <= 0) throw new BadRequestException('maxValue must be greater than zero');
    if (data.value > maxValue) {
      throw new BadRequestException(`Grade value (${data.value}) cannot exceed maxValue (${maxValue})`);
    }

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
      let studentName: string | null = null;
      try {
        const student = await this.prisma.student?.findUnique?.({
          where: { id: data.studentId },
          include: { user: { select: { firstName: true, lastName: true } } },
        });
        if (student?.user) {
          studentName = `${student.user.firstName} ${student.user.lastName}`.trim();
        }
      } catch {
        // mock safe
      }
      const groupName = group?.name || null;
      const friendlyMsg = studentName && groupName
        ? `Student "${studentName}" is not enrolled in group "${groupName}".`
        : 'Student is not enrolled in group.';

      throw new BadRequestException({
        code: 'STUDENT_NOT_ENROLLED_IN_GROUP',
        message: friendlyMsg,
        studentId: data.studentId,
        studentName,
        groupId: data.groupId,
        groupName,
      });
    }

    return this.prisma.grade.create({
      data: {
        organizationId,
        studentId: data.studentId,
        groupId: data.groupId,
        value: data.value,
        maxValue,
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
