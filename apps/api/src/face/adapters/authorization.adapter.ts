import { Injectable } from '@nestjs/common';
import type { AuthorizationPort, Permission } from '@medu/core/src/ports/authorization.port';
import { BiometricAccessDeniedError } from '@medu/core';
import { rolePermissionsForRole, Permission as ContractsPermission } from '@medu/contracts';

/**
 * Production RBAC adapter — resolves permissions from the user's role
 * using the RolePermissions map from @medu/contracts.
 *
 * The `role` parameter is mandatory in the face platform because
 * TenantContext always carries the JWT-verified role. If no role is
 * provided, access is denied (fail-closed).
 */
@Injectable()
export class SimpleAuthorizationAdapter implements AuthorizationPort {
  async hasPermission(permission: Permission, role?: string): Promise<boolean> {
    if (!role) return false;
    const permissions = rolePermissionsForRole(role);
    return permissions.includes(permission as ContractsPermission);
  }

  async requirePermission(permission: Permission, role?: string): Promise<void> {
    const hasIt = await this.hasPermission(permission, role);
    if (!hasIt) {
      throw new BiometricAccessDeniedError('permission', permission);
    }
  }

  async hasAnyPermission(permissions: Permission[], role?: string): Promise<boolean> {
    if (!role) return false;
    const userPermissions = rolePermissionsForRole(role);
    return permissions.some((p) => userPermissions.includes(p as ContractsPermission));
  }
}
