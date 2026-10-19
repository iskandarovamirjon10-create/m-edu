import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { RedisPubSubService } from '../redis/redis-pubsub.service';
import { IDEMPOTENT_OPTIONS_KEY, IdempotentOptions } from './idempotency.decorator';

interface IdempotencyCacheEntry {
  state: 'PROCESSING' | 'COMPLETED';
  statusCode: number;
  data: unknown;
  createdAt: number;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly redis: RedisPubSubService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: { organizationId?: string; id?: string } }>();
    const res = http.getResponse<Response>();

    const options: IdempotentOptions =
      this.reflector.getAllAndOverride<IdempotentOptions>(IDEMPOTENT_OPTIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || {};

    const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!idempotencyKey) {
      if (options.required) {
        throw new BadRequestException('Idempotency-Key header is required for this operation.');
      }
      return next.handle();
    }

    if (
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.trim().length < 8 ||
      idempotencyKey.length > 255
    ) {
      throw new BadRequestException(
        'Invalid Idempotency-Key header format. Expected 8-255 characters string.',
      );
    }

    const orgId = req.user?.organizationId || 'global';
    const method = req.method ? req.method.toUpperCase() : 'POST';
    const cleanPath = req.baseUrl || req.path || '/';
    const cacheKey = `idempotency:${orgId}:${method}:${cleanPath}:${idempotencyKey}`;

    const lockTtlMs = (options.lockTimeoutSeconds || 60) * 1000;
    const cacheTtlMs = (options.ttlSeconds || 86400) * 1000;

    return from(this.redis.get(cacheKey)).pipe(
      switchMap((existingRaw) => {
        if (existingRaw) {
          try {
            const entry: IdempotencyCacheEntry = JSON.parse(existingRaw);
            if (entry.state === 'PROCESSING') {
              throw new ConflictException(
                'An identical request is currently being processed. Please wait for completion before retrying.',
              );
            }
            if (entry.state === 'COMPLETED') {
              res.setHeader('X-Idempotency-Replayed', 'true');
              res.setHeader('X-Idempotency-Key', idempotencyKey);
              if (res.status && typeof res.status === 'function') {
                res.status(entry.statusCode);
              }
              return of(entry.data);
            }
          } catch (parseErr) {
            if (parseErr instanceof ConflictException) throw parseErr;
            this.logger.warn(`Corrupt idempotency entry for ${cacheKey}, resetting lock.`);
          }
        }

        const lockPayload: IdempotencyCacheEntry = {
          state: 'PROCESSING',
          statusCode: 0,
          data: null,
          createdAt: Date.now(),
        };

        return from(
          this.redis.setIfNotExists(cacheKey, JSON.stringify(lockPayload), lockTtlMs),
        ).pipe(
          switchMap((acquired) => {
            if (!acquired) {
              throw new ConflictException(
                'An identical request is currently being processed. Please wait for completion before retrying.',
              );
            }

            if (res.setHeader && typeof res.setHeader === 'function') {
              res.setHeader('X-Idempotency-Key', idempotencyKey);
            }

            return next.handle().pipe(
              tap({
                next: (data) => {
                  const completedPayload: IdempotencyCacheEntry = {
                    state: 'COMPLETED',
                    statusCode: res.statusCode || 200,
                    data,
                    createdAt: Date.now(),
                  };
                  void this.redis
                    .set(cacheKey, JSON.stringify(completedPayload), cacheTtlMs)
                    .catch((saveErr) => {
                      this.logger.warn(
                        `Failed to cache idempotent response for ${cacheKey}: ${saveErr}`,
                      );
                    });
                },
              }),
              catchError((err) => {
                void this.redis.delete(cacheKey).catch((delErr) => {
                  this.logger.warn(
                    `Failed to release idempotency lock for ${cacheKey}: ${delErr}`,
                  );
                });
                throw err;
              }),
            );
          }),
        );
      }),
    );
  }
}
