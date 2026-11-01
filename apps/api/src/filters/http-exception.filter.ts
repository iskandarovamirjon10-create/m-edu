/**
 * Global HTTP exception filter — never leaks internal details to clients.
 * Internal errors are logged with a secure logger (sensitive data redacted).
 *
 * Error mapping:
 *   - HttpException        → its own status + body (Nest built-ins)
 *   - FacePlatformError    → domain httpStatus + client-safe { code, message }
 *                            (face pipeline: enrollment, liveness, quality,
 *                            matching, tenant isolation, sessions, …)
 *   - everything else      → 500, message exposed only outside production
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FacePlatformError } from '@medu/core';
import { OAuthRedirectException } from '../auth/oauth-redirect.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    // The response may already have been sent by a downstream layer (e.g. a
    // guard performing res.redirect() before Nest raised an exception such
    // as ForbiddenException). Writing again would throw an uncaught
    // ERR_HTTP_HEADERS_SENT and surface as a spurious 500 in logs/monitors.
    // A handled response must never be overwritten by the error path.
    if (response.headersSent || response.writableEnded) {
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: string | undefined;
    let details: Record<string, unknown> | undefined;

    if (exception instanceof OAuthRedirectException) {
      // Controlled OAuth redirect (single write path — see the class docs).
      response.redirect(exception.statusCode, exception.url);
      return;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        const rawMessage = b.message;
        message = typeof rawMessage === 'string' ? rawMessage : exception.message;
        const rawCode = b.code;
        code = typeof rawCode === 'string' ? rawCode : undefined;
        if (Array.isArray(rawMessage)) message = rawMessage.join(', ');
      }
    } else if (
      exception instanceof Error &&
      (exception as Error & { type?: unknown }).type === 'entity.too.large'
    ) {
      // express/body-parser payload limit exceeded → 413, not 500
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = 'Request payload too large';
      this.logger.warn(`Payload too large on ${request.method} ${request.url}`);
    } else if (exception instanceof FacePlatformError) {
      // Domain errors carry a stable error code + intended HTTP status.
      // Only the client-safe payload is exposed — never internal details.
      status = exception.httpStatus;
      const clientError = exception.toClientError();
      message = clientError.message;
      code = clientError.code;
      if (clientError.details) {
        details = clientError.details;
      }
    } else if (
      exception instanceof Error &&
      'code' in exception &&
      typeof (exception as any).code === 'string' &&
      (exception as any).code.startsWith('P')
    ) {
      // Prisma known errors — map to appropriate HTTP status
      const prismaCode = (exception as any).code as string;
      const prismaMap: Record<string, [number, string]> = {
        P1001: [HttpStatus.SERVICE_UNAVAILABLE, 'Database connection failed'],
        P1002: [HttpStatus.GATEWAY_TIMEOUT, 'Database server timed out'],
        P1008: [HttpStatus.GATEWAY_TIMEOUT, 'Database operation timed out'],
        P2024: [HttpStatus.SERVICE_UNAVAILABLE, 'Database connection pool timed out'],
        P2002: [HttpStatus.CONFLICT, 'A record with this value already exists'],
        P2025: [HttpStatus.NOT_FOUND, 'Record not found'],
        P2003: [HttpStatus.BAD_REQUEST, 'Related record not found'],
        P2014: [HttpStatus.BAD_REQUEST, 'Invalid relation data'],
        P2023: [HttpStatus.BAD_REQUEST, 'Invalid identifier format'],
        P2000: [HttpStatus.BAD_REQUEST, 'The provided value is too long'],
        P2006: [HttpStatus.BAD_REQUEST, 'The provided value is invalid'],
      };
      const mapping = prismaMap[prismaCode];
      if (mapping) {
        [status, message] = mapping;
      }
      this.logger.warn(
        `Prisma error ${prismaCode} on ${request.method} ${request.url}: ${exception.message}`,
      );
    } else if (exception instanceof Error) {
      // 500 for unexpected errors — log internally, never expose details.
      // The raw message is only echoed to the client OUTSIDE production;
      // in production the client always gets the generic message.
      if (process.env.NODE_ENV !== 'production') {
        message = exception.message;
      }
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details ? { details } : {}),
      path: request.url,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    });
  }
}
