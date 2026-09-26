/**
 * Reusable multi-tenant scoping utility for Prisma queries.
 * Enforces that every tenant-bound query explicitly includes organizationId.
 */

export function scopeToTenant<T extends Record<string, any>>(
  where: T,
  organizationId: string,
): T & { organizationId: string } {
  if (!organizationId || typeof organizationId !== 'string' || organizationId.trim().length === 0) {
    throw new Error('Tenant scoping violation: a non-empty organizationId is required');
  }
  return {
    ...where,
    organizationId: organizationId.trim(),
  };
}

/**
 * Asserts that a target record belongs to the expected tenant organization.
 * Throws a generic Error/NotFoundException if tenant mismatch is detected.
 */
export function assertTenantOwnership(
  record: { organizationId?: string | null } | null | undefined,
  expectedOrgId: string,
  entityName = 'Entity',
): void {
  if (!record || record.organizationId !== expectedOrgId) {
    throw new Error(`Tenant isolation violation: ${entityName} does not belong to organization ${expectedOrgId}`);
  }
}
