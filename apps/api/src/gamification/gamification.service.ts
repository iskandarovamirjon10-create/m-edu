import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** XP/coin rewards per gamified event. */
export const XP_RULES = {
  ATTENDANCE_ON_TIME: { xp: 10, coins: 5 },
  HOMEWORK_ON_TIME_GOOD_GRADE: { xp: 20, coins: 10 },
  EXAM_HIGH_SCORE: { xp: 50, coins: 25 },
} as const;

export type GamificationEventType = keyof typeof XP_RULES;

export type GamificationAwardResult = {
  awarded: boolean;
  reason?: 'duplicate';
  xp: number;
  coins: number;
  level: number;
  levelUp: boolean;
};

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  avatar: string | null;
  groupId: string | null;
  groupName: string | null;
  xp: number;
  coins: number;
  level: number;
}


export interface RewardItem {
  id: string;
  title: string;
  description: string;
  costCoins: number;
  category: 'MERCH' | 'DISCOUNT' | 'BOOK' | 'PERK';
  icon: string;
}

export const REWARD_CATALOG: RewardItem[] = [
  {
    id: 'merch-tshirt',
    title: 'M-EDU Brend Futbolka',
    description: 'Maxsus paxtali premium sifatli futbolka',
    costCoins: 150,
    category: 'MERCH',
    icon: '👕',
  },
  {
    id: 'discount-10',
    title: 'Keyingi oy to’loviga 10% chegirma',
    description: 'Ota-onangiz uchun to’lovga maxsus vaucher',
    costCoins: 250,
    category: 'DISCOUNT',
    icon: '🎟️',
  },
  {
    id: 'merch-thermos',
    title: 'M-EDU Smart Termos',
    description: 'Haroratni ko’rsatuvchi zanglamas metall termos',
    costCoins: 200,
    category: 'MERCH',
    icon: '☕',
  },
  {
    id: 'book-programming',
    title: 'Dasturlash / IT Qo’llanma Kitobi',
    description: 'Mualliflik amaliy qo’llanmasi',
    costCoins: 100,
    category: 'BOOK',
    icon: '📚',
  },
  {
    id: 'perk-vip-mentor',
    title: 'Bosh Mentor bilan 1 soatlik VIP sessiya',
    description: 'Karyera va xalqaro imtihonlar bo’yicha maslahat',
    costCoins: 300,
    category: 'PERK',
    icon: '⭐',
  },
];

/** Levels advance every 100 XP: level = floor(totalXp / 100) + 1. */
export function levelForXp(totalXp: number): number {
  return Math.floor(totalXp / 100) + 1;
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Award XP + coins for a gamified event.
   *
   * Idempotent: when `refId` is provided, the unique
   * (studentId, type, refId) constraint on GamificationXpEvent collapses
   * duplicate awards (e.g. re-marking attendance on the same day) without
   * failing the caller. Level is recomputed from total XP, so a level-up is
   * derived, never guessed.
   */
  async award(
    studentId: string,
    organizationId: string,
    type: GamificationEventType,
    ref?: { type: string; id: string },
  ): Promise<GamificationAwardResult> {
    const rule = XP_RULES[type];

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Append-only ledger row; a duplicate (P2002 below) throws before any
        // balance mutation happens.
        await tx.gamificationXpEvent.create({
          data: {
            organizationId,
            studentId,
            type,
            xp: rule.xp,
            coins: rule.coins,
            refType: ref?.type,
            refId: ref?.id,
          },
        });

        const updated = await tx.studentGamification.upsert({
          where: { studentId },
          create: { 
            organizationId, 
            studentId,
            xp: rule.xp,
            coins: rule.coins,
            level: levelForXp(rule.xp)
          },
          update: {
            xp: { increment: rule.xp },
            coins: { increment: rule.coins },
          },
          select: { xp: true, coins: true, level: true },
        });

        const computedLevel = levelForXp(updated.xp);
        let finalLevel = updated.level;
        let levelUp = false;

        // Note: levelUp handles standard level jumps. If they somehow skip multiple levels,
        // it still triggers correctly since computedLevel > updated.level.
        if (computedLevel > updated.level) {
          finalLevel = computedLevel;
          levelUp = true;
          await tx.studentGamification.update({
            where: { studentId },
            data: { level: computedLevel },
          });
        }

        return {
          awarded: true as const,
          xp: updated.xp,
          coins: updated.coins,
          level: finalLevel,
          levelUp,
        };
      });

      if (result.levelUp) {
        this.logger.log(`Student ${studentId} reached level ${result.level}`);
      }
      return result;
    } catch (err) {
      // P2002 = duplicate (studentId, type, refId): the event was already
      // rewarded. Return the current balance untouched.
      if ((err as { code?: string })?.code === 'P2002') {
        const current = await this.prisma.studentGamification.findUnique({
          where: { studentId },
          select: { xp: true, coins: true, level: true },
        });
        return {
          awarded: false,
          reason: 'duplicate',
          xp: current?.xp ?? 0,
          coins: current?.coins ?? 0,
          level: current?.level ?? 1,
          levelUp: false,
        };
      }
      // Gamification must never break the business flow that triggered it.
      this.logger.error(
        `Failed to award ${type} to student ${studentId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      const current = await this.prisma.studentGamification
        .findUnique({
          where: { studentId },
          select: { xp: true, coins: true, level: true },
        })
        .catch(() => null);
      return {
        awarded: false,
        xp: current?.xp ?? 0,
        coins: current?.coins ?? 0,
        level: current?.level ?? 1,
        levelUp: false,
      };
    }
  }

  /** The student's own balance card data (XP, coins, level, org rank). */
  async getMyStats(studentId: string, organizationId: string) {
    const stats = await this.prisma.studentGamification.findUnique({
      where: { studentId },
      select: { xp: true, coins: true, level: true, updatedAt: true },
    });

    if (!stats) {
      return {
        xp: 0,
        coins: 0,
        level: 1,
        xpToNextLevel: 100,
        rank: null,
        rankTotal: 0,
      };
    }

    const [rankRow, rankTotal] = await Promise.all([
      this.prisma.studentGamification.count({
        where: {
          organizationId,
          xp: { gt: stats.xp },
        },
      }),
      this.prisma.studentGamification.count({
        where: { organizationId },
      }),
    ]);

    return {
      xp: stats.xp,
      coins: stats.coins,
      level: stats.level,
      // Progress within the current 100-XP band.
      xpToNextLevel: 100 - (stats.xp % 100),
      rank: rankRow + 1,
      rankTotal,
    };
  }

  /**
   * XP leaderboard for the organization (or a single group).
   *
   * The DB does the ranking (window function), so only the top-N slice
   * crosses the wire — this stays fast with 100k students.
   */
  async getLeaderboard(
    organizationId: string,
    options: { groupId?: string; limit?: number } = {},
  ): Promise<Array<LeaderboardEntry>> {
    const limit = Math.min(Math.max(1, options.limit ?? 20), 100);

    if (options.groupId) {
      // Group-scoped ranking: rank computed within the group.
      const rows = await this.prisma.$queryRaw<
        Array<{
          studentId: string;
          first_name: string | null;
          last_name: string | null;
          avatar: string | null;
          group_id: string | null;
          group_name: string | null;
          xp: number;
          coins: number;
          level: number;
          rank: bigint | number;
        }>
      >`
        WITH ranked AS (
          SELECT
            sg."studentId"   AS "studentId",
            sg."xp",
            sg."coins",
            sg."level",
            RANK() OVER (ORDER BY sg."xp" DESC, sg."coins" DESC) AS rank
          FROM "StudentGamification" sg
          WHERE sg."organizationId" = ${organizationId}::uuid
            AND EXISTS (
              SELECT 1 FROM "StudentGroup" sgr
              WHERE sgr."studentId" = sg."studentId"
                AND sgr."groupId" = ${options.groupId}::uuid
                AND sgr."isActive" = true
            )
        )
        SELECT ranked.*, u."firstName" AS "first_name", u."lastName" AS "last_name",
               u."avatar", g."id" AS "group_id", g."name" AS "group_name"
        FROM ranked
        LEFT JOIN "Student" s ON s."id" = ranked."studentId"
        LEFT JOIN "User" u ON u."id" = s."userId"
        LEFT JOIN "StudentGroup" sgr ON sgr."studentId" = ranked."studentId" AND sgr."isActive" = true
        LEFT JOIN "Group" g ON g."id" = sgr."groupId"
        WHERE ranked.rank <= ${limit}
        ORDER BY ranked.rank ASC
      `;

      return rows.map((row) => ({
        rank: Number(row.rank),
        studentId: row.studentId,
        studentName: [row.first_name, row.last_name].filter(Boolean).join(' '),
        avatar: row.avatar,
        groupId: row.group_id,
        groupName: row.group_name,
        xp: row.xp,
        coins: row.coins,
        level: row.level,
      }));
    }

    // Organization-wide ranking (default).
    const rows = await this.prisma.$queryRaw<
      Array<{
        studentId: string;
        first_name: string | null;
        last_name: string | null;
        avatar: string | null;
        group_id: string | null;
        group_name: string | null;
        xp: number;
        coins: number;
        level: number;
        rank: bigint | number;
      }>
    >`
      WITH ranked AS (
        SELECT
          "studentId",
          "xp",
          "coins",
          "level",
          RANK() OVER (ORDER BY "xp" DESC, "coins" DESC) AS rank
        FROM "StudentGamification"
        WHERE "organizationId" = ${organizationId}::uuid
      )
      SELECT ranked.*, u."firstName" AS "first_name", u."lastName" AS "last_name",
             u."avatar", g."id" AS "group_id", g."name" AS "group_name"
      FROM ranked
      LEFT JOIN "Student" s ON s."id" = ranked."studentId"
      LEFT JOIN "User" u ON u."id" = s."userId"
      LEFT JOIN "StudentGroup" sgr ON sgr."studentId" = ranked."studentId" AND sgr."isActive" = true
      LEFT JOIN "Group" g ON g."id" = sgr."groupId"
      WHERE ranked.rank <= ${limit}
      ORDER BY ranked.rank ASC
    `;

    return rows.map((row) => ({
      rank: Number(row.rank),
      studentId: row.studentId,
      studentName: [row.first_name, row.last_name].filter(Boolean).join(' '),
      avatar: row.avatar,
      groupId: row.group_id,
      groupName: row.group_name,
      xp: row.xp,
      coins: row.coins,
      level: row.level,
    }));
  }

  /** Recent XP events for a student (activity feed on the profile card). */
  async getRecentEvents(studentId: string, limit = 10) {
    return this.prisma.gamificationXpEvent.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
      select: {
        id: true,
        type: true,
        xp: true,
        coins: true,
        refType: true,
        refId: true,
        createdAt: true,
      },
    });
  }

  /** Admin/teacher overview: how active the gamification system is. */
  async getOrgStats(organizationId: string) {
    const [participants, sums, maxLevelResult, topLevels] = await Promise.all([
      this.prisma.studentGamification.count({ where: { organizationId } }),
      this.prisma.studentGamification.aggregate({
        where: { organizationId },
        _sum: { xp: true, coins: true },
      }),
      this.prisma.studentGamification.aggregate({
        where: { organizationId },
        _max: { level: true },
      }),
      this.prisma.studentGamification.groupBy({
        by: ['level'],
        where: { organizationId },
        _count: { level: true },
        orderBy: { level: 'desc' },
        take: 5,
      }),
    ]);

    return {
      participants,
      totalXp: sums._sum.xp ?? 0,
      totalCoins: sums._sum.coins ?? 0,
      maxLevel: maxLevelResult._max.level ?? 1,
      levelDistribution: topLevels.map((row) => ({
        level: row.level,
        students: row._count.level,
      })),
    };
  }
  /** Get all redeemable items in the M-Coins reward store. */
  async getRewards(): Promise<RewardItem[]> {
    return REWARD_CATALOG;
  }

  /** Spend M-Coins to claim a reward item. */
  async claimReward(studentId: string, organizationId: string, rewardId: string) {
    const reward = REWARD_CATALOG.find((r) => r.id === rewardId);
    if (!reward) {
      throw new BadRequestException('Bunday mukofot do’konda topilmadi');
    }

    // Atomic debit: the conditional update only lands while the balance still
    // covers the cost, so two concurrent claims can never go negative.
    const debit = await this.prisma.studentGamification.updateMany({
      where: { studentId, coins: { gte: reward.costCoins } },
      data: { coins: { decrement: reward.costCoins } },
    });

    if (debit.count === 0) {
      const current = await this.prisma.studentGamification.findUnique({
        where: { studentId },
        select: { coins: true },
      });
      throw new BadRequestException(
        `Coinlar yetarli emas. Sizda: ${current?.coins ?? 0}, kerak: ${reward.costCoins}`,
      );
    }

    const updated = await this.prisma.studentGamification.findUniqueOrThrow({
      where: { studentId },
      select: { coins: true, xp: true, level: true },
    });

    this.logger.log(`Student ${studentId} claimed reward ${reward.title} for ${reward.costCoins} coins.`);

    return {
      success: true,
      reward,
      remainingCoins: updated.coins,
      message: `Tabriklaymiz! "${reward.title}" xarid qilindi. Administrator sizga yetkazib beradi.`,
    };
  }
}
