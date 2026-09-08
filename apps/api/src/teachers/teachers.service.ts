import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateTeacherDto, UpdateTeacherDto } from '../common/dto';
import { TeacherQuery } from '../common/dto/query';

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
    if (data.email) {
      const existing = await this.prisma.user.findFirst({ where: { email: data.email } });
      if (existing) throw new BadRequestException('Email already registered');
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const email = data.email || `teacher-${randomUUID()}@placeholder.local`;

    return this.prisma.teacher.create({
      data: {
        organization: { connect: { id: organizationId } },
        specializations: data.specializations || [],
        hourlyRate: data.hourlyRate,
        bio: data.bio,
        experience: data.experience,
        user: {
          create: {
            organization: { connect: { id: organizationId } },
            email,
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            role: 'TEACHER',
            settings: { create: {} },
          },
        },
      },
      include: { user: true },
    });
  }

  async update(organizationId: string, id: string, data: UpdateTeacherDto) {
    await this.findOne(organizationId, id);

    const teacherData: Prisma.TeacherUpdateInput = {};
    if (data.specializations !== undefined) teacherData.specializations = data.specializations;
    if (data.hourlyRate !== undefined) teacherData.hourlyRate = data.hourlyRate;
    if (data.bio !== undefined) teacherData.bio = data.bio;
    if (data.experience !== undefined) teacherData.experience = data.experience;

    const userData: Prisma.UserUpdateInput = {};
    if (data.firstName !== undefined) userData.firstName = data.firstName;
    if (data.lastName !== undefined) userData.lastName = data.lastName;
    if (data.phone !== undefined) userData.phone = data.phone;

    if (Object.keys(teacherData).length === 0 && Object.keys(userData).length === 0) {
      return this.findOne(organizationId, id);
    }

    return this.prisma.teacher.update({
      where: { id, organizationId },
      data: {
        ...teacherData,
        ...(Object.keys(userData).length > 0 ? { user: { update: userData } } : {}),
      },
      include: { user: true },
    });
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

    const groupCount = await this.prisma.group.count({ where: { teacherId: id } });
    if (groupCount > 0) {
      throw new BadRequestException(
        'This teacher is assigned to groups — deactivate the teacher instead of deleting them',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teacher.delete({ where: { id, organizationId } });

      // Remove the linked login account so a deleted teacher cannot sign in.
      if (teacher.userId) {
        await tx.notification.deleteMany({ where: { userId: teacher.userId } });
        await tx.session.deleteMany({ where: { userId: teacher.userId } });
        await tx.userSettings.deleteMany({ where: { userId: teacher.userId } });
        await tx.user.delete({ where: { id: teacher.userId } });
      }
    });

    return { message: 'Teacher deleted successfully' };
  }
}
