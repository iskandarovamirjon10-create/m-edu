/**
 * Attendance domain models and analytics.
 */

import type { Student } from './students';
import type { Group } from './academics';

export { AttendanceDecision } from '@medu/contracts';
export type { AttendanceDecision as AttendanceDecisionType } from '@medu/contracts';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface Attendance {
  id: string;
  organizationId: string;
  studentId: string;
  groupId: string;
  date: string;
  status: AttendanceStatus;
  source: string;
  note?: string | null;
  confidence?: string | null;
  student?: Student;
  group?: Group;
}

export interface AttendanceStat {
  status: AttendanceStatus;
  count: number;
}

/**
 * Aggregated attendance metrics used by dashboard analytics.
 */
export interface AttendanceAnalytics {
  overall: { total: number; present: number; rate: number };
  byStatus: AttendanceStat[];
  byGroup: Array<{ groupId: string | null; _count: { status: number } }>;
  daily: Array<{ date: string; status: AttendanceStatus; count: number }>;
}
