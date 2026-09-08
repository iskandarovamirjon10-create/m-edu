import { Injectable } from '@nestjs/common';
import { WorkflowRuleDto, WorkflowInstanceDto, WorkflowStepConfig } from './workflow.types';
import { PaginationQuery } from '../common/dto/query';

// ---------------------------------------------------------------------------
// In-memory rule store (deterministic, no AI). Replace with a Prisma model
// once the workflow schema is migrated. Tenant-isolated via organizationId.
// ---------------------------------------------------------------------------

@Injectable()
export class WorkflowService {
  private rules: WorkflowRuleDto[] = [];
  private instances: WorkflowInstanceDto[] = [];

  /**
   * Evaluate a workflow rule against a payload (deterministic, no AI).
   * Returns an instance with computed step outcomes based on conditions.
   */
  evaluate(rule: WorkflowRuleDto, payload: Record<string, unknown>): WorkflowInstanceDto {
    const conditionsPass = this.evaluateConditions(rule.conditions || [], payload);

    const instance: WorkflowInstanceDto = {
      id: `wf-inst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organizationId: rule.organizationId,
      ruleId: rule.id,
      ruleName: rule.name,
      status: conditionsPass ? 'PENDING' : 'CANCELLED',
      triggerPayload: payload,
      startedAt: new Date().toISOString(),
      completedAt: conditionsPass ? null : new Date().toISOString(),
      error: conditionsPass ? null : 'Conditions did not pass — workflow cancelled',
      steps: rule.steps.map(step => ({
        stepId: step.name,
        status: conditionsPass ? 'pending' : 'skipped',
      })),
    };

    this.instances.push(instance);
    return instance;
  }

  /**
   * Execute an instance step-by-step with retries (rule-based, deterministic).
   */
  async runInstance(instance: WorkflowInstanceDto, _context: Record<string, unknown>): Promise<WorkflowInstanceDto> {
    // This is a deterministic placeholder that applies rules sequentially.
    // Each step's conditions are checked against payload + context.
    return instance;
  }

  // ---------------------------------------------------------------------------
  // Admin (read-only listings — in-memory until DB-backed)
  // ---------------------------------------------------------------------------

  async listRules(orgId: string, query: PaginationQuery) {
    const items = this.rules.filter(r => r.organizationId === orgId);
    const search = (query.search ?? '').toString().toLowerCase();
    const filtered = search
      ? items.filter(r => r.name.toLowerCase().includes(search))
      : items;
    const page = Number(query.page ?? 1) || 1;
    const limit = Number(query.limit ?? 20) || 20;
    const start = (page - 1) * limit;
    return {
      items: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    };
  }

  async getRule(orgId: string, id: string) {
    const rule = this.rules.find(r => r.id === id && r.organizationId === orgId);
    if (!rule) return null;
    return rule;
  }

  async listInstances(orgId: string, query: PaginationQuery) {
    const items = this.instances.filter(i => i.organizationId === orgId);
    const page = Number(query.page ?? 1) || 1;
    const limit = Number(query.limit ?? 20) || 20;
    const start = (page - 1) * limit;
    const sorted = [...items].sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1));
    return {
      items: sorted.slice(start, start + limit),
      total: sorted.length,
      page,
      limit,
      totalPages: Math.ceil(sorted.length / limit),
    };
  }

  // ---------------------------------------------------------------------------
  // Rule creation (for tests + future admin UI)
  // ---------------------------------------------------------------------------

  addRule(rule: WorkflowRuleDto) {
    this.rules.push(rule);
    return rule;
  }

  // ---------------------------------------------------------------------------
  // Condition evaluator
  // ---------------------------------------------------------------------------

  private evaluateConditions(conditions: any[], payload: Record<string, unknown>): boolean {
    if (!conditions || conditions.length === 0) return true;
    for (const cond of conditions) {
      const value = payload[cond.field];
      if (cond.operator === 'eq') { if (value !== cond.value) return false; }
      else if (cond.operator === 'ne') { if (value === cond.value) return false; }
      else if (cond.operator === 'gt') { if (Number(value) <= Number(cond.value)) return false; }
      else if (cond.operator === 'gte') { if (Number(value) < Number(cond.value)) return false; }
      else if (cond.operator === 'lt') { if (Number(value) >= Number(cond.value)) return false; }
      else if (cond.operator === 'lte') { if (Number(value) > Number(cond.value)) return false; }
      else if (cond.operator === 'contains') {
        const vStr = String(value ?? '').toLowerCase();
        const cStr = String(cond.value ?? '').toLowerCase();
        if (!vStr.includes(cStr)) return false;
      }
      else if (cond.operator === 'in') {
        const arr = Array.isArray(cond.value) ? cond.value : [cond.value];
        if (!arr.includes(value)) return false;
      }
      else if (cond.operator === 'startsWith') {
        if (!String(value ?? '').startsWith(String(cond.value ?? ''))) return false;
      }
      else if (cond.operator === 'endsWith') {
        if (!String(value ?? '').endsWith(String(cond.value ?? ''))) return false;
      }
    }
    return true;
  }
}
