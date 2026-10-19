import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { CSRF_COOKIE_NAME } from './csrf.middleware';
import { AllowPublic } from '../auth/public.decorator';

/**
 * Public CSRF-token seed endpoint.
 *
 * Ensures the `XSRF-TOKEN` cookie is present on the response so the SPA/client
 * can immediately satisfy double-submit CSRF requirements on mutations.
 */
@ApiTags('Security')
@AllowPublic()
@Controller('csrf-token')
@SkipThrottle()
export class CsrfController {
  @Get()
  @ApiOperation({ summary: 'Ensure the XSRF-TOKEN cookie is present' })
  getToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    let token = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE_NAME];
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
    return { cookieName: CSRF_COOKIE_NAME, present: true };
  }
}
