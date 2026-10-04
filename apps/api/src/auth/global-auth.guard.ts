import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Global authentication guard — the fail-closed default for the whole API.
 *
 * Registered as an `APP_GUARD` in `AppModule` (AFTER `ThrottlerGuard`, so
 * rate limiting still keys anonymous traffic before we spend a JWT verify on
 * it, and so the existing throttle regression test keeps finding
 * `ThrottlerGuard` first).
 *
 * Behaviour
 * ---------
 * | context | decision                                                    |
 * |---------|-------------------------------------------------------------|
 * | HTTP    | `@AllowPublic()` → pass; otherwise run the `jwt` strategy    |
 * | WS/RPC  | pass — a Passport HTTP strategy cannot read a socket          |
 * |         | handshake. Gateway handlers are authenticated by their own    |
 * |         | class-level `WsJwtGuard`, which `global-auth.guard.spec.ts`   |
 * |         | proves is present on every registered gateway.                |
 *
 * When the strategy rejects (missing / malformed / expired token, revoked or
 * expired session, deactivated user, organization mismatch) `AuthGuard` throws
 * `UnauthorizedException` → HTTP 401. It never converts a failure into a pass.
 */
@Injectable()
export class GlobalAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Non-HTTP contexts are handled by their own guards (see table above).
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic === true) {
      return true;
    }

    return super.canActivate(context);
  }
}
