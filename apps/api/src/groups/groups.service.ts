import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateGroupDto, UpdateGroupDto } from '../common/dto';
import { GroupQuery } from '../common/dto/query';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: GroupQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.GroupWhereInput = { organizationId };

    if (query.courseId) where.courseId = query.courseId;
    if (query.teacherId) where.teacherId = query.teacherId;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { room: { contains: query.search, mode: 'insensitive' } },
        { course: { name: { contains: query.search, mode: 'insensitive' } } },
        { teacher: { user: { firstName: { contains: query.search, mode: 'insensitive' } } } },
        { teacher: { user: { lastName: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        include: {
          course: { select: { id: true, name: true } },
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          _count: { select: { enrollments: { where: { isActive: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.group.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, organizationId },
      include: {
        course: { select: { id: true, name: true, price: true } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        schedules: { where: { isActive: true } },
        enrollments: {
          where: { isActive: true },
          include: { student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } },
        },
      },
    });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async create(organizationId: string, data: CreateGroupDto) {
    // Tenant isolation: the course a group references must belong to the
    // same organization. Accepting an arbitrary courseId would let a tenant
    // pull another org's course into its own groups (cross-tenant
    // reference / data pull-through), so it is rejected server-side.
    const course = await this.prisma.course.findFirst({
      where: { id: data.courseId, organizationId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (data.teacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: data.teacherId, organizationId },
      });
      if (!teacher) {
        throw new NotFoundException('Teacher not found');
      }
    }

    return this.prisma.group.create({
      data: {
        organizationId,
        name: data.name,
        courseId: data.courseId,
        teacherId: data.teacherId ?? null,
        capacity: data.capacity ?? 20,
        room: data.room || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(organizationId: string, id: string, data: UpdateGroupDto) {
    const group = await this.findOne(organizationId, id);

    // Changing the group's teacher must keep the teacher inside the same
    // organization (same cross-tenant reference rule as create).
    if (data.teacherId !== undefined && data.teacherId !== null && data.teacherId !== '') {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: data.teacherId, organizationId },
      });
      if (!teacher) {
        throw new NotFoundException('Teacher not found');
      }
    }

    const updateData: Prisma.GroupUncheckedUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.teacherId !== undefined) {
      updateData.teacherId = data.teacherId === '' ? null : data.teacherId;
    }
    if (data.capacity !== undefined) {
      // Prevent reducing capacity below current active enrollment.
      if (data.capacity < (group.capacity ?? Infinity)) {
        const activeCount = await this.prisma.studentGroup.count({
          where: { groupId: id, isActive: true },
        });
        if (data.capacity < activeCount) {
          throw new BadRequestException('CAPACITY_LESS_THAN_ACTIVE_STUDENTS');
        }
      }
      updateData.capacity = data.capacity;
    }
    if (data.room !== undefined) updateData.room = data.room;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (Object.keys(updateData).length === 0) return group;

    return this.prisma.group.update({ where: { id, organizationId }, data: updateData });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.group.update({ where: { id, organizationId }, data: { isActive: false } });
  }

  // ------------------------------------------------------------------
  // Group Capacity, Occupancy & Waitlist Insights
  // ------------------------------------------------------------------

  async getGroupCapacityAndOccupancy(organizationId: string, id: string) {
    const group = await this.findOne(organizationId, id);
    const capacity = group.capacity ?? 20;
    const activeCount = await this.prisma.studentGroup.count({
      where: { groupId: id, isActive: true },
    });

    const availableSeats = Math.max(0, capacity - activeCount);
    const isFull = activeCount >= capacity;
    const occupancyPercent = capacity > 0 ? Math.min(100, Math.round((activeCount / capacity) * 100)) : 100;

    return {
      groupId: id,
      name: group.name,
      room: group.room,
      capacity,
      activeCount,
      availableSeats,
      isFull,
      occupancyPercent,
    };
  }

  // ------------------------------------------------------------------
  // Level Progression & Batch Graduation (Bosqichdan bosqichga o'tish)
  // ------------------------------------------------------------------

  async graduateAndPromote(
    organizationId: string,
    id: string,
    data: {
      studentIds: string[];
      targetGroupId?: string;
      targetGroupName?: string;
      targetCourseId?: string;
      archiveOldGroup?: boolean;
    },
  ) {
    const sourceGroup = await this.findOne(organizationId, id);
    if (!data.studentIds || data.studentIds.length === 0) {
      throw new BadRequestException("O'tkaziladigan o'quvchilar ro'yxati (studentIds) bo'sh bo'lishi mumkin emas");
    }

    let targetGroupId = data.targetGroupId;

    return this.prisma.$transaction(async (tx) => {
      // If no targetGroupId provided, create the new group automatically
      if (!targetGroupId) {
        if (!data.targetCourseId || !data.targetGroupName) {
          throw new BadRequestException("Yangi guruh yaratish uchun targetCourseId va targetGroupName talab qilinadi");
        }

        const newGroup = await tx.group.create({
          data: {
            organizationId,
            name: data.targetGroupName,
            courseId: data.targetCourseId,
            teacherId: sourceGroup.teacherId,
            capacity: sourceGroup.capacity,
            room: sourceGroup.room,
            startDate: new Date(),
            isActive: true,
          },
        });
        targetGroupId = newGroup.id;
      }

      const now = new Date();

      // Deactivate students in source group
      await tx.studentGroup.updateMany({
        where: {
          groupId: id,
          studentId: { in: data.studentIds },
        },
        data: {
          isActive: false,
          leftAt: now,
        },
      });

      // Enroll students into target group
      for (const studentId of data.studentIds) {
        await tx.studentGroup.upsert({
          where: {
            studentId_groupId: {
              studentId,
              groupId: targetGroupId!,
            },
          },
          update: {
            isActive: true,
            leftAt: null,
          },
          create: {
            organizationId,
            studentId,
            groupId: targetGroupId!,
            isActive: true,
            joinedAt: now,
          },
        });
      }

      if (data.archiveOldGroup) {
        await tx.group.update({
          where: { id },
          data: { isActive: false, endDate: now },
        });
      }

      return {
        success: true,
        sourceGroupId: id,
        targetGroupId,
        promotedCount: data.studentIds.length,
        message: `${data.studentIds.length} nafar o'quvchi keyingi bosqich guruhiga muvaffaqiyatli o'tkazildi`,
      };
    });
  }
}
