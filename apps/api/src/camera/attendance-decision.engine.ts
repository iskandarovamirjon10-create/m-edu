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
   * Must be the SAME timezone that produced the Attendance row this event
   * refers to — otherwise a recognition between local midnight and the UTC
   * offset (05:00 for Asia/Tashkent) is dated one day earlier than its row.
   */
  timezone?: string | null;
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

type AttendanceDecision =
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
}

// ---------------------------------------------------------------------------
// CONSTANTS
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

const MINUTES_PER_DAY = 24 * 60;

const DEFAULT_TIMEZONE = 'UTC';

const ATTENDANCE_UNIQUE_TARGET = 'studentId_groupId_date';

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
  THURSDAY: 'FRIDAY',
  FRIDAY: 'SATURDAY',
  SATURDAY: 'SUNDAY',
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

// ---------------------------------------------------------------------------
// SERVICE
// ---------------------------------------------------------------------------

/**
 * AttendanceDecisionEngine
 *
 * 1. Validate recognition context.
 * 2. Validate student tenant ownership and active status.
 * 3. Resolve the correct academic group from the current schedule.
 * 4. Respect manual attendance as authoritative.
 * 5. Prevent duplicates/concurrent duplicate creation.
 * 6. Persist attendance + camera event atomically.
 * 7. Provide deterministic idempotency.
 *
 * Deliberately does NOT silently guess a group.
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

    const organization = await this.prisma.organization.findUnique({
      where: { id: params.organizationId },
      select: { id: true, timezone: true },
    });

    if (!organization) {
      throw new Error('Recognition organization not found');
    }

    // Verify the camera belongs to the same organization (cross-tenant guard).
    const camera = await this.prisma.camera.findFirst({
      where: {
        id: params.cameraId,
        organizationId: organization.id,
      },
      select: { id: true, name: true, location: true },
    });

    if (!camera) {
      throw new Error('Recognition camera not found in organization');
    }

    const cameraLocation = this.normalizeOptional(camera.location);
    const cameraName =
      this.normalizeOptional(camera.name) ??
      this.normalizeOptional(params.cameraName) ??
      'IP Camera';

    // Canonical eligibility: active user, not PAUSED/DROPPED.
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
      timezone: organization.timezone,
      cameraLocation,
      cameraName,
    };

    // ---- Student missing / inactive --------------------------------------
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
          timezone: organization.timezone,
        }),
      });
    }

    // ---- Active group memberships ----------------------------------------
    // Canonical membership window — identical to AttendanceService.markAttendance
    // and PrismaStudentAdapter.isStudentInGroup: membership active, group
    // active, joinedAt <= END of the org-local day, leftAt IS NULL or >= START.
    const membershipDayStart = this.getOrganizationDate(
      recognizedAt,
      organization.timezone,
    );

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
          timezone: organization.timezone,
        }),
      });
    }

    // ---- Resolve group strictly from the schedule ------------------------
    const resolvedGroup = this.resolveTargetGroup(
      enrollments,
      recognizedAt,
      organization.timezone ?? DEFAULT_TIMEZONE,
      cameraLocation,
    );

    // ---- Holiday gate ----------------------------------------------------
    // Resolved against the ORGANIZATION-LOCAL calendar date, shifted by the
    // schedule anchor (overnight classes belong to the anchor day).
    const holidayCheckDate = resolvedGroup.anchorDayOffset
      ? this.getOrganizationDateWithOffset(
          recognizedAt,
          organization.timezone,
          resolvedGroup.anchorDayOffset,
        )
      : recognizedAt;

    if (
      await this.isOrganizationHoliday(
        organization.id,
        holidayCheckDate,
        organization.timezone,
      )
    ) {
      return this.persistDecisionEvent({
        ...baseEvent,
        decision: 'HOLIDAY',
        idempotencyKey: this.buildIdempotencyKey({
          organizationId: organization.id,
          cameraId: camera.id,
          studentId: student.id,
          groupId: 'holiday',
          recognizedAt,
          timezone: organization.timezone,
          anchorDayOffset: resolvedGroup.anchorDayOffset,
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
          timezone: organization.timezone,
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
          timezone: organization.timezone,
        }),
      });
    }

    const groupId = resolvedGroup.groupId;

    // ---- Financial / overdue gate (parity with face-session path) -------
    // The face-session path (FaceService.processAttempt) denies entry when
    // the student has overdue invoices. The camera path MUST apply the same
    // business rule — otherwise an overdue student walks in through the
    // camera door but is blocked at the kiosk.
    //
    // FAIL-CLOSED: if the financial lookup fails, deny attendance rather
    // than silently recording for a potentially delinquent student.
    const financial = await this.loadStudentFinancial(
      organization.id,
      student.id,
    );

    if (financial && financial.overdue > 0) {
      return this.persistDecisionEvent({
        ...baseEvent,
        decision: 'INSUFFICIENT_FUNDS',
        idempotencyKey: this.buildIdempotencyKey({
          organizationId: organization.id,
          cameraId: camera.id,
          studentId: student.id,
          groupId,
          recognizedAt,
          timezone: organization.timezone,
          anchorDayOffset: resolvedGroup.anchorDayOffset,
        }),
      });
    }

    const attendanceDate = this.getOrganizationDateWithOffset(
      recognizedAt,
      organization.timezone ?? DEFAULT_TIMEZONE,
      resolvedGroup.anchorDayOffset ?? 0,
    );

    const idempotencyKey = this.buildIdempotencyKey({
      organizationId: organization.id,
      cameraId: camera.id,
      studentId: student.id,
      groupId,
      recognizedAt,
      timezone: organization.timezone,
      anchorDayOffset: resolvedGroup.anchorDayOffset,
    });

    // Enrichment only — never a gate. Resolve the Lesson row running for this
    // group/date; returns null when ambiguous.
    const linkedLessonId = await this.resolveLessonForAttendance(
      organization.id,
      groupId,
      attendanceDate,
      recognizedAt,
      organization.timezone,
    );

    // ---- Attendance + durable event — atomic -----------------------------
    try {
      const decisionResult = await this.prisma.$transaction(
        async (tx) => {
          const existingAttendance = await tx.attendance.findUnique({
            where: {
              studentId_groupId_date: {
                studentId: student.id,
                groupId,
                date: attendanceDate,
              },
            },
          });

          // Manual attendance is authoritative.
          if (existingAttendance) {
            if (existingAttendance.source === 'MANUAL') {
              const eventId = await this.recordDurableEvent(tx, {
                ...baseEvent,
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
                eventId,
              };
            }

            const eventId = await this.recordDurableEvent(tx, {
              ...baseEvent,
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
              eventId,
            };
          }

          const attendance = await tx.attendance.create({
            data: {
              organizationId: organization.id,
              studentId: student.id,
              groupId,
              date: attendanceDate,
              status: resolvedGroup.isLate ? 'LATE' : 'PRESENT',
              source: 'FACE',
              confidence: baseEvent.confidence,
              similarityScore: baseEvent.similarityScore,
              cameraId: camera.id,
              // null when no single lesson could be resolved — never guessed.
              lessonId: linkedLessonId,
              note: this.buildAttendanceNote(cameraName, cameraLocation),
            },
          });

          const eventId = await this.recordDurableEvent(tx, {
            ...baseEvent,
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
          });

          return {
            decision: 'RECORDED' as const,
            attendanceId: attendance.id,
            groupId,
            message: 'Attendance successfully recorded',
            eventId,
          };
        },
        { maxWait: 5_000, timeout: 10_000 },
      );

      // Side-effects OUTSIDE the transaction (best-effort, never blocking).
      if (
        decisionResult.decision === 'RECORDED' &&
        decisionResult.attendanceId
      ) {
        this.publishAttendanceCreated(organization.id, {
          attendanceId: decisionResult.attendanceId,
          studentId: student.id,
          groupId,
          recognizedAt,
        });

        this.emitAttendanceNotification(organization.id, {
          attendanceId: decisionResult.attendanceId,
          studentId: student.id,
          studentName: this.formatStudentName(student.user),
          recognizedAt,
        });
      }

      return decisionResult;
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

    // Organization timezone is authoritative — caller timezone is only a
    // fallback when the org has none configured.
    const timezone =
      organization.timezone?.trim() || opts.timezone?.trim() || DEFAULT_TIMEZONE;

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

    if (await this.isOrganizationHoliday(organization.id, at, timezone)) {
      this.logger.warn('Schedule gate denied: organization holiday', {
        organizationId: organization.id,
        groupId,
      });
      return { valid: false, isLate: false, deniedReason: 'HOLIDAY' };
    }

    // Reuse the camera-path resolver so both gates can never drift apart.
    const resolved = this.resolveTargetGroup(
      enrollments,
      at,
      timezone,
      opts.cameraLocation,
    );

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

    // The resolved group must be the group that attendance is about to be
    // written for — anything else means the wrong lesson would receive it.
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
   * Strict schedule resolution.
   *
   * 1. Student membership alone is NOT enough.
   * 2. Current local day must match (or anchor as previous/next day).
   * 3. Current local time must fall within schedule ± grace.
   * 4. Camera room is a strong disambiguation signal.
   * 5. Room matching still requires time matching.
   * 6. Multiple valid groups are ambiguous.
   * 7. Never randomly select the first enrollment.
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
      minutesSinceStart: number;
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

        // Case 1 — schedule anchored TODAY.
        if (scheduleDay === currentDay) {
          if (!isOvernight) {
            const windowStart = startMinutes - SCHEDULE_GRACE_MINUTES;
            const windowEnd = endMinutes + SCHEDULE_GRACE_MINUTES;
            if (
              currentMinutes >= windowStart &&
              currentMinutes <= windowEnd
            ) {
              matched = true;
              anchorDayOffset = 0;
              minutesSinceStart = currentMinutes - startMinutes;
            }
          } else {
            // Overnight schedule starting today: 23:00 → 01:00, arrival
            // permitted from 22:30 today.
            const windowStart = startMinutes - SCHEDULE_GRACE_MINUTES;
            if (currentMinutes >= windowStart) {
              matched = true;
              anchorDayOffset = 0;
              minutesSinceStart = currentMinutes - startMinutes;
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
          minutesSinceStart,
          isLate: minutesSinceStart > LATE_THRESHOLD_MINUTES,
          anchorDayOffset,
        });
      }
    }

    if (candidates.length === 0) {
      return { status: 'NO_MATCH', groupId: '' };
    }

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
        const uniqueGroupIds = new Set(
          roomCandidates.map((c) => c.groupId),
        );

        if (uniqueGroupIds.size === 1) {
          return this.toMatched(roomCandidates[0]);
        }

        return { status: 'AMBIGUOUS', groupId: '' };
      }

      // Room mismatch fallback: the camera location did not match any
      // candidate's room, but if there is EXACTLY ONE time-valid group,
      // the time signal is unambiguous and we accept it. This handles the
      // common case where a camera's location field is stale/incorrect but
      // the schedule still uniquely identifies the group.
      //
      // When multiple time-valid groups exist, room is the only
      // disambiguator — without it the result stays NO_MATCH (fail-closed).
      const uniqueFallbackIds = new Set(candidates.map((c) => c.groupId));
      if (uniqueFallbackIds.size === 1) {
        return this.toMatched(candidates[0]);
      }

      return { status: 'NO_MATCH', groupId: '' };
    }

    // Without a camera location we can only match exactly one distinct group.
    const uniqueGroupIds = new Set(candidates.map((c) => c.groupId));

    if (uniqueGroupIds.size === 1) {
      return this.toMatched(candidates[0]);
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
  // PRIVATE — DECISION EVENT (non-attendance paths)
  // =========================================================================

  /**
   * Persist a decision event outside the attendance creation path
   * (inactive student, no group, no schedule, ambiguous schedule, holiday).
   *
   * Wrapped in a transaction so the durable-event idempotency validation can
   * roll back its own write if a conflicting key exists.
   */
  private async persistDecisionEvent(params: {
    timezone?: string | null;
    organizationId: string;
    cameraId: string;
    studentId: string;
    recognizedAt: Date;

    decision: AttendanceDecision;
    idempotencyKey: string;

    confidence?: number | null;
    similarityScore?: number | null;
    faceQuality?: number | null;

    cameraLocation?: string | null;
    cameraName?: string | null;
  }) {
    const eventId = await this.prisma.$transaction((tx) =>
      this.recordDurableEvent(tx, {
        organizationId: params.organizationId,
        cameraId: params.cameraId,
        studentId: params.studentId,
        recognizedAt: params.recognizedAt,
        decision: params.decision,
        idempotencyKey: params.idempotencyKey,
        confidence: params.confidence,
        similarityScore: params.similarityScore,
        faceQuality: params.faceQuality,
        timezone: params.timezone,
      }),
    );

    return {
      decision: params.decision,
      message: DECISION_MESSAGES[params.decision],
      eventId,
    };
  }

  // =========================================================================
  // PRIVATE — CONCURRENT DUPLICATE
  // =========================================================================

  /**
   * Handles the race where another transaction created the attendance
   * between our existence check and create().
   *
   * The re-read and the durable-event write share ONE transaction so the
   * invariant "event.attendanceId points to a real attendance row" holds.
   */
  private async resolveConcurrentDuplicate(params: {
    organizationId: string;
    cameraId: string;
    studentId: string;
    groupId: string;
    attendanceDate: Date;

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
      const concurrentAttendance = await tx.attendance.findUnique({
        where: {
          studentId_groupId_date: {
            studentId: params.studentId,
            groupId: params.groupId,
            date: params.attendanceDate,
          },
        },
      });

      if (!concurrentAttendance) {
        // The P2002 did not correspond to the expected constraint —
        // never fabricate a duplicate result.
        throw new Error(
          'Attendance uniqueness conflict occurred but the concurrent attendance could not be resolved',
        );
      }

      const eventId = await this.recordDurableEvent(tx, {
        ...params.baseEvent,
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
        eventId,
      };
    });
  }

  // =========================================================================
  // PRIVATE — DURABLE EVENT
  // =========================================================================

  /**
   * Idempotent durable-event persistence.
   *
   * MUST be called inside a transaction when the caller cares about the
   * mismatch-throw rolling back its own write. The upsert is atomic, but
   * attribute validation happens after the write returns — a mismatch is
   * only safely undone inside a transaction.
   */
  private async recordDurableEvent(
    prisma: Pick<PrismaService, 'cameraAttendanceEvent'>,
    params: DurableEventParams,
  ): Promise<string> {
    const eventDate = this.getOrganizationDate(
      params.recognizedAt,
      params.timezone,
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
      return event.id;
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

      // Never return a fabricated event id.
      throw err;
    }
  }

  private assertEventMatches(
    event: DurableEventShape,
    params: DurableEventParams,
  ): void {
    const decisionMismatch = Boolean(
      event.decision && event.decision !== params.decision,
    );
    const studentMismatch = Boolean(
      event.studentId && event.studentId !== params.studentId,
    );
    const cameraMismatch = Boolean(
      event.cameraId && event.cameraId !== params.cameraId,
    );
    const groupMismatch = Boolean(
      params.groupId && event.groupId && event.groupId !== params.groupId,
    );

    if (!decisionMismatch && !studentMismatch && !cameraMismatch && !groupMismatch) {
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

  /**
   * Deterministic idempotency key.
   *
   * Canonical format: org | camera | student | group | local-date | bucket.
   */
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
   *
   * Returns an id ONLY when the answer is UNAMBIGUOUS — anything else
   * resolves to null. Lesson linkage is enrichment, never a gate on recording
   * attendance; lookup failures also resolve to null.
   */
  private async resolveLessonForAttendance(
    organizationId: string,
    groupId: string,
    date: Date,
    at: Date,
    timezone?: string | null,
  ): Promise<string | null> {
    try {
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

      const running = lessons.filter((lesson) => {
        const start = this.parseTimeToMinutes(lesson.startTime);
        const end = this.parseTimeToMinutes(lesson.endTime);

        if (start === null || end === null) return false;

        return start <= end
          ? minutes >= start && minutes <= end
          : minutes >= start || minutes <= end;
      });

      return running.length === 1 ? running[0].id : null;
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

  /**
   * True when the ORGANIZATION-LOCAL calendar date of `at` is a configured
   * OrganizationHoliday.
   *
   * Fails CLOSED on error: a lookup failure must not silently authorize
   * attendance on a holiday.
   */
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
  // PRIVATE — FINANCIAL GATE
  // =========================================================================

  /**
   * Load the student's overdue / outstanding amounts from open invoices.
   *
   * Uses the canonical `computeInvoiceOutstanding` formula shared with the
   * face-session path so both pipelines produce identical financial
   * verdicts. Returns null when the student does not belong to this
   * organization (fail-closed: caller treats null as "deny").
   */
  private async loadStudentFinancial(
    organizationId: string,
    studentId: string,
  ): Promise<{ balance: number; outstanding: number; overdue: number } | null> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
      select: { balance: true },
    });
    if (!student) return null;

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
      balance: Number(student.balance),
      outstanding,
      overdue,
    };
  }

  // =========================================================================
  // PRIVATE — TIMEZONE / DATE
  // =========================================================================

  private isValidTimezone(tz?: string | null): boolean {
    if (!tz || typeof tz !== 'string' || !tz.trim()) return false;

    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
      return true;
    } catch {
      // Intl throws a RangeError for unknown zones — log so misconfigured
      // organizations are visible instead of silently falling back to UTC.
      this.logger.warn('Invalid timezone; falling back to UTC', {
        timezone: tz,
      });
      return false;
    }
  }

  private normalizeTimezone(timezone?: string | null): string {
    const trimmed = timezone?.trim();
    if (trimmed && this.isValidTimezone(trimmed)) return trimmed;
    return DEFAULT_TIMEZONE;
  }

  /**
   * Organization-local calendar date, represented as UTC midnight.
   *
   * Uses Intl (not a fixed UTC offset) so DST-aware timezones work.
   */
  private getOrganizationDate(date: Date, timezone?: string | null): Date {
    const tz = this.normalizeTimezone(timezone);

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(date);
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

  /**
   * Organization-local weekday + minutes-since-midnight.
   */
  private getLocalDateTime(
    date: Date,
    timezone?: string | null,
  ): { dayOfWeek: string; minutes: number } {
    const tz = this.normalizeTimezone(timezone);

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);

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

    // Some Intl implementations emit "24" for midnight.
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

  /** Strict HH:mm parser. Returns null on malformed input. */
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

  /**
   * Validate a biometric score and return it (or null when absent).
   *
   * Scores must be in [0, 1]. Out-of-range values are client input errors,
   * not server faults — but they also indicate an upstream pipeline defect,
   * so they are surfaced as a hard failure rather than silently clamped.
   */
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
    if (params.recognizedAt.getTime() > Date.now() + 5_000) {
      throw new Error('recognizedAt cannot be significantly in the future');
    }

    // Validate every score here so a malformed value never reaches the DB.
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

  /**
   * True ONLY when `err` is a P2002 on the Attendance unique constraint.
   *
   * The previous fallback returned `true` whenever `meta` was missing, which
   * would treat unrelated P2002s (e.g. an idempotency-key collision on
   * CameraAttendanceEvent) as concurrent attendance duplicates.
   */
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
      // Attendance unique constraint is exactly (studentId, groupId, date).
      return ATTENDANCE_UNIQUE_TARGET.split('_').every((part) =>
        fields.some((f) => f.includes(part.toLowerCase())),
      );
    }

    if (typeof target === 'string') {
      return target.toLowerCase().includes('attendance');
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
      recognizedAt: Date;
    },
  ): void {
    if (!this.redisPubSub) return;

    // Pass a RAW payload — RedisPubSubService owns serialization (mixing raw
    // objects and pre-stringified JSON double-serializes downstream).
    this.redisPubSub
      .publish(ATTENDANCE_CREATED_EVENT, {
        organizationId,
        attendanceId: payload.attendanceId,
        studentId: payload.studentId,
        groupId: payload.groupId,
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
