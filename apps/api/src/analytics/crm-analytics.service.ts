import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STAGES = ['NEW', 'CONTACTED', 'TRIAL_LESSON', 'WON', 'LOST'] as const;

interface OwnerRow {
  ownerId: string | null;
  total: bigint | number;
  won: bigint | number;
  lost: bigint | number;
  active: bigint | number;
}

/**
 * CRM analytics computed in the DATABASE, not in Node.
 *
 * HISTORICAL BUG: every method loaded the org's ENTIRE lead table into
 * memory (findMany without limits) and aggregated with JS loops. With 100k
 * leads that is ~100MB of heap churn per dashboard refresh, multiplied by
 * every concurrent viewer. All heavy work now happens in PostgreSQL via
 * single grouped queries; only aggregates cross the wire.
 */
@Injectable()
export class CrmAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFunnelAnalysis(organizationId: string) {
    const rows = await this.prisma.lead.groupBy({
      by: ['stage'],
      where: { organizationId },
      _count: { stage: true },
    });

    const stageCounts: Record<string, number> = {};
    for (const s of STAGES) stageCounts[s] = 0;
    for (const row of rows) {
      stageCounts[row.stage] = row._count.stage;
    }

    const total = STAGES.reduce((sum, s) => sum + stageCounts[s], 0);
    const funnel = STAGES.map((stage, i) => {
      const count = stageCounts[stage];
      const prevCount = i === 0 ? total : stageCounts[STAGES[i - 1]];
      const conversionFromPrev = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
      const conversionFromTop = total > 0 ? Math.round((count / total) * 100) : 0;
      return { stage, count, conversionFromPrev, conversionFromTop };
    });

    const wonCount = stageCounts['WON'] || 0;
    const overallConversion = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    return { total, funnel, overallConversion };
  }

  async getSourcePerformance(organizationId: string) {
    // One grouped query: totals, wins, losses and average days-to-win per
    // source, all computed by PostgreSQL.
    const rows = await this.prisma.$queryRaw<
      Array<{ source: string; total: bigint | number; won: bigint | number; lost: bigint | number; avg_days_to_win: number | null }>
    >`
      SELECT
        COALESCE("source", 'Unknown') AS source,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE "stage" = 'WON') AS won,
        COUNT(*) FILTER (WHERE "stage" = 'LOST') AS lost,
        AVG(
          CASE WHEN "stage" = 'WON'
            THEN CEIL(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400.0)
          END
        ) AS "avg_days_to_win"
      FROM "Lead"
      WHERE "organizationId" = ${organizationId}::uuid
      GROUP BY COALESCE("source", 'Unknown')
    `;

    return rows
      .map((row) => {
        const totalLeads = Number(row.total);
        const wonLeads = Number(row.won);
        const lostLeads = Number(row.lost);
        return {
          source: row.source,
          totalLeads,
          wonLeads,
          lostLeads,
          conversionRate: totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0,
          avgDaysToConvert:
            row.avg_days_to_win !== null ? Math.round(Number(row.avg_days_to_win)) : 0,
        };
      })
      .sort((a, b) => b.totalLeads - a.totalLeads);
  }

  async getPipelineVelocity(organizationId: string) {
    // Active-lead aging is computed in the database; WON/LOST leads are
    // excluded from pipeline aging by definition.
    const activeRows = await this.prisma.$queryRaw<
      Array<{ stage: string; avg_days: number | null; median_days: number | null; lead_count: bigint | number }>
    >`
      SELECT
        "stage",
        AVG(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 86400.0) AS "avg_days",
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 86400.0
        ) AS "median_days",
        COUNT(*) AS "lead_count"
      FROM "Lead"
      WHERE "organizationId" = ${organizationId}::uuid
        AND "stage" NOT IN ('WON', 'LOST')
      GROUP BY "stage"
    `;

    const wonRow = await this.prisma.$queryRaw<Array<{ avg_days: number | null }>>`
      SELECT AVG(
        EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400.0
      ) AS "avg_days"
      FROM "Lead"
      WHERE "organizationId" = ${organizationId}::uuid
        AND "stage" = 'WON'
    `;

    const stageVelocity = STAGES.map((stage) => {
      const row = activeRows.find((r) => r.stage === stage);
      const leadCount = row ? Number(row.lead_count) : 0;
      const avgDays = row?.avg_days !== null && row?.avg_days !== undefined ? Math.round(Number(row.avg_days)) : 0;
      const medianDays = row?.median_days !== null && row?.median_days !== undefined ? Math.round(Number(row.median_days)) : 0;
      return { stage, leadCount, avgDays, medianDays };
    });

    const totalActiveLeads = stageVelocity.reduce((sum, s) => sum + s.leadCount, 0);
    const avgDaysInPipeline =
      totalActiveLeads > 0
        ? Math.round(
            stageVelocity.reduce((sum, s) => sum + s.avgDays * s.leadCount, 0) / totalActiveLeads,
          )
        : 0;

    const avgTimeToWin =
      wonRow[0]?.avg_days !== null && wonRow[0]?.avg_days !== undefined
        ? Math.round(Number(wonRow[0].avg_days))
        : 0;

    return {
      stageVelocity,
      avgDaysInPipeline,
      avgTimeToWin,
      totalActiveLeads,
    };
  }

  async getLostReasons(organizationId: string) {
    const rows = await this.prisma.lead.groupBy({
      by: ['lostReason'],
      where: { organizationId, stage: 'LOST' },
      _count: { lostReason: true },
    });

    const reasons: Array<{ reason: string; count: number }> = [];
    let noReason = 0;
    let totalLost = 0;

    for (const row of rows) {
      const count = row._count.lostReason;
      totalLost += count;
      if (row.lostReason) {
        reasons.push({ reason: row.lostReason, count });
      } else {
        noReason += count;
      }
    }

    reasons.sort((a, b) => b.count - a.count);
    if (noReason > 0) {
      reasons.push({ reason: 'Not specified', count: noReason });
    }

    return { totalLost, reasons };
  }

  async getLeadAging(organizationId: string, limit = 200) {
    // Only the pages of leads the dashboard actually renders are fetched;
    // the status distribution is computed below from this bounded set.
    const leads = await this.prisma.lead.findMany({
      where: { organizationId, stage: { notIn: ['WON', 'LOST'] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        stage: true,
        createdAt: true,
        updatedAt: true,
        source: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const now = new Date();
    const aging = leads
      .map((lead) => {
        const daysInPipeline = Math.ceil((now.getTime() - lead.createdAt.getTime()) / 86400000);
        const daysSinceUpdate = Math.ceil((now.getTime() - lead.updatedAt.getTime()) / 86400000);
        let status: 'FRESH' | 'WARMING' | 'STALE' | 'STUCK';
        if (daysInPipeline <= 3) status = 'FRESH';
        else if (daysInPipeline <= 7) status = 'WARMING';
        else if (daysInPipeline <= 30) status = 'STALE';
        else status = 'STUCK';
        return {
          id: lead.id,
          name: [lead.firstName, lead.lastName].filter(Boolean).join(' '),
          stage: lead.stage,
          source: lead.source,
          daysInPipeline,
          daysSinceUpdate,
          status,
          createdAt: lead.createdAt,
        };
      })
      .sort((a, b) => b.daysInPipeline - a.daysInPipeline);

    const statusCounts = { FRESH: 0, WARMING: 0, STALE: 0, STUCK: 0 };
    for (const item of aging) statusCounts[item.status]++;

    return { leads: aging, statusCounts, total: aging.length };
  }

  async getModeratorActivity(organizationId: string) {
    const rows = await this.prisma.$queryRaw<OwnerRow[]>`
      SELECT
        "ownerId",
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE "stage" = 'WON') AS won,
        COUNT(*) FILTER (WHERE "stage" = 'LOST') AS lost,
        COUNT(*) FILTER (WHERE "stage" NOT IN ('WON', 'LOST')) AS active
      FROM "Lead"
      WHERE "organizationId" = ${organizationId}::uuid
      GROUP BY "ownerId"
    `;

    const ownerIds = rows
      .map((r) => r.ownerId)
      .filter((id): id is string => id !== null);
    const users =
      ownerIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: ownerIds }, organizationId },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const moderators = rows
      .map((row) => {
        const ownerId = row.ownerId ?? 'unassigned';
        const user = userMap.get(ownerId);
        const total = Number(row.total);
        const won = Number(row.won);
        return {
          moderatorId: ownerId,
          name: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : 'Unassigned',
          email: user?.email || null,
          totalLeads: total,
          wonLeads: won,
          lostLeads: Number(row.lost),
          activeLeads: Number(row.active),
          conversionRate: total > 0 ? Math.round((won / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.totalLeads - a.totalLeads);

    return moderators;
  }
}
