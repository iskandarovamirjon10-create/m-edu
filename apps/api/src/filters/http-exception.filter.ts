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


/**
 * Redacts any leaked database credentials, connection URLs, or auth secrets from error messages.
 */
function sanitizeErrorMessage(msg: string): string {
  if (!msg || typeof msg !== 'string') return msg;
  return msg
    .replace(new RegExp('(postgres(?:ql)?:\\/\\/[^:]+:)[^@]+(@)', 'gi'), '$1***$2')
    .replace(/(bearer\s+)[a-zA-Z0-9._-]+/gi, '$1***')
    .replace(/("password"|"secret"|"token"|"apiKey"|"jwt")\s*:\s*"[^"]+"/gi, '$1: "***"');
}

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
    if (!response || response.headersSent || response.writableEnded) {
      return;
    }

    if (exception instanceof OAuthRedirectException) {
      // Controlled OAuth redirect (single write path — see the class docs).
      if (typeof response.redirect === 'function') {
        response.redirect(exception.statusCode, exception.url);
      }
      return;
    }

    if (typeof response.status !== 'function') {
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: string | undefined;
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
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
        if (Array.isArray(rawMessage)) {
          message = rawMessage.join(', ');
          details = { ...(details || {}), errors: rawMessage };
          if (!code) {
            code = 'VALIDATION_ERROR';
          }
        }
        if (b.error && typeof b.error === 'string' && !code) {
          code = (b.error as string).toUpperCase().replace(/\s+/g, '_');
        }
      }
    } else if (
      exception instanceof Error &&
      (exception as Error & { type?: unknown }).type === 'entity.too.large'
    ) {
      // express/body-parser payload limit exceeded → 413, not 500
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = 'Request payload too large';
      this.logger.warn(`Payload too large on ${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''}`);
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
      (exception.name === 'PrismaClientValidationError' || (exception as any).constructor?.name === 'PrismaClientValidationError')
    ) {
      status = HttpStatus.BAD_REQUEST;
      code = 'DATABASE_VALIDATION_ERROR';
      message = 'Invalid input query parameters or data format';
      this.logger.warn(`Prisma validation error on ${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''}: ${exception.message.slice(0, 200)}`);
    } else if (
      exception instanceof Error &&
      (exception.name === 'PrismaClientInitializationError' || (exception as any).constructor?.name === 'PrismaClientInitializationError')
    ) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = 'DATABASE_CONNECTION_ERROR';
      message = 'Database service connection unavailable';
      this.logger.error(`Prisma initialization error on ${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''}: ${exception.message}`);
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
        P2001: [HttpStatus.NOT_FOUND, 'Record not found'],
        P2002: [HttpStatus.CONFLICT, 'A record with this value already exists'],
        P2025: [HttpStatus.NOT_FOUND, 'Record not found'],
        P2003: [HttpStatus.BAD_REQUEST, 'Related record not found'],
        P2011: [HttpStatus.BAD_REQUEST, 'Null constraint violation on required field'],
        P2012: [HttpStatus.BAD_REQUEST, 'Missing a required value'],
        P2013: [HttpStatus.BAD_REQUEST, 'Missing a required argument'],
        P2014: [HttpStatus.BAD_REQUEST, 'Invalid relation data'],
        P2015: [HttpStatus.NOT_FOUND, 'Related record not found'],
        P2016: [HttpStatus.BAD_REQUEST, 'Query interpretation error'],
        P2017: [HttpStatus.BAD_REQUEST, 'Related records are not connected'],
        P2018: [HttpStatus.NOT_FOUND, 'Required connected records not found'],
        P2023: [HttpStatus.BAD_REQUEST, 'Invalid identifier format'],
        P2000: [HttpStatus.BAD_REQUEST, 'The provided value is too long'],
        P2006: [HttpStatus.BAD_REQUEST, 'The provided value is invalid'],
        P2034: [HttpStatus.CONFLICT, 'Transaction conflict or deadlock, please retry'],
      };
      const mapping = prismaMap[prismaCode];
      if (mapping) {
        [status, message] = mapping;
      }
      this.logger.warn(
        `Prisma error ${prismaCode} on ${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''}: ${exception.message}`,
      );
    } else if (
      exception instanceof Error &&
      'code' in exception &&
      typeof (exception as any).code === 'string' &&
      /^(22P02|23505|23503|40P01|40001)$/.test((exception as any).code)
    ) {
      // Postgres raw driver errors (e.g. from $queryRaw)
      const pgCode = (exception as any).code as string;
      const pgMap: Record<string, [number, string]> = {
        '22P02': [HttpStatus.BAD_REQUEST, 'Invalid input syntax (malformed identifier or type)'],
        '23505': [HttpStatus.CONFLICT, 'A record with this value already exists'],
        '23503': [HttpStatus.BAD_REQUEST, 'Related record not found'],
        '40P01': [HttpStatus.CONFLICT, 'Database deadlock detected, please retry'],
        '40001': [HttpStatus.CONFLICT, 'Transaction serialization conflict, please retry'],
      };
      const mapping = pgMap[pgCode];
      if (mapping) {
        [status, message] = mapping;
      }
      this.logger.warn(
        `Postgres error ${pgCode} on ${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''}: ${exception.message}`,
      );
    } else if (exception instanceof Error) {
      // 500 for unexpected errors — log internally, never expose details.
      // The raw message is only echoed to the client OUTSIDE production;
      // in production the client always gets the generic message.
      if (process.env.NODE_ENV !== 'production') {
        message = sanitizeErrorMessage(exception.message);
      }
      this.logger.error(
        `Unhandled exception on ${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''}: ${exception.message}`,
        exception.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      code,
      message: sanitizeErrorMessage(message),
      ...(details ? { details } : {}),
      path: request?.url ?? '',
      requestId: request?.id || (request?.headers?.['x-request-id'] as string | undefined),
      timestamp: new Date().toISOString(),
    });
  }
}
