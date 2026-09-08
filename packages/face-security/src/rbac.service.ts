/**
 * RBAC Service — role-based access control enforcement.
 *
 * Backend must enforce authorization regardless of frontend checks.
 * Permissions are checked against the user's role from the JWT token.
 */

import type { AuthorizationPort } from '@medu/core';
import { RolePermissions, type Permission } from '@medu/contracts';
import { BiometricAccessDeniedError } from '@medu/core';

export class RbacService implements AuthorizationPort {
  constructor(
    private readonly getUserRole: () => Promise<string>,
    private readonly getPermissions: () => Promise<Permission[]>
  ) {}

  async hasPermission(permission: Permission, _role?: string): Promise<boolean> {
    const permissions = await this.getPermissions();
    return permissions.includes(permission);
  }

  async requirePermission(permission: Permission, _role?: string): Promise<void> {
    const hasIt = await this.hasPermission(permission);
    if (!hasIt) {
      throw new BiometricAccessDeniedError('permission', permission);
    }
  }

  async hasAnyPermission(permissions: Permission[], _role?: string): Promise<boolean> {
    const userPermissions = await this.getPermissions();
    return permissions.some((p) => userPermissions.includes(p));
  }

  /**
   * Get permissions for a given role.
   * This is a static lookup — no DB query needed.
   */
  static getPermissionsForRole(role: string): Permission[] {
    return RolePermissions[role] || [];
  }
}
