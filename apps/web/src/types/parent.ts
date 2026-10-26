/**
 * Parent portal domain models.
 */

import type { AttendanceStatus } from './attendance';
import type { Invoice } from './invoices';

export interface ParentChild {
  studentId: string;
  studentName: string;
  groups: { id: string; name: string }[];
  attendanceRate: number;
  averageGrade: number;
  pendingPayments: number;
  permissions?: Record<string, boolean>;
  student?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    status: string;
    balance: number;
    groups: { id: string; name: string }[];
    user: { firstName: string; lastName: string; avatar?: string };
  };
  relationship?: string;
}

export interface ParentAttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  groupName: string;
  note?: string | null;
  group?: { id: string; name: string };
  lesson?: { topic: string; startTime: string };
}

export interface ParentAttendanceSummary {
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
  byStatus?: Record<string, number>;
  total?: number;
  attendanceRate?: number;
}

export interface ParentGradesResponse {
  grades: {
    id: string;
    groupName: string;
    subject?: string;
    value: number;
    maxValue?: number;
    label?: string;
    date: string;
    group?: { name: string };
    notes?: string;
  }[];
  average: number;
  examResults?: {
    id: string;
    examTitle?: string;
    score: number;
    totalMarks?: number;
    date?: string;
    isPassed?: boolean;
    exam?: { title: string; examType: string; totalMarks: number };
  }[];
}

export interface ParentInvoicesResponse {
  invoices: Invoice[];
  totalOutstanding: number;
  outstanding?: number;
  overdue?: number;
  payments?: {
    id: string;
    amount: string;
    method?: string;
    reference?: string;
    paidAt?: string;
    createdAt: string;
  }[];
}

export interface ParentWeeklyDigest {
  student: {
    id: string;
    fullName: string;
    avatar: string | null;
  };
  period: {
    startDate: string;
    endDate: string;
    weekNumber: number;
  };
  metrics: {
    attendanceRate: number;
    lessonsAttended: number;
    totalLessons: number;
    latesCount: number;
    excusedCount: number;
    homeworkCompletionRate: number;
    averageScore: number;
    weeklyMasteryScore: number;
    statusTone: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION';
  };
  highlights: string[];
  recommendations: string[];
  recentAttendances: Array<{
    date: string;
    status: string;
    markedAt: string | null;
    source: string;
    groupName: string;
  }>;
  recentAssignments: Array<{
    title: string;
    groupName: string;
    score: number | null;
    maxScore: number;
    submittedAt: string;
    feedback: string | null;
  }>;
}

