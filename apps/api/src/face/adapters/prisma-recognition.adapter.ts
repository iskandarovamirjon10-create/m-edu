import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { 
  RecognitionRepository, 
  RecognitionSessionEntity, 
  RecognitionAttemptEntity, 
  AttendanceRecordEntity 
} from '@medu/core/src/ports/recognition-repository.port';
import type { RecognitionSessionStatus, RecognitionAttemptStatus } from '@medu/contracts';
import { AttendanceDecision } from '@medu/contracts';
import type { RecognitionSession, RecognitionAttempt, Prisma, Attendance } from '@prisma/client';
import { AttendanceStatus } from '@prisma/client';
import { startOfDay, endOfDayInclusive } from '../../common/date-range';

interface AttendanceRowInput {
  id: string;
  organizationId: string;
  studentId: string;
  groupId: string;
  lessonId?: string | null;
  sessionId?: string | null;
  decision?: string;
  status?: string;
  note?: string | null;
  recordedAt?: Date;
  date?: Date;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

const VALID_ATTENDANCE_DECISIONS = new Set<string>(Object.values(AttendanceDecision));

// Allowlist of columns that may be used in ORDER BY for recognition attempt
// queries. Without this, a caller-controlled `sortBy` flows into Prisma's
// orderBy key, which surfaces a 500 on invalid field names today.
const ALLOWED_ATTEMPT_SORT_FIELDS = new Set([
  'occurredAt',
  'createdAt',
  'confidence',
  'similarityScore',
  'processingTimeMs',
  'qualityScore',
]);

const ALLOWED_SORT_ORDERS = new Set(['asc', 'desc']);

interface AttemptListFilters {
  sessionId?: string;
  studentId?: string;
  status?: RecognitionAttemptStatus;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface AttendanceListFilters {
  studentId?: string;
  groupId?: string;
  lessonId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  decision?: AttendanceDecision;
  page?: number;
  limit?: number;
}

/**
 * Minimal structural view of the schedule gate so this adapter does not have
 * to import the camera module (audit P0-1).
 */
export interface ScheduleGate {
  validateGroupTime(
    organizationId: string,
    studentId: string,
    groupId: string,
    options?: { cameraLocation?: string | null; at?: Date }
  ): Promise<boolean>;

  /**
   * Optional (LATE parity): the same evaluation as validateGroupTime but
   * returning the LATE detail too, so face-session rows get the SAME
   * PRESENT/LATE semantics the camera path applies.
   */
  describeGroupTime?(
    organizationId: string,
    studentId: string,
    groupId: string,
    options?: { cameraLocation?: string | null; at?: Date }
  ): Promise<{ valid: boolean; isLate: boolean }>;
}

@Injectable()
export class PrismaRecognitionAdapter implements RecognitionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleGate?: ScheduleGate,
  ) {}

  /**
   * Schedule gate (audit P0-1).
   *
   * Delegates to the single AttendanceDecisionEngine implementation so the
   * face-session path and the camera path can never diverge.
   *
   * FAILS CLOSED when no gate was injected: an adapter without a schedule
   * gate must never authorize attendance.
   */
  async isWithinSchedule(
    organizationId: string,
    studentId: string,
    groupId: string,
    options?: { cameraLocation?: string | null; at?: Date }
  ): Promise<boolean> {
    if (!this.scheduleGate) {
      return false;
    }

    return this.scheduleGate.validateGroupTime(
      organizationId,
      studentId,
      groupId,
      options
    );
  }


  /**
   * Organization-local calendar date (stored as UTC midnight of the local
   * day). MUST match AttendanceDecisionEngine.getOrganizationDate so the
   * camera path and this session path never split one local day across two
   * rows (P0 timezone divergence).
   */
  private async getOrganizationLocalDate(organizationId: string, at: Date = new Date()): Promise<Date> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const tz = org?.timezone?.trim() || process.env.DEFAULT_TIMEZONE || 'Asia/Tashkent';

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(at);

    const get = (type: 'year' | 'month' | 'day') => {
      const value = parts.find((p) => p.type === type)?.value;
      if (!value) throw new Error(`Unable to resolve local date part: ${type}`);
      return Number(value);
    };

    return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  }

  private mapSessionEntity(row: RecognitionSession): RecognitionSessionEntity {
    return {
      id: row.id,
      organizationId: row.organizationId,
      deviceId: row.deviceId,
      actorId: row.actorId,
      groupId: row.groupId,
      lessonId: row.lessonId,
      status: row.status as RecognitionSessionStatus,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapAttemptEntity(row: RecognitionAttempt): RecognitionAttemptEntity {
    return {
      id: row.id,
      organizationId: row.organizationId,
      sessionId: row.sessionId,
      identifiedStudentId: row.identifiedStudentId,
      actorId: row.actorId,
      status: row.status as RecognitionAttemptStatus,
      // `0` is a legitimate score (orthogonal embedding / zero quality), so
      // only null/undefined may be mapped to null. The previous truthiness
      // check (`row.confidence ? … : null`) silently turned a real 0 into null.
      confidence: row.confidence !== null && row.confidence !== undefined ? Number(row.confidence) : null,
      qualityScore: row.qualityScore !== null && row.qualityScore !== undefined ? Number(row.qualityScore) : null,
      livenessResult: row.livenessResult,
      similarityScore: row.similarityScore !== null && row.similarityScore !== undefined ? Number(row.similarityScore) : null,
      processingTimeMs: row.processingTimeMs,
      metadata: row.metadata as Record<string, unknown> | null,
      occurredAt: row.occurredAt,
      createdAt: row.createdAt,
    };
  }

  private mapAttendanceEntity(row: AttendanceRowInput): AttendanceRecordEntity {
    // `Attendance.status` is an AttendanceStatus (PRESENT/LATE/...), NOT an
    // AttendanceDecision. Never alias it — resolve a genuine decision instead.
    const decision = this.resolveAttendanceDecision(row);
    return {
      id: row.id,
      organizationId: row.organizationId,
      studentId: row.studentId,
      groupId: row.groupId,
      lessonId: row.lessonId ?? null,
      sessionId: row.sessionId ?? null,
      decision,
      recordedAt: row.recordedAt ?? row.date ?? row.createdAt,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
    };
  }

  /**
   * Resolve a valid AttendanceDecision for an Attendance row. FACE writes
   * persist the pipeline decision both explicitly (createAttendance) and in
   * the `note` JSON; anything else that produced a real attendance row is by
   * definition RECORDED.
   */
  private resolveAttendanceDecision(row: AttendanceRowInput): AttendanceDecision {
    if (row.decision && VALID_ATTENDANCE_DECISIONS.has(row.decision)) {
      return row.decision as AttendanceDecision;
    }

    if (row.note) {
      try {
        const parsed = JSON.parse(row.note) as { decision?: unknown };
        if (typeof parsed?.decision === 'string' && VALID_ATTENDANCE_DECISIONS.has(parsed.decision)) {
          return parsed.decision as AttendanceDecision;
        }
      } catch {
        // Malformed / non-JSON note — fall through to the default.
      }
    }

    return AttendanceDecision.RECORDED;
  }

  // ---- Sessions ----

  async createSession(data: {
    organizationId: string;
    deviceId?: string;
    actorId?: string;
    groupId?: string;
    lessonId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<RecognitionSessionEntity> {
    const row = await this.prisma.recognitionSession.create({
      data: {
        organizationId: data.organizationId,
        deviceId: data.deviceId,
        actorId: data.actorId,
        groupId: data.groupId,
        lessonId: data.lessonId,
        status: 'STARTED',
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
      },
    });
    return this.mapSessionEntity(row);
  }

  async findSession(organizationId: string, id: string): Promise<RecognitionSessionEntity | null> {
    const row = await this.prisma.recognitionSession.findFirst({
      where: { id, organizationId },
    });
    return row ? this.mapSessionEntity(row) : null;
  }

  async updateSessionStatus(organizationId: string, id: string, status: RecognitionSessionStatus, endedAt?: Date): Promise<void> {
    await this.prisma.recognitionSession.update({
      where: { id, organizationId },
      data: {
        status,
        ...(endedAt && { endedAt }),
      },
    });
  }

  async countActiveSessions(organizationId: string): Promise<number> {
    // ACTIVE = any session that has NOT reached a terminal state.
    // STARTED and IN_PROGRESS both consume the concurrent-session budget;
    // counting only STARTED let IN_PROGRESS sessions bypass the limit
    // (they transition to IN_PROGRESS on the first attempt).
    //
    // Per the business rule: FINISHED and CANCELLED are the ONLY terminal
    // states that release budget. ERROR is still counted so a crashed
    // session cannot silently free a slot while its camera is reconnecting.
    return this.prisma.recognitionSession.count({
      where: {
        organizationId,
        status: { notIn: ['FINISHED', 'CANCELLED'] },
      },
    });
  }

  // ---- Attempts ----

  async createAttempt(data: {
    organizationId: string;
    sessionId: string;
    identifiedStudentId?: string;
    actorId?: string;
    status: RecognitionAttemptStatus;
    confidence?: number;
    qualityScore?: number;
    livenessResult?: string;
    similarityScore?: number;
    processingTimeMs?: number;
    metadata?: Record<string, unknown>;
    clientAttemptId?: string | null;
  }): Promise<RecognitionAttemptEntity> {
    const row = await this.prisma.recognitionAttempt.create({
      data: {
        organizationId: data.organizationId,
        sessionId: data.sessionId,
        identifiedStudentId: data.identifiedStudentId,
        actorId: data.actorId,
        status: data.status,
        confidence: data.confidence,
        qualityScore: data.qualityScore,
        livenessResult: data.livenessResult,
        similarityScore: data.similarityScore,
        processingTimeMs: data.processingTimeMs,
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
        clientAttemptId: data.clientAttemptId ?? null,
      },
    });
    return this.mapAttemptEntity(row);
  }

  async updateAttemptOutcome(
    organizationId: string,
    attemptId: string,
    outcome: {
      attendanceDecision?: string | null;
      attendanceId?: string | null;
    },
  ): Promise<void> {
    await this.prisma.recognitionAttempt.updateMany({
      where: { id: attemptId, organizationId },
      data: {
        ...(outcome.attendanceDecision !== undefined && {
          attendanceDecision: outcome.attendanceDecision,
        }),
        ...(outcome.attendanceId !== undefined && {
          attendanceId: outcome.attendanceId,
        }),
      },
    });
  }

  async listAttempts(organizationId: string, filters: AttemptListFilters): Promise<{ items: RecognitionAttemptEntity[]; total: number }> {
    const where: Record<string, unknown> = { organizationId };
    if (filters.sessionId) where.sessionId = filters.sessionId;
    if (filters.studentId) where.identifiedStudentId = filters.studentId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.occurredAt = {};
      if (filters.dateFrom) (where.occurredAt as Record<string, Date>).gte = startOfDay(filters.dateFrom);
      if (filters.dateTo) (where.occurredAt as Record<string, Date>).lte = endOfDayInclusive(filters.dateTo);
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(Math.max(1, Number(filters.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const sortBy = ALLOWED_ATTEMPT_SORT_FIELDS.has(filters.sortBy ?? '') ? filters.sortBy! : 'occurredAt';
    const sortOrder = ALLOWED_SORT_ORDERS.has(filters.sortOrder ?? '') ? filters.sortOrder! : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.recognitionAttempt.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip,
      }),
      this.prisma.recognitionAttempt.count({ where }),
    ]);

    return {
      items: rows.map(r => this.mapAttemptEntity(r)),
      total,
    };
  }

  async getSessionAttempts(
    organizationId: string,
    sessionId: string,
    pagination?: { page?: number | string; limit?: number | string },
  ): Promise<{ items: RecognitionAttemptEntity[]; total: number }> {
    const page = Math.max(1, Number(pagination?.page) || 1);
    const limit = Math.min(Math.max(1, Number(pagination?.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.recognitionAttempt.findMany({
        where: { organizationId, sessionId },
        orderBy: { occurredAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.recognitionAttempt.count({
        where: { organizationId, sessionId },
      }),
    ]);

    return {
      items: rows.map(r => this.mapAttemptEntity(r)),
      total,
    };
  }

  // ---- Attendance ----

  /**
   * P2 (LATE parity): the camera path marks LATE when a student arrives
   * beyond the schedule grace window, while the face-session path used to
   * hardcode PRESENT for every row. Both now ask the SAME engine.
   *
   * Fails open to PRESENT: a gate hiccup must never block recording an
   * attendance the schedule gate has already approved.
   */
  private async resolveAttendanceStatus(
    organizationId: string,
    studentId: string,
    groupId: string,
  ): Promise<AttendanceStatus> {
    if (typeof this.scheduleGate?.describeGroupTime !== 'function') {
      return AttendanceStatus.PRESENT;
    }

    try {
      const evaluation = await this.scheduleGate.describeGroupTime(
        organizationId,
        studentId,
        groupId,
      );

      return evaluation?.valid && evaluation.isLate
        ? AttendanceStatus.LATE
        : AttendanceStatus.PRESENT;
    } catch {
      return AttendanceStatus.PRESENT;
    }
  }

  async createAttendance(data: {
    organizationId: string;
    studentId: string;
    groupId: string;
    lessonId?: string;
    sessionId?: string;
    recognitionAttemptId?: string;
    decision: AttendanceDecision;
    metadata?: Record<string, unknown>;
  }): Promise<AttendanceRecordEntity> {
    const attendanceDate = await this.getOrganizationLocalDate(data.organizationId);
    const status = await this.resolveAttendanceStatus(
      data.organizationId,
      data.studentId,
      data.groupId,
    );

    let row: Attendance;
    try {
      row = await this.prisma.attendance.create({
        data: {
          organizationId: data.organizationId,
          studentId: data.studentId,
          groupId: data.groupId,
          lessonId: data.lessonId ?? null,
          date: attendanceDate,
          status,
          source: 'FACE',
          recognitionAttemptId: data.recognitionAttemptId,
          note: JSON.stringify({
            decision: data.decision,
            lessonId: data.lessonId,
            sessionId: data.sessionId,
            metadata: data.metadata,
          }),
        },
      });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
        const dayEnd = new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000);
        const existing = await this.prisma.attendance.findFirst({
          where: {
            organizationId: data.organizationId,
            studentId: data.studentId,
            groupId: data.groupId,
            date: {
              gte: attendanceDate,
              lt: dayEnd,
            },
          },
        });
        if (existing) {
          return this.mapAttendanceEntity({
            id: existing.id,
            organizationId: existing.organizationId,
            studentId: existing.studentId,
            groupId: existing.groupId,
            createdAt: existing.createdAt,
            decision: 'DUPLICATE_PREVENTED',
            sessionId: data.sessionId,
            lessonId: data.lessonId,
            metadata: data.metadata,
            recordedAt: existing.createdAt,
          });
        }
      }
      throw error;
    }
    return this.mapAttendanceEntity({
      id: row.id,
      organizationId: row.organizationId,
      studentId: row.studentId,
      groupId: row.groupId,
      createdAt: row.createdAt,
      decision: data.decision,
      sessionId: data.sessionId,
      lessonId: data.lessonId,
      metadata: data.metadata,
      recordedAt: row.createdAt,
    });
  }

  async findExistingAttendance(
    organizationId: string,
    studentId: string,
    groupId: string,
    _lessonId: string | null
  ): Promise<AttendanceRecordEntity | null> {
    const dayStart = await this.getOrganizationLocalDate(organizationId);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const row = await this.prisma.attendance.findFirst({
      where: {
        organizationId,
        studentId,
        groupId,
        date: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
    });
    return row ? this.mapAttendanceEntity(row) : null;
  }

  async listAttendance(organizationId: string, filters: AttendanceListFilters): Promise<{ items: AttendanceRecordEntity[]; total: number }> {
    const where: Record<string, unknown> = { organizationId };
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.groupId) where.groupId = filters.groupId;
    if (filters.lessonId) where.lessonId = filters.lessonId;
    if (filters.decision) {
      // `decision` is the pipeline outcome stored on CameraAttendanceEvent,
      // NOT a column on Attendance. Resolve matching attendance rows through
      // the event table so this filter is REAL (never silently ignored),
      // scoped by the caller's organization for tenant isolation.
      const eventRows = await this.prisma.cameraAttendanceEvent.findMany({
        where: {
          organizationId,
          decision: filters.decision as string,
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
        return { items: [], total: 0 };
      }
      where.id = { in: attendanceIds };
    }
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) (where.date as Record<string, Date>).gte = startOfDay(filters.dateFrom);
      if (filters.dateTo) (where.date as Record<string, Date>).lte = endOfDayInclusive(filters.dateTo);
    }

    const [rows, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(filters.limit && { take: filters.limit }),
        ...(filters.limit && filters.page && { skip: (filters.page - 1) * filters.limit }),
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      items: rows.map(r => this.mapAttendanceEntity(r)),
      total,
    };
  }

  // ---- Analytics ----

  async getRecognitionStats(organizationId: string, dateFrom: Date, dateTo: Date): Promise<{
    totalAttempts: number;
    successful: number;
    uncertain: number;
    failed: number;
    livenessFailures: number;
    qualityFailures: number;
    averageLatencyMs: number;
  }> {
    const where = {
      organizationId,
      occurredAt: { gte: startOfDay(dateFrom), lte: endOfDayInclusive(dateTo) },
    };

    const [totalAttempts, successful, uncertain, failed, livenessFailures, qualityFailures, avgLatencyResult] = await Promise.all([
      this.prisma.recognitionAttempt.count({ where }),
      this.prisma.recognitionAttempt.count({ where: { ...where, status: 'IDENTIFIED' } }),
      this.prisma.recognitionAttempt.count({ where: { ...where, status: 'MATCH_UNCERTAIN' } }),
      this.prisma.recognitionAttempt.count({ where: { ...where, status: 'MATCH_NOT_FOUND' } }),
      this.prisma.recognitionAttempt.count({ where: { ...where, status: 'LIVENESS_FAILED' } }),
      this.prisma.recognitionAttempt.count({ where: { ...where, status: 'QUALITY_FAILED' } }),
      this.prisma.recognitionAttempt.aggregate({
        where: { ...where, processingTimeMs: { not: null } },
        _avg: { processingTimeMs: true },
      }),
    ]);

    return {
      totalAttempts,
      successful,
      uncertain,
      failed,
      livenessFailures,
      qualityFailures,
      averageLatencyMs: avgLatencyResult._avg.processingTimeMs ? Math.round(Number(avgLatencyResult._avg.processingTimeMs)) : 0,
    };
  }

  async getAttendanceStats(organizationId: string, dateFrom: Date, dateTo: Date): Promise<{
    recorded: number;
    duplicatePrevented: number;
    notInGroup: number;
    lessonInvalid: number;
  }> {
    const where = {
      organizationId,
      createdAt: { gte: startOfDay(dateFrom), lte: endOfDayInclusive(dateTo) },
    };

    const [recorded, duplicatePrevented, notInGroup, lessonInvalid] = await Promise.all([
      // Accept both the canonical 'FACE' source and the legacy
      // 'FACE_RECOGNITION' rows written by older builds.
      this.prisma.attendance.count({
        where: { ...where, source: { in: ['FACE', 'FACE_RECOGNITION'] } },
      }),
      // Non-recorded outcomes never create an Attendance row: they live on the
      // CameraAttendanceEvent pipeline, so count them from `decision`.
      this.prisma.cameraAttendanceEvent.count({
        where: { ...where, decision: AttendanceDecision.DUPLICATE_PREVENTED },
      }),
      this.prisma.cameraAttendanceEvent.count({
        where: { ...where, decision: AttendanceDecision.STUDENT_NOT_IN_GROUP },
      }),
      this.prisma.cameraAttendanceEvent.count({
        where: { ...where, decision: AttendanceDecision.LESSON_INVALID },
      }),
    ]);

    return {
      recorded,
      duplicatePrevented,
      notInGroup,
      lessonInvalid,
    };
  }
}
