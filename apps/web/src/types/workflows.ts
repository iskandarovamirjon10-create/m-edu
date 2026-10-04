/**
 * Workflow and automated business rule engine domain models.
 */

import type { AuditEntityType } from './audit';

export type WorkflowTrigger =
  | 'MANUAL'
  | 'ON_CREATE'
  | 'ON_UPDATE'
  | 'ON_DELETE'
  | 'ON_SCHEDULE'
  | 'ON_CONDITION'
  | 'ON_EVENT';

export type WorkflowStepType =
  | 'SEND_NOTIFICATION'
  | 'SEND_EMAIL'
  | 'CREATE_TASK'
  | 'UPDATE_FIELD'
  | 'WEBHOOK'
  | 'WAIT'
  | 'CONDITION'
  | 'APPROVAL'
  | 'ASSIGN_ROLE'
  | 'RUN_QUERY';

export type WorkflowInstanceStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface WorkflowCondition {
  field: string;
  operator:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'contains'
    | 'startsWith'
    | 'endsWith';
  value: unknown;
}

export interface WorkflowStep {
  id: string;
  order: number;
  type: WorkflowStepType;
  name: string;
  config: Record<string, unknown>;
  /** Optional conditions that must pass before this step runs. */
  conditions?: WorkflowCondition[];
  /** On failure behaviour. */
  onError?: 'fail' | 'continue' | 'retry';
  retries?: number;
}

export interface WorkflowRule {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  /** Entity the rule listens on. */
  entityType: AuditEntityType;
  conditions?: WorkflowCondition[];
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  lastRunStatus?: 'success' | 'failed' | null;
  runCount?: number;
}

export interface WorkflowInstanceStep {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
}

export interface WorkflowInstance {
  id: string;
  organizationId: string;
  ruleId: string;
  ruleName: string;
  status: WorkflowInstanceStatus;
  triggerPayload?: Record<string, unknown>;
  steps: WorkflowInstanceStep[];
  startedAt: string;
  completedAt?: string | null;
  error?: string | null;
}
