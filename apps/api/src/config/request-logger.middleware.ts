/**
 * Request logging middleware with request IDs & APM telemetry timing.
 *
 * Assigns a correlation ID (X-Request-Id) to every request, logs method,
 * path, status, duration and actor (when authenticated). Sensitive data is
 * NEVER logged: Authorization headers are not included, request bodies are
 * not logged at all, and query-string values for known secrets (OAuth
 * `code`, `state`, `token`, `password`, …) are replaced with `***`.
 *
 * Attaches standard enterprise APM headers:
 *  - X-Request-Id: correlation tracking
 *  - X-Response-Time: execution duration in milliseconds
 *  - Server-Timing: W3C standard trace metrics
 */
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { RequestUser } from '../auth/types';

/** Query params whose values must never appear in logs. */
const SENSITIVE_QUERY_KEYS = new Set([
  'code',
  'state',
  'token',
  'access_token',
  'id_token',
  'refresh_token',
  'password',
  'passwd',
  'secret',
  'api_key',
  'apikey',
  'signature',
  'sig',
  'jwt',
]);

/**
 * Strip known-sensitive values from a URL's query string while keeping the
 * path (and non-sensitive params) intact for debugging.
 */
export function redactUrl(rawUrl: string): string {
  const qIndex = rawUrl.indexOf('?');
  if (qIndex === -1) return rawUrl;
  const path = rawUrl.slice(0, qIndex);
  const query = rawUrl.slice(qIndex + 1);
  const parts = query.split('&').map((pair) => {
    const eq = pair.indexOf('=');
    if (eq === -1) return pair;
    const key = pair.slice(0, eq);
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      return `${key}=***`;
    }
    return pair;
  });
  return `${path}?${parts.join('&')}`;
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request & { id?: string; user?: RequestUser }, res: Response, next: NextFunction) {
    // SECURITY: never trust inbound ids verbatim. An attacker can forge
    // `\r\n`, unbounded strings or shared ids to corrupt logs / poison
    // correlation. Accept only a tight public-safe shape, otherwise mint one.
    const rawRequestId = req.headers['x-request-id'];
    const requestId =
      typeof rawRequestId === 'string' && /^[A-Za-z0-9._-]{8,64}$/.test(rawRequestId)
        ? rawRequestId
        : randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    req.id = requestId;

    const startedAt = process.hrtime.bigint();
    const { method, originalUrl } = req;
    const safeUrl = redactUrl(originalUrl);

    // Attach W3C Server-Timing & X-Response-Time headers before response headers are flushed
    const originalWriteHead = res.writeHead;
    res.writeHead = function (...args: any[]) {
      if (!res.headersSent) {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        res.setHeader('X-Response-Time', `${durationMs.toFixed(1)}ms`);
        res.setHeader('Server-Timing', `app;dur=${durationMs.toFixed(1)}`);
      }
      return originalWriteHead.apply(this, args as any);
    };

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const actor = req.user?.sub ? ` user=${String(req.user.sub).slice(0, 8)}` : '';
      this.logger.log(
        `${method} ${safeUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms${actor} id=${requestId.slice(0, 8)}`,
      );
    });

    next();
  }
}
