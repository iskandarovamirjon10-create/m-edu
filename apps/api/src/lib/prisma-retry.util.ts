import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const _logger = new Logger('PrismaRetry');

/**
 * Only transient/concurrency errors may be retried.
 *
 * P2024 — connection pool timeout (database under load)
 * P2034 — transaction write conflict / deadlock
 * 40001 — serialization failure
 * 40P01 — deadlock detected
 *
 * Deterministic errors (P2002 unique violation, P2000 value too long,
 * P2025 record not found, validation errors, …) are NOT retryable: retrying
 * them can never succeed and only amplifies load (retry storm).
 */
const TRANSIENT_ERROR_CODES = new Set(['P2024', 'P2034', '40001', '40P01']);

/**
 * Exported for tests — reports whether an error is worth retrying.
 */
export const isTransientPrismaError = (err: unknown): boolean => {
  if (typeof err === 'object' && err !== null) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code)) {
      return true;
    }
    const message = (err as { message?: string }).message;
    if (typeof message === 'string') {
      if (message.includes('serialization failure')) return true;
      if (message.includes('deadlock detected')) return true;
      if (message.includes('could not serialize')) return true;
      if (message.includes('Timed out fetching a new connection')) return true;
    }
  }
  return false;
};

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  logger?: Logger;
}

export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 100;
  const maxDelayMs = opts.maxDelayMs ?? 5000;

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (!isTransientPrismaError(err) || attempt >= maxAttempts) {
        throw err;
      }

      attempt++;
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      opts.logger?.warn(
        `Prisma retry attempt ${attempt}/${maxAttempts} after ${delay}ms`,
        JSON.stringify({ code: (err as { code?: string })?.code }),
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export type PrismaTxClient = PrismaClient | Omit<PrismaClient, '$transaction' | '$executeRawUnsafe' | '$queryRawUnsafe'>;
