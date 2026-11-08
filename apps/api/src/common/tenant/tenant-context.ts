import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped tenant context (SEC-02).
 *
 * The tenant boundary used to depend entirely on every service remembering to
 * add `organizationId` to its Prisma `where` clause — 2 499 hand-written
 * occurrences and only one helper call. This context closes that gap: the
 * authenticated principal's organization is captured once per request and the
 * Prisma middleware in `PrismaService` injects it into every query against a
 * tenant-scoped model.
 *
 * Populated by `TenantContextInterceptor`, which runs after the auth guard has
 * attached `req.user` (guards run before interceptors in NestJS).
 */
export interface TenantStore {
  /** Organization of the authenticated principal. Never client-supplied. */
  organizationId: string;
  /** Principal role, kept for diagnostics and bypass decisions. */
  role: string;
  /**
   * Platform operators act across tenants by design, so scoping is skipped for
   * them. Derived from `PLATFORM_ROLES` (PLATFORM_OWNER only).
   */
  bypass: boolean;
  /** Request correlation id, used in violation logs. */
  requestId?: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

/** Current request's tenant store, or `undefined` outside a request. */
export function getTenantStore(): TenantStore | undefined {
  return storage.getStore();
}

/** Run `fn` (and every async resource it creates) inside the tenant context. */
export function runWithTenant<T>(store: TenantStore, fn: () => T): T {
  return storage.run(store, fn);
}

/** Test/utility helper: clear the store for the current async chain. */
export function exitTenantContext(): void {
  storage.exit(() => undefined);
}
