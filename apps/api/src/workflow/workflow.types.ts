// Workflow module types (rule-based / deterministic — no AI models)

export const WorkflowTriggerEnum = [
  'MANUAL', 'ON_CREATE', 'ON_UPDATE', 'ON_DELETE', 'ON_SCHEDULE', 'ON_CONDITION', 'ON_EVENT',
] as const;
export type WorkflowTrigger = typeof WorkflowTriggerEnum[number];

export const WorkflowStepTypeEnum = [
  'SEND_NOTIFICATION', 'SEND_EMAIL', 'CREATE_TASK', 'UPDATE_FIELD', 'WEBHOOK', 'WAIT', 'CONDITION', 'APPROVAL', 'ASSIGN_ROLE', 'RUN_QUERY',
] as const;
export type WorkflowStepType = typeof WorkflowStepTypeEnum[number];

export const WorkflowInstanceStatusEnum = [
  'PENDING', 'RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED',
] as const;
export type WorkflowInstanceStatus = typeof WorkflowInstanceStatusEnum[number];

export interface WorkflowCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'startsWith' | 'endsWith';
  value: unknown;
}

export interface WorkflowStepConfig {
  order: number;
  type: WorkflowStepType;
  name: string;
  config: Record<string, unknown>;
  conditions?: WorkflowCondition[];
  onError?: 'fail' | 'continue' | 'retry';
  retries?: number;
}

export interface WorkflowRuleDto {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  trigger: WorkflowTrigger;
  entityType: string;
  conditions?: WorkflowCondition[];
  steps: WorkflowStepConfig[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  lastRunStatus?: 'success' | 'failed' | null;
  runCount?: number;
}

export interface WorkflowInstanceDto {
  id: string;
  organizationId: string;
  ruleId: string;
  ruleName: string;
  status: WorkflowInstanceStatus;
  triggerPayload?: Record<string, unknown>;
  startedAt: string;
  completedAt?: string | null;
  error?: string | null;
  steps: WorkflowInstanceStepDto[];
}

export interface WorkflowInstanceStepDto {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
}
