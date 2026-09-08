import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import type { RequestUser, TenantContext } from '../../auth/types';

interface TenantRequest {
  user?: RequestUser;
  tenantContext?: TenantContext;
}

/**
 * Builds the tenant context exclusively from the authenticated JWT principal.
 *
 * Security invariants:
 * - Never reads tenant identity from client-controlled headers/query/body.
 * - Never trusts an existing tenantContext supplied by the client.
 * - tenantContext exists only when an authenticated principal exists.
 * - organizationId always comes from req.user.organizationId.
 * - A missing organizationId fails closed instead of creating an invalid
 *   tenant context.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request =
      context
        .switchToHttp()
        .getRequest<TenantRequest>();

    const user = request.user;

    /*
     * Never preserve a pre-existing tenant context.
     *
     * The interceptor owns this field and must rebuild it exclusively
     * from the authenticated principal.
     */
    delete request.tenantContext;

    /*
     * Unauthenticated requests are allowed to continue.
     *
     * Authentication/authorization guards remain responsible for deciding
     * whether the endpoint itself requires authentication.
     */
    if (!user) {
      return next.handle();
    }

    /*
     * organizationId is the tenant security boundary.
     *
     * Do not construct a tenant context without it.
     * RequestUser should normally guarantee this at the type/auth layer,
     * but this runtime check provides a fail-closed defense.
     */
    if (!user.organizationId) {
      return next.handle();
    }

    const tenantContext: TenantContext = {
      userId: user.sub,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    request.tenantContext = tenantContext;

    return next.handle();
  }
}