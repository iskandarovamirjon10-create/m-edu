import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

import { LessonGeneratorService } from './lesson-generator.service';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessonGenerator: LessonGeneratorService,
  ) {}

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
    if (data.startTime >= data.endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    const group = await this.prisma.group.findFirst({
      where: { id: data.groupId, organizationId },
    });
    if (!group) throw new NotFoundException('Group not found');

    const result = await this.prisma.$transaction(async (tx) => {
      // pg_advisory_xact_lock auto-releases at commit/rollback
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}::text || 'schedule'))`;

      await this.checkForConflictsTx(tx, organizationId, data.dayOfWeek, data.startTime, data.endTime, data.room, group.teacherId);

      return tx.schedule.create({
        data: {
          groupId: data.groupId,
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
          room: data.room ?? null,
        },
      });
    });

    // Automatically generate lessons for the next 30 days
    const from = new Date();
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
    await this.lessonGenerator.generate(organizationId, from, to, data.groupId).catch(() => {
      // Suppress generation errors to avoid breaking schedule creation.
      // Next nightly cron will fix it anyway.
    });

    return result;
  }

  async update(organizationId: string, id: string, data: UpdateScheduleDto) {
    const schedule = await this.findOne(organizationId, id);

    const updateData: Prisma.ScheduleUpdateInput = {};
    if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.room !== undefined) updateData.room = data.room;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (Object.keys(updateData).length === 0) return schedule;

    // Before updating, check conflicts if time, day, or room changes
    const checkDay = data.dayOfWeek ?? schedule.dayOfWeek;
    const checkStart = data.startTime ?? schedule.startTime;
    const checkEnd = data.endTime ?? schedule.endTime;
    if (checkStart >= checkEnd) {
      throw new BadRequestException('Start time must be before end time');
    }
    const checkRoom = data.room !== undefined ? data.room : schedule.room;
    
    // Check conflicts only if the schedule is staying active
    const isActive = data.isActive !== undefined ? data.isActive : schedule.isActive;
    
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}::text || 'schedule'))`;

      if (isActive) {
        const group = await tx.group.findFirst({ where: { id: schedule.groupId, organizationId } });
        await this.checkForConflictsTx(tx, organizationId, checkDay as DayOfWeek, checkStart, checkEnd, checkRoom, group?.teacherId, schedule.id);
      }

      return tx.schedule.update({ where: { id, group: { organizationId } }, data: updateData });
    });

    if (isActive) {
      const from = new Date();
    from.setUTCHours(0, 0, 0, 0);
      const to = new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
      await this.lessonGenerator.generate(organizationId, from, to, schedule.groupId).catch(() => {});
    }

    return result;
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.schedule.update({ where: { id, group: { organizationId } }, data: { isActive: false } });
  }

  /**
   * Helper to prevent double booking of Rooms and Teachers
   */
  private async checkForConflicts(
    organizationId: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    room?: string | null,
    teacherId?: string | null,
    excludeScheduleId?: string,
  ) {
    return this.checkForConflictsTx(this.prisma, organizationId, dayOfWeek, startTime, endTime, room, teacherId, excludeScheduleId);
  }

  /**
   * Transaction-safe conflict checker. Accepts a Prisma client or transaction
   * client so that the read is serialized within the advisory-lock transaction.
   */
  private async checkForConflictsTx(
    client: { schedule: { findMany: (...args: any[]) => any } },
    organizationId: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    room?: string | null,
    teacherId?: string | null,
    excludeScheduleId?: string,
  ) {
    // A simple string comparison for "HH:mm" works correctly since "09:00" < "10:00"
    // Time overlap condition: (ExistingStart < NewEnd) AND (ExistingEnd > NewStart)
    const overlappingSchedules = await client.schedule.findMany({
      where: {
        group: { organizationId },
        dayOfWeek,
        isActive: true,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      },
      include: {
        group: { select: { name: true, teacherId: true } },
      },
    });

    for (const overlap of overlappingSchedules) {
      // 1. Room Conflict
      if (room && overlap.room === room) {
        throw new BadRequestException(
          `Xona to'qnashuvi (Room Conflict): ${dayOfWeek} kuni soat ${overlap.startTime}-${overlap.endTime} oralig'ida ${room} xonasida "${overlap.group.name}" guruhining darsi bor. Boshqa xona yoki vaqt tanlang.`,
        );
      }
      
      // 2. Teacher Conflict
      if (teacherId && overlap.group.teacherId === teacherId) {
        throw new BadRequestException(
          `O'qituvchi to'qnashuvi (Teacher Conflict): Ushbu o'qituvchining ${dayOfWeek} kuni soat ${overlap.startTime}-${overlap.endTime} oralig'ida "${overlap.group.name}" guruhida darsi bor.`,
        );
      }
    }
  }
}

