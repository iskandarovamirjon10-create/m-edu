import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { hashPassword } from '../auth/auth.config';
import { normalizeEmail } from '../auth/auth.utils';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateTeacherDto, UpdateTeacherDto } from '../common/dto';
import { TeacherQuery } from '../common/dto/query';
import { userPublicSelect } from '../common/selects/user.select';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: TeacherQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.TeacherWhereInput = { organizationId };

    if (query.search) {
      where.OR = [
        { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { user: { phone: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true } },
          groups: { where: { isActive: true }, select: { id: true, name: true } },
          _count: { select: { groups: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.teacher.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, organizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true } },
        groups: { where: { isActive: true }, include: { course: { select: { id: true, name: true } } } },
      },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    return teacher;
  }

  async create(organizationId: string, data: CreateTeacherDto) {
    const normalizedEmail = data.email ? normalizeEmail(data.email) : null;
    if (normalizedEmail) {
      // User.email is globally unique across the whole system
      const existing = await this.prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      });
      if (existing) throw new BadRequestException('Email already registered');
    }

    const passwordHash = data.password ? await hashPassword(data.password) : null;
    const email = normalizedEmail || `teacher-${randomUUID()}@placeholder.local`;
    const phone = data.phone?.trim() || null;

    try {
      return await this.prisma.teacher.create({
        data: {
          organization: { connect: { id: organizationId } },
          specializations: data.specializations || [],
          salaryType: data.salaryType || 'MONTHLY',
          hourlyRate: data.hourlyRate ?? null,
          lessonRate: data.lessonRate ?? null,
          bio: data.bio?.trim() || null,
          experience: data.experience ?? null,
          user: {
            create: {
              organization: { connect: { id: organizationId } },
              email,
              passwordHash,
              firstName: data.firstName.trim(),
              lastName: data.lastName.trim(),
              phone,
              role: 'TEACHER',
              settings: { create: {} },
            },
          },
        },
        include: { user: userPublicSelect },
      });
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Email already registered');
      }
      throw error;
    }
  }

  async update(organizationId: string, id: string, data: UpdateTeacherDto) {
    const teacher = await this.findOne(organizationId, id);

    const teacherData: Prisma.TeacherUpdateInput = {};
    if (data.specializations !== undefined) teacherData.specializations = data.specializations;
    if (data.salaryType !== undefined) teacherData.salaryType = data.salaryType;
    if (data.hourlyRate !== undefined) teacherData.hourlyRate = data.hourlyRate;
    if (data.lessonRate !== undefined) teacherData.lessonRate = data.lessonRate;
    if (data.bio !== undefined) teacherData.bio = data.bio?.trim() || null;
    if (data.experience !== undefined) teacherData.experience = data.experience;

    const userData: Prisma.UserUpdateInput = {};
    if (data.firstName !== undefined) userData.firstName = data.firstName.trim();
    if (data.lastName !== undefined) userData.lastName = data.lastName.trim();
    if (data.phone !== undefined) userData.phone = data.phone?.trim() || null;
    if (data.isActive !== undefined) userData.isActive = data.isActive;

    if (data.email !== undefined) {
      const normalizedEmail = data.email ? normalizeEmail(data.email) : null;
      if (normalizedEmail) {
        const existing = await this.prisma.user.findFirst({
          where: {
            email: { equals: normalizedEmail, mode: 'insensitive' },
            id: { not: teacher.userId },
          },
        });
        if (existing) throw new BadRequestException('Email already registered');
        userData.email = normalizedEmail;
      }
    }

    if (data.password) {
      userData.passwordHash = await hashPassword(data.password);
    }

    if (Object.keys(teacherData).length === 0 && Object.keys(userData).length === 0) {
      return this.findOne(organizationId, id);
    }

    try {
      return await this.prisma.teacher.update({
        where: { id, organizationId },
        data: {
          ...teacherData,
          ...(Object.keys(userData).length > 0 ? { user: { update: userData } } : {}),
        },
        include: { user: userPublicSelect },
      });
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Email already registered');
      }
      throw error;
    }
  }

  /**
   * Hard-delete a teacher AND their linked login account.
   *
   * Teachers referenced by any group are rejected (deletion would silently
   * null the group's teacherId or violate RESTRICT semantics) — deactivate
   * instead. Otherwise removes the Teacher row and the linked User row in
   * one transaction so the deleted teacher cannot log in.
   */
  async remove(organizationId: string, id: string) {
    const teacher = await this.findOne(organizationId, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.group.updateMany({
        where: { teacherId: id, organizationId },
        data: { teacherId: null },
      });
      await tx.lesson.updateMany({
        where: { teacherId: id },
        data: { teacherId: null },
      });
      await tx.payrollRun.deleteMany({
        where: { teacherId: id, organizationId },
      });

      await tx.teacher.delete({ where: { id, organizationId } });

      // Remove the linked login account so a deleted teacher cannot sign in.
      if (teacher.userId) {
        await tx.notification.deleteMany({ where: { userId: teacher.userId } });
        await tx.session.deleteMany({ where: { userId: teacher.userId } });
        await tx.userSettings.deleteMany({ where: { userId: teacher.userId } });
        await tx.user.deleteMany({ where: { id: teacher.userId, organizationId } });
      }
    });

    return { message: 'Teacher deleted successfully' };
  }
}
