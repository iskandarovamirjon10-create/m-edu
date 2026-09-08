import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto, UpdateScheduleDto } from '../common/dto';
import { parsePagination } from '../lib/pagination';

/** Query parameters accepted by the schedule listing endpoint. */
export interface ScheduleQuery {
  page?: string | number;
  limit?: string | number;
  groupId?: string;
  dayOfWeek?: string;
}

const DAY_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
type DayOfWeek = (typeof DAY_OF_WEEK)[number];

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ScheduleQuery) {
    const { page, limit, skip } = parsePagination(query);

    const where: Prisma.ScheduleWhereInput = {
      group: { organizationId },
      isActive: true,
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.dayOfWeek && DAY_OF_WEEK.includes(query.dayOfWeek as DayOfWeek)
        ? { dayOfWeek: query.dayOfWeek as DayOfWeek }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        include: { group: { select: { id: true, name: true } } },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.schedule.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id, group: { organizationId } },
      include: { group: { select: { id: true, name: true, room: true } } },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    return schedule;
  }

  async create(organizationId: string, data: CreateScheduleDto) {
    const group = await this.prisma.group.findFirst({
      where: { id: data.groupId, organizationId },
    });
    if (!group) throw new NotFoundException('Group not found');

    return this.prisma.schedule.create({
      data: {
        groupId: data.groupId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room ?? null,
      },
    });
  }

  async update(organizationId: string, id: string, data: UpdateScheduleDto) {
    await this.findOne(organizationId, id);

    const updateData: Prisma.ScheduleUpdateInput = {};
    if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.room !== undefined) updateData.room = data.room;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (Object.keys(updateData).length === 0) return this.findOne(organizationId, id);

    return this.prisma.schedule.update({ where: { id, group: { organizationId } }, data: updateData });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.schedule.update({ where: { id, group: { organizationId } }, data: { isActive: false } });
  }
}
