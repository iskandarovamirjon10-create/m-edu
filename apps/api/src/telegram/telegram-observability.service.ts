import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';

export interface TelegramObservabilityOverview {
  configured: boolean;
  botUsername: string | null;
  organizationId: string;
  accounts: {
    total: number;
    active: number;
    disconnected: number;
    blocked: number;
    suspended: number;
    lastSeenAt: Date | null;
  };
  deliveries: {
    last24h: { sent: number; failed: number; deferred: number; skipped: number };
    recentFailures: Array<{
      eventType: string;
      channel: string;
      failureCategory: string | null;
      attempts: number;
      failedAt: Date | null;
    }>;
  };
  /**
   * Platform-wide webhook health. `TelegramUpdate` is a global dedup ledger
   * with no organization column, so this is returned ONLY to a platform
   * super-admin — an organization admin never sees global volume.
   */
  webhook: { updatesLast24h: number; lastUpdateAt: Date | null } | null;
}

/**
 * Tenant-scoped operational view of the Telegram integration (Admin Web →
 * Settings → Integrations → Telegram).
 *
 * What is deliberately NEVER returned:
 *   - the bot token, webhook secret or callback secret (not even booleans that
 *     would let an attacker confirm a guess),
 *   - raw Telegram chat/user ids (they are external identifiers and are not
 *     needed to answer any operational question here),
 *   - another organization's data: every query is scoped to the caller's
 *     `organizationId`, and the one global metric (webhook volume) is gated on
 *     the existing platform role.
 */
@Injectable()
export class TelegramObservabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  async overview(params: {
    organizationId: string;
    role: string;
  }): Promise<TelegramObservabilityOverview> {
    const { organizationId } = params;

    const [
      total,
      active,
      disconnected,
      blocked,
      suspended,
      lastSeen,
      last24hGroups,
      recentFailures,
    ] = await Promise.all([
      this.prisma.telegramAccount.count({ where: { organizationId } }),
      this.prisma.telegramAccount.count({ where: { organizationId, status: 'ACTIVE' } }),
      this.prisma.telegramAccount.count({
        where: { organizationId, status: 'DISCONNECTED' },
      }),
      this.prisma.telegramAccount.count({ where: { organizationId, status: 'BLOCKED' } }),
      this.prisma.telegramAccount.count({ where: { organizationId, status: 'SUSPENDED' } }),
      this.prisma.telegramAccount.aggregate({
        where: { organizationId },
        _max: { lastSeenAt: true },
      }),
      this.prisma.notificationDelivery.groupBy({
        by: ['status'],
        where: {
          organizationId,
          channel: 'TELEGRAM',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        _count: { _all: true },
      }),
      this.prisma.notificationDelivery.findMany({
        where: { organizationId, status: 'FAILED' },
        orderBy: { failedAt: 'desc' },
        take: 20,
        select: {
          eventType: true,
          channel: true,
          failureCategory: true,
          attempts: true,
          failedAt: true,
        },
      }),
    ]);

    const countFor = (status: string) =>
      last24hGroups.find((group) => group.status === status)?._count._all ?? 0;

    return {
      configured: this.telegram.isConfigured(),
      botUsername: this.telegram.getBotUsername(),
      organizationId,
      accounts: {
        total,
        active,
        disconnected,
        blocked,
        suspended,
        lastSeenAt: lastSeen?._max.lastSeenAt ?? null,
      },
      deliveries: {
        last24h: {
          sent: countFor('SENT'),
          failed: countFor('FAILED'),
          deferred: countFor('DEFERRED'),
          skipped: countFor('SKIPPED'),
        },
        recentFailures,
      },
      webhook: await this.webhookHealth(params.role),
    };
  }

  private async webhookHealth(
    role: string,
  ): Promise<TelegramObservabilityOverview['webhook']> {
    // Only the pre-existing platform role may see global (cross-tenant) volume.
    if (role !== Role.SUPER_ADMIN) return null;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [updatesLast24h, latest] = await Promise.all([
      this.prisma.telegramUpdate.count({ where: { receivedAt: { gte: since } } }),
      this.prisma.telegramUpdate.findFirst({
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      }),
    ]);

    return { updatesLast24h, lastUpdateAt: latest?.receivedAt ?? null };
  }
}
