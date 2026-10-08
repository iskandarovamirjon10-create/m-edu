import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toDateToInclusive, startOfDay, getOrganizationDate } from '../common/date-range';
import { canonicalMembershipWhere } from '../common/student-membership';
import { parsePagination } from '../lib/pagination';
import { DayOfWeek, LessonStatus, Prisma } from '@prisma/client';
import { MarkAttendanceDto, UpdateAttendanceDto } from '../common/dto';
import { AttendanceQuery } from '../common/dto/query';
import type { RequestUser } from '../auth/types';

const INDEX_TO_DAY: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async markAttendance(organizationId: string, data: MarkAttendanceDto) {
    const group = await this.prisma.group.findFirst({
      where: { id: data.groupId, organizationId },
    });
    if (!group) throw new NotFoundException('Group not found');
    // A soft-deleted (archived) group must not receive attendance — the same
    // rule the face/camera pipeline enforces, so both paths agree.
    if (group.isActive === false) {
      throw new BadRequestException('Group is inactive and cannot receive attendance');
    }

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
    const rawDate =
      typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date.trim())
        ? new Date(`${data.date.trim()}T12:00:00.000Z`)
        : new Date(data.date);
    const date = getOrganizationDate(rawDate, org?.timezone);

    // Deduplicate by studentId within the payload — a repeated student would
    // otherwise violate the (studentId, groupId, date) unique constraint and
    // surface as a raw 500. Last record wins (matches the update path below).
    const deduped = new Map<string, MarkAttendanceDto['records'][number]>();
    for (const record of data.records) deduped.set(record.studentId, record);
    data.records = Array.from(deduped.values());

    // Defense in depth: scope membership lookup by tenant as well as group.
    // The group is already verified to belong to `organizationId`, and
    // memberships are created org-scoped, so this is provably equivalent —
    // but it makes the tenant invariant explicit and self-documenting.
    //
    // The membership rule itself lives in `common/student-membership.ts` so
    // the manual, face and camera paths can never drift apart again. Note the
    // org-local window: `joinedAt <= END of the day` is what makes a student
    // assigned earlier TODAY eligible today (previously `joinedAt <= dayStart`
    // rejected every same-day assignment with
    // "Student ... is not enrolled in group ...").
    const enrollments = await this.prisma.studentGroup.findMany({
      where: canonicalMembershipWhere({
        organizationId,
        groupId: data.groupId,
        dayStart: date,
      }),
      select: { studentId: true },
    });
    const enrolledStudentIds = new Set(enrollments.map((e) => e.studentId));

    for (const record of data.records) {
      if (!enrolledStudentIds.has(record.studentId)) {
        throw new BadRequestException(
          `Student ${record.studentId} is not enrolled in group ${data.groupId}`,
        );
      }
    }

    // [BUSINESS LOGIC FIX]: Validate that a planned/conducted Lesson exists for this date.
    // Also attach the lessonId to the attendance record for accurate payroll and history.
    const startOfDay = date;
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // P0: deterministic lesson selection — never rely on unordered findFirst().
    // Prefer a non-cancelled lesson for the day; fall back to the first ordered
    // lesson so an all-cancelled day still blocks attendance below.
    const dayLessons = await this.prisma.lesson.findMany({
      where: {
        groupId: data.groupId,
        organizationId,
        date: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
    });
    let lesson =
      dayLessons.find((candidate) => candidate.status !== 'CANCELLED') ??
      dayLessons[0];

    if (!lesson) {
      // P0-2: On-demand lesson materialization from group schedule.
      // If a group has an active schedule for this day-of-week, materialize the
      // required Lesson row(s) idempotently so manual attendance succeeds immediately
      // on newly created groups without requiring batch background generation.
      const dayOfWeek = INDEX_TO_DAY[date.getUTCDay()];
      const schedules = await this.prisma.schedule.findMany({
        where: {
          groupId: data.groupId,
          dayOfWeek,
          isActive: true,
        },
        orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
      });

      if (schedules.length === 0) {
        throw new BadRequestException(
          `Bu sana uchun guruh jadvali mavjud emas. Avval guruh jadvalini belgilang.`,
        );
      }

      for (const s of schedules) {
        try {
          await this.prisma.lesson.create({
            data: {
              organizationId,
              scheduleId: s.id,
              groupId: data.groupId,
              teacherId: group.teacherId ?? null,
              date,
              startTime: s.startTime,
              endTime: s.endTime,
              room: s.room ?? group.room ?? null,
              status: LessonStatus.PLANNED,
              updatedAt: new Date(),
            },
          });
        } catch (err: unknown) {
          // Concurrency safety: if another worker created this lesson concurrently,
          // ignore the P2002 unique constraint violation on (groupId, date, startTime).
          if ((err as { code?: string })?.code !== 'P2002') {
            throw err;
          }
        }
      }

      const refreshedLessons = await this.prisma.lesson.findMany({
        where: {
          groupId: data.groupId,
          organizationId,
          date: { gte: startOfDay, lt: endOfDay },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
      });

      lesson =
        refreshedLessons.find((candidate) => candidate.status !== 'CANCELLED') ??
        refreshedLessons[0];

      if (!lesson) {
        throw new BadRequestException(
          `Siz davomat yozmoqchi bo'lgan kunda ushbu guruh uchun dars (Lesson) rejalashtirilmagan.`,
        );
      }
    }

    if (lesson.status === 'CANCELLED') {
      throw new BadRequestException(`Ushbu dars bekor qilingan (CANCELLED). Bekor qilingan darsga davomat qilib bo'lmaydi.`);
    }

    /**
     * P0: all writes (auto-conduct lesson + create/update attendance) commit or
     * roll back together. Previously the PLANNED→CONDUCTED update committed
     * even when createMany failed, leaving a conducted lesson with no attendance.
     */
    const commitAttendance = async (allowCreate: boolean) =>
      this.prisma.$transaction(
        async (tx) => {
          let lessonStatus = lesson.status;
          if (lessonStatus === 'PLANNED') {
            await tx.lesson.update({
              where: { id: lesson.id },
              data: { status: 'CONDUCTED' },
            });
            lessonStatus = 'CONDUCTED';
          }

          const existingRecords = await tx.attendance.findMany({
            where: {
              groupId: data.groupId,
              date,
              studentId: { in: data.records.map((r) => r.studentId) },
            },
          });
          const existingMap = new Map(existingRecords.map((e) => [e.studentId, e]));

          let createdCount = 0;
          const updatedRecords: unknown[] = [];

          for (const record of data.records) {
            const payload = {
              status: record.status,
              note: record.note,
              lessonId: lesson.id,
            };
            const existing = existingMap.get(record.studentId);

            if (existing) {
              updatedRecords.push(
                await tx.attendance.update({
                  where: { id: existing.id },
                  data: payload,
                }),
              );
              continue;
            }

            if (!allowCreate) {
              // P2002 recovery pass: a concurrent request already inserted
              // this row — re-read and update instead of creating.
              const row = await tx.attendance.findUnique({
                where: {
                  studentId_groupId_date: {
                    studentId: record.studentId,
                    groupId: data.groupId,
                    date,
                  },
                },
              });
              if (row) {
                updatedRecords.push(
                  await tx.attendance.update({
                    where: { id: row.id },
                    data: payload,
                  }),
                );
                continue;
              }
            }

            await tx.attendance.create({
              data: {
                organizationId,
                studentId: record.studentId,
                groupId: data.groupId,
                lessonId: lesson.id,
                date,
                status: record.status,
                note: record.note,
              },
            });
            createdCount += 1;
          }

          return { created: createdCount, updated: updatedRecords.length };
        },
        { maxWait: 5_000, timeout: 10_000 },
      );

    try {
      const result = await commitAttendance(true);
      return {
        created: result.created,
        updated: result.updated,
        total: data.records.length,
      };
    } catch (err: unknown) {
      // P2002 = unique constraint (studentId, groupId, date) — a concurrent
      // request already recorded attendance. The failed transaction rolled
      // back completely (including any lesson auto-conduct); retry once with
      // create disabled so only the current operation's missing rows are
      // reconciled as updates.
      if ((err as { code?: string })?.code === 'P2002') {
        const result = await commitAttendance(false);
        return {
          created: result.created,
          updated: result.updated,
          total: data.records.length,
        };
      }
      throw err;
    }
  }

  async update(user: RequestUser | { organizationId: string; sub?: string; id?: string }, id: string, dto: UpdateAttendanceDto) {
    const organizationId = user.organizationId;
    const existing = await this.prisma.attendance.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Attendance record not found');

    const data: Prisma.AttendanceUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.note !== undefined) data.note = dto.note;
    if (Object.keys(data).length === 0) return existing;

    // A human correction is authoritative: flip provenance to MANUAL so the
    // camera pipeline (MANUAL_PRESERVED) never silently overwrites it.
    data.source = 'MANUAL';

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.attendance.updateMany({ where: { id, organizationId }, data }); if (updated.count === 0) throw new NotFoundException(); const latest = await tx.attendance.findFirst({ where: { id, organizationId } });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: (user as { sub?: string }).sub || (user as { id?: string }).id,
          action: 'UPDATE',
          resource: 'Attendance',
          resourceId: id,
          changes: { from: existing.status, to: latest!.status, note: latest!.note },
        },
      });
      return latest!;
    });
  }

  async remove(user: RequestUser | { organizationId: string; sub?: string; id?: string }, id: string) {
    const organizationId = user.organizationId;
    const existing = await this.prisma.attendance.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Attendance record not found');

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.attendance.deleteMany({ where: { id, organizationId } }); if (deleted.count === 0) return;
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: (user as { sub?: string }).sub || (user as { id?: string }).id,
          action: 'DELETE',
          resource: 'Attendance',
          resourceId: id,
          changes: { deletedRecord: existing },
        },
      });
    });
    
    return { deleted: true, id };
  }

  async findAll(organizationId: string, query: AttendanceQuery) {
    const { page, limit, skip } = parsePagination(query, { limit: 50 });
    const where: Prisma.AttendanceWhereInput = { organizationId };

    if (query.groupId) where.groupId = query.groupId;
    if (query.lessonId) where.lessonId = query.lessonId;
    // Self-service scoping: the caller (controller) only passes ids it has
    // already authorized; the filter itself is tenant-scoped by organizationId
    // above, so a foreign id can never widen the result set.
    if (query.studentId) where.studentId = query.studentId;
    // Teacher scoping: attendance rows of the groups this teacher owns.
    if (query.teacherId) where.group = { teacherId: query.teacherId };
    if (query.status) where.status = query.status as Prisma.AttendanceWhereInput['status'];
    // Pipeline-decision filter: the Attendance row does not carry the
    // pipeline decision directly — it lives on CameraAttendanceEvent (camera
    // path) / RecognitionAttempt.attendanceDecision (face path). Resolve the
    // matching attendance ids through the event table (org-scoped) so the
    // filter is REAL and never widens the result set across tenants.
    if (query.decision) {
      const eventRows = await this.prisma.cameraAttendanceEvent.findMany({
        where: {
          organizationId,
          decision: query.decision,
          attendanceId: { not: null },
        },
        select: { attendanceId: true },
        take: 1000,
      });

      const attendanceIds = [
        ...new Set(
          eventRows
            .map((r) => r.attendanceId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      if (attendanceIds.length === 0) {
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
      where.id = { in: attendanceIds };
    }
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = startOfDay(query.dateFrom);
      const dateTo = toDateToInclusive(query.dateTo);
      if (dateTo) where.date.lte = dateTo;
    }
    // Single-day filter (frontend sends `date=YYYY-MM-DD`). Attendance rows
    // store a full timestamp, so match the whole local day range instead of
    // doing an exact equality that would silently match nothing.
    if (query.date) {
      const day = new Date(query.date);
      if (!Number.isNaN(day.getTime())) {
        const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        where.date = { gte: start, lt: end };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        include: {
          student: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
          group: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAnalytics(organizationId: string, query: AttendanceQuery) {
    const where: Prisma.AttendanceWhereInput = { organizationId };
    if (query.groupId) where.groupId = query.groupId;
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = startOfDay(query.dateFrom);
      const dateTo = toDateToInclusive(query.dateTo);
      if (dateTo) where.date.lte = dateTo;
    }
    if (query.date) {
      const day = new Date(query.date);
      if (!Number.isNaN(day.getTime())) {
        const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        where.date = { gte: start, lt: end };
      }
    }

    const [statusCounts, groupStats, dailyStats] = await Promise.all([
      this.prisma.attendance.groupBy({ by: ['status'], where, _count: { status: true } }),
      this.prisma.attendance.groupBy({ by: ['groupId'], where, _count: { status: true } }),
      this.getDailyStats(organizationId, query),
    ]);

    const total = statusCounts.reduce((sum, s) => sum + s._count.status, 0);
    const presentCount = statusCounts.find((s) => s.status === 'PRESENT')?._count.status || 0;

    return {
      overall: {
        total,
        present: presentCount,
        rate: total > 0 ? Math.round((presentCount / total) * 100) : 0,
      },
      byStatus: statusCounts,
      byGroup: groupStats,
      daily: dailyStats,
    };
  }

  private async getDailyStats(organizationId: string, query: AttendanceQuery) {
    const conditions: Prisma.Sql[] = [Prisma.sql`"organizationId" = ${organizationId}::uuid`];

    if (query.groupId) {
      conditions.push(Prisma.sql`"groupId" = ${query.groupId}::uuid`);
    }
    if (query.dateFrom) {
      conditions.push(Prisma.sql`date >= ${startOfDay(query.dateFrom)}`);
    }
    const dateTo = toDateToInclusive(query.dateTo);
    if (dateTo) {
      conditions.push(Prisma.sql`date <= ${dateTo}`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    return this.prisma.$queryRaw`
      SELECT DATE(date) as date, status, COUNT(*)::int as count
      FROM "Attendance"
      WHERE ${whereClause}
      GROUP BY DATE(date), status
      ORDER BY date DESC
      LIMIT 30`;
  }
}

