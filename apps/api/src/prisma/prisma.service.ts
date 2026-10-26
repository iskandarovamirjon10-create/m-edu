import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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
    return parsed.toString();
  } catch {
    return url;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

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
   * Safe non-throwing database health check (used by readiness probes and health monitors)
   */
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
