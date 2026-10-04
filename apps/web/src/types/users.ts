/**
 * User management domain models.
 */

export type { User, Role, UserRole, UserSettings } from './auth';

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}
