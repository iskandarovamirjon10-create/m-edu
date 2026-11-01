import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AutoFixScheduleConflictDto,
  ConflictAuditQueryDto,
  DAYS_OF_WEEK,
  ResolveConflictDto,
} from './dto/schedule-optimizer.dto';

export type ScheduleConflictType =
  | 'TEACHER_COLLISION'
  | 'ROOM_COLLISION'
  | 'CAPACITY_OVERFLOW'
  | 'STUDENT_COLLISION';

export interface ScheduleConflictItem {
  id: string;
  type: ScheduleConflictType;
  severity: 'CRITICAL' | 'WARNING';
  dayOfWeek: DayOfWeek;
  timeSlot: string; // "14:00 - 15:30"
  room: string | null;
  teacherName: string;
  groupNames: string[];
  scheduleIds: string[];
  description: string;
  recommendedAction: string;
}

export interface ConflictAuditResult {
  totalConflicts: number;
  criticalCount: number;
  warningCount: number;
  byType: Record<ScheduleConflictType, number>;
  conflicts: ScheduleConflictItem[];
}

export interface ResolvedSlotOption {
  room: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  score: number; // 0 - 100 (100 = optimal match)
  roomCapacity: number;
  groupEnrolledCount: number;
  rationale: string;
}

@Injectable()
export class ScheduleOptimizerService {
  private readonly logger = new Logger(ScheduleOptimizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Scans all schedules across the organization to uncover active timetable collisions.
   */
  async auditAllConflicts(
    organizationId: string,
    query: ConflictAuditQueryDto,
  ): Promise<ConflictAuditResult> {
    const schedules = await this.prisma.schedule.findMany({
      where: {
        isActive: true,
        group: {
          organizationId,
          isActive: true,
          ...(query.branchId ? { branchId: query.branchId } : {}),
        },
        ...(query.dayOfWeek ? { dayOfWeek: query.dayOfWeek } : {}),
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            room: true,
            capacity: true,
            teacherId: true,
            teacher: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            enrollments: {
              where: { isActive: true },
              select: { studentId: true },
            },
          },
        },
      },
    });

    const conflicts: ScheduleConflictItem[] = [];
    const byType: Record<ScheduleConflictType, number> = {
      TEACHER_COLLISION: 0,
      ROOM_COLLISION: 0,
      CAPACITY_OVERFLOW: 0,
      STUDENT_COLLISION: 0,
    };

    // 1. Check Capacity Overflow for each schedule
    for (const s of schedules) {
      const roomCapacity = s.group.capacity ?? 20;
      const enrolledCount = s.group.enrollments.length;

      if (enrolledCount > roomCapacity) {
        byType.CAPACITY_OVERFLOW++;
        conflicts.push({
          id: `cap_${s.id}`,
          type: 'CAPACITY_OVERFLOW',
          severity: 'WARNING',
          dayOfWeek: s.dayOfWeek,
          timeSlot: `${s.startTime} - ${s.endTime}`,
          room: s.room ?? s.group.room ?? 'Noma’lum xona',
          teacherName: s.group.teacher
            ? `${s.group.teacher.user.firstName} ${s.group.teacher.user.lastName}`
            : 'O‘qituvchi tayinlanmagan',
          groupNames: [s.group.name],
          scheduleIds: [s.id],
          description: `Guruh sig‘imi oshib ketgan: ${enrolledCount} nafar talaba mavjud (Xona sig‘imi: ${roomCapacity}).`,
          recommendedAction: 'Guruhni kattaroq auditoriyaga ko‘chirish yoki yangi guruh ochish.',
        });
      }
    }

    // 2. Pairwise collisions: Teacher, Room, Student
    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const s1 = schedules[i];
        const s2 = schedules[j];

        // Same day check
        if (s1.dayOfWeek !== s2.dayOfWeek) continue;

        // Time overlap condition: (s1.start < s2.end) AND (s1.end > s2.start)
        const overlap = s1.startTime < s2.endTime && s1.endTime > s2.startTime;
        if (!overlap) continue;

        const effectiveRoom1 = (s1.room ?? s1.group.room ?? '').trim().toLowerCase();
        const effectiveRoom2 = (s2.room ?? s2.group.room ?? '').trim().toLowerCase();

        // 2a. Room Collision
        if (effectiveRoom1 && effectiveRoom2 && effectiveRoom1 === effectiveRoom2) {
          byType.ROOM_COLLISION++;
          conflicts.push({
            id: `room_${s1.id}_${s2.id}`,
            type: 'ROOM_COLLISION',
            severity: 'CRITICAL',
            dayOfWeek: s1.dayOfWeek,
            timeSlot: `${s1.startTime} - ${s1.endTime} & ${s2.startTime} - ${s2.endTime}`,
            room: s1.room ?? s1.group.room,
            teacherName: `${s1.group.teacher?.user.firstName ?? ''} / ${s2.group.teacher?.user.firstName ?? ''}`,
            groupNames: [s1.group.name, s2.group.name],
            scheduleIds: [s1.id, s2.id],
            description: `Xona to‘qnashuvi: "${s1.group.name}" va "${s2.group.name}" bir xil [${s1.room ?? s1.group.room}] xonasiga belgilangan!`,
            recommendedAction: 'Bir guruhni bo‘sh turgan boshqa xonaga o‘tkazish.',
          });
        }

        // 2b. Teacher Collision
        const teacherId1 = s1.group.teacherId;
        const teacherId2 = s2.group.teacherId;
        if (teacherId1 && teacherId2 && teacherId1 === teacherId2) {
          byType.TEACHER_COLLISION++;
          const teacher = s1.group.teacher?.user;
          const teacherFullName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'O‘qituvchi';
          conflicts.push({
            id: `teacher_${s1.id}_${s2.id}`,
            type: 'TEACHER_COLLISION',
            severity: 'CRITICAL',
            dayOfWeek: s1.dayOfWeek,
            timeSlot: `${s1.startTime} - ${s1.endTime}`,
            room: `${s1.room ?? s1.group.room ?? '-'} & ${s2.room ?? s2.group.room ?? '-'}`,
            teacherName: teacherFullName,
            groupNames: [s1.group.name, s2.group.name],
            scheduleIds: [s1.id, s2.id],
            description: `O‘qituvchi to‘qnashuvi: ${teacherFullName} bir vaqtning o‘zida 2 ta guruhga ("${s1.group.name}" va "${s2.group.name}") dars o‘ta olmaydi!`,
            recommendedAction: 'Guruhlardan birining dars vaqtini o‘zgartirish yoki yordamchi o‘qituvchi tayinlash.',
          });
        }

        // 2c. Student Overlapping Enrollment Collision
        const students1 = new Set(s1.group.enrollments.map((sg) => sg.studentId));
        const sharedStudentCount = s2.group.enrollments.filter((sg) =>
          students1.has(sg.studentId),
        ).length;

        if (sharedStudentCount > 0) {
          byType.STUDENT_COLLISION++;
          conflicts.push({
            id: `student_${s1.id}_${s2.id}`,
            type: 'STUDENT_COLLISION',
            severity: 'CRITICAL',
            dayOfWeek: s1.dayOfWeek,
            timeSlot: `${s1.startTime} - ${s1.endTime}`,
            room: `${s1.room ?? s1.group.room ?? '-'} / ${s2.room ?? s2.group.room ?? '-'}`,
            teacherName: s1.group.teacher?.user.firstName ?? 'N/A',
            groupNames: [s1.group.name, s2.group.name],
            scheduleIds: [s1.id, s2.id],
            description: `${sharedStudentCount} nafar talaba bir vaqtda ikkita faol guruhga ("${s1.group.name}" va "${s2.group.name}") yozilgan!`,
            recommendedAction: 'Talabalar uchun para vaqtlarini moslashtirish.',
          });
        }
      }
    }

    const criticalCount = conflicts.filter((c) => c.severity === 'CRITICAL').length;
    const warningCount = conflicts.filter((c) => c.severity === 'WARNING').length;

    return {
      totalConflicts: conflicts.length,
      criticalCount,
      warningCount,
      byType,
      conflicts,
    };
  }

  /**
   * Generates collision-free, optimized alternative slot suggestions for a conflicting schedule entry.
   */
  async suggestResolvedSlots(
    organizationId: string,
    dto: ResolveConflictDto,
  ): Promise<{ scheduleId: string; groupName: string; options: ResolvedSlotOption[] }> {
    const targetSchedule = await this.prisma.schedule.findFirst({
      where: {
        id: dto.scheduleId,
        group: { organizationId },
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            teacherId: true,
            capacity: true,
            room: true,
            enrollments: { where: { isActive: true }, select: { studentId: true } },
          },
        },
      },
    });

    if (!targetSchedule) {
      throw new NotFoundException(`Schedule entry [${dto.scheduleId}] not found`);
    }

    const durationMinutes = this.calculateDurationMinutes(
      targetSchedule.startTime,
      targetSchedule.endTime,
    );
    const enrolledCount = targetSchedule.group.enrollments.length;

    // Collect all registered rooms in this organization
    const groupsWithRooms = await this.prisma.group.findMany({
      where: { organizationId, isActive: true, room: { not: null } },
      select: { room: true, capacity: true },
    });

    const knownRooms = new Map<string, number>();
    for (const g of groupsWithRooms) {
      if (g.room && g.room.trim()) {
        const roomName = g.room.trim();
        const cap = g.capacity ?? 20;
        knownRooms.set(roomName, Math.max(knownRooms.get(roomName) ?? 0, cap));
      }
    }
    if (knownRooms.size === 0) {
      knownRooms.set('Auditoriya 101', 25);
      knownRooms.set('Auditoriya 102', 20);
      knownRooms.set('Katta Zal', 40);
    }

    // Candidate standard start hours: 09:00, 10:30, 14:00, 15:30, 17:00, 18:30
    const candidateStartTimes = ['09:00', '10:30', '14:00', '15:30', '17:00', '18:30'];
    const daysToTest = dto.preferredDays && dto.preferredDays.length > 0
      ? dto.preferredDays
      : [targetSchedule.dayOfWeek];

    // Fetch all other active schedules to verify collision-free status
    const allOtherSchedules = await this.prisma.schedule.findMany({
      where: {
        isActive: true,
        id: { not: targetSchedule.id },
        group: { organizationId, isActive: true },
      },
      include: {
        group: {
          select: {
            teacherId: true,
            room: true,
            enrollments: { where: { isActive: true }, select: { studentId: true } },
          },
        },
      },
    });

    const validOptions: ResolvedSlotOption[] = [];

    for (const day of daysToTest) {
      for (const startStr of candidateStartTimes) {
        const endStr = this.addMinutes(startStr, durationMinutes);

        // Filter time of day if requested
        const hour = parseInt(startStr.slice(0, 2), 10);
        if (dto.preferredTimeOfDay === 'MORNING' && hour >= 12) continue;
        if (dto.preferredTimeOfDay === 'AFTERNOON' && (hour < 12 || hour >= 17)) continue;
        if (dto.preferredTimeOfDay === 'EVENING' && hour < 17) continue;

        for (const [roomName, cap] of knownRooms.entries()) {
          // Check capacity
          if (cap < enrolledCount) continue;

          // Check for conflicts
          let hasConflict = false;
          for (const other of allOtherSchedules) {
            if (other.dayOfWeek !== day) continue;
            const overlap = startStr < other.endTime && endStr > other.startTime;
            if (!overlap) continue;

            // Room collision
            const otherRoom = (other.room ?? other.group.room ?? '').trim().toLowerCase();
            if (otherRoom === roomName.toLowerCase()) {
              hasConflict = true;
              break;
            }

            // Teacher collision
            if (
              targetSchedule.group.teacherId &&
              other.group.teacherId === targetSchedule.group.teacherId
            ) {
              hasConflict = true;
              break;
            }
          }

          if (!hasConflict) {
            let score = 85;
            if (day === targetSchedule.dayOfWeek) score += 10;
            if (cap >= enrolledCount && cap <= enrolledCount + 5) score += 5; // Perfect room fit

            validOptions.push({
              room: roomName,
              dayOfWeek: day,
              startTime: startStr,
              endTime: endStr,
              score,
              roomCapacity: cap,
              groupEnrolledCount: enrolledCount,
              rationale: `To‘qnashuvsiz toza slot: ${day} soat ${startStr} - ${endStr} (${roomName}, sig‘imi ${cap} kishi)`,
            });
          }
        }
      }
    }

    validOptions.sort((a, b) => b.score - a.score);

    return {
      scheduleId: targetSchedule.id,
      groupName: targetSchedule.group.name,
      options: validOptions.slice(0, 5),
    };
  }

  /**
   * Atomically executes the auto-fix relocation for a schedule.
   */
  async autoFixConflict(
    organizationId: string,
    actorId: string,
    dto: AutoFixScheduleConflictDto,
  ) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id: dto.scheduleId, group: { organizationId } },
      include: { group: true },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule entry ${dto.scheduleId} not found`);
    }

    // Verify target slot does not introduce fresh collisions
    const collisionCheck = await this.prisma.schedule.findFirst({
      where: {
        id: { not: dto.scheduleId },
        dayOfWeek: dto.targetDayOfWeek,
        isActive: true,
        group: { organizationId, isActive: true },
        startTime: { lt: dto.targetEndTime },
        endTime: { gt: dto.targetStartTime },
        OR: [
          { room: dto.targetRoom },
          { group: { room: dto.targetRoom } },
          ...(schedule.group.teacherId
            ? [{ group: { teacherId: schedule.group.teacherId } }]
            : []),
        ],
      },
      include: { group: true },
    });

    if (collisionCheck) {
      throw new ConflictException(
        `Tanlangan yangi slotda to‘qnashuv mavjud: "${collisionCheck.group.name}" guruhi bilan vaqt yoki xona to‘qnashmoqda!`,
      );
    }

    const oldSnapshot = {
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      room: schedule.room ?? schedule.group.room,
    };

    const updated = await this.prisma.schedule.update({
      where: { id: dto.scheduleId },
      data: {
        dayOfWeek: dto.targetDayOfWeek,
        startTime: dto.targetStartTime,
        endTime: dto.targetEndTime,
        room: dto.targetRoom,
      },
    });

    // Record audit trail
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'SCHEDULE_AUTO_FIX',
      resource: 'Schedule',
      resourceId: dto.scheduleId,
      changes: {
        schedule: {
          old: oldSnapshot,
          new: {
            dayOfWeek: dto.targetDayOfWeek,
            startTime: dto.targetStartTime,
            endTime: dto.targetEndTime,
            room: dto.targetRoom,
          },
        },
      },
    });

    this.logger.log(
      `Schedule [${dto.scheduleId}] auto-fixed: ${dto.targetDayOfWeek} ${dto.targetStartTime}-${dto.targetEndTime} (${dto.targetRoom}) by [${actorId}]`,
    );

    return {
      success: true,
      schedule: updated,
      message: `Jadval to‘qnashuvi muvaffaqiyatli bartaraf etildi (${dto.targetRoom}, ${dto.targetDayOfWeek} ${dto.targetStartTime}-${dto.targetEndTime})`,
    };
  }

  private calculateDurationMinutes(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return Math.max(30, (eh * 60 + em) - (sh * 60 + sm));
  }

  private addMinutes(timeStr: string, minutes: number): string {
    const [h, m] = timeStr.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }
}
