import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ALLOW_ANY_ROLE_KEY,
  ALLOW_SELF_SERVICE_KEY,
  ROLES_KEY,
} from './roles.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { isFamilyRole } from './authorization.policy';

/**
 * Role guard implementing the centralized authorization policy.
 *
 * Decision order (first match wins):
 *
 *   1. `@Roles(...)`               → the role MUST be in the list.
 *      (An explicit list is the strongest statement and always wins, so a
 *      leftover `@()` next to `@Roles()` can never widen access.)
 *   2. `@AllowSelfService()`       → any authenticated principal, including
 *      `PARENT` / `STUDENT`. Self-service endpoints only.
 *   3. `@()`           → any authenticated **staff** role.
 *      `PARENT` / `STUDENT` are DENIED here: these accounts only ever see
 *      their own data (see authorization.policy.ts).
 *   4. otherwise                   → DENY (secure default).
 *
 * Platform `SUPER_ADMIN` bypasses role lists (it is a superset of every
 * permission set elsewhere in the codebase), but it never bypasses the
 * authentication requirement — `user` must exist.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const allowAnyRole = this.reflector.getAllAndOverride<boolean>(ALLOW_ANY_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const allowSelfService = this.reflector.getAllAndOverride<boolean>(ALLOW_SELF_SERVICE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { user } = context.switchToHttp().getRequest();

    // Unauthenticated requests are rejected by JwtAuthGuard first; if a route
    // is ever wired without it, deny rather than throw a confusing 500.
    if (!user || typeof user.role !== 'string' || !user.role) {
      return false;
    }

    if (user.mustChangePassword) {
      const req = context.switchToHttp().getRequest();
      const url = (req.url || req.path || '').toLowerCase();
      const isAllowedEndpoint =
        url.includes('/auth/change-password') ||
        url.includes('/users/change-password') ||
        url.includes('/auth/me') ||
        url.includes('/auth/logout') ||
        url.includes('/auth/refresh');
      if (!isAllowedEndpoint) {
        throw new ForbiddenException('Must change initial password before accessing application functionality');
      }
    }

    // Platform SUPER_ADMIN bypasses every role-restricted route.
    if (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN') {
      return true;
    }

    // 1. Explicit role list — authoritative.
    if (requiredRoles && requiredRoles.length > 0) {
      return requiredRoles.includes(user.role);
    }

    // 2. Self-service — the caller's own data only, family roles included.
    if (allowSelfService) {
      return true;
    }

    // 3. "Any staff role" — never family accounts.
    if (allowAnyRole) {
      return !isFamilyRole(user.role);
    }

    // 4. SECURE DEFAULT: neither @Roles(...) nor an explicit opt-in is set.
    return false;
  }
}

