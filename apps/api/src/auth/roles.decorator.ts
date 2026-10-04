import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * `@AllowAnyRole()` — any internal **staff** role.
 *
 * Family accounts (`PARENT`, `STUDENT`) are deliberately excluded: they are
 * denied unless an endpoint lists roles explicitly or opts in with
 * `@AllowSelfService()`. See `authorization.policy.ts` for the rationale.
 */
export const ALLOW_ANY_ROLE_KEY = 'allowAnyRole';
export const AllowAnyRole = () => SetMetadata(ALLOW_ANY_ROLE_KEY, true);

/**
 * `@AllowSelfService()` — any authenticated principal INCLUDING family roles.
 *
 * Reserved for endpoints that operate strictly on the caller's own
 * account/settings/notifications (e.g. change my password, my settings, my
 * notifications). Never use it for organization-wide reads.
 */
export const ALLOW_SELF_SERVICE_KEY = 'allowSelfService';
export const AllowSelfService = () => SetMetadata(ALLOW_SELF_SERVICE_KEY, true);

