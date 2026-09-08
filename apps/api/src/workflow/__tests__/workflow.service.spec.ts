/**
 * Unit tests for WorkflowService — deterministic, rule-based, no AI.
 * Tests cover condition evaluation across all supported operators.
 */
import { describe, it, expect } from 'vitest';
import { WorkflowService } from '../workflow.service';

const ORG = 'org-1';

function makeRule(conditions: any[] = [], steps: any[] = [{ name: 'step-1' }]) {
  return {
    id: 'rule-1',
    organizationId: ORG,
    name: 'Test rule',
    description: 'A test rule',
    trigger: 'manual',
    conditions,
    steps,
    enabled: true,
  } as any;
}

describe('WorkflowService', () => {
  let svc: WorkflowService;
  beforeEach(() => { svc = new WorkflowService(); });

  describe('evaluate', () => {
    it('returns PENDING when no conditions', () => {
      const result = svc.evaluate(makeRule([]), {});
      expect(result.status).toBe('PENDING');
      expect(result.steps.every(s => s.status === 'pending')).toBe(true);
    });

    it('returns CANCELLED when conditions fail', () => {
      const result = svc.evaluate(
        makeRule([{ field: 'amount', operator: 'gt', value: 1000 }]),
        { amount: 500 },
      );
      expect(result.status).toBe('CANCELLED');
      expect(result.error).toContain('Conditions did not pass');
    });

    it('returns PENDING when conditions pass', () => {
      const result = svc.evaluate(
        makeRule([{ field: 'amount', operator: 'gt', value: 1000 }]),
        { amount: 1500 },
      );
      expect(result.status).toBe('PENDING');
    });

    it('evaluates multiple conditions with AND logic', () => {
      const result = svc.evaluate(
        makeRule([
          { field: 'amount', operator: 'gte', value: 100 },
          { field: 'type', operator: 'eq', value: 'REFUND' },
        ]),
        { amount: 200, type: 'REFUND' },
      );
      expect(result.status).toBe('PENDING');
    });

    it('cancels if any condition fails (AND)', () => {
      const result = svc.evaluate(
        makeRule([
          { field: 'amount', operator: 'gte', value: 100 },
          { field: 'type', operator: 'eq', value: 'REFUND' },
        ]),
        { amount: 200, type: 'PAYMENT' },
      );
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('evaluateConditions — operators', () => {
    const cases: Array<[string, string, any, any, boolean]> = [
      // [description, operator, conditionValue, payloadValue, expected]
      ['eq matches', 'eq', 'A', { x: 'A' }, true],
      ['eq mismatch', 'eq', 'A', { x: 'B' }, false],
      ['ne matches', 'ne', 'A', { x: 'B' }, true],
      ['ne with same value fails', 'ne', 'A', { x: 'A' }, false],
      ['gt passes when greater', 'gt', 5, { x: 10 }, true],
      ['gt fails when equal', 'gt', 5, { x: 5 }, false],
      ['gt fails when less', 'gt', 5, { x: 1 }, false],
      ['gte passes when equal', 'gte', 5, { x: 5 }, true],
      ['gte passes when greater', 'gte', 5, { x: 10 }, true],
      ['gte fails when less', 'gte', 5, { x: 1 }, false],
      ['lt passes when less', 'lt', 5, { x: 1 }, true],
      ['lt fails when equal', 'lt', 5, { x: 5 }, false],
      ['lte passes when equal', 'lte', 5, { x: 5 }, true],
      ['contains is case-insensitive', 'contains', 'WORLD', { x: 'hello world' }, true],
      ['in matches array', 'in', ['A', 'B'], { x: 'A' }, true],
      ['in does not match', 'in', ['A', 'B'], { x: 'C' }, false],
      ['startsWith', 'startsWith', 'hello', { x: 'hello world' }, true],
      ['startsWith fails', 'startsWith', 'world', { x: 'hello world' }, false],
      ['endsWith', 'endsWith', 'world', { x: 'hello world' }, true],
      ['endsWith fails', 'endsWith', 'hello', { x: 'hello world' }, false],
    ];

    it.each(cases)('%s', (_desc, op, condValue, payload, expected) => {
      const result = svc.evaluate(
        makeRule([{ field: 'x', operator: op, value: condValue }]),
        payload,
      );
      expect(result.status).toBe(expected ? 'PENDING' : 'CANCELLED');
    });
  });

  describe('runInstance', () => {
    it('returns the same instance (placeholder for orchestration)', async () => {
      const instance = svc.evaluate(makeRule(), {});
      const result = await svc.runInstance(instance, {});
      expect(result).toBe(instance);
    });
  });

  describe('instance metadata', () => {
    it('includes a unique ID', () => {
      const a = svc.evaluate(makeRule(), {});
      const b = svc.evaluate(makeRule(), {});
      expect(a.id).not.toBe(b.id);
      expect(a.id).toMatch(/^wf-inst-/);
    });

    it('includes startedAt timestamp', () => {
      const before = new Date().toISOString();
      const result = svc.evaluate(makeRule(), {});
      const after = new Date().toISOString();
      expect(result.startedAt >= before).toBe(true);
      expect(result.startedAt <= after).toBe(true);
    });

    it('marks completedAt when cancelled', () => {
      const result = svc.evaluate(
        makeRule([{ field: 'x', operator: 'eq', value: 'nope' }]),
        { x: 'yes' },
      );
      expect(result.completedAt).not.toBeNull();
    });

    it('leaves completedAt null when pending', () => {
      const result = svc.evaluate(makeRule(), {});
      expect(result.completedAt).toBeNull();
    });
  });
});
