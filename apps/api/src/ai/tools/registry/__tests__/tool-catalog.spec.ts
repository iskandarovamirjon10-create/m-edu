import { describe, expect, it } from 'vitest';
import { AiPermission } from '@medu/contracts';
import { createAiToolDefinitions } from '../index';

const stub = {} as any;

function buildCatalog() {
  return createAiToolDefinitions({
    students: stub,
    teachers: stub,
    attendance: stub,
    schedule: stub,
    invoices: stub,
    groups: stub,
    courses: stub,
    prisma: stub,
  });
}

describe('AI tool catalog', () => {
  const tools = buildCatalog();

  it('exposes every capability the Copilot UI renders', () => {
    const names = tools.map((tool) => tool.name).sort();

    expect(names).toEqual(
      [
        'attendance.groups',
        'attendance.summary',
        'biometrics.recent_events',
        'biometrics.status',
        'courses.create',
        'courses.list',
        'finance.debtors',
        'finance.summary',
        'grades.analytics',
        'groups.create',
        'groups.list',
        'notifications.broadcast',
        'schedule.create',
        'schedule.list',
        'students.create',
        'students.search',
        'teachers.create',
        'teachers.list',
        'teachers.workload',
      ].sort(),
    );
  });

  it('registers no duplicate tool names', () => {
    const names = tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gates every mutating tool behind confirmation with a permission', () => {
    const writes = tools.filter((tool) => tool.requiresConfirmation);

    expect(writes.map((tool) => tool.name).sort()).toEqual(
      [
        'courses.create',
        'groups.create',
        'notifications.broadcast',
        'schedule.create',
        'students.create',
        'teachers.create',
      ].sort(),
    );

    for (const tool of writes) {
      expect(tool.permission).toBeTruthy();
      expect(tool.riskLevel).toBeTruthy();
    }
  });

  it('never exposes a broadcast that bypasses the notification permission', () => {
    const broadcast = tools.find(
      (tool) => tool.name === 'notifications.broadcast',
    );
    expect(broadcast?.permission).toBe(AiPermission.NOTIFICATIONS_WRITE);
  });

  it('keeps read tools confirmation-free', () => {
    const reads = tools.filter((tool) => !tool.requiresConfirmation);
    expect(reads.length).toBeGreaterThan(0);
    for (const tool of reads) {
      expect(tool.permission).toMatch(/:read$/);
    }
  });

  it('describes every tool for function calling', () => {
    for (const tool of tools) {
      expect(tool.description.trim().length).toBeGreaterThan(20);
      expect(tool.inputSchema).toBeTruthy();
    }
  });
});
