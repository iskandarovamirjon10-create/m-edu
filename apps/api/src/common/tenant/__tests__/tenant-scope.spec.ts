import { describe, it, expect } from 'vitest';
import {
  isTenantScopedModel,
  scopePrismaArgs,
  TenantScopeViolation,
} from '../tenant-scope';

const ORG = '11111111-1111-1111-1111-111111111111';
const OTHER_ORG = '22222222-2222-2222-2222-222222222222';

describe('tenant scoping (SEC-02)', () => {
  it('derives tenant-scoped models from the Prisma schema', () => {
    expect(isTenantScopedModel('Student')).toBe(true);
    expect(isTenantScopedModel('Organization')).toBe(false);
    expect(isTenantScopedModel(undefined)).toBe(false);
  });

  it('injects organizationId into list queries without touching other filters', () => {
    const args = scopePrismaArgs('Student', 'findMany', { where: { isActive: true } }, ORG) as {
      where: Record<string, unknown>;
    };
    expect(args.where).toEqual({ isActive: true, organizationId: ORG });
  });

  it('injects organizationId into by-id lookups and updates', () => {
    const find = scopePrismaArgs('Student', 'findUnique', { where: { id: 's1' } }, ORG) as {
      where: Record<string, unknown>;
    };
    expect(find.where).toEqual({ id: 's1', organizationId: ORG });

    const update = scopePrismaArgs(
      'Student',
      'update',
      { where: { id: 's1' }, data: { firstName: 'Ali' } },
      ORG,
    ) as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(update.where).toEqual({ id: 's1', organizationId: ORG });
    expect(update.data).toEqual({ firstName: 'Ali', organizationId: ORG });
  });

  it('rejects an explicit cross-tenant target', () => {
    expect(() =>
      scopePrismaArgs('Student', 'findUnique', { where: { id: 's1', organizationId: OTHER_ORG } }, ORG),
    ).toThrow(TenantScopeViolation);
  });

  it('stamps created rows with the request organization', () => {
    const created = scopePrismaArgs('Student', 'create', { data: { firstName: 'Ali' } }, ORG) as {
      data: Record<string, unknown>;
    };
    expect(created.data).toEqual({ firstName: 'Ali', organizationId: ORG });
  });

  it('stamps every row of a createMany batch', () => {
    const created = scopePrismaArgs(
      'Student',
      'createMany',
      { data: [{ firstName: 'A' }, { firstName: 'B' }] },
      ORG,
    ) as { data: Array<Record<string, unknown>> };
    expect(created.data).toEqual([
      { firstName: 'A', organizationId: ORG },
      { firstName: 'B', organizationId: ORG },
    ]);
  });

  it('scopes both sides of an upsert', () => {
    const upsert = scopePrismaArgs(
      'Student',
      'upsert',
      { where: { id: 's1' }, create: { firstName: 'A' }, update: { firstName: 'B' } },
      ORG,
    ) as { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> };
    expect(upsert.where).toEqual({ id: 's1', organizationId: ORG });
    expect(upsert.create).toEqual({ firstName: 'A', organizationId: ORG });
    expect(upsert.update).toEqual({ firstName: 'B', organizationId: ORG });
  });

  it('leaves global models untouched', () => {
    const args = { where: { id: 'org1' } };
    expect(scopePrismaArgs('Organization', 'findUnique', args, ORG)).toEqual(args);
  });
});
