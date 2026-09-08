import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { 
  RecognitionRepository, 
  RecognitionSessionEntity, 
  RecognitionAttemptEntity, 
  AttendanceRecordEntity 
} from '@medu/core/src/ports/recognition-repository.port';
import type { RecognitionSessionStatus, RecognitionAttemptStatus, AttendanceDecision } from '@medu/contracts';
import type { RecognitionSession, RecognitionAttempt, Prisma, Attendance } from '@prisma/client';
import { AttendanceStatus } from '@prisma/client';

interface AttendanceRowInput {
  id: string;
  organizationId: string;
  studentId: string;
  groupId: string;
  lessonId?: string | null;
  sessionId?: string | null;
  decision?: string;
  status?: string;
  recordedAt?: Date;
  date?: Date;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

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

@Injectable()
export class PrismaRecognitionAdapter implements RecognitionRepository {
  constructor(private readonly prisma: PrismaService) {}

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
      confidence: row.confidence ? Number(row.confidence) : null,
      qualityScore: row.qualityScore ? Number(row.qualityScore) : null,
      livenessResult: row.livenessResult,
      similarityScore: row.similarityScore ? Number(row.similarityScore) : null,
      processingTimeMs: row.processingTimeMs,
      metadata: row.metadata as Record<string, unknown> | null,
      occurredAt: row.occurredAt,
      createdAt: row.createdAt,
    };
  }

  private mapAttendanceEntity(row: AttendanceRowInput): AttendanceRecordEntity {
    return {
      id: row.id,
      organizationId: row.organizationId,
      studentId: row.studentId,
      groupId: row.groupId,
      lessonId: row.lessonId ?? null,
      sessionId: row.sessionId ?? null,
      decision: (row.decision ?? row.status) as AttendanceDecision,
      recordedAt: row.recordedAt ?? row.date ?? row.createdAt,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
    };
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
    return this.prisma.recognitionSession.count({
      where: { organizationId, status: 'STARTED' },
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
      },
    });
    return this.mapAttemptEntity(row);
  }

  async listAttempts(organizationId: string, filters: AttemptListFilters): Promise<{ items: RecognitionAttemptEntity[]; total: number }> {
    const where: Record<string, unknown> = { organizationId };
    if (filters.sessionId) where.sessionId = filters.sessionId;
    if (filters.studentId) where.identifiedStudentId = filters.studentId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.occurredAt = {};
      if (filters.dateFrom) (where.occurredAt as Record<string, Date>).gte = filters.dateFrom;
      if (filters.dateTo) (where.occurredAt as Record<string, Date>).lte = filters.dateTo;
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

  async getSessionAttempts(organizationId: string, sessionId: string): Promise<RecognitionAttemptEntity[]> {
    const rows = await this.prisma.recognitionAttempt.findMany({
      where: { organizationId, sessionId },
      orderBy: { occurredAt: 'desc' },
    });
    return rows.map(r => this.mapAttemptEntity(r));
  }

  // ---- Attendance ----

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
    const now = new Date();
    const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let row: Attendance;
    try {
      row = await this.prisma.attendance.create({
        data: {
          organizationId: data.organizationId,
          studentId: data.studentId,
          groupId: data.groupId,
          date: utcMidnight,
          status: AttendanceStatus.PRESENT,
          source: 'FACE_RECOGNITION',
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
        const existing = await this.prisma.attendance.findFirst({
          where: {
            organizationId: data.organizationId,
            studentId: data.studentId,
            groupId: data.groupId,
            date: {
              gte: utcMidnight,
              lt: new Date(utcMidnight.getTime() + 24 * 60 * 60 * 1000),
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
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) (where.date as Record<string, Date>).gte = filters.dateFrom;
      if (filters.dateTo) (where.date as Record<string, Date>).lte = filters.dateTo;
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
      occurredAt: { gte: dateFrom, lte: dateTo },
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
      createdAt: { gte: dateFrom, lte: dateTo },
    };

    const [_total, recorded] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.count({ where: { ...where, source: 'FACE_RECOGNITION' } }),
    ]);

    return {
      recorded,
      duplicatePrevented: 0,
      notInGroup: 0,
      lessonInvalid: 0,
    };
  }
}