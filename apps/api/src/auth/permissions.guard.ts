import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { Permission, RolePermissions } from '@medu/contracts';

/**
 * Permission-based RBAC guard.
 *
 * Endpoints declared with `@RequirePermissions(...)` are authorized by
 * checking the authenticated user's ROLE against the role → permission map
 * in @medu/contracts (`RolePermissions`). This is the correct pairing for
 * controllers that annotate endpoints with permission strings such as
 * `Permissions.CAMERA_MANAGE` ('camera.manage') — the generic RolesGuard
 * compares those strings against `user.role` and would deny every role.
 *
 * Mirrors FacePermissionsGuard's identity checks, but is fail-closed:
 *  - no required permissions declared → 403 (endpoint must declare them)
 *  - missing/malformed identity → 401
 *  - role with no registered permissions → 403
 *  - missing permission → 403
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      throw new ForbiddenException(
        'Endpoint does not declare required permissions (fail-closed).',
      );
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role || typeof user.role !== 'string') {
      throw new UnauthorizedException('Authenticated user is required.');
    }

    if (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN') {
      return true;
    }

    const userPermissions = Object.prototype.hasOwnProperty.call(RolePermissions, user.role)
      ? RolePermissions[user.role as keyof typeof RolePermissions]
      : undefined;

    if (!userPermissions || userPermissions.length === 0) {
      throw new ForbiddenException(
        `Role "${user.role}" has no permissions registered for this module.`,
      );
    }

    const missing = requiredPermissions.filter((p) => !userPermissions.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Role "${user.role}" is missing required permissions: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
