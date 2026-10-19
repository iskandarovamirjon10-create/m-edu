import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
