import { SetMetadata, applyDecorators, UseInterceptors } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';

export const IDEMPOTENT_OPTIONS_KEY = 'IDEMPOTENT_OPTIONS_KEY';

export interface IdempotentOptions {
  /**
   * Time-to-live for cached response in seconds. Default: 86,400 (24 hours).
   */
  ttlSeconds?: number;
  /**
   * Timeout in seconds for in-flight processing lock. Default: 60 seconds.
   */
  lockTimeoutSeconds?: number;
  /**
   * Whether the Idempotency-Key header is strictly required. Default: false (if omitted, request runs normally).
   */
  required?: boolean;
}

export function Idempotent(options: IdempotentOptions = {}) {
  return applyDecorators(
    SetMetadata(IDEMPOTENT_OPTIONS_KEY, options),
    UseInterceptors(IdempotencyInterceptor),
  );
}
