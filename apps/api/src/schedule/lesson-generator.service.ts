import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DayOfWeek, LessonStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Schedule → Lesson instance generator (37-Phase Report §9/§13 gap #5).
 *
 * Weekly Schedule templates are the recurring *plan*; attendance and payroll
 * need tangible dated sessions. This service materializes `Lesson` rows for a
 * date range from every active schedule of the targeted groups.
 *
 * Determinism & idempotency:
 *  - the unique constraint (groupId, date, startTime) plus `skipDuplicates`
 *    makes generation re-runnable any number of times without creating dupes;
 *  - generation is pure date arithmetic (no randomness, no AI);
 *  - every run is tenant-scoped by organizationId.
 */

/** DayOfWeek enum → JS getUTCDay() index (0 = Sunday). */
const DAY_INDEX: Record<DayOfWeek, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

export interface GenerateLessonsResult {
  /** Date window that was scanned (inclusive). */
  from: Date;
  to: Date;
  groupsScanned: number;
  schedulesMatched: number;
  /** Lesson rows created by this run. */
  created: number;
  /** Lesson rows that already existed (idempotent re-run). */
  skipped: number;
  /** Lessons marked CANCELLED whose date was already in the past. */
  pastPlannedCancelled: number;
}

@Injectable()
export class LessonGeneratorService {
  private readonly logger = new Logger(LessonGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Materialize lessons for the given inclusive date range.
   * @param organizationId tenant scope (required)
   * @param from ISO date (start of day, inclusive)
   * @param to   ISO date (end of day, inclusive); max 62 days per run
   * @param groupId optional — restrict generation to one group
   */
  async generate(
    organizationId: string,
    from: Date,
    to: Date,
    groupId?: string,
  ): Promise<GenerateLessonsResult> {
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('from/to must be valid dates');
    }
    if (to < from) throw new BadRequestException('to must be on or after from');
    if (to.getTime() - from.getTime() > 62 * 24 * 3600 * 1000) {
      throw new BadRequestException('Range too large: generate at most 62 days at a time');
    }

    // Tenant-scoped schedule fetch. The group relation pins the tenant.
    const holidays = await this.prisma.organizationHoliday.findMany({
      where: { organizationId, date: { gte: from, lte: to } },
      select: { date: true },
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));
    const schedules = await this.prisma.schedule.findMany({
      where: {
        isActive: true,
        ...(groupId ? { groupId } : {}),
        group: { organizationId, isActive: true },
      },
      include: {
        group: { select: { id: true, teacherId: true, room: true, startDate: true, endDate: true } },
      },
    });

    if (groupId && schedules.length === 0) {
      // Distinguish "unknown group" from "group has no schedule yet".
      const group = await this.prisma.group.findFirst({
        where: { id: groupId, organizationId },
        select: { id: true },
      });
      if (!group) throw new NotFoundException('Group not found in this organization');
    }

    let created = 0;
    let skipped = 0;

    // createMany with skipDuplicates is one round-trip per batch and races
    // safely against the (groupId, date, startTime) unique constraint.
    const batch: Prisma.LessonCreateManyInput[] = [];

    const startNormalized = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0));
    const endNormalized = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59, 999));

    for (const schedule of schedules) {
      const cursor = new Date(startNormalized);
      while (cursor <= endNormalized) {
        const dateStr = cursor.toISOString().split('T')[0];
        const dayMatches = cursor.getUTCDay() === DAY_INDEX[schedule.dayOfWeek];
        const notHoliday = !holidayDates.has(dateStr);
        const withinGroupRange =
          (!schedule.group.startDate || cursor >= schedule.group.startDate) &&
          (!schedule.group.endDate || cursor <= schedule.group.endDate);

        if (dayMatches && notHoliday && withinGroupRange) {
          batch.push({
            organizationId,
            scheduleId: schedule.id,
            groupId: schedule.groupId,
            teacherId: schedule.group.teacherId,
            date: new Date(cursor),
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            room: schedule.room ?? schedule.group.room ?? null,
            status: LessonStatus.PLANNED,
            updatedAt: new Date(),
          });
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    if (batch.length > 0) {
      const result = await this.prisma.lesson.createMany({
        data: batch,
        skipDuplicates: true,
      });
      created = result.count;
      skipped = batch.length - result.count;
    }

    // Reconciliation: PLANNED lessons whose end time has fully passed without a
    // CONDUCTED status are closed out as CANCELLED so payroll/workload never
    // silently count phantom lessons. Cancellation waits until END of the
    // scheduled day (date + endTime), not start-of-day UTC midnight — the old
    // `date < now` rule cancelled every lesson on its own day as soon as the
    // calendar rolled past midnight UTC.
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const closed = await this.prisma.$executeRaw`
      UPDATE "Lesson"
      SET "status" = 'CANCELLED',
          "cancelledAt" = NOW(),
          "cancelReason" = 'Auto-closed: planned end time passed without confirmation',
          "updatedAt" = NOW()
      WHERE "organizationId" = ${organizationId}::uuid
        AND "status" = 'PLANNED'
        AND (
          "date" < ${todayStr}::date
          OR (
            "date" = ${todayStr}::date
            AND ("date" + "endTime"::time) < ${now}
          )
        )
        ${groupId ? Prisma.sql`AND "groupId" = ${groupId}::uuid` : Prisma.empty}
    `;

    this.logger.log(
      `lessons_generated org=${organizationId} range=${from.toISOString().slice(0, 10)}..${to.toISOString().slice(0, 10)} created=${created} skipped=${skipped} autoClosed=${Number(closed)}`,
    );

    return {
      from,
      to,
      groupsScanned: new Set(schedules.map((s) => s.groupId)).size,
      schedulesMatched: schedules.length,
      created,
      skipped,
      pastPlannedCancelled: Number(closed),
    };
  }

  /**
   * Confirm (CONDUCTED) or cancel a single lesson. Only PLANNED lessons can
   * transition; teacher or admin action. Audit trail is written by the caller.
   */
  async setStatus(
    organizationId: string,
    lessonId: string,
    status: 'CONDUCTED' | 'CANCELLED',
    opts: { cancelReason?: string } = {},
  ) {
    if (status === 'CANCELLED' && !opts.cancelReason?.trim()) {
      throw new BadRequestException('A cancellation reason is required');
    }
    const updated = await this.prisma.lesson.updateMany({
      where: { id: lessonId, organizationId, status: LessonStatus.PLANNED },
      data: {
        status,
        ...(status === 'CANCELLED'
          ? { cancelledAt: new Date(), cancelReason: opts.cancelReason!.trim() }
          : {}),
      },
    });
    if (updated.count !== 1) {
      throw new NotFoundException('Lesson not found or not in PLANNED status');
    }
    return this.prisma.lesson.findFirst({ where: { id: lessonId, organizationId } });
  }

  /** Lessons for a group/date range, used by attendance and workload views. */
  async listForGroup(
    organizationId: string,
    groupId: string,
    from: Date,
    to: Date,
  ) {
    return this.prisma.lesson.findMany({
      where: { organizationId, groupId, date: { gte: from, lte: to } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: {
        attendances: { select: { studentId: true, status: true } },
      },
    });
  }
}




