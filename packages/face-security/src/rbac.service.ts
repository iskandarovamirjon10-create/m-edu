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

  async hasPermission(permission: Permission, role?: string): Promise<boolean> {
    // SECURITY FIX: the `role` argument used to be ignored — every caller in
    // @medu/core passes the tenant role and previously got a check against
    // whatever the closure captured instead. Authorization is now a union:
    // the dynamic permission list (DB/tenant interceptor) OR the static
    // role matrix, so a caller that passes `role` is really checked against
    // that role.
    const permissions = await this.getPermissions();
    if (permissions.includes(permission)) return true;
    if (role) {
      return RbacService.getPermissionsForRole(role).includes(permission);
    }
    return false;
  }

  async requirePermission(permission: Permission, role?: string): Promise<void> {
    const hasIt = await this.hasPermission(permission, role);
    if (!hasIt) {
      throw new BiometricAccessDeniedError('permission', permission);
    }
  }

  async hasAnyPermission(permissions: Permission[], role?: string): Promise<boolean> {
    if (!permissions || permissions.length === 0) return false;
    // Batch resolution: load dynamic permissions once to prevent N+1 DB calls
    const userPermissions = await this.getPermissions();
    const rolePermissions = role ? RbacService.getPermissionsForRole(role) : [];
    
    for (const permission of permissions) {
      if (userPermissions.includes(permission) || rolePermissions.includes(permission)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get permissions for a given role.
   * This is a static lookup — no DB query needed.
   */
  static getPermissionsForRole(role: string): Permission[] {
    // Prototype-key safety: `RolePermissions['constructor']` / `['toString']`
    // resolve to Functions via the prototype chain; `.includes()` would then
    // throw (500) on a poisoned / legacy `role` claim.
    return (
      typeof role === 'string' &&
      Object.prototype.hasOwnProperty.call(RolePermissions, role)
        ? RolePermissions[role]
        : []
    );
  }
}
