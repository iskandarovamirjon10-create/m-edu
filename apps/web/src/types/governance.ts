/**
 * Data governance, retention policies, and compliance export logs.
 */

import type { Paginated } from './common';
export type { Paginated };

export interface DataGovernancePolicy {
  id: string;
  dataType: string;
  isActive: boolean;
  lastRunAt: string | null;
  retentionDays: number;
  archivalDays: number | null;
  deleteAfterDays: number | null;
  name?: string;
  description?: string;
}

export interface ExportLog {
  id: string;
  userId: string | null;
  exportType: string;
  format: string;
  recordCount: number;
  status: string;
  createdAt: string;
  user?: { firstName: string; lastName: string } | null;
}

export interface DataAccessLog {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  userName: string | null;
  ipAddress: string | null;
  timestamp: string;
  createdAt?: string;
}

export interface ExportStats {
  totalExports: number;
  last30Days: number;
  byType: Array<{ type: string; count: number }>;
  lastExport: {
    createdAt: string;
    exportType: string;
    format: string;
    recordCount: number;
  } | null;
}

export interface RetentionCheckResult {
  checkedAt: string;
  policiesChecked: number;
  results: Array<{
    dataType: string;
    policyId: string;
    archivalCandidates: number;
    deletionCandidates: number;
    oldestRecord: string | null;
  }>;
}
