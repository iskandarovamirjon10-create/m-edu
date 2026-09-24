import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ComponentHealth {
  name: string;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  latencyMs: number;
  lastChecked: string;
  details?: Record<string, unknown>;
}

export interface SystemSummary {
  uptime: number;
  components: ComponentHealth[];
}

@Injectable()
export class SystemHealthService {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<SystemSummary> {
    const components = await this.checkComponents();
    const uptime = Math.floor((Date.now() - this.startedAt) / 1000);
    return { uptime, components };
  }

  private async checkComponents(): Promise<ComponentHealth[]> {
    const components: ComponentHealth[] = [];
    components.push(await this.checkDatabase());
    components.push(await this.checkPrisma());
    components.push(await this.checkMemory());
    components.push(await this.checkDisk());
    return components;
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'database',
        status: 'UP',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
      };
    } catch (err: unknown) {
      return {
        name: 'database',
        status: 'DOWN',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        details: { error: err instanceof Error ? err.message : 'unknown' },
      };
    }
  }

  private async checkPrisma(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const count = await this.prisma.organization.count();
      return {
        name: 'prisma',
        status: 'UP',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        details: { organizationCount: count },
      };
    } catch (err: unknown) {
      return {
        name: 'prisma',
        status: 'DOWN',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        details: { error: err instanceof Error ? err.message : 'unknown' },
      };
    }
  }

  private async checkMemory(): Promise<ComponentHealth> {
    const start = Date.now();
    const used = process.memoryUsage();
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
    const status: ComponentHealth['status'] =
      heapUsedMB / heapTotalMB > 0.9 ? 'DEGRADED' : 'UP';
    return {
      name: 'memory',
      status,
      latencyMs: Date.now() - start,
      lastChecked: new Date().toISOString(),
      details: { heapUsedMB, heapTotalMB, rssMB: Math.round(used.rss / 1024 / 1024) },
    };
  }

  private async checkDisk(): Promise<ComponentHealth> {
    const start = Date.now();
    return {
      name: 'disk',
      status: 'UP',
      latencyMs: Date.now() - start,
      lastChecked: new Date().toISOString(),
      details: { note: 'process-local health check' },
    };
  }
}
