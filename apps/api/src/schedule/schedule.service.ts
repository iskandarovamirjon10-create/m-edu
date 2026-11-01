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
  /** Restrict to lessons of the groups taught by this teacher. */
  teacherId?: string;
  dayOfWeek?: string;
}

const DAY_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
type DayOfWeek = (typeof DAY_OF_WEEK)[number];

import { LessonGeneratorService } from './lesson-generator.service';
import type { RequestUser } from '../auth/types';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessonGenerator: LessonGeneratorService,
  ) {}

  async findAll(organizationId: string, query: ScheduleQuery, user?: RequestUser | { id: string; role?: string }) {
    const { page, limit, skip } = parsePagination(query);

    const groupFilter: Prisma.GroupWhereInput =
      user?.role === 'STUDENT'
        ? { organizationId, enrollments: { some: { student: { userId: (user as any)?.id || (user as any)?.sub } } } }
        : { organizationId };
    // Teacher scoping: lessons for the groups this teacher owns. Combined with
    // the organization scope above, a foreign teacherId from another tenant
    // can never match.
    if (query.teacherId) groupFilter.teacherId = query.teacherId;
    const where: Prisma.ScheduleWhereInput = {
      isActive: true,
      group: groupFilter,
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.dayOfWeek && DAY_OF_WEEK.includes(query.dayOfWeek as DayOfWeek)
        ? { dayOfWeek: query.dayOfWeek as DayOfWeek }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        include: { group: { select: { id: true, name: true, room: true } } },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.schedule.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / (limit || 1)) };
  }

  async findOne(organizationId: string, id: string, user?: RequestUser | { id: string; role?: string }) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id, ...(user?.role === 'STUDENT' ? { group: { organizationId, enrollments: { some: { student: { userId: (user as any)?.id || (user as any)?.sub } } } } } : { group: { organizationId } }) },
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
      if (typeof tx.$queryRaw === 'function') {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}::text || 'schedule'))`;
      }

      const effectiveRoom = data.room !== undefined && data.room !== null ? data.room : group.room;
      await this.checkForConflictsTx(
        tx,
        organizationId,
        data.dayOfWeek,
        data.startTime,
        data.endTime,
        effectiveRoom,
        group.teacherId,
        undefined,
        group.startDate,
        group.endDate,
      );

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
      if (typeof tx.$queryRaw === 'function') {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}::text || 'schedule'))`;
      }

      if (isActive) {
        const group = await tx.group.findFirst({ where: { id: schedule.groupId, organizationId } });
        const effectiveRoom = checkRoom !== undefined && checkRoom !== null ? checkRoom : group?.room;
        await this.checkForConflictsTx(
          tx,
          organizationId,
          checkDay as DayOfWeek,
          checkStart,
          checkEnd,
          effectiveRoom,
          group?.teacherId,
          schedule.id,
          group?.startDate,
          group?.endDate,
        );
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
    groupStartDate?: Date | null,
    groupEndDate?: Date | null,
  ) {
    return this.checkForConflictsTx(this.prisma, organizationId, dayOfWeek, startTime, endTime, room, teacherId, excludeScheduleId, groupStartDate, groupEndDate);
  }

  /**
   * Transaction-safe conflict checker. Accepts a Prisma client or transaction
   * client so that the read is serialized within the advisory-lock transaction.
   */
  private async checkForConflictsTx(
    client: PrismaService | Prisma.TransactionClient,
    organizationId: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    room?: string | null,
    teacherId?: string | null,
    excludeScheduleId?: string,
    groupStartDate?: Date | null,
    groupEndDate?: Date | null,
  ) {
    // A simple string comparison for "HH:mm" works correctly since "09:00" < "10:00"
    // Time overlap condition: (ExistingStart < NewEnd) AND (ExistingEnd > NewStart)
    const overlappingSchedules = await client.schedule.findMany({
      where: {
        group: { organizationId, isActive: true },
        dayOfWeek,
        isActive: true,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      },
      include: {
        group: { select: { id: true, name: true, teacherId: true, room: true, startDate: true, endDate: true } },
      },
    });

    for (const overlap of overlappingSchedules) {
      // 1. Room Conflict
      // Check date interval overlap between groups:
      // If one group ends before the other starts, they run in disjoint calendar intervals and do not conflict.
      if (groupStartDate && overlap.group.endDate && groupStartDate > overlap.group.endDate) {
        continue;
      }
      if (groupEndDate && overlap.group.startDate && groupEndDate < overlap.group.startDate) {
        continue;
      }

      // 1. Room Conflict (comparing effective schedule room or inherited group room)
      const targetRoom = room ? room.trim().toLowerCase() : null;
      const existingRoom = (overlap.room ?? overlap.group.room)?.trim().toLowerCase() || null;
      if (targetRoom && existingRoom && targetRoom === existingRoom) {
        throw new BadRequestException('SCHEDULE_ROOM_CONFLICT');
      }
      
      // 2. Teacher Conflict
      if (teacherId && overlap.group.teacherId === teacherId) {
        throw new BadRequestException('SCHEDULE_TEACHER_CONFLICT');
      }
    }
  }

  // ------------------------------------------------------------------
  // Room Utilization & Dead Hours Heatmap (Xonalar unumdorligi)
  // ------------------------------------------------------------------

  async getRoomUtilization(organizationId: string) {
    const [groups, schedules] = await Promise.all([
      this.prisma.group.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true, room: true },
      }),
      this.prisma.schedule.findMany({
        where: { group: { organizationId }, isActive: true },
        include: { group: { select: { id: true, name: true, room: true } } },
      }),
    ]);

    const roomsSet = new Set<string>();
    groups.forEach((g) => {
      if (g.room?.trim()) roomsSet.add(g.room.trim());
    });
    schedules.forEach((s) => {
      if (s.room?.trim()) roomsSet.add(s.room.trim());
      else if (s.group.room?.trim()) roomsSet.add(s.group.room.trim());
    });

    const rooms = Array.from(roomsSet).sort();
    if (rooms.length === 0) {
      rooms.push('Xona 1', 'Xona 2', 'Xona 3', 'Xona 4');
    }

    const timeSlots = [
      { id: '09:00', label: '09:00 - 10:30', start: '09:00', end: '10:30', isMorning: true },
      { id: '10:30', label: '10:30 - 12:00', start: '10:30', end: '12:00', isMorning: true },
      { id: '12:00', label: '12:00 - 13:30', start: '12:00', end: '13:30', isMorning: true },
      { id: '14:00', label: '14:00 - 15:30', start: '14:00', end: '15:30', isMorning: false },
      { id: '15:30', label: '15:30 - 17:00', start: '15:30', end: '17:00', isMorning: false },
      { id: '17:00', label: '17:00 - 18:30', start: '17:00', end: '18:30', isMorning: false },
      { id: '18:30', label: '18:30 - 20:00', start: '18:30', end: '20:00', isMorning: false },
    ];

    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

    const matrix: Record<string, Record<string, { occupiedRooms: string[]; rate: number; isDeadHour: boolean }>> = {};

    let totalSlotChecks = 0;
    let deadSlotCount = 0;

    for (const day of days) {
      matrix[day] = {};
      for (const slot of timeSlots) {
        const occupied = new Set<string>();

        for (const s of schedules) {
          if (s.dayOfWeek !== day) continue;
          const assignedRoom = s.room?.trim() || s.group.room?.trim();
          if (!assignedRoom) continue;

          if (s.startTime < slot.end && s.endTime > slot.start) {
            occupied.add(assignedRoom);
          }
        }

        const occupiedRooms = Array.from(occupied);
        const rate = rooms.length > 0 ? Math.round((occupiedRooms.length / rooms.length) * 100) : 0;
        const isDeadHour = rate <= 35;

        totalSlotChecks++;
        if (isDeadHour) deadSlotCount++;

        matrix[day][slot.id] = {
          occupiedRooms,
          rate,
          isDeadHour,
        };
      }
    }

    const deadHoursPercentage = totalSlotChecks > 0 ? Math.round((deadSlotCount / totalSlotChecks) * 100) : 0;

    return {
      totalRooms: rooms.length,
      rooms,
      timeSlots,
      days,
      matrix,
      deadHoursPercentage,
      recommendation:
        deadHoursPercentage > 30
          ? "Ertalabki 09:00 - 13:30 vaqt oralig'ida xonalar 60%+ bo'sh. Bu soatlarga maxsus chegirmali yoki intensiv kurslar ochish orqali tushumni 25% ga oshirish mumkin."
          : "Xonalar unumdorligi barqaror darajada taqsimlangan.",
    };
  }
}

