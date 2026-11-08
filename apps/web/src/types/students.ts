/**
 * Student domain models.
 */

import type { User } from './auth';
import type { Payment } from './finance';
import type { Attendance } from './attendance';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface Student {
  id: string;
  organizationId: string;
  userId: string;
  status?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  address?: string | null;
  notes?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
  balance?: number;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'isActive'>;
  groups?: Array<{
    id?: string;
    groupId?: string;
    name?: string;
    group?: { id: string; name: string; room?: string | null };
    isActive?: boolean;
  }>;
  payments?: Payment[];
  attendance?: Attendance[];
  _count?: { payments?: number; faceEnrollments?: number; attendance?: number };
}

export interface StudentSummary {
  id: string;
  firstName: string;
  lastName: string;
  studentId?: string | null;
  isActive?: boolean;
}
