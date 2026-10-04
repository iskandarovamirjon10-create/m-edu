/**
 * CRM Pipeline Analytics response types.
 */

export interface CRMFunnelResponse {
  total: number;
  overallConversion: number;
  funnel: Array<{
    stage: string;
    count: number;
    conversionFromPrev: number;
    conversionFromTop: number;
  }>;
}

export interface CRMVelocityResponse {
  stageVelocity: Array<{ stage: string; leadCount: number; avgDays: number; medianDays: number }>;
  avgDaysInPipeline: number;
  avgTimeToWin: number;
  totalActiveLeads: number;
}

export interface CRMLostReasonsResponse {
  totalLost: number;
  reasons: Array<{ reason: string; count: number }>;
}

export interface CRMAgingLead {
  id: string;
  name: string;
  stage: string;
  source: string | null;
  daysInPipeline: number;
  daysSinceUpdate: number;
  status: 'FRESH' | 'WARMING' | 'STALE' | 'STUCK';
  createdAt: string;
}

export interface CRMAgingResponse {
  leads: CRMAgingLead[];
  statusCounts: { FRESH: number; WARMING: number; STALE: number; STUCK: number };
  total: number;
}

export interface CRMModeratorStats {
  moderatorId: string;
  name: string;
  email: string | null;
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  activeLeads: number;
  conversionRate: number;
}

export interface CRMSources {
  source: string;
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  avgDaysToConvert: number;
}
