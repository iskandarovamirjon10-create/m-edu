export function branchScopeFilter(organizationId: string, branchId?: string | null) {
  if (branchId) return { organizationId, branchId };
  return { organizationId };
}
