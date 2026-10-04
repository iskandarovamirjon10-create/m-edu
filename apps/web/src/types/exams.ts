/**
 * Examination and academic assessment domain models.
 */

import type { Course } from './academics';
import type { Student } from './students';

export type ExamType = 'MIDTERM' | 'FINAL' | 'QUIZ' | 'ASSIGNMENT';

export interface Exam {
  id: string;
  organizationId: string;
  groupId: string;
  subject: string;
  title: string;
  description?: string | null;
  examDate: string;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  examType: ExamType;
  isPublished: boolean;
  group?: { id: string; name: string; courseId?: string; course?: Course };
  results?: { id: string; marksObtained: number; isPassed: boolean }[];
  createdAt: string;
  updatedAt: string;
}

export interface ExamResult {
  id: string;
  organizationId: string;
  examId: string;
  studentId: string;
  score: number;
  grade?: string;
  isPassed: boolean;
  rank?: number;
  submittedAt?: string;
  gradedAt?: string;
  exam?: Exam;
  student?: Student;
  createdAt: string;
  updatedAt: string;
}

export interface ExamStats {
  totalExams: number;
  upcomingExams: number;
  averageScore: number;
  passRate: number;
}
