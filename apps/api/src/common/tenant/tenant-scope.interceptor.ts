import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { isPlatformRole } from '../../auth/authorization.policy';
import { runWithTenant, type TenantStore } from './tenant-context';

/**
 * Binds the authenticated principal's organization to the request's async
 * context so the Prisma middleware can enforce tenant scoping (SEC-02).
 *
 * Why an interceptor: NestJS runs guards BEFORE interceptors, so by the time
 * this runs `req.user` has been resolved by `GlobalAuthGuard`/`JwtStrategy`.
 * Why a custom Observable instead of `defer`: `next.handle()` returns a cold
 * observable that Nest subscribes to later; only a subscription created inside
 * `runWithTenant` keeps the store attached to every async resource the handler
 * spawns (Prisma calls included).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (typeof context.getType === 'function' && context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      user?: { organizationId?: string; role?: string; sub?: string };
      id?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const organizationId =
      typeof request?.user?.organizationId === 'string'
        ? request.user.organizationId.trim()
        : '';

    // Public endpoints, webhooks and cron runs have no principal. They are not
    // tenant-bound, so the middleware intentionally leaves their queries alone.
    if (!organizationId) {
      return next.handle();
    }

    const header = request.headers?.['x-request-id'];
    const requestId = Array.isArray(header) ? header[0] : header;

    const store: TenantStore = {
      organizationId,
      role: request.user?.role ?? '',
      // Cross-tenant operators must not be silently narrowed into one tenant.
      bypass: isPlatformRole(request.user?.role),
      requestId,
    };

    return new Observable((subscriber) =>
      runWithTenant(store, () => next.handle().subscribe(subscriber)),
    );
  }
}
