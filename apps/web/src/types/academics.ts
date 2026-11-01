/**
 * Academic curriculum, courses, groups, and scheduling domain models.
 */

import type { User } from './auth';
import type { Student } from './students';

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface Course {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  price: string;
  duration: number;
  level?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Teacher {
  id: string;
  organizationId: string;
  userId: string;
  specializations: string[];
  salaryType?: 'MONTHLY' | 'HOURLY' | 'PER_LESSON';
  hourlyRate?: string | number | null;
  lessonRate?: string | number | null;
  bio?: string | null;
  experience?: number | null;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'isActive'>;
  groups?: Group[];
  metrics?: {
    totalStudents: number;
    weeklyHours: number;
    groupsCount: number;
  };
}

export interface Schedule {
  id: string;
  groupId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room?: string | null;
  isActive: boolean;
  group?: {
    id?: string;
    name?: string;
    room?: string | null;
  };
}

/** Schedule row as returned inside a Group detail (backend Group.schedules). */
export interface GroupSchedule {
  id: string;
  groupId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room?: string | null;
  isActive: boolean;
}

export interface Group {
  id: string;
  organizationId: string;
  name: string;
  courseId: string;
  teacherId?: string | null;
  capacity?: number | null;
  room?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  course?: Course;
  teacher?: Teacher | null;
  enrollments?: { student: Student; isActive: boolean }[];
  schedules?: Schedule[];
  _count?: { enrollments?: number; attendance?: number };
}

export interface Grade {
  id: string;
  studentId: string;
  groupId: string;
  value: number;
  maxValue?: number | null;
  label?: string | null;
  notes?: string | null;
}

export interface Homework {
  id: string;
  organizationId: string;
  groupId: string;
  title: string;
  description?: string | null;
  deadline?: string | null;
  maxScore?: number | null;
  group?: Group;
}

export interface AtRiskStudent {
  studentId: string;
  fullName: string;
  phone?: string | null;
  riskType: 'ABSENCE_STREAK' | 'LOW_MASTERY' | 'FREQUENT_LATE';
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  stats: {
    absenceCount: number;
    absenceStreak: number;
    homeworkAverage: number;
    latesCount: number;
  };
  recommendedIntervention: string;
}

export interface PedagogicalCheckpoint {
  phase: 'WARM_UP' | 'ACTIVE_PRACTICE' | 'FORMATIVE_CHECK' | 'WRAP_UP';
  title: string;
  durationMinutes: number;
  instruction: string;
  promptExample: string;
}

export interface DifferentiatedTask {
  tier: 'FOUNDATION' | 'CORE' | 'ADVANCED';
  targetAudience: string;
  badgeText: string;
  taskTitle: string;
  taskPrompt: string;
  solutionHint: string;
}

export interface LessonCopilotAnalysis {
  lessonId: string;
  topic: string;
  courseName: string;
  groupName: string;
  groupMetrics: {
    totalStudents: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    attendanceRateToday: number;
    averageHistoricalAttendance: number;
    homeworkCompletionRate: number;
    groupMasteryIndex: number;
    comprehensionStatus: 'EXCELLENT' | 'STABLE' | 'NEEDS_ATTENTION';
  };
  atRiskStudents: AtRiskStudent[];
  pedagogicalCheckpoints: PedagogicalCheckpoint[];
  differentiatedTasks: DifferentiatedTask[];
}

