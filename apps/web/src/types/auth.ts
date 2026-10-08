/**
 * Authentication and authorization domain models for M-EDU platform.
 */

export type Role =
  | 'PLATFORM_OWNER'
  | 'SUPER_ADMIN'
  | 'ORG_ADMIN'
  | 'MANAGER'
  | 'TEACHER'
  | 'ASSISTANT'
  | 'STUDENT'
  | 'PARENT';

/** Backward-compatibility alias for Role */
export type UserRole = Role;

export interface Organization {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export interface UserSettings {
  id: string;
  theme?: string | null;
  language?: string | null;
  timezone?: string | null;
  emailNotifications?: boolean | null;
  pushNotifications?: boolean | null;
  smsNotifications?: boolean | null;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatar?: string | null;
  role: Role;
  isActive: boolean;
  organizationId: string;
  lastLoginAt?: string | null;
  organization?: Organization;
  settings?: UserSettings | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface ActiveSession {
  id: string;
  userId?: string;
  userName?: string;
  deviceName?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown' | string;
  browser?: string;
  os?: string;
  ipAddress: string;
  userAgent?: string;
  device?: string;
  location?: string;
  lastActiveAt: string;
  createdAt: string;
  expiresAt?: string;
  isCurrent?: boolean;
  isCurrentSession?: boolean;
}
