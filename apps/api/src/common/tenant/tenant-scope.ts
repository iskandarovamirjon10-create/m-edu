import { Prisma } from '@prisma/client';

/**
 * Pure tenant-scoping logic for Prisma operations (SEC-02).
 *
 * Kept free of Nest/Prisma-client side effects so it can be unit tested and
 * reused by the middleware in `PrismaService`.
 *
 * Scope of the rule: a model is "tenant scoped" when it declares a REQUIRED
 * `organizationId` field. Models without it (Organization itself, global
 * policy rows, oauth_session …) are global by design and are never rewritten.
 */

export class TenantScopeViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeViolation';
  }
}

type DmmfModel = {
  name: string;
  fields: ReadonlyArray<{ name: string; isRequired?: boolean }>;
};

function readDmmfModels(): DmmfModel[] {
  const dmmf = (Prisma as unknown as { dmmf?: { datamodel?: { models?: DmmfModel[] } } }).dmmf;
  return dmmf?.datamodel?.models ?? [];
}

/** Models that must always be filtered by `organizationId`. */
export const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set(
  readDmmfModels()
    .filter((model) =>
      model.fields.some((field) => field.name === 'organizationId' && field.isRequired !== false),
    )
    .map((model) => model.name),
);

/** True when the model carries a required `organizationId`. */
export function isTenantScopedModel(model?: string | null): boolean {
  return typeof model === 'string' && TENANT_SCOPED_MODELS.has(model);
}

/** Operations whose `where` clause selects tenant-owned rows. */
const WHERE_ACTIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

/** Operations that create rows and therefore need `data.organizationId`. */
const CREATE_ACTIONS = new Set(['create', 'createMany']);

function assertOrg(value: unknown, expected: string, model: string, action: string): void {
  if (typeof value === 'string' && value !== expected) {
    throw new TenantScopeViolation(
      `Tenant isolation violation: ${model}.${action} targeted organization "${value}" from a request bound to "${expected}".`,
    );
  }
}

function scopeWhere(
  where: Record<string, unknown> | undefined,
  organizationId: string,
  model: string,
  action: string,
): Record<string, unknown> {
  const next = where ? { ...where } : {};
  assertOrg(next.organizationId, organizationId, model, action);
  next.organizationId = organizationId;
  return next;
}

function scopeRow(
  row: Record<string, unknown>,
  organizationId: string,
  model: string,
  action: string,
): Record<string, unknown> {
  assertOrg(row.organizationId, organizationId, model, action);
  return { ...row, organizationId };
}

/**
 * Returns a copy of `args` with the tenant filter applied.
 *
 * Throws {@link TenantScopeViolation} when the caller explicitly targets a
 * different organization — that is never a legitimate tenant-bound request and
 * is the exact shape a cross-tenant IDOR takes.
 */
export function scopePrismaArgs(
  model: string | null | undefined,
  action: string,
  args: unknown,
  organizationId: string,
): Record<string, unknown> {
  const input = (args ?? {}) as Record<string, unknown>;

  if (!isTenantScopedModel(model)) return input;

  const modelName = model as string;

  if (WHERE_ACTIONS.has(action)) {
    const next: Record<string, unknown> = { ...input };
    next.where = scopeWhere(
      input.where as Record<string, unknown> | undefined,
      organizationId,
      modelName,
      action,
    );
    // update/upsert carry `data`; it must not be able to move a row across tenants.
    if (action === 'update' && input.data) {
      const data = input.data as Record<string, unknown>;
      assertOrg(data.organizationId, organizationId, modelName, action);
      next.data = data.organizationId ? data : { ...data, organizationId };
    }
    return next;
  }

  if (CREATE_ACTIONS.has(action)) {
    const next: Record<string, unknown> = { ...input };
    if (action === 'createMany') {
      const rows = Array.isArray(input.data) ? input.data : [input.data ?? {}];
      next.data = rows.map((row) =>
        scopeRow((row ?? {}) as Record<string, unknown>, organizationId, modelName, action),
      );
    } else {
      next.data = scopeRow(
        (input.data ?? {}) as Record<string, unknown>,
        organizationId,
        modelName,
        action,
      );
    }
    return next;
  }

  if (action === 'upsert') {
    const next: Record<string, unknown> = { ...input };
    next.where = scopeWhere(
      input.where as Record<string, unknown> | undefined,
      organizationId,
      modelName,
      action,
    );
    next.create = scopeRow(
      (input.create ?? {}) as Record<string, unknown>,
      organizationId,
      modelName,
      action,
    );
    const update = (input.update ?? {}) as Record<string, unknown>;
    assertOrg(update.organizationId, organizationId, modelName, action);
    next.update = update.organizationId ? update : { ...update, organizationId };
    return next;
  }

  // Unknown/raw operations are left untouched; the caller opts out explicitly.
  return input;
}
