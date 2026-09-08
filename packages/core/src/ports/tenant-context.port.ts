/**
 * Tenant context port — provides authenticated, server-side tenant context.
 *
 * CRITICAL: Tenant context must NEVER come from client-supplied headers or body.
 * It must be extracted from the validated JWT token by the authentication layer.
 */

export interface TenantContext {
  /** The authenticated user's ID */
  userId: string;
  /** The user's email */
  email: string;
  /** The user's role */
  role: string;
  /** The organization (tenant) ID */
  organizationId: string;
}

export interface TenantContextProvider {
  /**
   * Get the current tenant context from the request.
   * Throws if no valid context is available.
   */
  getContext(): Promise<TenantContext>;

  /**
   * Validate that a given organizationId matches the current tenant.
   * This prevents cross-tenant access.
   */
  validateOrganization(organizationId: string): Promise<void>;
}
