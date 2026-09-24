import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CSRF_COOKIE_NAME } from './csrf.middleware';

/**
 * Public CSRF-token seed endpoint.
 *
 * `CsrfMiddleware` sets the `XSRF-TOKEN` cookie on every response that does
 * not already carry one; this route exists so the SPA can force that to
 * happen *before* its first mutating request (login, password reset, …)
 * instead of racing it. It returns no secret: the token is only ever read
 * from the cookie, which the browser must echo back in `X-XSRF-TOKEN`.
 */
@ApiTags('Security')
@Controller('csrf-token')
@SkipThrottle()
export class CsrfController {
  @Get()
  @ApiOperation({ summary: 'Ensure the XSRF-TOKEN cookie is present' })
  getToken(@Req() req: Request) {
    const token = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE_NAME];
    return { cookieName: CSRF_COOKIE_NAME, present: typeof token === 'string' && token.length > 0 };
  }
}
