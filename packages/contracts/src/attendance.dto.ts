import { z } from 'zod';
import type { AttendanceDecision } from './enums';

// ============================================================================
// Request DTOs
// ============================================================================

export const AttendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  studentId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  decision: z.nativeEnum({
    RECORDED: 'RECORDED',
    DUPLICATE_PREVENTED: 'DUPLICATE_PREVENTED',
  }).optional(),
});
export type AttendanceQueryDto = z.infer<typeof AttendanceQuerySchema>;

// ============================================================================
// Response DTOs
// ============================================================================

export interface AttendanceRecordResponseDto {
  id: string;
  organizationId: string;
  studentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentId: string | null;
  };
  groupId: string;
  group: { id: string; name: string };
  lessonId: string | null;
  sessionId: string | null;
  decision: AttendanceDecision;
  recordedAt: string;
  createdAt: string;
}

export interface AttendanceListResponseDto {
  items: AttendanceRecordResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AttendanceAnalyticsDto {
  totalAttempts: number;
  successfulRecognitions: number;
  uncertainRecognitions: number;
  failedRecognitions: number;
  attendanceRecorded: number;
  duplicatePrevented: number;
  livenessFailures: number;
  qualityFailures: number;
  attendanceRate: number;
  byDate: Array<{ date: string; attempts: number; recognized: number; attended: number }>;
  byGroup: Array<{ groupId: string; groupName: string; attempts: number; recognized: number; attended: number }>;
}
