import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@medu/contracts';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Require specific permissions (from @medu/contracts `Permissions`) on an
 * endpoint. Evaluated by `PermissionsGuard`, which maps the authenticated
 * user's role to its registered permission set (`RolePermissions`).
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
