/**
 * Security center and threat detection domain models.
 */

export type SecurityAlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SecurityAlertStatus = 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export type SecurityEventType =
  | 'BRUTE_FORCE'
  | 'IMPOSSIBLE_TRAVEL'
  | 'NEW_DEVICE'
  | 'PRIVILEGE_ESCALATION'
  | 'SUSPICIOUS_IP'
  | 'MASS_EXPORT'
  | 'SQL_INJECTION_ATTEMPT'
  | 'XSS_ATTEMPT'
  | 'PATH_TRAVERSAL'
  | 'RATE_LIMIT_HIT'
  | 'OAUTH_FAILURE'
  | 'PASSWORD_RESET'
  | 'EMAIL_CHANGE'
  | 'MFA_DISABLED'
  | 'ROLE_CHANGED'
  | 'CUSTOM';

export interface SecurityAlert {
  id: string;
  organizationId: string;
  type: SecurityEventType;
  severity: SecurityAlertSeverity;
  status: SecurityAlertStatus;
  title: string;
  message: string;
  actorId?: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface SecuritySummary {
  total: number;
  byStatus: Record<SecurityAlertStatus, number>;
  bySeverity: Record<SecurityAlertSeverity, number>;
  byType: Record<SecurityEventType, number>;
  detectedThisWeek: number;
  resolvedThisWeek: number;
  riskScore: number; // 0-100
  lastIncidentAt?: string;
}
