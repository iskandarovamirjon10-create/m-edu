import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key read by {@link GlobalAuthGuard}.
 *
 * `Reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class])` resolves this
 * at both the method and the class level, so a decorator on either the route
 * handler or the controller opts the whole controller in.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * `@AllowPublic()` — the ONLY way to expose a route without a JWT.
 *
 * FAIL-CLOSED CONTRACT
 * --------------------
 * `GlobalAuthGuard` is registered as a global `APP_GUARD`. It denies every
 * HTTP request that carries no valid access token unless the route handler or
 * its controller is annotated with `@AllowPublic()`. A newly generated
 * controller therefore starts closed: forgetting `@UseGuards(...)` no longer
 * silently publishes the endpoint.
 *
 * Invariants enforced by `public-whitelist.spec.ts`:
 *
 *   1. The set of `@AllowPublic()` routes is a closed, reviewed allow-list.
 *      Adding one without updating the allow-list fails the build.
 *   2. A route may not be simultaneously `@AllowPublic()` and role-restricted
 *      (`@Roles` / `@AllowAnyRole` / `@AllowSelfService`): the RolesGuard would
 *      deny it for want of a principal, which is a silent contradiction.
 *
 * Decorators that must stay on the allow-list (see the spec for the canonical
 * list) fall into exactly three families:
 *
 *   - probes      — `GET /`, `/health`, `/live`, `/liveness`, `/readiness`,
 *                   `/metrics`, `/ai/health` (no tenant data, no side effects)
 *   - bootstrap   — `/csrf-token` (must be reachable before login) and the
 *                   unauthenticated half of `/auth/*`
 *   - webhooks    — `/webhooks/telegram`, `/webhooks/terminal`, which
 *                   authenticate with their own shared-secret schemes rather
 *                   than with a user session
 *
 * Never annotate a data-bearing route with `@AllowPublic()`. If an endpoint
 * must be reachable anonymously, authenticate the *caller* (device key, webhook
 * secret, signed link) inside the handler and document it here.
 */
export const AllowPublic = () => SetMetadata(IS_PUBLIC_KEY, true);

