/**
 * Executive dashboard and general analytics overview models.
 */

import type { MonthlyRevenue, Payment, PaymentStatus } from './finance';
import type { FollowUp, LeadStage } from './leads';
import type { AttendanceStat, AttendanceStatus } from './attendance';

export interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  activeGroups: number;
  totalCourses?: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  monthlyRevenue: MonthlyRevenue[];
  recentPayments: Payment[];
  totalLeads: number;
  wonLeads: number;
  newLeadsThisMonth: number;
  conversionRate: number;
  attendanceRate: number;
  upcomingFollowUps: FollowUp[];
  attendanceStats: AttendanceStat[];
  leadByStage: { stage: LeadStage; count: number }[];
}

export interface AnalyticsOverview {
  overview: {
    totalStudents: number;
    activeStudents: number;
    totalTeachers: number;
    activeGroups: number;
    totalRevenue: number;
    monthlyRevenue: { month: string; total: number }[];
  };
  students: { monthlyNew: { month: string; count: number }[] };
  attendance: { statusDistribution: { status: AttendanceStatus; count: number }[]; averageRate: number };
  payments: { byStatus: { status: PaymentStatus; count: number; total: number }[] };
  leads: { byStage: { stage: LeadStage; count: number }[]; conversionRate: number };
}
