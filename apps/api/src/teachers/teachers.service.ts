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
import {
  BulkTeacherStatusDto,
  BulkTeacherSalaryDto,
  BulkTeacherSpecializationsDto,
} from './dto/teachers-bulk.dto';

export interface TeacherStatsSummary {
  total: number;
  active: number;
  inactive: number;
  withGroups: number;
  withoutGroups: number;
  totalGroups: number;
  totalHoursWeekly: number;
  avgHourlyRate: number;
  avgExperience: number;
  salaryTypes: {
    monthly: number;
    hourly: number;
    perLesson: number;
  };
  specializations: Array<{ name: string; count: number }>;
}

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  private parseMinutes(start: string, end: string): number {
    const [sh = 0, sm = 0] = (start || '').split(':').map(Number);
    const [eh = 0, em = 0] = (end || '').split(':').map(Number);
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }

  async findAll(organizationId: string, query: TeacherQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.TeacherWhereInput = { organizationId };

    // Search filter across name, email, phone, specializations
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { user: { firstName: { contains: s, mode: 'insensitive' } } },
        { user: { lastName: { contains: s, mode: 'insensitive' } } },
        { user: { email: { contains: s, mode: 'insensitive' } } },
        { user: { phone: { contains: s, mode: 'insensitive' } } },
        { specializations: { has: s } },
      ];
    }

    // Active status filter
    if (query.isActive !== undefined && query.isActive !== '' && query.isActive !== 'ALL') {
      const activeBool = query.isActive === 'true' || query.isActive === '1';
      where.user = { is: { isActive: activeBool } };
    }

    // Salary type filter
    if (query.salaryType && query.salaryType !== 'ALL') {
      where.salaryType = query.salaryType as any;
    }

    // Specialization tag filter
    if (query.specialization?.trim()) {
      where.specializations = { has: query.specialization.trim() };
    }

    // Assigned groups filter
    if (query.hasGroups !== undefined && query.hasGroups !== '') {
      const hasGroupsBool = query.hasGroups === 'true' || query.hasGroups === '1';
      if (hasGroupsBool) {
        where.groups = { some: { isActive: true } };
      } else {
        where.groups = { none: { isActive: true } };
      }
    }

    // Sorting logic
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    let orderBy: Prisma.TeacherOrderByWithRelationInput = { createdAt: 'desc' };
    if (query.sortBy === 'name') {
      orderBy = { user: { firstName: sortOrder } };
    } else if (query.sortBy === 'hourlyRate') {
      orderBy = { hourlyRate: sortOrder };
    } else if (query.sortBy === 'experience') {
      orderBy = { experience: sortOrder };
    } else if (query.sortBy === 'createdAt') {
      orderBy = { createdAt: sortOrder };
    }

    const [items, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true } },
          groups: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              course: { select: { id: true, name: true } },
              schedules: {
                where: { isActive: true },
                select: { id: true, dayOfWeek: true, startTime: true, endTime: true, room: true },
              },
              _count: { select: { enrollments: { where: { isActive: true } } } },
            },
          },
          _count: { select: { groups: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.teacher.count({ where }),
    ]);

    // Enhance items with weekly teaching hours and total students count
    const enrichedItems = items.map((teacher) => {
      let totalStudents = 0;
      let totalMinutes = 0;
      const groups = Array.isArray(teacher.groups) ? teacher.groups : [];

      for (const group of groups) {
        totalStudents += group._count?.enrollments ?? 0;
        for (const schedule of group.schedules || []) {
          totalMinutes += this.parseMinutes(schedule.startTime, schedule.endTime);
        }
      }

      const weeklyHours = Math.round((totalMinutes / 60) * 10) / 10;
      return {
        ...teacher,
        metrics: {
          totalStudents,
          weeklyHours,
          groupsCount: groups.length,
        },
      };
    });

    return { items: enrichedItems, total, page, limit, totalPages: Math.ceil(total / (limit || 1)) };
  }

  async getStats(organizationId: string): Promise<TeacherStatsSummary> {
    const teachers = await this.prisma.teacher.findMany({
      where: { organizationId },
      include: {
        user: { select: { isActive: true } },
        groups: {
          where: { isActive: true },
          include: { schedules: { where: { isActive: true } } },
        },
      },
    });

    const total = teachers.length;
    let active = 0;
    let inactive = 0;
    let withGroups = 0;
    let totalGroups = 0;
    let totalMinutes = 0;
    let totalRates = 0;
    let rateCount = 0;
    let totalExp = 0;
    let expCount = 0;

    let monthly = 0;
    let hourly = 0;
    let perLesson = 0;
    const specMap: Record<string, number> = {};

    for (const t of teachers) {
      if (t.user?.isActive !== false) {
        active++;
      } else {
        inactive++;
      }

      const groups = Array.isArray(t.groups) ? t.groups : [];
      const activeGroups = groups.length;
      if (activeGroups > 0) {
        withGroups++;
        totalGroups += activeGroups;
      }

      for (const g of groups) {
        for (const s of g.schedules || []) {
          totalMinutes += this.parseMinutes(s.startTime, s.endTime);
        }
      }

      if (t.salaryType === 'HOURLY') hourly++;
      else if (t.salaryType === 'PER_LESSON') perLesson++;
      else monthly++;

      if (t.hourlyRate && Number(t.hourlyRate) > 0) {
        totalRates += Number(t.hourlyRate);
        rateCount++;
      }

      if (t.experience && t.experience > 0) {
        totalExp += t.experience;
        expCount++;
      }

      for (const spec of t.specializations || []) {
        const trimmed = spec.trim();
        if (trimmed) {
          specMap[trimmed] = (specMap[trimmed] || 0) + 1;
        }
      }
    }

    const specializations = Object.entries(specMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total,
      active,
      inactive,
      withGroups,
      withoutGroups: total - withGroups,
      totalGroups,
      totalHoursWeekly: Math.round((totalMinutes / 60) * 10) / 10,
      avgHourlyRate: rateCount > 0 ? Math.round(totalRates / rateCount) : 0,
      avgExperience: expCount > 0 ? Math.round((totalExp / expCount) * 10) / 10 : 0,
      salaryTypes: { monthly, hourly, perLesson },
      specializations,
    };
  }

  async findOne(organizationId: string, id: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, organizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true } },
        groups: {
          where: { isActive: true },
          include: {
            course: { select: { id: true, name: true } },
            schedules: {
              where: { isActive: true },
              select: { id: true, dayOfWeek: true, startTime: true, endTime: true, room: true },
            },
            _count: { select: { enrollments: { where: { isActive: true } } } },
          },
        },
      },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    if (!('groups' in teacher)) {
      return teacher;
    }

    let totalStudents = 0;
    let totalMinutes = 0;
    const groups = Array.isArray(teacher.groups) ? teacher.groups : [];
    for (const g of groups) {
      totalStudents += g._count?.enrollments ?? 0;
      for (const s of g.schedules || []) {
        totalMinutes += this.parseMinutes(s.startTime, s.endTime);
      }
    }

    const weeklyHours = Math.round((totalMinutes / 60) * 10) / 10;
    return {
      ...teacher,
      metrics: {
        totalStudents,
        weeklyHours,
        groupsCount: groups.length,
      },
    };
  }

  async getTeacherAnalytics(organizationId: string, id: string) {
    const teacher = await this.findOne(organizationId, id);
    const capacityHours = 40;
    const weeklyHours = teacher.metrics.weeklyHours;
    const utilization = capacityHours > 0 ? Math.round((weeklyHours / capacityHours) * 100) : 0;

    let workloadStatus: 'UNDERUTILIZED' | 'BALANCED' | 'OVERLOADED';
    if (utilization < 60) workloadStatus = 'UNDERUTILIZED';
    else if (utilization <= 100) workloadStatus = 'BALANCED';
    else workloadStatus = 'OVERLOADED';

    const hourlyRate = teacher.hourlyRate ? Number(teacher.hourlyRate) : 0;
    const lessonRate = teacher.lessonRate ? Number(teacher.lessonRate) : 0;
    let estimatedMonthlyCompensation = 0;

    if (teacher.salaryType === 'HOURLY') {
      estimatedMonthlyCompensation = Math.round(weeklyHours * 4.2 * hourlyRate);
    } else if (teacher.salaryType === 'PER_LESSON') {
      const estimatedLessonsMonth = Math.round(weeklyHours * 4.2);
      estimatedMonthlyCompensation = estimatedLessonsMonth * lessonRate;
    } else {
      estimatedMonthlyCompensation = 3_000_000 + Math.round(weeklyHours * 4.2 * 40_000);
    }

    return {
      teacherId: teacher.id,
      name: `${teacher.user?.firstName} ${teacher.user?.lastName}`,
      salaryType: teacher.salaryType,
      hourlyRate,
      lessonRate,
      weeklyHours,
      capacityHours,
      utilization,
      workloadStatus,
      totalStudents: teacher.metrics.totalStudents,
      groupsCount: teacher.metrics.groupsCount,
      estimatedMonthlyCompensation,
      groups: teacher.groups,
    };
  }

  async create(organizationId: string, data: CreateTeacherDto) {
    const normalizedEmail = data.email ? normalizeEmail(data.email) : null;
    if (normalizedEmail) {
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

  async bulkStatus(organizationId: string, dto: BulkTeacherStatusDto) {
    const teachers = await this.prisma.teacher.findMany({
      where: {
        id: { in: dto.teacherIds },
        organizationId,
      },
      select: { id: true, userId: true },
    });

    const userIds = teachers.map((t) => t.userId).filter(Boolean);
    if (userIds.length > 0) {
      await this.prisma.user.updateMany({
        where: { id: { in: userIds }, organizationId },
        data: { isActive: dto.isActive },
      });
    }

    return {
      success: true,
      updatedCount: userIds.length,
      isActive: dto.isActive,
    };
  }

  async bulkSalary(organizationId: string, dto: BulkTeacherSalaryDto) {
    const updateData: Prisma.TeacherUpdateManyMutationInput = {};
    if (dto.salaryType !== undefined) updateData.salaryType = dto.salaryType;
    if (dto.hourlyRate !== undefined) updateData.hourlyRate = dto.hourlyRate;
    if (dto.lessonRate !== undefined) updateData.lessonRate = dto.lessonRate;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No salary fields provided to update');
    }

    const res = await this.prisma.teacher.updateMany({
      where: {
        id: { in: dto.teacherIds },
        organizationId,
      },
      data: updateData,
    });

    return {
      success: true,
      updatedCount: res.count,
    };
  }

  async bulkSpecializations(organizationId: string, dto: BulkTeacherSpecializationsDto) {
    const teachers = await this.prisma.teacher.findMany({
      where: { id: { in: dto.teacherIds }, organizationId },
      select: { id: true, specializations: true },
    });

    let updatedCount = 0;
    for (const t of teachers) {
      let finalSpecs: string[];
      if (dto.mode === 'replace') {
        finalSpecs = Array.from(new Set(dto.specializations.map((s) => s.trim()).filter(Boolean)));
      } else {
        const set = new Set([...(t.specializations || []), ...dto.specializations.map((s) => s.trim()).filter(Boolean)]);
        finalSpecs = Array.from(set);
      }

      await this.prisma.teacher.update({
        where: { id: t.id },
        data: { specializations: finalSpecs },
      });
      updatedCount++;
    }

    return { success: true, updatedCount };
  }

  async assignGroup(organizationId: string, teacherId: string, groupId: string) {
    const [teacher, group] = await Promise.all([
      this.prisma.teacher.findFirst({ where: { id: teacherId, organizationId } }),
      this.prisma.group.findFirst({ where: { id: groupId, organizationId } }),
    ]);

    if (!teacher) throw new NotFoundException('Teacher not found');
    if (!group) throw new NotFoundException('Group not found');

    const updatedGroup = await this.prisma.group.update({
      where: { id: groupId },
      data: { teacherId },
      include: {
        course: { select: { id: true, name: true } },
      },
    });

    return {
      success: true,
      message: 'Group successfully assigned to teacher',
      group: updatedGroup,
    };
  }

  /**
   * Hard-delete a teacher AND their linked login account.
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
      if (tx.calendarEvent?.updateMany) {
        await tx.calendarEvent.updateMany({
          where: { teacherId: id, organizationId },
          data: { teacherId: null },
        });
      }
      await tx.payrollRun.deleteMany({
        where: { teacherId: id, organizationId },
      });

      await tx.teacher.delete({ where: { id, organizationId } as any });

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
