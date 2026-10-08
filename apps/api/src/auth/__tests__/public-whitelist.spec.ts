import * as fs from 'fs';
import * as path from 'path';
import { RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { IS_PUBLIC_KEY } from '../public.decorator';
import { ALLOW_ANY_ROLE_KEY, ALLOW_SELF_SERVICE_KEY, ROLES_KEY } from '../roles.decorator';
import { GlobalAuthGuard } from '../global-auth.guard';
import { AppModule } from '../../app.module';

/**
 * The closed allow-list of routes reachable WITHOUT a JWT.
 *
 * This is the single reviewable source of truth for "what is anonymous". The
 * guard itself (`GlobalAuthGuard`) denies by default, so the only way to widen
 * the anonymous surface is to add an `@AllowPublic()` decorator — and the only
 * way that lands is by editing this array in the same commit, which forces the
 * widening to go through review.
 *
 * Three families, nothing else:
 *   - probes / bootstrap — `/`, health, liveness, readiness, metrics, csrf,
 *                          `/ai/health` (no tenant data, no side effects)
 *   - unauthenticated auth flows — login, register, reset, OAuth handshakes
 *   - webhooks — authenticate with their own shared secret inside the handler
 *
 * NOTE: `POST /api/auth/invitations/accept` and `POST /api/auth/request-access`
 * were part of this list while those routes existed on `AuthController`. They
 * are currently NOT routable (the routes and `AuthService.acceptInvitation`
 * were reverted off `HEAD`), so they are absent here — this list always mirrors
 * what actually exists. `test/access-control.e2e.spec.ts` still targets
 * `/auth/invitations/accept` and needs to follow whatever lands for that
 * feature; re-adding a route therefore requires re-adding its line here too,
 * otherwise the scan assertion below fails.
 */
const ALLOWED_PUBLIC_ROUTES: readonly string[] = [
  // probes / bootstrap
  'GET /',
  'GET /api/ai/health',
  'GET /api/csrf-token',
  'GET /api/health',
  'GET /api/live',
  'GET /api/liveness',
  'GET /api/metrics',
  'GET /api/readiness',
  // unauthenticated auth flows
  'GET /api/auth/apple',
  'GET /api/auth/apple/callback',
  'GET /api/auth/google',
  'GET /api/auth/google/callback',
  'POST /api/auth/bootstrap',
  'POST /api/auth/forgot-password',
  'POST /api/auth/invitations/accept',
  'POST /api/auth/login',
  'POST /api/auth/oauth/exchange',
  'POST /api/auth/parent-login',
  'POST /api/auth/register',
  'POST /api/auth/reset-password',
  // webhooks (own shared-secret authentication, CSRF-exempt by policy)
  'POST /api/webhooks/telegram',
  'POST /api/webhooks/terminal/event',
];

/** Routes that must NEVER become anonymous, asserted explicitly below. */
const MUST_STAY_AUTHENTICATED: readonly string[] = [
  'GET /api/auth/me',
  'POST /api/auth/logout',
  'POST /api/auth/refresh',
  'GET /api/students',
  'GET /api/expenses',
  'GET /api/dashboard/stats',
];

const SRC = path.resolve(__dirname, '..', '..');
const GLOBAL_PREFIX = 'api';

const HTTP_VERBS: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
  [RequestMethod.ALL]: 'ALL',
};

/** Controllers excluded from the `/api` prefix in `main.ts`. */
const PREFIX_EXCLUDED_CONTROLLERS = new Set(['RootController']);

interface RouteInfo {
  key: string;
  controller: string;
  handler: string;
  isPublic: boolean;
  roleKeys: string[];
}

/** Metadata keys RolesGuard consults, in its own resolution order. */
const ROLE_KEYS = [ROLES_KEY, ALLOW_ANY_ROLE_KEY, ALLOW_SELF_SERVICE_KEY] as const;

function roleKeysOf(target: object): string[] {
  return ROLE_KEYS.filter((key) => Reflect.getMetadata(key, target) !== undefined);
}

function listControllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === 'dist') continue;
      out.push(...listControllerFiles(full));
    } else if (entry.name.endsWith('.controller.ts')) {
      out.push(full);
    }
  }
  return out;
}

function normalize(controllerPath: string, methodPath: string, skipPrefix: boolean): string {
  const segments = ['', ...(skipPrefix ? [] : [GLOBAL_PREFIX]), controllerPath, methodPath]
    .join('/')
    .split('/')
    .filter((s) => s !== '' && s !== '.');
  return '/' + segments.join('/');
}

/**
 * Walks every `*.controller.ts` under `src/` and reads the SAME metadata
 * `GlobalAuthGuard` reads (`IS_PUBLIC_KEY` via `Reflector`), plus the role
 * metadata `RolesGuard` reads. No application boot: the assertion is about
 * what the guards will see, not about runtime wiring.
 */
async function collectRoutesOnce(): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = [];

  for (const file of listControllerFiles(SRC)) {
    const relative = './' + path.relative(__dirname, file).replace(/\\/g, '/');
    const mod: Record<string, unknown> = await import(/* @vite-ignore */ relative);

    for (const [exportName, exported] of Object.entries(mod)) {
      if (typeof exported !== 'function') continue;
      const controllerPath = Reflect.getMetadata(PATH_METADATA, exported) as string | string[] | undefined;
      if (controllerPath === undefined) continue;

      const skipPrefix = PREFIX_EXCLUDED_CONTROLLERS.has(exportName);
      const controllerIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, exported) === true;
      const classRoleKeys = roleKeysOf(exported);
      const paths = Array.isArray(controllerPath) ? controllerPath : [controllerPath];

      for (const handler of Object.getOwnPropertyNames(exported.prototype).filter(
        (name) => name !== 'constructor',
      )) {
        const descriptor = Object.getOwnPropertyDescriptor(exported.prototype, handler);
        if (!descriptor || typeof descriptor.value !== 'function') continue;
        const methodPath = Reflect.getMetadata(PATH_METADATA, descriptor.value) as string | undefined;
        if (methodPath === undefined) continue;

        const verb = Reflect.getMetadata(METHOD_METADATA, descriptor.value) as number | undefined;
        const httpVerb = verb !== undefined ? HTTP_VERBS[verb] ?? `METHOD(${verb})` : 'ALL';

        const isPublic =
          controllerIsPublic || Reflect.getMetadata(IS_PUBLIC_KEY, descriptor.value) === true;

        // RolesGuard resolves with getAllAndOverride([handler, class]), so a
        // route is role-restricted if EITHER level declares roles.
        const roleKeys = [...new Set([...classRoleKeys, ...roleKeysOf(descriptor.value)])];

        for (const p of paths) {
          routes.push({
            key: `${httpVerb} ${normalize(p, methodPath, skipPrefix)}`,
            controller: exportName,
            handler,
            isPublic,
            roleKeys,
          });
        }
      }
    }
  }

  return routes.sort((a, b) => a.key.localeCompare(b.key));
}

// The scan imports every controller module (~400 routes); do it once per run.
let cachedRoutes: Promise<RouteInfo[]> | undefined;
function routesOnce(): Promise<RouteInfo[]> {
  cachedRoutes ??= collectRoutesOnce();
  return cachedRoutes;
}

describe('public route allow-list', () => {
  it('scans the whole API surface', async () => {
    const routes = await routesOnce();
    // Sanity: a broken scan would silently make every assertion below vacuous.
    expect(routes.length).toBeGreaterThan(400);
    expect(routes.some((r) => r.controller === 'StudentsController')).toBe(true);
    expect(routes.some((r) => r.controller === 'TerminalWebhookController')).toBe(true);
  });

  it('exposes EXACTLY the reviewed @AllowPublic() allow-list', async () => {
    const routes = await routesOnce();
    const actual = routes.filter((r) => r.isPublic).map((r) => r.key).sort();

    expect(actual).toEqual([...ALLOWED_PUBLIC_ROUTES].sort());
  });

  it('never marks a route public AND role-restricted (contradictory metadata)', async () => {
    const routes = await routesOnce();
    const contradictory = routes.filter((r) => r.isPublic && r.roleKeys.length > 0);

    expect(contradictory.map((r) => `${r.key} -> ${r.roleKeys.join(',')}`)).toEqual([]);
  });

  it('keeps session-bearing auth and data routes authenticated', async () => {
    const routes = await routesOnce();
    const byKey = new Map(routes.map((r) => [r.key, r]));

    for (const key of MUST_STAY_AUTHENTICATED) {
      const route = byKey.get(key);
      expect(route, `${key} must exist in the route table`).toBeDefined();
      expect(route?.isPublic, `${key} must not be public`).toBe(false);
    }
  });

  it('registers GlobalAuthGuard as a global APP_GUARD, behind ThrottlerGuard', () => {
    const providers = (Reflect.getMetadata('providers', AppModule) ?? []) as Array<{
      provide?: unknown;
      useClass?: unknown;
    }>;

    const appGuards = providers.filter((p) => p && p.provide === APP_GUARD);

    expect(appGuards.length).toBe(2);
    expect(appGuards[0].useClass).toBe(ThrottlerGuard);
    expect(appGuards[1].useClass).toBe(GlobalAuthGuard);
  });
});
