export interface AutomationCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface AutomationAction {
  type: string;
  template?: string;
  target?: string;
  message?: string;
  channel?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  eventType: string;
  isActive: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  cooldownMinutes: number;
  maxTriggersPerDay: number;
  totalRuns: number;
  successCount: number;
  failureCount: number;
  lastRunAt: string | null;
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  rule?: { name: string; eventType: string };
  status: 'SUCCESS' | 'FAILED' | 'LOOP_DETECTED';
  triggeredBy: string;
  entityType?: string;
  entityId?: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface AutomationStats {
  totalRules: number;
  activeRules: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate?: number;
  loopDetected: number;
  topRules: Array<{
    id: string;
    name: string;
    eventType: string;
    totalRuns: number;
    successCount: number;
    failureCount: number;
  }>;
}
