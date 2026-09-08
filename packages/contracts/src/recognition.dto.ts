import { z } from 'zod';
import type { RecognitionSessionStatus, RecognitionAttemptStatus, AttendanceDecision } from './enums';

// ============================================================================
// Request DTOs
// ============================================================================

export const CreateRecognitionSessionSchema = z.object({
  deviceId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateRecognitionSessionDto = z.infer<typeof CreateRecognitionSessionSchema>;

export const SubmitRecognitionAttemptSchema = z.object({
  /** Base64-encoded image frame from camera */
  imageBase64: z.string().min(1, 'Image data is required'),
  metadata: z.record(z.unknown()).optional(),
});
export type SubmitRecognitionAttemptDto = z.infer<typeof SubmitRecognitionAttemptSchema>;

export const FinishRecognitionSessionSchema = z.object({
  reason: z.enum(['COMPLETED', 'TIMEOUT', 'CANCELLED', 'ERROR']).default('COMPLETED'),
});
export type FinishRecognitionSessionDto = z.infer<typeof FinishRecognitionSessionSchema>;

export const RecognitionHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sessionId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: z.nativeEnum({
    IDENTIFIED: 'IDENTIFIED',
    UNIDENTIFIED: 'UNIDENTIFIED',
    ERROR: 'ERROR',
  }).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(['occurredAt', 'confidence', 'status']).default('occurredAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type RecognitionHistoryQueryDto = z.infer<typeof RecognitionHistoryQuerySchema>;

// ============================================================================
// Response DTOs
// ============================================================================

export interface RecognitionSessionResponseDto {
  id: string;
  organizationId: string;
  deviceId: string | null;
  actorId: string | null;
  groupId: string | null;
  group: { id: string; name: string } | null;
  lessonId: string | null;
  lesson: { id: string; startTime: string; endTime: string } | null;
  status: RecognitionSessionStatus;
  startedAt: string;
  endedAt: string | null;
  attemptCount: number;
  identifiedCount: number;
  createdAt: string;
}

export interface RecognitionAttemptResponseDto {
  id: string;
  sessionId: string;
  identifiedStudentId: string | null;
  identifiedStudent: {
    id: string;
    firstName: string;
    lastName: string;
    studentId: string | null;
  } | null;
  status: RecognitionAttemptStatus;
  confidence: number | null;
  qualityScore: number | null;
  livenessResult: string | null;
  similarityScore: number | null;
  processingTimeMs: number | null;
  occurredAt: string;
}

export interface RecognitionResultDto {
  /** The recognition attempt ID */
  attemptId: string;
  /** Whether a student was identified */
  identified: boolean;
  /** Student info if identified */
  student: { id: string; firstName: string; lastName: string } | null;
  /** Confidence category */
  confidenceCategory: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  /** Confidence score (0-1) */
  confidence: number;
  /** Liveness result */
  liveness: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'UNAVAILABLE';
  /** Quality score */
  qualityScore: number;
  /** Whether attendance was recorded */
  attendanceRecorded: boolean;
  /** Attendance decision if applicable */
  attendanceDecision: AttendanceDecision | null;
  /** Human-readable status message */
  message: string;
}

export interface RecognitionHistoryResponseDto {
  items: RecognitionAttemptResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
