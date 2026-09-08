import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { isGoogleOAuthConfigured } from './google-oauth-config';
import { OAuthRedirectException } from './oauth-redirect.exception';
import type { GoogleProfile } from './types';

/**
 * Google OAuth guard.
 *
 * CSRF `state` handling is performed by passport itself (`state: true` +
 * express-session): it generates the nonce at initiation, stores it in the
 * session, and verifies the echoed value on the callback — callbacks with a
 * missing/mismatched/replayed state fail before any token exchange.
 *
 * This guard additionally:
 *  - bounces Google error returns (?error=access_denied etc.) straight to
 *    the frontend with a safe message (no OAuth re-initiation loop, no
 *    internals leaked), and
 *  - maps passport failures to safe client errors.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const code = typeof req.query?.code === 'string' ? req.query.code : null;
    const oauthError = req.query?.error;

    // Initiation leg: if Google credentials are not configured, fail fast
    // with a friendly message instead of sending the user to Google with a
    // bogus client_id (Google would answer 401 invalid_client on a
    // placeholder client). After configuring GOOGLE_CLIENT_ID/SECRET, the
    // API must be restarted (env is read at boot).
    //
    // IMPORTANT — the guard NEVER writes the response itself. Responding
    // here and continuing through the Nest pipeline causes a second write:
    // returning `false` produced an uncaught ERR_HTTP_HEADERS_SENT (403/500
    // in logs), returning `true` produced a spurious 200 status in the
    // request log while the client saw the 302. The redirect is signalled
    // via OAuthRedirectException and emitted exactly once by the global
    // exception filter.
    if (!code && !oauthError && !isGoogleOAuthConfigured()) {
      const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const msg =
        'Google sign-in is not configured on this server yet. Please sign in with your email and password.';
      throw new OAuthRedirectException(
        `${frontendUrl}/auth/callback?error=${encodeURIComponent(msg)}`,
      );
    }

    if (!code && oauthError) {
      // Google returned an error (e.g. the user denied consent). No code was
      // issued, so nothing to exchange — bounce to the frontend safely.
      const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const safeMessage =
        oauthError === 'access_denied'
          ? 'You cancelled Google sign-in.'
          : 'Google sign-in failed. Please try again.';
      throw new OAuthRedirectException(
        `${frontendUrl}/auth/callback?error=${encodeURIComponent(safeMessage)}`,
      );
    }

    return super.canActivate(context) as boolean;
  }

  handleRequest<TUser = GoogleProfile>(
    err: Error | null,
    user: TUser,
    _info: unknown,
  ): TUser {
    if (err || !user) {
      // Never leak passport/internal error details to the client.
      throw err instanceof UnauthorizedException
        ? err
        : new UnauthorizedException('Google authentication failed. Please try again.');
    }
    return user;
  }
}
