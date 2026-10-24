import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from './public.decorator';

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
  constructor(private readonly reflector?: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (this.reflector) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (isPublic === true) {
        return true;
      }
    }

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

  handleRequest(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
    if (user) return user;

    // LOGIC-04: On /auth/refresh, if the access token has expired but was signed legitimately,
    // allow the request into AuthController.refresh to check and rotate the active DB session
    const req = context.switchToHttp().getRequest();
    const url = req.url || req.path || '';
    if (url.includes('/auth/refresh') && info?.name === 'TokenExpiredError') {
      return null;
    }

    return super.handleRequest(err, user, info, context, status);
  }
}
