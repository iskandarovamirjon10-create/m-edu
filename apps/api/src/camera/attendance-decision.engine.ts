import { Injectable, Optional } from '@nestjs/common';
import * as crypto from 'node:crypto';

import { SecureLogger } from '@medu/face-security';

import { PrismaService } from '../prisma/prisma.service';
import { RedisPubSubService } from '../common/redis/redis-pubsub.service';
import { NotificationEventService } from '../notifications/events/notification-event.service';
import { ATTENDANCE_CREATED_EVENT } from '../attendance/attendance.gateway';
import { getErrorMessage } from '../lib/error';
import {
  canonicalMembershipWhere,
  INELIGIBLE_STUDENT_STATUSES,
} from '../common/student-membership';
import {
  computeInvoiceOutstanding,
  NON_BILLABLE_INVOICE_STATUSES,
} from '../payments/invoice-outstanding';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

/**
 * Input received from the camera/recognition worker.
 *
 * SECURITY:
 * - studentId is NOT trusted as proof of identity.
 * - The caller must have completed the recognition/authorization pipeline.
 * - organizationId/cameraId are additionally validated against persisted
 *   records before attendance is created.
 */
export interface RecognitionParams {
  organizationId: string;
  cameraId: string;
  studentId: string;
  recognizedAt: Date;

  qualityScore?: number | null;
  confidence?: number | null;
  similarityScore?: number | null;

  cameraLocation?: string | null;
  cameraName?: string | null;
}

interface DurableEventParams {
  /**
   * Organization-local timezone used to resolve this event's calendar date.
   * Must be the SAME timezone and anchorDayOffset that produced the Attendance
   * row this event refers to.
   */
  timezone?: string | null;
  anchorDayOffset?: number;
  organizationId: string;
  cameraId: string;
  studentId: string;
  recognizedAt: Date;

  idempotencyKey: string;
  decision: AttendanceDecision;

  groupId?: string | null;
  attendanceId?: string | null;

  confidence?: number | null;
  similarityScore?: number | null;
  faceQuality?: number | null;
}

export type AttendanceDecision =
  | 'RECORDED'
  | 'STUDENT_INACTIVE'
  | 'STUDENT_NOT_IN_GROUP'
  | 'NO_SCHEDULED_GROUP'
  | 'AMBIGUOUS_SCHEDULE'
  | 'MANUAL_PRESERVED'
  | 'DUPLICATE_PREVENTED'
  | 'HOLIDAY'
  | 'INSUFFICIENT_FUNDS';

export interface ValidateGroupTimeOptions {
  cameraLocation?: string | null;
  at?: Date;
  /** Fallback timezone when the organization has none configured. */
  timezone?: string | null;
}

export interface ResolvedGroup {
  groupId: string;
  status: 'MATCHED' | 'NO_MATCH' | 'AMBIGUOUS';
  startMinutes?: number;
  minutesSinceStart?: number;
  isLate?: boolean;
  anchorDayOffset?: number;
}

export interface GroupTimeEvaluation {
  valid: boolean;
  isLate: boolean;
  deniedReason?:
    | 'MISSING_IDENTIFIERS'
    | 'UNKNOWN_ORGANIZATION'
    | 'STUDENT_INACTIVE'
    | 'NOT_ENROLLED'
    | 'NO_SCHEDULE'
    | 'HOLIDAY'
    | 'NO_UNAMBIGUOUS_WINDOW'
    | 'WRONG_GROUP';
}

/** Minimal shape of a durable event needed to validate idempotency keys. */
interface DurableEventShape {
  id: string;
  decision: string | null;
  studentId: string | null;
  cameraId: string | null;
  groupId: string | null;
  attendanceId?: string | null;
}

interface RecordedDurableEventResult {
  id: string;
  decision: AttendanceDecision;
  attendanceId: string | null;
  reusedExisting: boolean;
}

// ---------------------------------------------------------------------------
// CONSTANTS & FORMATTER CACHES
// ---------------------------------------------------------------------------

/**
 * Camera recognition cooldown. Multiple frames from the same camera can
 * recognize the same student repeatedly; the idempotency bucket collapses
 * them into a single durable event.
 */
const COOLDOWN_WINDOW_MINUTES = 5;

/** Schedule grace: recognition accepted ± this many minutes around a lesson. */
const SCHEDULE_GRACE_MINUTES = 30;

/** Minutes after the scheduled start before the row becomes LATE. */
const LATE_THRESHOLD_MINUTES = 15;

/** Maximum allowed clock skew for incoming camera frame timestamps. */
const MAX_FUTURE_DRIFT_MS = 5_000;

const MINUTES_PER_DAY = 24 * 60;

const DEFAULT_TIMEZONE = 'UTC';

const ATTENDANCE_UNIQUE_TARGET = 'studentId_groupId_date';
const ATTENDANCE_LESSON_UNIQUE_TARGET = 'studentId_lessonId';

const DAY_BEFORE: Readonly<Record<string, string>> = Object.freeze({
  SUNDAY: 'SATURDAY',
  MONDAY: 'SUNDAY',
  TUESDAY: 'MONDAY',
  WEDNESDAY: 'TUESDAY',
  THURSDAY: 'WEDNESDAY',
  FRIDAY: 'THURSDAY',
  SATURDAY: 'FRIDAY',
});

const DAY_AFTER: Readonly<Record<string, string>> = Object.freeze({
  SUNDAY: 'MONDAY',
  MONDAY: 'TUESDAY',
  TUESDAY: 'WEDNESDAY',
  WEDNESDAY: 'THURSDAY',
  FRIDAY: 'SATURDAY',
  SATURDAY: 'SUNDAY',
  THURSDAY: 'FRIDAY',
});

const DECISION_MESSAGES: Readonly<Record<AttendanceDecision, string>> =
  Object.freeze({
    RECORDED: 'Attendance successfully recorded',
    STUDENT_INACTIVE:
      'Student account is inactive or not found in organization',
    STUDENT_NOT_IN_GROUP: 'Student is not actively enrolled in any group',
    NO_SCHEDULED_GROUP:
      'No scheduled class found for student at current time and location',
    AMBIGUOUS_SCHEDULE:
      'Multiple scheduled groups matched; attendance was not automatically assigned',
    MANUAL_PRESERVED: 'Authoritative manual attendance preserved',
    DUPLICATE_PREVENTED: 'Duplicate attendance prevented',
    HOLIDAY:
      'Organization holiday: no scheduled classes, attendance not recorded',
    INSUFFICIENT_FUNDS:
      'Student has overdue invoices; attendance denied by financial gate',
  });

/**
 * High-performance Intl caches to avoid V8 ICU instantiation overhead
 * on high-frequency camera frame streams.
 */
const validTimezoneCache = new Map<string, boolean>();
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

// ---------------------------------------------------------------------------
// SERVICE
// ---------------------------------------------------------------------------

/**
 * AttendanceDecisionEngine
 *
 * 1. Validate recognition context & biometric score bounds.
 * 2. Validate student tenant ownership and active status.
 * 3. Resolve the correct academic group from the current schedule (with multi-slot disambiguation).
 * 4. Respect manual attendance as authoritative across both lesson-linked and date-linked rows.
 * 5. Prevent duplicates, concurrent races, and cooldown idempotency collisions.
 * 6. Persist attendance + camera event atomically.
 * 7. Emit real-time pub/sub & notification events outside the DB transaction.
 */
@Injectable()
export class AttendanceDecisionEngine {
  private readonly logger = new SecureLogger('info');

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redisPubSub?: RedisPubSubService,
    @Optional() private readonly notificationEvents?: NotificationEventService,
  ) {}

  // =========================================================================
  // PUBLIC — RECOGNITION PIPELINE
  // =========================================================================

  /**
   * Main recognition → attendance decision pipeline.
   */
  async processRecognition(params: RecognitionParams) {
    this.validateRecognitionParams(params);

    const recognizedAt = new Date(params.recognizedAt.getTime());

    // Parallelize independent tenant + camera verification queries
    const [organization, camera] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: params.organizationId },
        select: { id: true, timezone: true },
      }),
      this.prisma.camera.findFirst({
        where: {
          id: params.cameraId,
          organizationId: params.organizationId,
        },
        select: { id: true, name: true, location: true },
      }),
    ]);

    if (!organization) {
      throw new Error('Recognition organization not found');
    }

    if (!camera) {
      throw new Error('Recognition camera not found in organization');
    }

    const timezone = this.normalizeTimezone(organization.timezone);
    const cameraLocation = this.normalizeOptional(camera.location);
    const cameraName =
      this.normalizeOptional(camera.name) ??
      this.normalizeOptional(params.cameraName) ??
      'IP Camera';

    // Canonical eligibility: active user, not PAUSED/DROPPED.
    // Also select `balance` upfront to avoid a redundant round-trip in financial gate.
    const student = await this.prisma.student.findFirst({
      where: {
        id: params.studentId,
        organizationId: organization.id,
        user: { isActive: true },
        status: { notIn: [...INELIGIBLE_STUDENT_STATUSES] },
      },
      select: {
        id: true,
        userId: true,
        balance: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const baseEvent = {
      organizationId: organization.id,
      cameraId: camera.id,
      studentId: params.studentId,
      recognizedAt,
      faceQuality: this.assertScore(params.qualityScore, 'qualityScore'),
      confidence: this.assertScore(params.confidence, 'confidence'),
      similarityScore: this.assertScore(params.similarityScore, 'similarityScore'),
      timezone,
      cameraLocation,
      cameraName,
    };

    // ---- 1. Student missing / inactive -----------------------------------
    if (!student) {
      return this.persistDecisionEvent({
        ...baseEvent,
        decision: 'STUDENT_INACTIVE',
        idempotencyKey: this.buildIdempotencyKey({
          organizationId: organization.id,
          cameraId: camera.id,
          studentId: params.studentId,
          groupId: 'inactive',
          recognizedAt,
          timezone,
        }),
      });
    }

    // ---- 2. Active group memberships -------------------------------------
    const membershipDayStart = this.getOrganizationDate(recognizedAt, timezone);

    const enrollments = await this.prisma.studentGroup.findMany({
      where: canonicalMembershipWhere({
        organizationId: organization.id,
        studentId: student.id,
        dayStart: membershipDayStart,
      }),
      select: {
        groupId: true,
        group: {
          select: {
            id: true,
            name: true,
            room: true,
            schedules: {
              where: { isActive: true },
              select: {
                dayOfWeek: true,
                startTime: true,
                endTime: true,
                room: true,
              },
            },
          },
        },
      },
    });

    if (enrollments.length === 0) {
      return this.persistDecisionEvent({
        ...baseEvent,
        decision: 'STUDENT_NOT_IN_GROUP',
        idempotencyKey: this.buildIdempotencyKey({
          organizationId: organization.id,
          cameraId: camera.id,
          studentId: student.id,
          groupId: 'no-group',
          recognizedAt,
          timezone,
        }),
      });
    }

    // ---- 3. Resolve group strictly from the schedule ---------------------
    const resolvedGroup = this.resolveTargetGroup(
      enrollments,
      recognizedAt,
      timezone,
      cameraLocation,
    );

    const anchorDayOffset = resolvedGroup.anchorDayOffset ?? 0;

    // ---- 4. Holiday gate -------------------------------------------------
    const holidayCheckDate = anchorDayOffset
      ? this.getOrganizationDateWithOffset(recognizedAt, timezone, anchorDayOffset)
      : recognizedAt;

    if (
      await this.isOrganizationHoliday(
        organization.id,
        holidayCheckDate,
        timezone,
      )
    ) {
      return this.persistDecisionEvent({
        ...baseEvent,
        anchorDayOffset,
        decision: 'HOLIDAY',
        idempotencyKey: this.buildIdempotencyKey({
          organizationId: organization.id,
          cameraId: camera.id,
          studentId: student.id,
          groupId: 'holiday',
          recognizedAt,
          timezone,
          anchorDayOffset,
        }),
      });
    }

    if (resolvedGroup.status === 'NO_MATCH') {
      return this.persistDecisionEvent({
        ...baseEvent,
        decision: 'NO_SCHEDULED_GROUP',
        idempotencyKey: this.buildIdempotencyKey({
          organizationId: organization.id,
          cameraId: camera.id,
          studentId: student.id,
          groupId: 'no-schedule',
          recognizedAt,
          timezone,
        }),
      });
    }

    if (resolvedGroup.status === 'AMBIGUOUS') {
      return this.persistDecisionEvent({
        ...baseEvent,
        decision: 'AMBIGUOUS_SCHEDULE',
        idempotencyKey: this.buildIdempotencyKey({
          organizationId: organization.id,
          cameraId: camera.id,
          studentId: student.id,
          groupId: 'ambiguous-schedule',
          recognizedAt,
          timezone,
        }),
      });
    }

    const groupId = resolvedGroup.groupId;

    // ---- 5. Financial / overdue gate (TRUE FAIL-CLOSED) ------------------
    const financial = await this.loadStudentFinancial(
      organization.id,
      student.id,
      student.balance,
    );

    // Fail-closed: if financial is null (lookup failed or student missing) OR overdue > 0
    if (!financial || financial.overdue > 0) {
      return this.persistDecisionEvent({
        ...baseEvent,
        groupId,
        anchorDayOffset,
        decision: 'INSUFFICIENT_FUNDS',
        idempotencyKey: this.buildIdempotencyKey({
          organizationId: organization.id,
          cameraId: camera.id,
          studentId: student.id,
          groupId,
          recognizedAt,
          timezone,
          anchorDayOffset,
        }),
      });
    }

    const attendanceDate = this.getOrganizationDateWithOffset(
      recognizedAt,
      timezone,
      anchorDayOffset,
    );

    const idempotencyKey = this.buildIdempotencyKey({
      organizationId: organization.id,
      cameraId: camera.id,
      studentId: student.id,
      groupId,
      recognizedAt,
      timezone,
      anchorDayOffset,
    });

    // Resolve the Lesson row running for this group/date (with grace window support)
    const linkedLessonId = await this.resolveLessonForAttendance(
      organization.id,
      groupId,
      attendanceDate,
      recognizedAt,
      timezone,
    );

    const statusToRecord = resolvedGroup.isLate ? 'LATE' : 'PRESENT';

    // ---- 6. Attendance + durable event — atomic --------------------------
    try {
      const decisionResult = await this.prisma.$transaction(
        async (tx) => {
          const existingAttendance = await this.findExistingAttendance(tx, {
            studentId: student.id,
            groupId,
            attendanceDate,
            lessonId: linkedLessonId,
          });

          // Existing attendance found (either MANUAL or earlier biometric frame)
          if (existingAttendance) {
            if (existingAttendance.source === 'MANUAL') {
              const evt = await this.recordDurableEvent(tx, {
                ...baseEvent,
                anchorDayOffset,
                groupId,
                attendanceId: existingAttendance.id,
                decision: 'MANUAL_PRESERVED',
                idempotencyKey,
              });

              this.logger.info(
                'Manual attendance preserved over camera recognition',
                {
                  organizationId: organization.id,
                  studentId: student.id,
                  groupId,
                  attendanceId: existingAttendance.id,
                },
              );

              return {
                decision: 'MANUAL_PRESERVED' as const,
                attendanceId: existingAttendance.id,
                groupId,
                message:
                  'Authoritative manual attendance preserved; automatic overwrite skipped',
                eventId: evt.id,
                isNewRecord: false,
              };
            }

            // Biometric duplicate (e.g. 2nd frame in same cooldown bucket or next bucket)
            const evt = await this.recordDurableEvent(tx, {
              ...baseEvent,
              anchorDayOffset,
              groupId,
              attendanceId: existingAttendance.id,
              decision: 'DUPLICATE_PREVENTED',
              idempotencyKey,
            });

            return {
              decision: 'DUPLICATE_PREVENTED' as const,
              attendanceId: existingAttendance.id,
              groupId,
              message:
                'Attendance already exists for this student and group on this date',
              eventId: evt.id,
              isNewRecord: false,
            };
          }

          // Create new biometric attendance row
          const attendance = await tx.attendance.create({
            data: {
              organizationId: organization.id,
              studentId: student.id,
              groupId,
              date: attendanceDate,
              status: statusToRecord,
              source: 'FACE',
              confidence: baseEvent.confidence,
              similarityScore: baseEvent.similarityScore,
              cameraId: camera.id,
              lessonId: linkedLessonId,
              note: this.buildAttendanceNote(cameraName, cameraLocation),
            },
          });

          const evt = await this.recordDurableEvent(tx, {
            ...baseEvent,
            anchorDayOffset,
            groupId,
            attendanceId: attendance.id,
            decision: 'RECORDED',
            idempotencyKey,
          });

          this.logger.info('Automatic camera attendance successfully recorded', {
            organizationId: organization.id,
            studentId: student.id,
            groupId,
            attendanceId: attendance.id,
            cameraId: camera.id,
            status: statusToRecord,
          });

          return {
            decision: 'RECORDED' as const,
            attendanceId: attendance.id,
            groupId,
            message: DECISION_MESSAGES.RECORDED,
            eventId: evt.id,
            isNewRecord: !evt.reusedExisting,
          };
        },
        { maxWait: 5_000, timeout: 10_000 },
      );

      // Side-effects OUTSIDE the transaction (only when a brand-new row was created)
      if (
        decisionResult.decision === 'RECORDED' &&
        decisionResult.isNewRecord &&
        decisionResult.attendanceId
      ) {
        this.publishAttendanceCreated(organization.id, {
          attendanceId: decisionResult.attendanceId,
          studentId: student.id,
          groupId,
          status: statusToRecord,
          recognizedAt,
        });

        this.emitAttendanceNotification(organization.id, {
          attendanceId: decisionResult.attendanceId,
          studentId: student.id,
          studentName: this.formatStudentName(student.user),
          status: statusToRecord,
          recognizedAt,
        });
      }

      const { isNewRecord: _, ...publicResult } = decisionResult;
      return publicResult;
    } catch (err: unknown) {
      // Concurrent create won the unique attendance race.
      if (
        this.extractPrismaCode(err) === 'P2002' &&
        this.isAttendanceUniqueConstraintViolation(err)
      ) {
        return this.resolveConcurrentDuplicate({
          organizationId: organization.id,
          cameraId: camera.id,
          studentId: student.id,
          groupId,
          attendanceDate,
          lessonId: linkedLessonId,
          anchorDayOffset,
          baseEvent,
          idempotencyKey,
        });
      }

      this.logger.error('Attendance recognition transaction failed', {
        organizationId: organization.id,
        cameraId: camera.id,
        studentId: student.id,
        groupId,
        error: getErrorMessage(err),
      });

      throw err;
    }
  }

  // =========================================================================
  // PUBLIC — SCHEDULE GATE
  // =========================================================================

  async validateGroupTime(
    organizationId: string,
    studentId: string,
    groupId: string,
    options: ValidateGroupTimeOptions | string = {},
  ): Promise<boolean> {
    const evaluation = await this.evaluateGroupTime(
      organizationId,
      studentId,
      groupId,
      options,
    );
    return evaluation.valid;
  }

  async describeGroupTime(
    organizationId: string,
    studentId: string,
    groupId: string,
    options: ValidateGroupTimeOptions | string = {},
  ): Promise<GroupTimeEvaluation> {
    return this.evaluateGroupTime(organizationId, studentId, groupId, options);
  }

  private async evaluateGroupTime(
    organizationId: string,
    studentId: string,
    groupId: string,
    options: ValidateGroupTimeOptions | string = {},
  ): Promise<GroupTimeEvaluation> {
    const opts: ValidateGroupTimeOptions =
      typeof options === 'string' ? { timezone: options } : options ?? {};

    if (!organizationId?.trim() || !studentId?.trim() || !groupId?.trim()) {
      return {
        valid: false,
        isLate: false,
        deniedReason: 'MISSING_IDENTIFIERS',
      };
    }

    const at =
      opts.at instanceof Date && !Number.isNaN(opts.at.getTime())
        ? opts.at
        : new Date();

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, timezone: true },
    });

    if (!organization) {
      this.logger.warn('Schedule gate denied: unknown organization', {
        organizationId,
      });
      return {
        valid: false,
        isLate: false,
        deniedReason: 'UNKNOWN_ORGANIZATION',
      };
    }

    const timezone = this.normalizeTimezone(
      organization.timezone?.trim() || opts.timezone?.trim(),
    );

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        organizationId: organization.id,
        user: { isActive: true },
        status: { notIn: [...INELIGIBLE_STUDENT_STATUSES] },
      },
      select: { id: true },
    });

    if (!student) {
      this.logger.warn('Schedule gate denied: student inactive or foreign', {
        organizationId: organization.id,
        studentId,
      });
      return { valid: false, isLate: false, deniedReason: 'STUDENT_INACTIVE' };
    }

    const membershipDayStart = this.getOrganizationDate(at, timezone);

    const enrollments = await this.prisma.studentGroup.findMany({
      where: canonicalMembershipWhere({
        organizationId: organization.id,
        studentId: student.id,
        groupId,
        dayStart: membershipDayStart,
      }),
      select: {
        groupId: true,
        group: {
          select: {
            id: true,
            name: true,
            room: true,
            schedules: {
              where: { isActive: true },
              select: {
                dayOfWeek: true,
                startTime: true,
                endTime: true,
                room: true,
              },
            },
          },
        },
      },
    });

    if (enrollments.length === 0) {
      this.logger.warn(
        'Schedule gate denied: student not actively enrolled in group',
        { organizationId: organization.id, studentId, groupId },
      );
      return { valid: false, isLate: false, deniedReason: 'NOT_ENROLLED' };
    }

    const hasAnySchedule = enrollments.some(
      (e) => e.group.schedules.length > 0,
    );

    if (!hasAnySchedule) {
      this.logger.warn('Schedule gate denied: group has no active schedule', {
        organizationId: organization.id,
        groupId,
      });
      return { valid: false, isLate: false, deniedReason: 'NO_SCHEDULE' };
    }

    // Reuse the camera-path resolver first so overnight anchorDayOffset is known for holiday check
    const resolved = this.resolveTargetGroup(
      enrollments,
      at,
      timezone,
      opts.cameraLocation,
    );

    const holidayCheckDate = resolved.anchorDayOffset
      ? this.getOrganizationDateWithOffset(at, timezone, resolved.anchorDayOffset)
      : at;

    if (await this.isOrganizationHoliday(organization.id, holidayCheckDate, timezone)) {
      this.logger.warn('Schedule gate denied: organization holiday', {
        organizationId: organization.id,
        groupId,
      });
      return { valid: false, isLate: false, deniedReason: 'HOLIDAY' };
    }

    if (resolved.status !== 'MATCHED') {
      this.logger.warn('Schedule gate denied: no unambiguous schedule window', {
        organizationId: organization.id,
        studentId,
        groupId,
        status: resolved.status,
      });
      return {
        valid: false,
        isLate: false,
        deniedReason: 'NO_UNAMBIGUOUS_WINDOW',
      };
    }

    if (resolved.groupId !== groupId) {
      this.logger.warn('Schedule gate denied: resolved a different group', {
        organizationId: organization.id,
        studentId,
        groupId,
        resolvedGroupId: resolved.groupId,
      });
      return { valid: false, isLate: false, deniedReason: 'WRONG_GROUP' };
    }

    return { valid: true, isLate: resolved.isLate === true };
  }

  // =========================================================================
  // PUBLIC — SCHEDULE RESOLVER
  // =========================================================================

  /**
   * Strict schedule resolution with same-group multi-slot disambiguation.
   */
  public resolveTargetGroup(
    enrollments: Array<{
      groupId: string;
      group: {
        id: string;
        name: string;
        room: string | null;
        schedules: Array<{
          dayOfWeek: string;
          startTime: string;
          endTime: string;
          room: string | null;
        }>;
      };
    }>,
    now: Date,
    timezone: string | null | undefined,
    cameraLocation?: string | null,
  ): ResolvedGroup {
    const { dayOfWeek: currentDay, minutes: currentMinutes } =
      this.getLocalDateTime(now, timezone);

    const normalizedCameraLocation = this.normalizeLocation(cameraLocation);

    interface Candidate {
      groupId: string;
      groupName: string;
      room: string | null;
      schedule: {
        dayOfWeek: string;
        startTime: string;
        endTime: string;
        room: string | null;
      };
      startMinutes: number;
      endMinutes: number;
      minutesSinceStart: number;
      isCurrentlyRunning: boolean;
      isLate: boolean;
      anchorDayOffset: number;
    }

    const candidates: Candidate[] = [];

    for (const enrollment of enrollments) {
      for (const schedule of enrollment.group.schedules) {
        const startMinutes = this.parseTimeToMinutes(schedule.startTime);
        const endMinutes = this.parseTimeToMinutes(schedule.endTime);

        if (startMinutes === null || endMinutes === null) {
          this.logger.warn('Ignoring malformed schedule time', {
            groupId: enrollment.groupId,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
          });
          continue;
        }

        const isOvernight = endMinutes < startMinutes;
        const scheduleDay = schedule.dayOfWeek.toUpperCase();

        let matched = false;
        let anchorDayOffset = 0;
        let minutesSinceStart = 0;
        let isCurrentlyRunning = false;

        // Case 1 — schedule anchored TODAY.
        if (scheduleDay === currentDay) {
          if (!isOvernight) {
            const windowStart = startMinutes - SCHEDULE_GRACE_MINUTES;
            const windowEnd = endMinutes + SCHEDULE_GRACE_MINUTES;
            if (currentMinutes >= windowStart && currentMinutes <= windowEnd) {
              matched = true;
              anchorDayOffset = 0;
              minutesSinceStart = currentMinutes - startMinutes;
              isCurrentlyRunning =
                currentMinutes >= startMinutes && currentMinutes <= endMinutes;
            }
          } else {
            const windowStart = startMinutes - SCHEDULE_GRACE_MINUTES;
            if (currentMinutes >= windowStart) {
              matched = true;
              anchorDayOffset = 0;
              minutesSinceStart = currentMinutes - startMinutes;
              isCurrentlyRunning = currentMinutes >= startMinutes;
            }
          }
        }

        // Case 2 — schedule anchored YESTERDAY (overnight rollover into today).
        if (
          !matched &&
          isOvernight &&
          scheduleDay === DAY_BEFORE[currentDay]
        ) {
          const windowEnd = endMinutes + SCHEDULE_GRACE_MINUTES;
          if (currentMinutes <= windowEnd) {
            matched = true;
            anchorDayOffset = -1;
            minutesSinceStart =
              MINUTES_PER_DAY - startMinutes + currentMinutes;
            isCurrentlyRunning = currentMinutes <= endMinutes;
          }
        }

        // Case 3 — schedule anchored TOMORROW (early grace before midnight).
        if (!matched && scheduleDay === DAY_AFTER[currentDay]) {
          if (startMinutes - SCHEDULE_GRACE_MINUTES < 0) {
            const todayGraceStart =
              MINUTES_PER_DAY + (startMinutes - SCHEDULE_GRACE_MINUTES);
            if (currentMinutes >= todayGraceStart) {
              matched = true;
              anchorDayOffset = 1;
              minutesSinceStart = -(
                MINUTES_PER_DAY - currentMinutes + startMinutes
              );
              isCurrentlyRunning = false;
            }
          }
        }

        if (!matched) continue;

        candidates.push({
          groupId: enrollment.groupId,
          groupName: enrollment.group.name,
          room: this.normalizeOptional(enrollment.group.room),
          schedule: {
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            room: this.normalizeOptional(schedule.room),
          },
          startMinutes,
          endMinutes,
          minutesSinceStart,
          isCurrentlyRunning,
          isLate: minutesSinceStart > LATE_THRESHOLD_MINUTES,
          anchorDayOffset,
        });
      }
    }

    if (candidates.length === 0) {
      return { status: 'NO_MATCH', groupId: '' };
    }

    /**
     * When the SAME group has two back-to-back slots whose grace windows overlap,
     * pick the slot that is actively running right now, or closest to its start time.
     */
    const pickBestSlotForSameGroup = (list: Candidate[]): Candidate => {
      if (list.length === 1) return list[0];
      return [...list].sort((a, b) => {
        if (a.isCurrentlyRunning !== b.isCurrentlyRunning) {
          return a.isCurrentlyRunning ? -1 : 1;
        }
        return Math.abs(a.minutesSinceStart) - Math.abs(b.minutesSinceStart);
      })[0];
    };

    // Room matching is a strong signal when the camera location is known.
    if (normalizedCameraLocation) {
      const roomCandidates = candidates.filter((candidate) => {
        const scheduleRoom = this.normalizeLocation(candidate.schedule.room);
        const groupRoom = this.normalizeLocation(candidate.room);

        return (
          (scheduleRoom && scheduleRoom === normalizedCameraLocation) ||
          (groupRoom && groupRoom === normalizedCameraLocation)
        );
      });

      if (roomCandidates.length === 1) {
        return this.toMatched(roomCandidates[0]);
      }

      if (roomCandidates.length > 1) {
        const uniqueGroupIds = new Set(roomCandidates.map((c) => c.groupId));
        if (uniqueGroupIds.size === 1) {
          return this.toMatched(pickBestSlotForSameGroup(roomCandidates));
        }
        return { status: 'AMBIGUOUS', groupId: '' };
      }

      // Room mismatch fallback: accept ONLY when time uniquely identifies 1 group
      const uniqueFallbackIds = new Set(candidates.map((c) => c.groupId));
      if (uniqueFallbackIds.size === 1) {
        return this.toMatched(pickBestSlotForSameGroup(candidates));
      }

      return { status: 'NO_MATCH', groupId: '' };
    }

    // Without a camera location we can only match when there is 1 distinct group
    const uniqueGroupIds = new Set(candidates.map((c) => c.groupId));
    if (uniqueGroupIds.size === 1) {
      return this.toMatched(pickBestSlotForSameGroup(candidates));
    }

    return { status: 'AMBIGUOUS', groupId: '' };
  }

  private toMatched(candidate: {
    groupId: string;
    startMinutes: number;
    minutesSinceStart: number;
    isLate: boolean;
    anchorDayOffset: number;
  }): ResolvedGroup {
    return {
      status: 'MATCHED',
      groupId: candidate.groupId,
      startMinutes: candidate.startMinutes,
      minutesSinceStart: candidate.minutesSinceStart,
      isLate: candidate.isLate,
      anchorDayOffset: candidate.anchorDayOffset,
    };
  }

  // =========================================================================
  // PRIVATE — ATTENDANCE LOOKUP (Unified Lesson + Date/Group lookup)
  // =========================================================================

  /**
   * Finds any existing attendance row for this student on this lesson OR group+date.
   * Prevents split-brain duplicates when a MANUAL attendance row was created
   * with `lessonId = null` before a Lesson record was linked.
   */
  private async findExistingAttendance(
    tx: any,
    params: {
      studentId: string;
      groupId: string;
      attendanceDate: Date;
      lessonId?: string | null;
    },
  ): Promise<any | null> {
    if (params.lessonId) {
      if (tx.attendance.findUnique) {
        const byLesson = await tx.attendance.findUnique({
          where: {
            studentId_lessonId: {
              studentId: params.studentId,
              lessonId: params.lessonId,
            },
          },
        });
        if (byLesson) return byLesson;
      }
      if (tx.attendance.findFirst) {
        const byLessonOrDate = await tx.attendance.findFirst({
          where: {
            studentId: params.studentId,
            OR: [
              { lessonId: params.lessonId },
              {
                groupId: params.groupId,
                date: params.attendanceDate,
                lessonId: null,
              },
            ],
          },
        });
        if (byLessonOrDate) return byLessonOrDate;
      }
    }

    if (tx.attendance.findFirst) {
      const byGroupDate = await tx.attendance.findFirst({
        where: {
          studentId: params.studentId,
          groupId: params.groupId,
          date: params.attendanceDate,
          lessonId: null,
        },
      });
      if (byGroupDate) return byGroupDate;
    }

    if (tx.attendance.findUnique) {
      return tx.attendance.findUnique({
        where: {
          studentId_groupId_date: {
            studentId: params.studentId,
            groupId: params.groupId,
            date: params.attendanceDate,
          },
        },
      });
    }

    return null;
  }

  // =========================================================================
  // PRIVATE — DECISION EVENT (non-attendance paths)
  // =========================================================================

  private async persistDecisionEvent(params: {
    timezone?: string | null;
    anchorDayOffset?: number;
    organizationId: string;
    cameraId: string;
    studentId: string;
    groupId?: string | null;
    recognizedAt: Date;

    decision: AttendanceDecision;
    idempotencyKey: string;

    confidence?: number | null;
    similarityScore?: number | null;
    faceQuality?: number | null;

    cameraLocation?: string | null;
    cameraName?: string | null;
  }) {
    const evt = await this.prisma.$transaction((tx) =>
      this.recordDurableEvent(tx, {
        organizationId: params.organizationId,
        cameraId: params.cameraId,
        studentId: params.studentId,
        groupId: params.groupId ?? null,
        recognizedAt: params.recognizedAt,
        decision: params.decision,
        idempotencyKey: params.idempotencyKey,
        confidence: params.confidence,
        similarityScore: params.similarityScore,
        faceQuality: params.faceQuality,
        timezone: params.timezone,
        anchorDayOffset: params.anchorDayOffset,
      }),
    );

    return {
      decision: params.decision,
      message: DECISION_MESSAGES[params.decision],
      eventId: evt.id,
    };
  }

  // =========================================================================
  // PRIVATE — CONCURRENT DUPLICATE
  // =========================================================================

  private async resolveConcurrentDuplicate(params: {
    organizationId: string;
    cameraId: string;
    studentId: string;
    groupId: string;
    attendanceDate: Date;
    lessonId?: string | null;
    anchorDayOffset?: number;

    baseEvent: {
      timezone?: string | null;
      organizationId: string;
      cameraId: string;
      studentId: string;
      recognizedAt: Date;
      faceQuality?: number | null;
      confidence?: number | null;
      similarityScore?: number | null;
      cameraLocation?: string | null;
      cameraName?: string | null;
    };

    idempotencyKey: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const concurrentAttendance = await this.findExistingAttendance(tx, {
        studentId: params.studentId,
        groupId: params.groupId,
        attendanceDate: params.attendanceDate,
        lessonId: params.lessonId,
      });

      if (!concurrentAttendance) {
        throw new Error(
          'Attendance uniqueness conflict occurred but the concurrent attendance could not be resolved',
        );
      }

      const evt = await this.recordDurableEvent(tx, {
        ...params.baseEvent,
        anchorDayOffset: params.anchorDayOffset,
        groupId: params.groupId,
        attendanceId: concurrentAttendance.id,
        decision: 'DUPLICATE_PREVENTED',
        idempotencyKey: params.idempotencyKey,
      });

      return {
        decision: 'DUPLICATE_PREVENTED' as const,
        attendanceId: concurrentAttendance.id,
        groupId: params.groupId,
        message: 'Concurrent recognition resolved: attendance already recorded',
        eventId: evt.id,
      };
    });
  }

  // =========================================================================
  // PRIVATE — DURABLE EVENT
  // =========================================================================

  /**
   * Idempotent durable-event persistence.
   *
   * Safely handles same-bucket cooldown replays where frame #1 recorded
   * `RECORDED` and frame #2 (1 second later) attempts `DUPLICATE_PREVENTED`
   * on the exact same idempotencyKey and attendanceId.
   */
  private async recordDurableEvent(
    prisma: Pick<PrismaService, 'cameraAttendanceEvent'>,
    params: DurableEventParams,
  ): Promise<RecordedDurableEventResult> {
    const eventDate = this.getOrganizationDateWithOffset(
      params.recognizedAt,
      params.timezone,
      params.anchorDayOffset ?? 0,
    );

    try {
      const event = await prisma.cameraAttendanceEvent.upsert({
        where: {
          organizationId_idempotencyKey: {
            organizationId: params.organizationId,
            idempotencyKey: params.idempotencyKey,
          },
        },
        create: {
          organizationId: params.organizationId,
          cameraId: params.cameraId,
          studentId: params.studentId,
          groupId: params.groupId ?? null,
          recognizedAt: params.recognizedAt,
          date: eventDate,
          confidence: params.confidence ?? null,
          similarityScore: params.similarityScore ?? null,
          faceQuality: params.faceQuality ?? null,
          decision: params.decision,
          attendanceId: params.attendanceId ?? null,
          idempotencyKey: params.idempotencyKey,
        },
        // Idempotent: an existing event is never modified.
        update: {},
      });

      this.assertEventMatches(event, params);

      const reusedExisting =
        event.decision !== params.decision ||
        (event as { recognizedAt?: Date }).recognizedAt?.getTime() !==
          params.recognizedAt.getTime();

      return {
        id: event.id,
        decision: (event.decision as AttendanceDecision) ?? params.decision,
        attendanceId: event.attendanceId ?? params.attendanceId ?? null,
        reusedExisting,
      };
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.message.startsWith('Idempotency key conflict')
      ) {
        throw err;
      }

      this.logger.error('Failed to persist camera attendance event', {
        organizationId: params.organizationId,
        cameraId: params.cameraId,
        studentId: params.studentId,
        decision: params.decision,
        error: getErrorMessage(err),
      });

      throw err;
    }
  }

  private assertEventMatches(
    event: DurableEventShape,
    params: DurableEventParams,
  ): void {
    const studentMismatch = Boolean(
      event.studentId && event.studentId !== params.studentId,
    );
    const cameraMismatch = Boolean(
      event.cameraId && event.cameraId !== params.cameraId,
    );
    const groupMismatch = Boolean(
      params.groupId && event.groupId && event.groupId !== params.groupId,
    );

    // Legitimate Cooldown Replay: Frame 1 wrote `RECORDED` for this attendanceId,
    // and Frame 2 (within the same 5-minute bucket) hit `existingAttendance` and
    // passed `DUPLICATE_PREVENTED` for the exact same student/camera/group.
    const isBenignCooldownReplay =
      !studentMismatch &&
      !cameraMismatch &&
      !groupMismatch &&
      ((event.decision === 'RECORDED' &&
        params.decision === 'DUPLICATE_PREVENTED') ||
        (event.decision === 'DUPLICATE_PREVENTED' &&
          params.decision === 'RECORDED'));

    const decisionMismatch =
      !isBenignCooldownReplay &&
      Boolean(event.decision && event.decision !== params.decision);

    if (
      !decisionMismatch &&
      !studentMismatch &&
      !cameraMismatch &&
      !groupMismatch
    ) {
      return;
    }

    this.logger.error(
      'Idempotency key conflict: existing event attributes differ from incoming request',
      {
        organizationId: params.organizationId,
        idempotencyKey: params.idempotencyKey,
        existingId: event.id,
        existingDecision: event.decision,
        incomingDecision: params.decision,
      },
    );

    throw new Error(
      `Idempotency key conflict: event already exists with different attributes ` +
        `(existing decision: ${event.decision}, incoming decision: ${params.decision})`,
    );
  }

  // =========================================================================
  // PRIVATE — IDEMPOTENCY KEY
  // =========================================================================

  private buildIdempotencyKey(params: {
    organizationId: string;
    cameraId: string;
    studentId: string;
    groupId: string;
    recognizedAt: Date;
    timezone?: string | null;
    anchorDayOffset?: number;
  }): string {
    const bucket = Math.floor(
      params.recognizedAt.getTime() / (COOLDOWN_WINDOW_MINUTES * 60 * 1000),
    );

    const localDate = this.getOrganizationDateWithOffset(
      params.recognizedAt,
      params.timezone,
      params.anchorDayOffset ?? 0,
    );

    const raw = [
      params.organizationId,
      params.cameraId,
      params.studentId,
      params.groupId,
      localDate.toISOString().slice(0, 10),
      bucket.toString(),
    ].join(':');

    return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  // =========================================================================
  // PRIVATE — LESSON LINKAGE
  // =========================================================================

  /**
   * Resolve the Lesson row running for this group/date at `at`.
   * Applies ±SCHEDULE_GRACE_MINUTES so early arrivals (e.g. 10 min before class)
   * still link to the proper Lesson row when multiple lessons exist on the same date.
   */
  private async resolveLessonForAttendance(
    organizationId: string,
    groupId: string,
    date: Date,
    at: Date,
    timezone?: string | null,
  ): Promise<string | null> {
    try {
      if (!this.prisma.lesson?.findMany) return null;
      const lessons = await this.prisma.lesson.findMany({
        where: {
          organizationId,
          groupId,
          date,
          status: { not: 'CANCELLED' },
        },
        select: { id: true, startTime: true, endTime: true },
      });

      if (lessons.length === 0) return null;
      if (lessons.length === 1) return lessons[0].id;

      const minutes = this.getLocalDateTime(at, timezone).minutes;

      // 1. Exact running window
      const exactRunning = lessons.filter((lesson) => {
        const start = this.parseTimeToMinutes(lesson.startTime);
        const end = this.parseTimeToMinutes(lesson.endTime);
        if (start === null || end === null) return false;
        return start <= end
          ? minutes >= start && minutes <= end
          : minutes >= start || minutes <= end;
      });

      if (exactRunning.length === 1) return exactRunning[0].id;

      // 2. Grace-expanded window (±30 min) for early/late arrivals
      const graceMatching = lessons.filter((lesson) => {
        const start = this.parseTimeToMinutes(lesson.startTime);
        const end = this.parseTimeToMinutes(lesson.endTime);
        if (start === null || end === null) return false;
        const wStart = start - SCHEDULE_GRACE_MINUTES;
        const wEnd = end + SCHEDULE_GRACE_MINUTES;
        return start <= end
          ? minutes >= wStart && minutes <= wEnd
          : minutes >= wStart || minutes <= wEnd;
      });

      return graceMatching.length === 1 ? graceMatching[0].id : null;
    } catch (err: unknown) {
      this.logger.warn(
        'Failed to resolve lesson for camera attendance — continuing without lesson linkage',
        { organizationId, groupId, error: getErrorMessage(err) },
      );
      return null;
    }
  }

  // =========================================================================
  // PRIVATE — HOLIDAY
  // =========================================================================

  private async isOrganizationHoliday(
    organizationId: string,
    at: Date,
    timezone?: string | null,
  ): Promise<boolean> {
    try {
      const holidayDate = this.getOrganizationDate(at, timezone);

      const holiday = await this.prisma.organizationHoliday.findFirst({
        where: { organizationId, date: holidayDate },
        select: { id: true },
      });

      return holiday !== null;
    } catch (err: unknown) {
      this.logger.error('Holiday lookup failed; failing closed', {
        organizationId,
        error: getErrorMessage(err),
      });
      return true;
    }
  }

  // =========================================================================
  // PRIVATE — FINANCIAL GATE (Fail-Closed)
  // =========================================================================

  private async loadStudentFinancial(
    organizationId: string,
    studentId: string,
    preloadedBalance?: unknown,
  ): Promise<{ balance: number; outstanding: number; overdue: number } | null> {
    try {
      let balanceNum: number;

      if (preloadedBalance !== undefined && preloadedBalance !== null) {
        balanceNum = Number(preloadedBalance);
      } else {
        const student = await this.prisma.student.findFirst({
          where: { id: studentId, organizationId },
          select: { balance: true },
        });
        if (!student) return null;
        balanceNum = Number(student.balance);
      }

      const openInvoices = await this.prisma.invoice.findMany({
        where: {
          organizationId,
          studentId,
          status: { notIn: [...NON_BILLABLE_INVOICE_STATUSES] },
        },
        select: {
          status: true,
          total: true,
          paidAmount: true,
          refundedAmount: true,
          dueDate: true,
        },
      });

      const { overdue, outstanding } = computeInvoiceOutstanding(openInvoices);

      return {
        balance: Number.isFinite(balanceNum) ? balanceNum : 0,
        outstanding,
        overdue,
      };
    } catch (err: unknown) {
      this.logger.error('Financial gate lookup failed; failing closed', {
        organizationId,
        studentId,
        error: getErrorMessage(err),
      });
      return null;
    }
  }

  // =========================================================================
  // PRIVATE — CACHED TIMEZONE / DATE ENGINE
  // =========================================================================

  private isValidTimezone(tz?: string | null): boolean {
    if (!tz || typeof tz !== 'string') return false;
    const trimmed = tz.trim();
    if (!trimmed) return false;

    const cached = validTimezoneCache.get(trimmed);
    if (cached !== undefined) return cached;

    try {
      Intl.DateTimeFormat(undefined, { timeZone: trimmed });
      validTimezoneCache.set(trimmed, true);
      return true;
    } catch {
      this.logger.warn('Invalid timezone; falling back to UTC', {
        timezone: tz,
      });
      validTimezoneCache.set(trimmed, false);
      return false;
    }
  }

  private normalizeTimezone(timezone?: string | null): string {
    const trimmed = timezone?.trim();
    if (trimmed && this.isValidTimezone(trimmed)) return trimmed;
    return DEFAULT_TIMEZONE;
  }

  private getDateFormatter(tz: string): Intl.DateTimeFormat {
    let fmt = dateFormatterCache.get(tz);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      dateFormatterCache.set(tz, fmt);
    }
    return fmt;
  }

  private getDateTimeFormatter(tz: string): Intl.DateTimeFormat {
    let fmt = dateTimeFormatterCache.get(tz);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      dateTimeFormatterCache.set(tz, fmt);
    }
    return fmt;
  }

  private getOrganizationDate(date: Date, timezone?: string | null): Date {
    const tz = this.normalizeTimezone(timezone);
    const parts = this.getDateFormatter(tz).formatToParts(date);

    const year = this.getDatePart(parts, 'year');
    const month = this.getDatePart(parts, 'month');
    const day = this.getDatePart(parts, 'day');

    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  private getOrganizationDateWithOffset(
    date: Date,
    timezone?: string | null,
    dayOffset: number = 0,
  ): Date {
    const base = this.getOrganizationDate(date, timezone);
    if (dayOffset === 0) return base;

    return new Date(
      Date.UTC(
        base.getUTCFullYear(),
        base.getUTCMonth(),
        base.getUTCDate() + dayOffset,
      ),
    );
  }

  private getLocalDateTime(
    date: Date,
    timezone?: string | null,
  ): { dayOfWeek: string; minutes: number } {
    const tz = this.normalizeTimezone(timezone);
    const parts = this.getDateTimeFormatter(tz).formatToParts(date);

    const weekday =
      parts
        .find((part) => part.type === 'weekday')
        ?.value?.toUpperCase() ?? 'SUNDAY';

    let hour = Number(
      parts.find((part) => part.type === 'hour')?.value ?? 0,
    );
    const minute = Number(
      parts.find((part) => part.type === 'minute')?.value ?? 0,
    );

    if (hour === 24) hour = 0;

    return {
      dayOfWeek: weekday,
      minutes: hour * 60 + minute,
    };
  }

  private getDatePart(
    parts: Intl.DateTimeFormatPart[],
    type: 'year' | 'month' | 'day',
  ): string {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) {
      throw new Error(`Unable to resolve local date part: ${type}`);
    }
    return value;
  }

  // =========================================================================
  // PRIVATE — PARSING / NORMALIZATION
  // =========================================================================

  private parseTimeToMinutes(
    value: string | null | undefined,
  ): number | null {
    if (!value) return null;

    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
    if (!match) return null;

    return Number(match[1]) * 60 + Number(match[2]);
  }

  private normalizeLocation(value: string | null | undefined): string | null {
    const normalized = this.normalizeOptional(value);
    return normalized
      ? normalized.normalize('NFKC').replace(/\s+/g, ' ').toLowerCase()
      : null;
  }

  private normalizeOptional(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private assertScore(
    value: number | null | undefined,
    field: string,
  ): number | null {
    if (value === null || value === undefined) return null;

    if (!Number.isFinite(value)) {
      throw new Error(`${field} must be a finite number`);
    }

    if (value < 0 || value > 1) {
      throw new Error(`${field} must be between 0 and 1`);
    }

    return value;
  }

  private buildAttendanceNote(
    cameraName: string,
    cameraLocation: string | null,
  ): string {
    return cameraLocation
      ? `Auto-recorded by camera: ${cameraName} (${cameraLocation})`
      : `Auto-recorded by camera: ${cameraName}`;
  }

  private formatStudentName(
    user: { firstName: string | null; lastName: string | null } | null,
  ): string {
    if (!user) return "O'quvchi";

    return (
      [user.firstName, user.lastName]
        .filter((part): part is string => Boolean(part))
        .join(' ')
        .trim() || "O'quvchi"
    );
  }

  // =========================================================================
  // PRIVATE — VALIDATION
  // =========================================================================

  private validateRecognitionParams(params: RecognitionParams): void {
    if (!params.organizationId?.trim()) {
      throw new Error('organizationId is required');
    }
    if (!params.cameraId?.trim()) {
      throw new Error('cameraId is required');
    }
    if (!params.studentId?.trim()) {
      throw new Error('studentId is required');
    }
    if (
      !(params.recognizedAt instanceof Date) ||
      Number.isNaN(params.recognizedAt.getTime())
    ) {
      throw new Error('recognizedAt must be a valid Date');
    }
    if (params.recognizedAt.getTime() > Date.now() + MAX_FUTURE_DRIFT_MS) {
      throw new Error('recognizedAt cannot be significantly in the future');
    }

    this.assertScore(params.qualityScore, 'qualityScore');
    this.assertScore(params.confidence, 'confidence');
    this.assertScore(params.similarityScore, 'similarityScore');
  }

  // =========================================================================
  // PRIVATE — PRISMA ERROR HELPERS
  // =========================================================================

  private extractPrismaCode(err: unknown): string | undefined {
    if (typeof err !== 'object' || err === null || !('code' in err)) {
      return undefined;
    }
    const code = (err as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }

  private isAttendanceUniqueConstraintViolation(err: unknown): boolean {
    if (typeof err !== 'object' || err === null || !('code' in err)) {
      return false;
    }

    const e = err as {
      code?: unknown;
      meta?: { target?: unknown; modelName?: unknown };
    };

    if (e.code !== 'P2002') return false;
    if (!e.meta || typeof e.meta !== 'object') return false;

    if (typeof e.meta.modelName === 'string') {
      return e.meta.modelName === 'Attendance';
    }

    const target = e.meta.target;

    if (Array.isArray(target)) {
      const fields = target.map(String).map((s) => s.toLowerCase());
      const isLessonTarget = ATTENDANCE_LESSON_UNIQUE_TARGET.split('_').every(
        (part) => fields.some((f) => f.includes(part.toLowerCase())),
      );
      const isGroupDateTarget = ATTENDANCE_UNIQUE_TARGET.split('_').every(
        (part) => fields.some((f) => f.includes(part.toLowerCase())),
      );
      return isLessonTarget || isGroupDateTarget;
    }

    if (typeof target === 'string') {
      const lower = target.toLowerCase();
      return (
        lower.includes('attendance') ||
        lower.includes('lesson') ||
        lower.includes('studentid')
      );
    }

    return false;
  }

  // =========================================================================
  // PRIVATE — SIDE-EFFECT EMISSION
  // =========================================================================

  private publishAttendanceCreated(
    organizationId: string,
    payload: {
      attendanceId: string;
      studentId: string;
      groupId: string;
      status: 'PRESENT' | 'LATE';
      recognizedAt: Date;
    },
  ): void {
    if (!this.redisPubSub) return;

    this.redisPubSub
      .publish(ATTENDANCE_CREATED_EVENT, {
        organizationId,
        attendanceId: payload.attendanceId,
        studentId: payload.studentId,
        groupId: payload.groupId,
        status: payload.status,
        recognizedAt: payload.recognizedAt.toISOString(),
      })
      .catch((e: unknown) =>
        this.logger.warn('Failed to publish ATTENDANCE_CREATED_EVENT', {
          error: getErrorMessage(e),
        }),
      );
  }

  private emitAttendanceNotification(
    organizationId: string,
    payload: {
      attendanceId: string;
      studentId: string;
      studentName: string;
      status: 'PRESENT' | 'LATE';
      recognizedAt: Date;
    },
  ): void {
    if (!this.notificationEvents) return;

    this.notificationEvents
      .emit({
        organizationId,
        type: 'ATTENDANCE_MARKED_PRESENT',
        occurredAt: payload.recognizedAt.toISOString(),
        entityType: 'Attendance',
        entityId: payload.attendanceId,
        data: {
          studentId: payload.studentId,
          studentName: payload.studentName,
          status: payload.status,
        },
      })
      .catch((e: unknown) =>
        this.logger.warn(
          'Failed to emit ATTENDANCE_MARKED_PRESENT notification',
          { error: getErrorMessage(e) },
        ),
      );
  }
}