import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  operationName?: string;
}

const logger = new Logger('PrismaResilience');

/**
 * Checks whether a database exception is transient and safe to retry
 * (e.g. deadlock, serialization failure, connection pool acquisition timeout, or connection reset).
 */
export function isTransientDatabaseError(error: unknown): boolean {
  if (!error) return false;

  // Error code check (Prisma or Postgres raw error)
  const code = (error as { code?: string })?.code;
  if (typeof code === 'string') {
    // Postgres codes:
    // 40P01 = deadlock_detected
    // 40001 = serialization_failure
    // 57P01 = admin_shutdown
    // 08006 = connection_failure
    // 08003 = connection_does_not_exist
    if (code === '40P01' || code === '40001' || code === '08006' || code === '08003') {
      return true;
    }

    // Prisma error codes:
    // P2034: Transaction failed due to a write conflict or a deadlock. Please retry your transaction.
    // P2024: Timed out fetching a new connection from the connection pool.
    // P1001: Can't reach database server
    // P1002: The database server was reached but timed out
    // P1008: Operations timed out
    if (code === 'P2034' || code === 'P2024' || code === 'P1001' || code === 'P1002' || code === 'P1008') {
      return true;
    }
  }

  // Error message checks
  const message = (error as { message?: string })?.message || String(error);
  const transientPatterns = [
    /deadlock detected/i,
    /could not serialize access/i,
    /concurrent transaction/i,
    /write conflict/i,
    /connection terminated unexpectedly/i,
    /connection reset/i,
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /connection closed/i,
    /broken pipe/i,
  ];

  return transientPatterns.some((pattern) => pattern.test(message));
}

/**
 * Executes a database operation with exponential backoff and jitter on transient errors.
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const opName = options.operationName ?? 'DatabaseOperation';

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt++;

      if (attempt > maxRetries || !isTransientDatabaseError(error)) {
        throw error;
      }

      // Calculate exponential backoff with full jitter
      const exponentialDelay = initialDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * (initialDelayMs / 2);
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      const errCode = (error as { code?: string })?.code || 'TRANSIENT';
      const errMsg = (error as { message?: string })?.message || String(error);

      logger.warn(
        `[${opName}] Transient DB failure (${errCode}: ${errMsg.slice(0, 100)}). Retry attempt ${attempt}/${maxRetries} after ${Math.round(delay)}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
