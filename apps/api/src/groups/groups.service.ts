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
      where.OR = [{ name: { contains: query.search, mode: 'insensitive' } }];
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
        capacity: data.capacity,
        room: data.room,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
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
          throw new BadRequestException(
            `Yangi sig'im (${data.capacity}) joriy talabalar sonidan (${activeCount}) kam — oldin talablarni boshqa guruhga ko'chiring.`,
          );
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
}
