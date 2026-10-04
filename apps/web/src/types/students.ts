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
  dateOfBirth?: string | null;
  gender?: Gender | null;
  address?: string | null;
  notes?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'isActive'>;
  groups?: { group: { id: string; name: string; room?: string | null }; isActive: boolean }[];
  payments?: Payment[];
  attendance?: Attendance[];
  _count?: { payments: number };
}

export interface StudentSummary {
  id: string;
  firstName: string;
  lastName: string;
  studentId?: string | null;
  isActive?: boolean;
}
