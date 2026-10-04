import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';

/**
 * Route-level JWT guard.
 *
 * Kept so `@UseGuards(JwtAuthGuard, RolesGuard)` continues to work verbatim,
 * but made idempotent: when `GlobalAuthGuard` has already validated the token
 * and populated `req.user`, re-running the Passport strategy would repeat the
 * JWT signature check plus two Prisma lookups (user + session) on every
 * request. Short-circuiting here keeps the per-request database cost at one
 * verification while preserving defence in depth — if the global guard were
 * ever removed, this guard still authenticates on its own.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest() as {
        user?: unknown;
        isAuthenticated?: () => boolean;
      };
      // `req.user` is only ever written by a completed Passport `jwt`
      // authentication (GlobalAuthGuard or this guard) or by an OAuth
      // strategy callback; never by untrusted input.
      if (req?.user) {
        return true;
      }
    }
    return super.canActivate(context);
  }
}
