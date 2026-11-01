import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateGroupDto, UpdateGroupDto } from '../common/dto';
import { GroupQuery } from '../common/dto/query';
import { BulkGroupRoomDto, BulkGroupStatusDto, BulkGroupTeacherDto } from './dto/groups-bulk.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: GroupQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.GroupWhereInput = { organizationId };

    if (query.courseId) where.courseId = query.courseId;
    if (query.teacherId) where.teacherId = query.teacherId;
    if (query.room) where.room = { contains: query.room, mode: 'insensitive' };
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

    let orderBy: Prisma.GroupOrderByWithRelationInput = { createdAt: 'desc' };
    if (query.sortBy === 'name') {
      orderBy = { name: query.sortOrder === 'desc' ? 'desc' : 'asc' };
    } else if (query.sortBy === 'capacity') {
      orderBy = { capacity: query.sortOrder === 'desc' ? 'desc' : 'asc' };
    } else if (query.sortBy === 'createdAt') {
      orderBy = { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        include: {
          course: { select: { id: true, name: true } },
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          _count: { select: { enrollments: { where: { isActive: true } } } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.group.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / (limit || 1)) };
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

    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (start > end) {
        throw new BadRequestException("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas (START_DATE_AFTER_END_DATE)");
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

    const effectiveStart = data.startDate !== undefined ? new Date(data.startDate) : group.startDate;
    const effectiveEnd = data.endDate !== undefined ? new Date(data.endDate) : group.endDate;
    if (effectiveStart && effectiveEnd && effectiveStart > effectiveEnd) {
      throw new BadRequestException("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas (START_DATE_AFTER_END_DATE)");
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
          where: { groupId: id, organizationId, isActive: true },
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
    return this.prisma.$transaction(async (tx) => {
      // Deactivate active student enrollments in this group
      await tx.studentGroup.updateMany({
        where: { groupId: id, organizationId, isActive: true },
        data: { isActive: false, leftAt: new Date() },
      });
      // Cancel future planned lessons for this group
      await tx.lesson.updateMany({
        where: { groupId: id, organizationId, status: 'PLANNED', date: { gte: new Date() } },
        data: { status: 'CANCELLED' },
      });
      return tx.group.update({ where: { id, organizationId }, data: { isActive: false } });
    });
  }

  // ------------------------------------------------------------------
  // Group Capacity, Occupancy & Waitlist Insights
  // ------------------------------------------------------------------

  async getGroupCapacityAndOccupancy(organizationId: string, id: string) {
    const group = await this.findOne(organizationId, id);
    const capacity = group.capacity ?? 20;
    const activeCount = await this.prisma.studentGroup.count({
      where: { groupId: id, organizationId, isActive: true },
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
      let targetGroup: { id: string; capacity: number | null; isActive: boolean } | null = null;

      if (targetGroupId) {
        // Enforce tenant boundary and serialize access to prevent capacity race conditions
        if (typeof tx.$queryRaw === 'function') {
          await tx.$queryRaw`SELECT id FROM "Group" WHERE id = ${targetGroupId}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE`;
        }

        targetGroup = await tx.group.findFirst({
          where: { id: targetGroupId, organizationId },
          select: { id: true, capacity: true, isActive: true },
        });
        if (!targetGroup) {
          throw new NotFoundException('Target group not found in organization');
        }
        if (targetGroup.isActive === false) {
          throw new BadRequestException('Target group is inactive and cannot receive students');
        }
      } else {
        // Create new group inside organization
        if (!data.targetCourseId || !data.targetGroupName) {
          throw new BadRequestException("Yangi guruh yaratish uchun targetCourseId va targetGroupName talab qilinadi");
        }

        const targetCourse = await tx.course.findFirst({
          where: { id: data.targetCourseId, organizationId },
          select: { id: true },
        });
        if (!targetCourse) {
          throw new NotFoundException('Target course not found in organization');
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
        targetGroup = newGroup;
      }

      // Enforce tenant boundary on studentIds: must belong to organization and be active members in source group
      const activeSourceMemberships = await tx.studentGroup.findMany({
        where: {
          groupId: id,
          organizationId,
          studentId: { in: data.studentIds },
          isActive: true,
        },
        select: { studentId: true },
      });
      const activeSet = new Set(activeSourceMemberships.map((m) => m.studentId));
      for (const sId of data.studentIds) {
        if (!activeSet.has(sId)) {
          throw new BadRequestException(`Student ${sId} is not an active member of the source group`);
        }
      }

      // Enforce capacity of target group
      const targetCapacity = targetGroup.capacity ?? sourceGroup.capacity;
      if (targetCapacity !== null && targetCapacity !== undefined) {
        const currentTargetCount = await tx.studentGroup.count({
          where: { groupId: targetGroupId!, organizationId, isActive: true },
        });
        if (currentTargetCount + data.studentIds.length > targetCapacity) {
          throw new BadRequestException(
            `Target group capacity reached (${currentTargetCount}/${targetCapacity}). Cannot promote ${data.studentIds.length} students.`,
          );
        }
      }

      const now = new Date();

      // Deactivate students in source group
      await tx.studentGroup.updateMany({
        where: {
          groupId: id,
          organizationId,
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
            organizationId,
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
          where: { id, organizationId },
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

  // ------------------------------------------------------------------
  // Aggregated Stats & Telemetry
  // ------------------------------------------------------------------

  async getStats(organizationId: string) {
    const groups = await this.prisma.group.findMany({
      where: { organizationId },
      include: {
        course: { select: { id: true, name: true } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { enrollments: { where: { isActive: true } } } },
      },
    });

    const totalGroups = groups.length;
    const activeGroups = groups.filter((g) => g.isActive).length;
    const inactiveGroups = totalGroups - activeGroups;

    let totalCapacity = 0;
    let enrolledStudents = 0;
    let fullGroups = 0;
    let nearFullGroups = 0;
    let vacantGroups = 0;

    const roomDistribution: Record<string, number> = {};
    const teacherDistribution: Record<string, { teacherName: string; groupCount: number }> = {};

    for (const group of groups) {
      if (group.room) {
        roomDistribution[group.room] = (roomDistribution[group.room] || 0) + 1;
      }
      if (group.teacher) {
        const teacherName = `${group.teacher.user.firstName} ${group.teacher.user.lastName}`.trim();
        if (!teacherDistribution[group.teacher.id]) {
          teacherDistribution[group.teacher.id] = { teacherName, groupCount: 0 };
        }
        teacherDistribution[group.teacher.id].groupCount++;
      }

      if (group.isActive) {
        const cap = group.capacity ?? 20;
        const count = group._count?.enrollments ?? 0;
        totalCapacity += cap;
        enrolledStudents += count;

        if (count >= cap) {
          fullGroups++;
        } else if (cap > 0 && count / cap >= 0.8) {
          nearFullGroups++;
        } else {
          vacantGroups++;
        }
      }
    }

    const averageOccupancyPercent =
      totalCapacity > 0 ? Math.min(100, Math.round((enrolledStudents / totalCapacity) * 100)) : 0;
    const uniqueRoomsCount = Object.keys(roomDistribution).length;

    return {
      totalGroups,
      activeGroups,
      inactiveGroups,
      fullGroups,
      nearFullGroups,
      vacantGroups,
      totalCapacity,
      enrolledStudents,
      averageOccupancyPercent,
      uniqueRoomsCount,
      roomDistribution,
      topTeachers: Object.values(teacherDistribution)
        .sort((a, b) => b.groupCount - a.groupCount)
        .slice(0, 5),
    };
  }

  // ------------------------------------------------------------------
  // Bulk Operations
  // ------------------------------------------------------------------

  async bulkStatus(organizationId: string, dto: BulkGroupStatusDto) {
    if (!dto.groupIds || dto.groupIds.length === 0) {
      throw new BadRequestException("Guruhlar ro'yxati (groupIds) bo'sh bo'lishi mumkin emas");
    }

    const existingGroups = await this.prisma.group.findMany({
      where: { id: { in: dto.groupIds }, organizationId },
      select: { id: true },
    });

    if (existingGroups.length !== dto.groupIds.length) {
      throw new NotFoundException("Barcha tanlangan guruhlar ushbu tashkilotga tegishli emas");
    }

    return this.prisma.$transaction(async (tx) => {
      if (!dto.isActive) {
        // Deactivate active student enrollments
        await tx.studentGroup.updateMany({
          where: { groupId: { in: dto.groupIds }, organizationId, isActive: true },
          data: { isActive: false, leftAt: new Date() },
        });
        // Cancel future planned lessons
        await tx.lesson.updateMany({
          where: { groupId: { in: dto.groupIds }, organizationId, status: 'PLANNED', date: { gte: new Date() } },
          data: { status: 'CANCELLED' },
        });
      }

      const result = await tx.group.updateMany({
        where: { id: { in: dto.groupIds }, organizationId },
        data: { isActive: dto.isActive },
      });

      return {
        success: true,
        count: result.count,
        isActive: dto.isActive,
        message: `${result.count} ta guruh holati muvaffaqiyatli ${dto.isActive ? 'faollashtirildi' : 'nofaol qilindi'}`,
      };
    });
  }

  async bulkTeacher(organizationId: string, dto: BulkGroupTeacherDto) {
    if (!dto.groupIds || dto.groupIds.length === 0) {
      throw new BadRequestException("Guruhlar ro'yxati (groupIds) bo'sh bo'lishi mumkin emas");
    }

    if (dto.teacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: dto.teacherId, organizationId },
      });
      if (!teacher) {
        throw new NotFoundException('Teacher not found in organization');
      }
    }

    const existingGroups = await this.prisma.group.findMany({
      where: { id: { in: dto.groupIds }, organizationId },
      select: { id: true },
    });

    if (existingGroups.length !== dto.groupIds.length) {
      throw new NotFoundException("Barcha tanlangan guruhlar ushbu tashkilotga tegishli emas");
    }

    const result = await this.prisma.group.updateMany({
      where: { id: { in: dto.groupIds }, organizationId },
      data: { teacherId: dto.teacherId || null },
    });

    return {
      success: true,
      count: result.count,
      teacherId: dto.teacherId || null,
      message: `${result.count} ta guruh o'qituvchisi muvaffaqiyatli yangilandi`,
    };
  }

  async bulkRoom(organizationId: string, dto: BulkGroupRoomDto) {
    if (!dto.groupIds || dto.groupIds.length === 0) {
      throw new BadRequestException("Guruhlar ro'yxati (groupIds) bo'sh bo'lishi mumkin emas");
    }

    const existingGroups = await this.prisma.group.findMany({
      where: { id: { in: dto.groupIds }, organizationId },
      select: { id: true },
    });

    if (existingGroups.length !== dto.groupIds.length) {
      throw new NotFoundException("Barcha tanlangan guruhlar ushbu tashkilotga tegishli emas");
    }

    const result = await this.prisma.group.updateMany({
      where: { id: { in: dto.groupIds }, organizationId },
      data: { room: dto.room || null },
    });

    return {
      success: true,
      count: result.count,
      room: dto.room || null,
      message: `${result.count} ta guruh xonasi muvaffaqiyatli yangilandi`,
    };
  }
}
