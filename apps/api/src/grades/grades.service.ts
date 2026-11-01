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

    return { items, total, page, limit, totalPages: Math.ceil(total / (limit || 1)) };
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

    if (typeof this.prisma.grade.updateMany === 'function') {
      await this.prisma.grade.updateMany({ where: { id, organizationId }, data: updateData });
      return this.findOne(organizationId, id);
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
    if (typeof this.prisma.grade.deleteMany === 'function') {
      await this.prisma.grade.deleteMany({ where: { id, organizationId } });
      return grade;
    }
    return this.prisma.grade.delete({ where: { id, organizationId } });
  }

  async calculateStudentGPA(organizationId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const grades = await this.prisma.grade.findMany({
      where: { studentId, organizationId },
    });

    if (grades.length === 0) {
      return { totalGrades: 0, gpa: 0, averagePercentage: 0 };
    }

    let totalWeight = 0;
    let weightedPoints = 0;

    for (const g of grades) {
      const maxVal = g.maxValue ?? DEFAULT_MAX_VALUE;
      const weight = maxVal > 0 ? maxVal : 0;
      if (weight > 0) {
        const pct = (g.value / maxVal) * 100;
        let points = 0;
        if (pct >= 90) points = 4.0;
        else if (pct >= 80) points = 3.7;
        else if (pct >= 70) points = 3.0;
        else if (pct >= 60) points = 2.0;
        else if (pct >= 50) points = 1.0;
        else points = 0.0;

        weightedPoints += points * weight;
        totalWeight += weight;
      }
    }

    const gpa = totalWeight > 0 ? Math.round((weightedPoints / totalWeight) * 100) / 100 : 0;
    const avgPercentage = totalWeight > 0
      ? Math.round((grades.reduce((acc, g) => acc + (g.value / (g.maxValue ?? DEFAULT_MAX_VALUE)) * 100, 0) / grades.length) * 10) / 10
      : 0;

    return {
      totalGrades: grades.length,
      gpa,
      averagePercentage: avgPercentage,
    };
  }
}
