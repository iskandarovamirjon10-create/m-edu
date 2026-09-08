/**
 * Request logging middleware with request IDs.
 *
 * Assigns a correlation ID (X-Request-Id) to every request, logs method,
 * path, status, duration and actor (when authenticated). Sensitive data is
 * NEVER logged: Authorization headers are not included, and request bodies
 * are not logged at all.
 *
 * The request ID is also exposed on error responses so operators can
 * correlate a client-visible failure with server logs.
 */
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { RequestUser } from '../auth/types';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request & { id?: string; user?: RequestUser }, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    req.id = requestId;

    const startedAt = process.hrtime.bigint();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const actor = req.user?.sub ? ` user=${String(req.user.sub).slice(0, 8)}` : '';
      this.logger.log(
        `${method} ${originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms${actor} id=${requestId.slice(0, 8)}`,
      );
    });

    next();
  }
}
