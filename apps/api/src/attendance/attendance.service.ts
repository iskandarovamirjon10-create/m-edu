import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { MarkAttendanceDto } from '../common/dto';
import { AttendanceQuery } from '../common/dto/query';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async markAttendance(organizationId: string, data: MarkAttendanceDto) {
    const group = await this.prisma.group.findFirst({
      where: { id: data.groupId, organizationId },
    });
    if (!group) throw new NotFoundException('Group not found');

    const date = new Date(data.date);

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
    const enrollments = await this.prisma.studentGroup.findMany({
      where: { groupId: data.groupId, organizationId, isActive: true },
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

    const existingRecords = await this.prisma.attendance.findMany({
      where: {
        groupId: data.groupId,
        date,
        studentId: { in: data.records.map((r) => r.studentId) },
      },
    });
    const existingMap = new Map(existingRecords.map((e) => [e.studentId, e]));

    const toUpdate: Array<{ existing: { id: string }; record: MarkAttendanceDto['records'][number] }> = [];
    const toCreate: MarkAttendanceDto['records'][number][] = [];

    for (const record of data.records) {
      const existing = existingMap.get(record.studentId);
      if (existing) {
        toUpdate.push({ existing, record });
      } else {
        toCreate.push(record);
      }
    }

    let createdCount = 0;
    const updatedRecords: unknown[] = [];
    if (toCreate.length > 0) {
      try {
        const result = await this.prisma.attendance.createMany({
          data: toCreate.map((record) => ({
            organizationId,
            studentId: record.studentId,
            groupId: data.groupId,
            date,
            status: record.status,
            note: record.note,
          })),
        });
        createdCount = result.count;
      } catch (err: unknown) {
        // P2002 = unique constraint (studentId, groupId, date) — a concurrent
        // request already recorded this attendance. Treat as an update: fetch
        // the now-existing rows and update their status/note.
        if ((err as { code?: string })?.code === 'P2002') {
          const existing = await this.prisma.attendance.findMany({
            where: {
              groupId: data.groupId,
              date,
              studentId: { in: toCreate.map((r) => r.studentId) },
            },
          });
          const map = new Map(existing.map((e) => [e.studentId, e]));
          const updates = toCreate
            .filter((record) => map.has(record.studentId))
            .map((record) => {
              const row = map.get(record.studentId)!;
              return this.prisma.attendance.update({
                where: { id: row.id },
                data: { status: record.status, note: record.note },
              });
            });
          updatedRecords.push(...(await Promise.all(updates)));
        } else {
          throw err;
        }
      }
    }
    if (toUpdate.length > 0) {
      const updates = toUpdate.map(({ existing, record }) =>
        this.prisma.attendance.update({
          where: { id: existing.id },
          data: { status: record.status, note: record.note },
        }),
      );
      updatedRecords.push(...(await Promise.all(updates)));
    }

    return {
      created: createdCount,
      updated: updatedRecords.length,
      total: data.records.length,
    };
  }

  async findAll(organizationId: string, query: AttendanceQuery) {
    const { page, limit, skip } = parsePagination(query, { limit: 50 });
    const where: Prisma.AttendanceWhereInput = { organizationId };

    if (query.groupId) where.groupId = query.groupId;
    if (query.status) where.status = query.status as Prisma.AttendanceWhereInput['status'];
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
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
        orderBy: { date: 'desc' },
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
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
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
    const conditions = ['"organizationId" = $1::uuid'];
    const params: (string | Date)[] = [organizationId];
    let paramIndex = 2;

    if (query.dateFrom) {
      conditions.push(`date >= $${paramIndex}`);
      params.push(new Date(query.dateFrom));
      paramIndex++;
    }
    if (query.dateTo) {
      conditions.push(`date <= $${paramIndex}`);
      params.push(new Date(query.dateTo));
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    return this.prisma.$queryRawUnsafe(
      `SELECT date, status, COUNT(*)::int as count
       FROM "Attendance"
       WHERE ${whereClause}
       GROUP BY date, status
       ORDER BY date DESC
       LIMIT 30`,
      ...params,
    );
  }
}
