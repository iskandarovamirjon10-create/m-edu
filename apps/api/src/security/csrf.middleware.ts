import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { requiresCsrfValidation } from './csrf.policy';

export const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
export const CSRF_HEADER_NAME = 'x-xsrf-token';

/**
 * Double-submit-cookie CSRF protection.
 *
 * Behaviour (see csrf.policy.ts for the exact scope):
 *   1. Every request gets an `XSRF-TOKEN` cookie if it does not already carry
 *      one, so a browser can always satisfy the check on its next mutation.
 *   2. Requests that are not cookie-authenticated mutating browser requests
 *      (GET/HEAD, machine webhooks, `Authorization`-header callers) are
 *      allowed through untouched — previously these were rejected with 403,
 *      which broke the Telegram webhook and every server-to-server client.
 *   3. Cookie-authenticated mutations must present a header that matches the
 *      cookie, compared in constant time.
 *
 * The frontend calls `GET /api/csrf-token` before its first mutation when the
 * cookie is missing, which removes the previous "first POST of a brand-new
 * browser session fails" race.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
    let token: string | undefined = typeof existingToken === 'string' ? existingToken : undefined;

    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // must be readable by the frontend (double submit)
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
      });
    }

    const mustValidate = requiresCsrfValidation({
      method: req.method,
      path: req.originalUrl || req.url || '',
      headers: req.headers as unknown as Record<string, unknown>,
    });

    if (!mustValidate) {
      next();
      return;
    }

    const headerToken = req.headers[CSRF_HEADER_NAME] ?? req.headers['x-csrf-token'];

    if (
      typeof headerToken !== 'string' ||
      !token ||
      !this.timingSafeEqual(headerToken, token)
    ) {
      throw new ForbiddenException(
        'Invalid CSRF token. Fetch GET /api/csrf-token (or reload the page) and retry with the X-XSRF-TOKEN header.',
      );
    }

    next();
  }

  /**
   * Constant-time string comparison.
   *
   * A plain `!==` short-circuits on the first differing byte, leaking the
   * position of the first mismatch through response timing and allowing the
   * token to be recovered byte-by-byte. `crypto.timingSafeEqual` compares in
   * constant time but requires equal-length buffers (it throws otherwise), so
   * lengths are mixed into a hash first: comparing digests of the raw values
   * keeps the comparison constant-time for arbitrary inputs without
   * revealing length through a thrown error or an early length check.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    const digest = (value: string) => crypto.createHash('sha256').update(value, 'utf8').digest();

    return crypto.timingSafeEqual(digest(a), digest(b));
  }
}
