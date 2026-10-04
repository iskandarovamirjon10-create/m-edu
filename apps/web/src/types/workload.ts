/**
 * Teacher workload tracking and capacity analysis domain models.
 */

export interface TeacherWorkload {
  teacherId: string;
  teacherName: string;
  groupsCount: number;
  studentsCount: number;
  hoursPerWeek?: number;
  weeklyHours?: number;
  capacityHours: number;
  utilization?: number; // 0..1
  utilisationPct?: number;
  status?: 'UNDERUTILIZED' | 'BALANCED' | 'OVERLOADED';
  overload?: boolean;
  upcomingClasses?: {
    groupId: string;
    groupName: string;
    startAt: string;
    endAt: string;
  }[];
  riskFactors?: string[];
  recommendation?: string;
}

export interface WorkloadSummary {
  total?: number;
  totalTeachers?: number;
  overloaded: number;
  balanced?: number;
  underutilized?: number;
  underutilised?: number;
  avgUtilization?: number;
  averageUtilisationPct?: number;
  totalWeeklyHours?: number;
  totalCapacityHours?: number;
}

export type TeacherWorkloadSummary = WorkloadSummary;

export interface TeacherWorkloadItem {
  teacherId: string;
  teacherName: string;
  groupsCount: number;
  studentsCount: number;
  hoursPerWeek: number;
  capacityHours: number;
  utilization: number;
  status: 'UNDERUTILIZED' | 'BALANCED' | 'OVERLOADED';
}
