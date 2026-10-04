/**
 * System health monitoring and infrastructure observability domain models.
 */

export type SystemHealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

export interface SystemHealthIncident {
  id: string;
  metric: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  message: string;
  startedAt: string;
  resolvedAt?: string;
  duration?: number;
}

export interface SystemHealthMetric {
  id: string;
  name: string;
  category:
    | 'DATABASE'
    | 'API'
    | 'CACHE'
    | 'STORAGE'
    | 'EMAIL'
    | 'REALTIME'
    | 'JOBS';
  status: SystemHealthStatus;
  value: number;
  unit: string;
  threshold?: number;
  message?: string;
  lastCheckedAt: string;
  history: { timestamp: string; value: number; status: SystemHealthStatus }[];
}

export interface SystemHealthSummary {
  status: SystemHealthStatus;
  uptime: number; // seconds
  uptimePct: number; // 0-100
  totalMetrics: number;
  byStatus: Record<SystemHealthStatus, number>;
  metrics: SystemHealthMetric[];
  incidents: SystemHealthIncident[];
}
