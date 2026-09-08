import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FACE_PERMISSIONS_KEY } from './face-permissions.decorator';
import { Permission, RolePermissions } from '@medu/contracts';

@Injectable()
export class FacePermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      FACE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role || typeof user.role !== 'string') {
      // Authenticated identity is missing or malformed — surface a 401 so
      // callers can distinguish "not logged in" from "logged in but forbidden".
      throw new UnauthorizedException('Authenticated user is required.');
    }

    // Look up permissions by hasOwnProperty so an unknown role cannot
    // accidentally fall through to Object.prototype entries (e.g. "constructor").
    const userPermissions = Object.prototype.hasOwnProperty.call(RolePermissions, user.role)
      ? RolePermissions[user.role as keyof typeof RolePermissions]
      : undefined;

    if (!userPermissions || userPermissions.length === 0) {
      // The role is not represented in RolePermissions — the principal is
      // authenticated but not authorized for any face API.
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