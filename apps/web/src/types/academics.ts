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
  hourlyRate?: string | null;
  bio?: string | null;
  experience?: number | null;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'isActive'>;
  groups?: Group[];
}

export interface Schedule {
  id: string;
  groupId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room?: string | null;
  isActive: boolean;
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
