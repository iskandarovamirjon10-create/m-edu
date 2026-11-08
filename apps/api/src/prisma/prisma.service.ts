import { executeWithRetry, RetryOptions } from '../common/prisma-resilience';
import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { getTenantStore } from '../common/tenant/tenant-context';
import {
  isTenantScopedModel,
  scopePrismaArgs,
  TenantScopeViolation,
} from '../common/tenant/tenant-scope';

type TenantScopeMode = 'off' | 'log' | 'enforce';

function getTunedDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('connection_limit')) {
      const limit = process.env.PRISMA_CONNECTION_LIMIT || '25';
      parsed.searchParams.set('connection_limit', limit);
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      const timeout = process.env.PRISMA_POOL_TIMEOUT || '20';
      parsed.searchParams.set('pool_timeout', timeout);
    }
    if (!parsed.searchParams.has('connect_timeout')) {
      const connectTimeout = process.env.PRISMA_CONNECT_TIMEOUT || '10';
      parsed.searchParams.set('connect_timeout', connectTimeout);
    }
    if (!parsed.searchParams.has('socket_timeout')) {
      const socketTimeout = process.env.PRISMA_SOCKET_TIMEOUT || '30';
      parsed.searchParams.set('socket_timeout', socketTimeout);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly tenantScopeMode: TenantScopeMode;
  private readonly tenantScopeReported = new Set<string>();

  constructor() {
    const tunedUrl = getTunedDatabaseUrl();
    super(
      tunedUrl
        ? {
            datasources: {
              db: {
                url: tunedUrl,
              },
            },
          }
        : undefined,
    );

    this.tenantScopeMode = (() => {
      const raw = (process.env.TENANT_SCOPE_ENFORCEMENT || '').trim().toLowerCase();
      if (raw === 'off' || raw === 'log' || raw === 'enforce') return raw;
      // Tests keep their previous behaviour (detect, do not rewrite) so a unit
      // suite without a full tenant fixture does not change semantics. Every
      // real runtime enforces: a query that forgets the tenant filter is the
      // exact shape of a cross-tenant data leak.
      return process.env.NODE_ENV === 'test' ? 'log' : 'enforce';
    })();
    this.registerTenantScopeMiddleware();
  }

  /**
   * SEC-02 — inject the request's organizationId into every Prisma operation on
   * a tenant-scoped model.
   *
   * Previously the boundary depended on each service remembering to add
   * `organizationId` by hand (2 499 occurrences, `scopeToTenant` called zero
   * times). The middleware closes that gap at the only layer every query must
   * pass through. Raw queries (`$queryRaw*`) are NOT covered — they bypass the
   * middleware by design and must keep their explicit tenant filters.
   */
  private registerTenantScopeMiddleware(): void {
    if (this.tenantScopeMode === 'off') return;

    // `$use` is deprecated in favour of client extensions but is the only hook
    // that rewrites queries on the exact client instance every service injects
    // (an extension would require rewiring all 117 services). Prisma 5.20 still
    // supports it; migrate to $extends on the Prisma 6 upgrade.
    this.$use(async (params, next) => {
      const store = getTenantStore();
      if (!store || store.bypass || !isTenantScopedModel(params.model)) {
        return next(params);
      }

      if (this.tenantScopeMode === 'log') {
        try {
          scopePrismaArgs(params.model, params.action, params.args, store.organizationId);
        } catch (error) {
          if (error instanceof TenantScopeViolation) {
            this.reportTenantIssue(`${params.model}.${params.action}`, error.message);
          }
        }
        return next(params);
      }

      try {
        params.args = scopePrismaArgs(
          params.model,
          params.action,
          params.args,
          store.organizationId,
        );
      } catch (error) {
        if (error instanceof TenantScopeViolation) {
          this.reportTenantIssue(`${params.model}.${params.action}`, error.message);
          throw new ForbiddenException('Tenant isolation violation');
        }
        throw error;
      }

      return next(params);
    });
  }

  private reportTenantIssue(key: string, message: string): void {
    if (this.tenantScopeReported.has(key)) return;
    this.tenantScopeReported.add(key);
    this.logger.warn(`[tenant-scope] ${message}`);
  }

  async onModuleInit() {
    const isTest = process.env.NODE_ENV === 'test';
    const maxRetries = isTest ? 1 : Number(process.env.PRISMA_CONNECT_MAX_RETRIES || 5);
    let delayMs = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Prisma connected to PostgreSQL connection pool successfully');
        break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (attempt === maxRetries) {
          this.logger.error(`Failed to connect to PostgreSQL after ${maxRetries} attempts: ${errMsg}`);
          throw err;
        }
        this.logger.warn(`PostgreSQL connection attempt ${attempt}/${maxRetries} failed: ${errMsg}. Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * 2, 8000);
      }
    }
  }

  /**
   * Safe execution with automatic retry for transient database errors (deadlocks, serialization failures).
   */
  async withRetry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T> {
    return executeWithRetry(operation, options);
  }

  /**
   * Resilient transaction runner that catches serialization failures / deadlocks (40P01, 40001, P2034)
   * and retries the entire transaction block with exponential backoff and jitter.
   */
  async transactionWithRetry<T>(
    action: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: RetryOptions & { timeout?: number; maxWait?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T> {
    const { timeout, maxWait, isolationLevel, ...retryOpts } = options || {};
    return executeWithRetry(
      () =>
        this.$transaction(action as any, {
          timeout: timeout ?? 15000,
          maxWait: maxWait ?? 5000,
          isolationLevel,
        }),
      {
        operationName: retryOpts.operationName || 'TransactionWithRetry',
        ...retryOpts,
      },
    );
  }

  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    try {
      await Promise.race([
        this.$disconnect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Prisma disconnect timed out after 5s')), 5000)),
      ]);
      this.logger.log('Prisma disconnected gracefully');
    } catch (err) {
      this.logger.warn(`Prisma disconnect warning: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
