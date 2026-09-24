/**
 * Tenant Isolation Service — enforces data isolation between organizations.
 *
 * Every tenant-owned entity must be scoped by organizationId.
 * Tenant context comes from validated JWT — never from client requests.
 */

import type { TenantContext, TenantContextProvider } from '@medu/core';
import { TenantMismatchError } from '@medu/core';

export class TenantIsolationService implements TenantContextProvider {
  /**
   * Get the current tenant context from the request.
   * In a real implementation, this extracts data from the JWT.
   */
  async getContext(): Promise<TenantContext> {
    // This will be implemented by the API layer's auth guard
    // which extracts context from the validated JWT token.
    throw new Error('getContext must be implemented by the API adapter');
  }

  /**
   * Validate that a given organizationId matches the current tenant.
   * This is a defense-in-depth check — services should call this
   * before any cross-tenant-sensitive operation.
   */
  async validateOrganization(organizationId: string): Promise<void> {
    const context = await this.getContext();
    if (context.organizationId !== organizationId) {
      throw new TenantMismatchError();
    }
  }
}

/**
 * Utility function to validate tenant ownership of a resource.
 * Use this in repository adapters and service methods.
 */
export function assertTenantOwnership(
  resourceOrganizationId: string,
  requestOrganizationId: string
): void {
  if (resourceOrganizationId !== requestOrganizationId) {
    throw new TenantMismatchError();
  }
}
