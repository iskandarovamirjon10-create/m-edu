/**
 * Recognition repository port — data access for recognition sessions,
 * attempts, and attendance records.
 */

import type { RecognitionSessionStatus, RecognitionAttemptStatus, AttendanceDecision } from '@medu/contracts';

export interface RecognitionSessionEntity {
  id: string;
  organizationId: string;
  deviceId: string | null;
  actorId: string | null;
  groupId: string | null;
  lessonId: string | null;
  status: RecognitionSessionStatus;
  startedAt: Date;
  endedAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecognitionAttemptEntity {
  id: string;
  organizationId: string;
  sessionId: string;
  identifiedStudentId: string | null;
  actorId: string | null;
  status: RecognitionAttemptStatus;
  confidence: number | null;
  qualityScore: number | null;
  livenessResult: string | null;
  similarityScore: number | null;
  processingTimeMs: number | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
  createdAt: Date;
}

export interface AttendanceRecordEntity {
  id: string;
  organizationId: string;
  studentId: string;
  groupId: string;
  lessonId: string | null;
  sessionId: string | null;
  decision: AttendanceDecision;
  recordedAt: Date;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface RecognitionRepository {
  // ---- Sessions ----
  createSession(data: {
    organizationId: string;
    deviceId?: string;
    actorId?: string;
    groupId?: string;
    lessonId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<RecognitionSessionEntity>;

  findSession(organizationId: string, id: string): Promise<RecognitionSessionEntity | null>;
  updateSessionStatus(organizationId: string, id: string, status: RecognitionSessionStatus, endedAt?: Date): Promise<void>;
  countActiveSessions(organizationId: string): Promise<number>;

  // ---- Attempts ----
  createAttempt(data: {
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
  }): Promise<RecognitionAttemptEntity>;

  listAttempts(organizationId: string, filters: {
    sessionId?: string;
    studentId?: string;
    status?: RecognitionAttemptStatus;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: RecognitionAttemptEntity[]; total: number }>;

  getSessionAttempts(
    organizationId: string,
    sessionId: string,
    pagination?: { page?: number | string; limit?: number | string },
  ): Promise<{ items: RecognitionAttemptEntity[]; total: number }>;

  // ---- Attendance ----
  createAttendance(data: {
    organizationId: string;
    studentId: string;
    groupId: string;
    lessonId?: string;
    sessionId?: string;
    recognitionAttemptId?: string;
    decision: AttendanceDecision;
    metadata?: Record<string, unknown>;
  }): Promise<AttendanceRecordEntity>;

  findExistingAttendance(
    organizationId: string,
    studentId: string,
    groupId: string,
    lessonId: string | null
  ): Promise<AttendanceRecordEntity | null>;

  /**
   * Schedule gate (audit P0-1).
   *
   * Must return true ONLY when the organization schedule permits attendance
   * for this student/group at this instant, and fail closed (false) on any
   * error, missing schedule, out-of-window time, ambiguous resolution or
   * organization holiday.
   *
   * Implementations resolve the timezone from the Organization row — the
   * caller must never pass a hardcoded timezone.
   */
  isWithinSchedule(
    organizationId: string,
    studentId: string,
    groupId: string,
    options?: { cameraLocation?: string | null; at?: Date }
  ): Promise<boolean>;

  listAttendance(organizationId: string, filters: {
    studentId?: string;
    groupId?: string;
    lessonId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    decision?: AttendanceDecision;
    page?: number;
    limit?: number;
  }): Promise<{ items: AttendanceRecordEntity[]; total: number }>;

  // ---- Analytics ----
  getRecognitionStats(organizationId: string, dateFrom: Date, dateTo: Date): Promise<{
    totalAttempts: number;
    successful: number;
    uncertain: number;
    failed: number;
    livenessFailures: number;
    qualityFailures: number;
    averageLatencyMs: number;
  }>;

  getAttendanceStats(organizationId: string, dateFrom: Date, dateTo: Date): Promise<{
    recorded: number;
    duplicatePrevented: number;
    notInGroup: number;
    lessonInvalid: number;
  }>;
}
