/**
 * Authorization port — RBAC enforcement at the service level.
 * Backend must enforce authorization regardless of frontend checks.
 *
 * Each method accepts an optional `role` parameter. When provided, the
 * adapter checks permissions for that specific role instead of using
 * internal state. This eliminates race conditions in concurrent requests.
 */

export type Permission = string;

export interface AuthorizationPort {
  /**
   * Check if the current user has the required permission.
   * Returns true if authorized, false otherwise.
   * @param role - The user's role to check permissions for
   */
  hasPermission(permission: Permission, role?: string): Promise<boolean>;

  /**
   * Require a permission — throws BiometricAccessDeniedError if not authorized.
   * @param role - The user's role to check permissions for
   */
  requirePermission(permission: Permission, role?: string): Promise<void>;

  /**
   * Check if the current user has any of the given permissions.
   * @param role - The user's role to check permissions for
   */
  hasAnyPermission(permissions: Permission[], role?: string): Promise<boolean>;
}
