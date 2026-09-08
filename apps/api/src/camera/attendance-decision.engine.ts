import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

import { SecureLogger } from '@medu/face-security';

import { PrismaService } from '../prisma/prisma.service';
import { getErrorMessage } from '../lib/error';

/**
 * Input received from the camera/recognition worker.
 *
 * SECURITY:
 * - studentId is NOT trusted as proof of identity.
 * - The caller of this engine must already have completed the
 *   server-side recognition/authorization pipeline.
 * - organizationId/cameraId are additionally validated against
 *   persisted records before attendance is created.
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
  | 'DUPLICATE_PREVENTED';

interface ScheduleCandidate {
  groupId: string;
  groupName: string;
  room: string | null;
  schedule: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room: string | null;
  };
}

interface ResolvedGroup {
  groupId: string;
  status: 'MATCHED' | 'NO_MATCH' | 'AMBIGUOUS';
}

/**
 * AttendanceDecisionEngine
 *
 * Responsibilities:
 * 1. Validate recognition context.
 * 2. Validate student tenant ownership and active status.
 * 3. Resolve the correct academic group from the current schedule.
 * 4. Respect manual attendance as authoritative.
 * 5. Prevent duplicates/concurrent duplicate creation.
 * 6. Persist attendance + camera event atomically.
 * 7. Provide deterministic idempotency.
 *
 * This service deliberately does NOT silently guess a group.
 */
@Injectable()
export class AttendanceDecisionEngine {
  private readonly logger = new SecureLogger('info');

  /**
   * Camera recognition cooldown.
   *
   * Multiple frames from the same camera can recognize the same student
   * repeatedly. The event idempotency bucket prevents event duplication.
   */
  private readonly cooldownWindowMinutes = 5;

  /**
   * Schedule grace period.
   *
   * Recognition is accepted up to 30 minutes before/after the scheduled
   * lesson. This should remain a business rule, not a UI rule.
   */
  private readonly scheduleGraceMinutes = 30;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Main recognition → attendance decision pipeline.
   */
  async processRecognition(params: RecognitionParams) {
    this.validateRecognitionParams(params);

    const recognizedAt = new Date(params.recognizedAt.getTime());

    const organization = await this.prisma.organization.findUnique({
      where: {
        id: params.organizationId,
      },
      select: {
        id: true,
        timezone: true,
      },
    });

    if (!organization) {
      throw new Error('Recognition organization not found');
    }

    /**
     * Verify that the camera belongs to the same organization.
     *
     * This prevents cross-tenant/cross-organization camera references.
     */
    const camera = await this.prisma.camera.findFirst({
      where: {
        id: params.cameraId,
        organizationId: organization.id,
      },
      select: {
        id: true,
        name: true,
        location: true,
      },
    });

    if (!camera) {
      throw new Error('Recognition camera not found in organization');
    }

    const cameraLocation =
      this.normalizeOptional(params.cameraLocation) ??
      this.normalizeOptional(camera.location);

    const cameraName =
      this.normalizeOptional(params.cameraName) ??
      this.normalizeOptional(camera.name) ??
      'IP Camera';

    const student = await this.prisma.student.findFirst({
      where: {
        id: params.studentId,
        organizationId: organization.id,
        user: {
          isActive: true,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    const baseEvent = {
      organizationId: organization.id,
      cameraId: camera.id,
      studentId: params.studentId,
      recognizedAt,
      faceQuality: this.normalizeScore(params.qualityScore),
      confidence: this.normalizeScore(params.confidence),
      similarityScore: this.normalizeScore(params.similarityScore),
      cameraLocation,
      cameraName,
    };

    /**
     * Student is missing/inactive.
     */
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
        }),
      });
    }

    /**
     * Find active group memberships.
     */
    const enrollments = await this.prisma.studentGroup.findMany({
      where: {
        organizationId: organization.id,
        studentId: student.id,
        isActive: true,
      },
      select: {
        groupId: true,
        group: {
          select: {
            id: true,
            name: true,
            room: true,
            schedules: {
              where: {
                isActive: true,
              },
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
        }),
      });
    }

    /**
     * Resolve the group strictly from the schedule.
     *
     * IMPORTANT:
     * There is intentionally NO:
     *
     * return enrollments[0].groupId
     *
     * fallback.
     */
    const resolvedGroup = this.resolveTargetGroup(
      enrollments,
      recognizedAt,
      organization.timezone ?? 'UTC',
      cameraLocation,
    );

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
        }),
      });
    }

    const groupId = resolvedGroup.groupId;

    /**
     * IMPORTANT:
     *
     * `recognizedAt` is converted to the organization's local calendar
     * date rather than blindly using UTC calendar boundaries.
     */
    const attendanceDate = this.getOrganizationDate(
      recognizedAt,
      organization.timezone ?? 'UTC',
    );

    const idempotencyKey = this.buildIdempotencyKey({
      organizationId: organization.id,
      cameraId: camera.id,
      studentId: student.id,
      groupId,
      recognizedAt,
    });

    /**
     * Attendance + durable event must be atomic.
     *
     * If attendance is created but event persistence fails,
     * both operations roll back.
     */
    try {
      return await this.prisma.$transaction(
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

          /**
           * Manual attendance is authoritative.
           */
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

          /**
           * Create attendance.
           *
           * Database uniqueness remains the final concurrency guarantee.
           */
          const attendance = await tx.attendance.create({
            data: {
              organizationId: organization.id,
              studentId: student.id,
              groupId,
              date: attendanceDate,
              status: 'PRESENT',
              source: 'FACE',

              confidence: baseEvent.confidence,
              similarityScore: baseEvent.similarityScore,

              cameraId: camera.id,

              note: this.buildAttendanceNote(
                cameraName,
                cameraLocation,
              ),
            },
          });

          /**
           * Persist durable camera event in the SAME transaction.
           */
          const eventId = await this.recordDurableEvent(tx, {
            ...baseEvent,
            groupId,
            attendanceId: attendance.id,
            decision: 'RECORDED',
            idempotencyKey,
          });

          this.logger.info(
            'Automatic camera attendance successfully recorded',
            {
              organizationId: organization.id,
              studentId: student.id,
              groupId,
              attendanceId: attendance.id,
              cameraId: camera.id,
            },
          );

          return {
            decision: 'RECORDED' as const,
            attendanceId: attendance.id,
            groupId,
            message: 'Attendance successfully recorded',
            eventId,
          };
        },
        {
          /**
           * Keep the transaction short.
           *
           * No network calls, inference, camera operations or external
           * services occur inside this transaction.
           */
          maxWait: 5_000,
          timeout: 10_000,
        },
      );
    } catch (err: unknown) {
      const prismaCode = this.extractPrismaCode(err);

      /**
       * Another recognition request won the unique attendance race.
       *
       * Re-read the row and create a durable duplicate event.
       */
      if (prismaCode === 'P2002') {
        return this.resolveConcurrentDuplicate({
          organizationId: organization.id,
          cameraId: camera.id,
          studentId: student.id,
          groupId,
          recognizedAt,
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

  /**
   * Strict schedule resolution.
   *
   * Rules:
   *
   * 1. Student membership alone is NOT enough.
   * 2. Current day must match.
   * 3. Current time must fall within schedule + grace.
   * 4. If camera location exists, prefer matching room.
   * 5. Room matching still requires time matching.
   * 6. Multiple valid groups are ambiguous.
   * 7. Never randomly select the first enrollment.
   */
  private resolveTargetGroup(
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
    const localDateTime = this.getLocalDateTime(now, timezone);

    const currentDay = localDateTime.dayOfWeek;
    const currentMinutes = localDateTime.minutes;

    const normalizedCameraLocation =
      this.normalizeLocation(cameraLocation);

    const candidates: ScheduleCandidate[] = [];

    for (const enrollment of enrollments) {
      for (const schedule of enrollment.group.schedules) {
        if (schedule.dayOfWeek.toUpperCase() !== currentDay) {
          continue;
        }

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

        /**
         * Normal schedule.
         */
        let inTimeWindow: boolean;

        if (endMinutes >= startMinutes) {
          const windowStart =
            startMinutes - this.scheduleGraceMinutes;

          const windowEnd =
            endMinutes + this.scheduleGraceMinutes;

          inTimeWindow =
            currentMinutes >= windowStart &&
            currentMinutes <= windowEnd;
        } else {
          /**
           * Overnight schedule.
           *
           * Example:
           * 23:00 → 01:00
           */
          const windowStart =
            startMinutes - this.scheduleGraceMinutes;

          const windowEnd =
            endMinutes + this.scheduleGraceMinutes;

          inTimeWindow =
            currentMinutes >= windowStart ||
            currentMinutes <= windowEnd;
        }

        if (!inTimeWindow) {
          continue;
        }

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
        });
      }
    }

    if (candidates.length === 0) {
      return {
        status: 'NO_MATCH',
        groupId: '',
      };
    }

    /**
     * If camera location is known, room matching becomes a strong
     * disambiguation signal.
     */
    if (normalizedCameraLocation) {
      const roomCandidates = candidates.filter((candidate) => {
        const scheduleRoom = this.normalizeLocation(
          candidate.schedule.room,
        );

        const groupRoom = this.normalizeLocation(candidate.room);

        return (
          (scheduleRoom &&
            scheduleRoom === normalizedCameraLocation) ||
          (groupRoom &&
            groupRoom === normalizedCameraLocation)
        );
      });

      if (roomCandidates.length === 1) {
        return {
          status: 'MATCHED',
          groupId: roomCandidates[0].groupId,
        };
      }

      if (roomCandidates.length > 1) {
        const uniqueGroupIds = new Set(
          roomCandidates.map((candidate) => candidate.groupId),
        );

        if (uniqueGroupIds.size === 1) {
          return {
            status: 'MATCHED',
            groupId: roomCandidates[0].groupId,
          };
        }

        return {
          status: 'AMBIGUOUS',
          groupId: '',
        };
      }

      /**
       * Camera location was supplied but did not match a scheduled room.
       *
       * We deliberately do NOT use the first candidate because doing so
       * could assign attendance to the wrong classroom.
       *
       * If your business rule wants location to be only a preference,
       * change this branch explicitly and test it.
       */
      return {
        status: 'NO_MATCH',
        groupId: '',
      };
    }

    /**
     * No camera location.
     *
     * We can only safely match if exactly one distinct group is scheduled.
     */
    const uniqueGroupIds = new Set(
      candidates.map((candidate) => candidate.groupId),
    );

    if (uniqueGroupIds.size === 1) {
      return {
        status: 'MATCHED',
        groupId: candidates[0].groupId,
      };
    }

    return {
      status: 'AMBIGUOUS',
      groupId: '',
    };
  }

  /**
   * Persist a decision event outside the attendance creation path.
   *
   * This is used for decisions such as:
   * - inactive student
   * - no group
   * - no schedule
   * - ambiguous schedule
   *
   * These do not create Attendance rows.
   */
  private async persistDecisionEvent(params: {
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
    const eventId = await this.recordDurableEvent(this.prisma, {
      organizationId: params.organizationId,
      cameraId: params.cameraId,
      studentId: params.studentId,
      recognizedAt: params.recognizedAt,
      decision: params.decision,
      idempotencyKey: params.idempotencyKey,
      confidence: params.confidence,
      similarityScore: params.similarityScore,
      faceQuality: params.faceQuality,
    });

    const messages: Record<AttendanceDecision, string> = {
      RECORDED: 'Attendance successfully recorded',
      STUDENT_INACTIVE:
        'Student account is inactive or not found in organization',
      STUDENT_NOT_IN_GROUP:
        'Student is not actively enrolled in any group',
      NO_SCHEDULED_GROUP:
        'No scheduled class found for student at current time and location',
      AMBIGUOUS_SCHEDULE:
        'Multiple scheduled groups matched; attendance was not automatically assigned',
      MANUAL_PRESERVED:
        'Authoritative manual attendance preserved',
      DUPLICATE_PREVENTED:
        'Duplicate attendance prevented',
    };

    return {
      decision: params.decision,
      message: messages[params.decision],
      eventId,
    };
  }

  /**
   * Handles the race where another transaction created the attendance
   * between our existence check and create().
   */
  private async resolveConcurrentDuplicate(params: {
    organizationId: string;
    cameraId: string;
    studentId: string;
    groupId: string;
    recognizedAt: Date;
    attendanceDate: Date;

    baseEvent: {
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
    const concurrentAttendance =
      await this.prisma.attendance.findUnique({
        where: {
          studentId_groupId_date: {
            studentId: params.studentId,
            groupId: params.groupId,
            date: params.attendanceDate,
          },
        },
      });

    if (!concurrentAttendance) {
      /**
       * The P2002 did not correspond to the expected attendance
       * uniqueness constraint.
       *
       * Do not fabricate a duplicate result.
       */
      throw new Error(
        'Attendance uniqueness conflict occurred but the concurrent attendance could not be resolved',
      );
    }

    const eventId = await this.recordDurableEvent(this.prisma, {
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
      message:
        'Concurrent recognition resolved: attendance already recorded',
      eventId,
    };
  }

  /**
   * Durable event persistence.
   *
   * The generic Prisma client type is intentionally structural so this
   * method works with both PrismaService and transaction clients.
   */
  private async recordDurableEvent(
    prisma: Pick<PrismaService, 'cameraAttendanceEvent'>,
    params: DurableEventParams,
  ): Promise<string> {
    const eventDate = this.getOrganizationDate(
      params.recognizedAt,
      undefined,
    );

    try {
      const event =
        await prisma.cameraAttendanceEvent.upsert({
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
            similarityScore:
              params.similarityScore ?? null,
            faceQuality: params.faceQuality ?? null,

            decision: params.decision,
            attendanceId: params.attendanceId ?? null,

            idempotencyKey: params.idempotencyKey,
          },

          /**
           * Idempotent event:
           *
           * If another worker already persisted the same event,
           * do not modify it.
           */
          update: {},
        });

      return event.id;
    } catch (err: unknown) {
      this.logger.error(
        'Failed to persist camera attendance event',
        {
          organizationId: params.organizationId,
          cameraId: params.cameraId,
          studentId: params.studentId,
          decision: params.decision,
          error: getErrorMessage(err),
        },
      );

      /**
       * NEVER return a fabricated event ID.
       */
      throw err;
    }
  }

  /**
   * Build deterministic attendance event idempotency key.
   *
   * Canonical format:
   *
   * org
   * camera
   * student
   * group
   * local attendance date
   * cooldown bucket
   */
  private buildIdempotencyKey(params: {
    organizationId: string;
    cameraId: string;
    studentId: string;
    groupId: string;
    recognizedAt: Date;
  }): string {
    const bucket = Math.floor(
      params.recognizedAt.getTime() /
        (this.cooldownWindowMinutes * 60 * 1000),
    );

    const raw = [
      params.organizationId,
      params.cameraId,
      params.studentId,
      params.groupId,
      params.recognizedAt.toISOString().slice(0, 10),
      bucket.toString(),
    ].join(':');

    return crypto
      .createHash('sha256')
      .update(raw, 'utf8')
      .digest('hex');
  }

  /**
   * Organization-local calendar date.
   *
   * IMPORTANT:
   * This implementation uses Intl rather than manually adding a
   * fixed UTC offset, so DST-aware timezones work correctly.
   *
   * If your database stores attendance dates using a strict Date column
   * representing UTC midnight, the returned value is the UTC midnight
   * corresponding to the organization's local calendar date.
   */
  private getOrganizationDate(
    date: Date,
    timezone?: string | null,
  ): Date {
    const tz = timezone?.trim() || 'UTC';

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

    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
      ),
    );
  }

  /**
   * Returns organization-local weekday + minutes.
   */
  private getLocalDateTime(
    date: Date,
    timezone?: string | null,
  ): {
    dayOfWeek: string;
    minutes: number;
  } {
    const tz = timezone?.trim() || 'UTC';

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);

    const weekday =
      parts.find((part) => part.type === 'weekday')
        ?.value
        .toUpperCase() ?? 'SUNDAY';

    let hour = Number(
      parts.find((part) => part.type === 'hour')?.value ?? 0,
    );

    const minute = Number(
      parts.find((part) => part.type === 'minute')?.value ?? 0,
    );

    /**
     * Some Intl implementations may produce "24" for midnight
     * with certain locale/timezone combinations.
     */
    if (hour === 24) {
      hour = 0;
    }

    return {
      dayOfWeek: weekday,
      minutes: hour * 60 + minute,
    };
  }

  /**
   * Strict HH:mm parser.
   */
  private parseTimeToMinutes(
    value: string | null | undefined,
  ): number | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();

    const match =
      /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
        normalized,
      );

    if (!match) {
      return null;
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    return hour * 60 + minute;
  }

  private normalizeLocation(
    value: string | null | undefined,
  ): string | null {
    const normalized = this.normalizeOptional(value);

    return normalized
      ? normalized
          .normalize('NFKC')
          .replace(/\s+/g, ' ')
          .toLowerCase()
      : null;
  }

  private normalizeOptional(
    value: string | null | undefined,
  ): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();

    return normalized.length > 0
      ? normalized
      : null;
  }

  private normalizeScore(
    value: number | null | undefined,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (!Number.isFinite(value)) {
      return null;
    }

    /**
     * Recognition scores are expected to be 0..1.
     *
     * Do not silently clamp invalid values because doing so can hide
     * upstream biometric pipeline defects.
     */
    if (value < 0 || value > 1) {
      throw new Error(
        'Recognition score must be between 0 and 1',
      );
    }

    return value;
  }

  private buildAttendanceNote(
    cameraName: string,
    cameraLocation: string | null,
  ): string {
    if (cameraLocation) {
      return `Auto-recorded by camera: ${cameraName} (${cameraLocation})`;
    }

    return `Auto-recorded by camera: ${cameraName}`;
  }

  private validateRecognitionParams(
    params: RecognitionParams,
  ): void {
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
      throw new Error(
        'recognizedAt cannot be significantly in the future',
      );
    }

    this.normalizeScore(params.qualityScore);
    this.normalizeScore(params.confidence);
    this.normalizeScore(params.similarityScore);
  }

  private extractPrismaCode(
    err: unknown,
  ): string | undefined {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err
    ) {
      const code = (err as { code?: unknown }).code;

      return typeof code === 'string'
        ? code
        : undefined;
    }

    return undefined;
  }

  private getDatePart(
    parts: Intl.DateTimeFormatPart[],
    type: 'year' | 'month' | 'day',
  ): string {
    const value = parts.find(
      (part) => part.type === type,
    )?.value;

    if (!value) {
      throw new Error(
        `Unable to resolve local date part: ${type}`,
      );
    }

    return value;
  }
}