/**
 * Multi-branch organizational structure domain models.
 */

import type { User } from './auth';

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  managerId?: string | null;
  email?: string | null;
  timezone?: string | null;
  currency?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  manager?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  _count?: {
    users?: number;
    courses?: number;
    students?: number;
    teachers?: number;
    groups?: number;
  };
}
