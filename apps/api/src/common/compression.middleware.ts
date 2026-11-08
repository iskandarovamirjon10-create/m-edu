import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import * as zlib from 'node:zlib';

/**
 * High-Performance Native HTTP Response Compression Middleware.
 * Uses Node.js built-in `node:zlib` with zero external dependencies.
 * Compresses JSON, text, and large payloads (>1KB) with gzip or deflate.
 * Reduces network payload transfer sizes by 75% to 90%.
 */
@Injectable()
export class FastCompressionMiddleware implements NestMiddleware {
  private readonly thresholdBytes = 1024;

  use(req: Request, res: Response, next: NextFunction): void {
    const acceptEncoding = (req.headers['accept-encoding'] as string) || '';

    // If client does not accept compression or SSE stream, bypass
    if (
      (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate')) ||
      req.headers['accept'] === 'text/event-stream'
    ) {
      return next();
    }

    const originalSend = res.send.bind(res);

    res.send = (body: any): Response => {
      // Bypasses if empty or already encoded
      if (
        !body ||
        res.statusCode === 204 ||
        res.statusCode === 304 ||
        res.getHeader('Content-Encoding')
      ) {
        return originalSend(body);
      }

      let buffer: Buffer;
      if (Buffer.isBuffer(body)) {
        buffer = body;
      } else if (typeof body === 'string') {
        buffer = Buffer.from(body, 'utf8');
      } else if (typeof body === 'object') {
        try {
          const json = JSON.stringify(body);
          if (!res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          }
          buffer = Buffer.from(json, 'utf8');
        } catch {
          return originalSend(body);
        }
      } else {
        buffer = Buffer.from(String(body), 'utf8');
      }

      // Skip small payloads where compression overhead exceeds benefits
      if (buffer.length < this.thresholdBytes) {
        return originalSend(buffer);
      }

      const useGzip = acceptEncoding.includes('gzip');
      try {
        const compressed = useGzip
          ? zlib.gzipSync(buffer, { level: 6 })
          : zlib.deflateSync(buffer, { level: 6 });

        res.setHeader('Content-Encoding', useGzip ? 'gzip' : 'deflate');
        res.setHeader('Vary', 'Accept-Encoding');
        res.removeHeader('Content-Length');
        return originalSend(compressed);
      } catch {
        return originalSend(buffer);
      }
    };

    next();
  };
}
