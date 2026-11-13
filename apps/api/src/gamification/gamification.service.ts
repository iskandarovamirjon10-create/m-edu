import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isFamilyRole } from '../auth/authorization.policy';

/** XP/coin rewards per gamified event. */
export const XP_RULES = {
  ATTENDANCE_ON_TIME: { xp: 10, coins: 5 },
  HOMEWORK_ON_TIME_GOOD_GRADE: { xp: 20, coins: 10 },
  EXAM_HIGH_SCORE: { xp: 50, coins: 25 },
} as const;

export type GamificationEventType = keyof typeof XP_RULES;

export type LeagueTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
export type LeagueZone = 'PROMOTION' | 'SAFE' | 'RELEGATION';

export const LEAGUE_CONFIG: Record<
  LeagueTier,
  { name: string; icon: string; minXp: number; color: string; badgeBg: string; perk: string }
> = {
  BRONZE: {
    name: 'Bronza Ligasi',
    icon: '🥉',
    minXp: 0,
    color: '#CD7F32',
    badgeBg: 'rgba(205,127,50,0.15)',
    perk: 'Boshlang‘ich daraja, har bir dars uchun standart XP',
  },
  SILVER: {
    name: 'Kumush Ligasi',
    icon: '🥈',
    minXp: 300,
    color: '#94A3B8',
    badgeBg: 'rgba(148,163,184,0.15)',
    perk: '+5% qo‘shimcha coinlar bonus va kumush nishon',
  },
  GOLD: {
    name: 'Oltin Ligasi',
    icon: '🥇',
    minXp: 700,
    color: '#F59E0B',
    badgeBg: 'rgba(245,158,11,0.15)',
    perk: '+10% coinlar va do‘konda eksklyuziv chegirmalar',
  },
  PLATINUM: {
    name: 'Platina Ligasi',
    icon: '💠',
    minXp: 1500,
    color: '#06B6D4',
    badgeBg: 'rgba(6,182,212,0.15)',
    perk: '+15% coinlar, mentor bilan VIP chat sessiyasi',
  },
  DIAMOND: {
    name: 'Olmos Ligasi',
    icon: '💎',
    minXp: 3000,
    color: '#8B5CF6',
    badgeBg: 'rgba(139,92,246,0.15)',
    perk: '+25% coinlar, premium chempionlik avatar ramkasi',
  },
};

export function leagueForXp(xp: number): LeagueTier {
  if (xp >= 3000) return 'DIAMOND';
  if (xp >= 1500) return 'PLATINUM';
  if (xp >= 700) return 'GOLD';
  if (xp >= 300) return 'SILVER';
  return 'BRONZE';
}

export function computeZone(rank: number, total: number): LeagueZone {
  if (total <= 1) return 'SAFE';
  if (rank <= Math.max(3, Math.ceil(total * 0.2))) return 'PROMOTION';
  if (total > 5 && rank > Math.floor(total * 0.85)) return 'RELEGATION';
  return 'SAFE';
}


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
  league: LeagueTier;
  zone: LeagueZone;
}


export interface RewardItem {
  id: string;
  title: string;
  description: string;
  costCoins: number;
  type?: 'PRODUCT' | 'COUPON' | string;
  category: 'MERCH' | 'DISCOUNT' | 'BOOK' | 'PERK' | string;
  icon: string;
  imageUrl?: string | null;
  stock?: number | null;
  couponCode?: string | null;
  isActive?: boolean;
}

export interface CreateRewardInput {
  title: string;
  description?: string;
  costCoins: number;
  type?: 'PRODUCT' | 'COUPON';
  category?: string;
  icon?: string;
  imageUrl?: string;
  stock?: number;
  couponCode?: string;
  isActive?: boolean;
}

export type UpdateRewardInput = Partial<CreateRewardInput>;

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

  /** The student's own balance card data (XP, coins, level, org rank, streak, league). */
  async getMyStats(studentId: string, organizationId: string) {
    const stats = await this.prisma.studentGamification.findUnique({
      where: { studentId },
      select: {
        xp: true,
        coins: true,
        level: true,
        streakDays: true,
        lastActiveDate: true,
        updatedAt: true,
        organizationId: true,
      },
    });

    if (!stats || (stats.organizationId && stats.organizationId !== organizationId)) {
      return {
        xp: 0,
        coins: 0,
        level: 1,
        xpToNextLevel: 100,
        levelSpan: 100,
        rank: null,
        rankTotal: 0,
        streak: 0,
        lastCheckIn: null,
        purchasesCount: 0,
        league: 'BRONZE' as LeagueTier,
        zone: 'SAFE' as LeagueZone,
      };
    }

    const [rankRow, rankTotal, purchasesCount] = await Promise.all([
      this.prisma.studentGamification.count({
        where: {
          organizationId,
          xp: { gt: stats.xp },
        },
      }),
      this.prisma.studentGamification.count({
        where: { organizationId },
      }),
      this.prisma.rewardClaim.count({
        where: { studentId },
      }),
    ]);

    const rank = rankRow + 1;
    const league = leagueForXp(stats.xp);
    const zone = computeZone(rank, rankTotal);

    return {
      xp: stats.xp,
      coins: stats.coins,
      level: stats.level,
      // Progress within the current 100-XP band.
      xpToNextLevel: 100 - (stats.xp % 100),
      levelSpan: 100,
      rank,
      rankTotal,
      streak: stats.streakDays ?? 0,
      lastCheckIn: stats.lastActiveDate ? stats.lastActiveDate.toISOString() : null,
      purchasesCount,
      league,
      zone,
    };
  }

  /**
   * Daily student check-in: verifies today's streak, calculates XP & coins rewards,
   * updates the streak counter, and awards streak milestones.
   */
  async checkIn(studentId: string, organizationId: string) {
    const now = new Date();

    // 1. Fetch or initialize student gamification row
    let record = await this.prisma.studentGamification.findUnique({
      where: { studentId },
    });

    if (!record) {
      record = await this.prisma.studentGamification.create({
        data: {
          studentId,
          organizationId,
          level: 1,
          xp: 0,
          totalXp: 0,
          coins: 0,
          streakDays: 0,
        },
      });
    }

    // 2. Prevent duplicate check-in on the same calendar day (UTC)
    if (record.lastActiveDate) {
      const last = new Date(record.lastActiveDate);
      const isSameDay =
        last.getUTCFullYear() === now.getUTCFullYear() &&
        last.getUTCMonth() === now.getUTCMonth() &&
        last.getUTCDate() === now.getUTCDate();

      if (isSameDay) {
        throw new BadRequestException('Bugungi kun uchun allaqachon belgilangansiz! Ertaga yana kutamiz 🔥');
      }
    }

    // 3. Check streak continuity (yesterday or within ~36 hours window)
    let newStreak = 1;
    if (record.lastActiveDate) {
      const last = new Date(record.lastActiveDate);
      const diffMs = now.getTime() - last.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      const yesterday = new Date(now);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const isYesterday =
        last.getUTCFullYear() === yesterday.getUTCFullYear() &&
        last.getUTCMonth() === yesterday.getUTCMonth() &&
        last.getUTCDate() === yesterday.getUTCDate();

      if (isYesterday || diffHours <= 36) {
        newStreak = (record.streakDays || 0) + 1;
      }
    }

    // 4. Reward calculations: Base XP & Coins + 7-day milestone bonus
    const baseRewardXp = 15;
    const baseRewardCoins = 5;
    const isWeeklyMilestone = newStreak % 7 === 0;
    const bonusXp = isWeeklyMilestone ? 50 : 0;
    const bonusCoins = isWeeklyMilestone ? 25 : 0;

    const earnedXp = baseRewardXp + bonusXp;
    const earnedCoins = baseRewardCoins + bonusCoins;

    const updatedXp = record.xp + earnedXp;
    const updatedTotalXp = (record.totalXp || 0) + earnedXp;
    const updatedCoins = record.coins + earnedCoins;
    const updatedLevel = Math.floor(updatedXp / 100) + 1;

    // 5. Update database record
    await this.prisma.studentGamification.update({
      where: { studentId },
      data: {
        xp: updatedXp,
        totalXp: updatedTotalXp,
        coins: updatedCoins,
        level: updatedLevel,
        streakDays: newStreak,
        lastActiveDate: now,
      },
    });

    return {
      success: true,
      streak: newStreak,
      xpAwarded: earnedXp,
      coinsAwarded: earnedCoins,
      level: updatedLevel,
      levelUp: updatedLevel > record.level,
      message: isWeeklyMilestone
        ? `Super seriya! ${newStreak} kun ketma-ket kirdingiz! Katta bonus: +${earnedXp} XP va +${earnedCoins} tanga! 🚀`
        : `Bugungi kun belgilandi! +${earnedXp} XP va +${earnedCoins} tanga 🔥`,
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
    options: {
      groupId?: string;
      limit?: number;
      requester?: { id: string; role: string; studentId?: string };
    } = {},
  ): Promise<Array<LeaderboardEntry>> {
    const limit = Math.min(Math.max(1, options.limit ?? 20), 100);
    const isStaff = options.requester?.role ? !isFamilyRole(options.requester.role) : true;
    const requestingStudentId = options.requester?.studentId;

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

      const totalCount = rows.length;
      return rows.map((row) => {
        const rank = Number(row.rank);
        // Security: Students can only view their own coins. Other students' coins are masked as 0.
        const coins = isStaff || (requestingStudentId && row.studentId === requestingStudentId) ? row.coins : 0;
        return {
          rank,
          studentId: row.studentId,
          studentName: [row.first_name, row.last_name].filter(Boolean).join(' '),
          avatar: row.avatar,
          groupId: row.group_id,
          groupName: row.group_name,
          xp: row.xp,
          coins,
          level: row.level,
          league: leagueForXp(row.xp),
          zone: computeZone(rank, totalCount),
        };
      });
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

    const totalCount = rows.length;
    return rows.map((row) => {
      const rank = Number(row.rank);
      // Security: Students can only view their own coins. Other students' coins are masked as 0.
      const coins = isStaff || (requestingStudentId && row.studentId === requestingStudentId) ? row.coins : 0;
      return {
        rank,
        studentId: row.studentId,
        studentName: [row.first_name, row.last_name].filter(Boolean).join(' '),
        avatar: row.avatar,
        groupId: row.group_id,
        groupName: row.group_name,
        xp: row.xp,
        coins,
        level: row.level,
        league: leagueForXp(row.xp),
        zone: computeZone(rank, totalCount),
      };
    });
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
  async getRewards(organizationId?: string, includeInactive = false): Promise<RewardItem[]> {
    if (!organizationId) {
      return REWARD_CATALOG;
    }

    const items = await this.prisma.gamificationReward.findMany({
      where: {
        organizationId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isActive: 'desc' }, { costCoins: 'asc' }],
    });

    if (items.length === 0) {
      return REWARD_CATALOG;
    }

    return items.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? '',
      costCoins: r.costCoins,
      type: r.type,
      category: r.category ?? 'MERCH',
      icon: r.icon ?? '🎁',
      imageUrl: r.imageUrl,
      stock: r.stock,
      couponCode: r.couponCode,
      isActive: r.isActive,
    }));
  }

  /** Create new reward in catalog (Admin only). */
  async createReward(organizationId: string, input: CreateRewardInput): Promise<RewardItem> {
    const created = await this.prisma.gamificationReward.create({
      data: {
        organizationId,
        title: input.title,
        description: input.description ?? '',
        costCoins: Math.max(1, input.costCoins),
        type: input.type ?? (input.couponCode ? 'COUPON' : 'PRODUCT'),
        category: input.category ?? 'MERCH',
        icon: input.icon ?? (input.type === 'COUPON' ? '🎟️' : '🎁'),
        imageUrl: input.imageUrl ?? null,
        stock: input.stock !== undefined ? input.stock : null,
        couponCode: input.couponCode ?? null,
        isActive: input.isActive ?? true,
      },
    });

    return {
      id: created.id,
      title: created.title,
      description: created.description ?? '',
      costCoins: created.costCoins,
      type: created.type,
      category: created.category ?? 'MERCH',
      icon: created.icon ?? '🎁',
      imageUrl: created.imageUrl,
      stock: created.stock,
      couponCode: created.couponCode,
      isActive: created.isActive,
    };
  }

  /** Update reward in catalog (Admin only). */
  async updateReward(organizationId: string, rewardId: string, input: UpdateRewardInput): Promise<RewardItem> {
    const existing = await this.prisma.gamificationReward.findFirst({
      where: { id: rewardId, organizationId },
    });
    if (!existing) {
      throw new BadRequestException('Mukofot topilmadi');
    }

    const updated = await this.prisma.gamificationReward.update({
      where: { id: rewardId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.costCoins !== undefined ? { costCoins: Math.max(1, input.costCoins) } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.stock !== undefined ? { stock: input.stock } : {}),
        ...(input.couponCode !== undefined ? { couponCode: input.couponCode } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description ?? '',
      costCoins: updated.costCoins,
      type: updated.type,
      category: updated.category ?? 'MERCH',
      icon: updated.icon ?? '🎁',
      imageUrl: updated.imageUrl,
      stock: updated.stock,
      couponCode: updated.couponCode,
      isActive: updated.isActive,
    };
  }

  /** Delete reward (Admin only). */
  async deleteReward(organizationId: string, rewardId: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.gamificationReward.findFirst({
      where: { id: rewardId, organizationId },
    });
    if (!existing) {
      throw new BadRequestException('Mukofot topilmadi');
    }

    await this.prisma.gamificationReward.delete({
      where: { id: rewardId },
    });

    return { success: true };
  }

  /** Spend M-Coins to claim a reward item. */
  async claimReward(studentId: string, organizationId: string, rewardId: string) {
    // 1. Look up reward from DB
    const dbReward = this.prisma.gamificationReward
      ? await this.prisma.gamificationReward.findFirst({
          where: { id: rewardId, organizationId, isActive: true },
        })
      : null;

    let costCoins = 0;
    let title = '';
    let isCoupon = false;
    let couponCode: string | null = null;
    let returnReward: RewardItem;

    if (dbReward) {
      if (dbReward.stock !== null && dbReward.stock <= 0) {
        throw new BadRequestException('Ushbu mukofot omborda tugagan');
      }
      costCoins = dbReward.costCoins;
      title = dbReward.title;
      isCoupon = dbReward.type === 'COUPON';
      couponCode = dbReward.couponCode;
      returnReward = {
        id: dbReward.id,
        title: dbReward.title,
        description: dbReward.description ?? '',
        costCoins: dbReward.costCoins,
        type: dbReward.type,
        category: dbReward.category ?? 'MERCH',
        icon: dbReward.icon ?? '🎁',
        imageUrl: dbReward.imageUrl,
        stock: dbReward.stock,
        couponCode: dbReward.couponCode,
        isActive: dbReward.isActive,
      };
    } else {
      const fallback = REWARD_CATALOG.find((r) => r.id === rewardId);
      if (!fallback) {
        throw new BadRequestException('Bunday mukofot do’konda topilmadi');
      }
      costCoins = fallback.costCoins;
      title = fallback.title;
      isCoupon = fallback.category === 'DISCOUNT' || fallback.category === 'PERK';
      returnReward = fallback;
    }

    // Verify student belongs to this organization
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
      select: { id: true },
    });
    if (!student) {
      throw new BadRequestException('Talaba profili topilmadi');
    }

    // Atomic debit: the conditional update only lands while the balance still
    // covers the cost and belongs to the correct organization, so two concurrent claims can never go negative.
    const debit = await this.prisma.studentGamification.updateMany({
      where: { studentId, organizationId, coins: { gte: costCoins } },
      data: { coins: { decrement: costCoins } },
    });

    if (debit.count === 0) {
      const current = await this.prisma.studentGamification.findFirst({
        where: { studentId, organizationId },
        select: { coins: true },
      });
      throw new BadRequestException(
        `Coinlar yetarli emas. Sizda: ${current?.coins ?? 0}, kerak: ${costCoins}`,
      );
    }

    // If reward was in DB and has finite stock, decrement stock atomically.
    // If concurrent claims exhausted the stock, revert debited coins and reject.
    if (dbReward && dbReward.stock !== null && this.prisma.gamificationReward) {
      const stockRes = await this.prisma.gamificationReward.updateMany({
        where: { id: dbReward.id, organizationId, stock: { gt: 0 } },
        data: { stock: { decrement: 1 } },
      }).catch(() => ({ count: 0 }));

      if (stockRes && stockRes.count === 0) {
        await this.prisma.studentGamification.updateMany({
          where: { studentId, organizationId },
          data: { coins: { increment: costCoins } },
        }).catch(() => {});
        throw new BadRequestException('Ushbu mukofot omborda tugagan');
      }
    }

    // Create claim record in DB
    if (dbReward && this.prisma.rewardClaim) {
      await this.prisma.rewardClaim.create({
        data: {
          organizationId,
          rewardId: dbReward.id,
          studentId,
          costCoins,
          couponCode: isCoupon ? couponCode : null,
          status: 'CLAIMED',
        },
      }).catch((err) => {
        this.logger.warn(`Failed to record reward claim: ${err?.message}`);
      });
    }

    const updated = await this.prisma.studentGamification.findFirstOrThrow({
      where: { studentId, organizationId },
      select: { coins: true, xp: true, level: true },
    });

    this.logger.log(`Student ${studentId} claimed reward ${title} for ${costCoins} coins.`);

    const message = isCoupon && couponCode
      ? `Tabriklaymiz! "${title}" kuponi olindi. Promo-kod: ${couponCode}`
      : `Tabriklaymiz! "${title}" xarid qilindi. Administrator sizga yetkazib beradi.`;

    return {
      success: true,
      reward: returnReward,
      couponCode: isCoupon ? couponCode : undefined,
      remainingCoins: updated.coins,
      message,
    };
  }

  /**
   * League tiers overview, current monthly season, and daily study quests.
   */
  async getLeagueOverview(organizationId: string, studentId?: string) {
    const now = new Date();
    const monthNames = [
      'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
      'Iyul', 'Avgust', 'Sentabr', 'Oktyabr', 'Noyabr', 'Dekabr',
    ];
    const seasonTitle = `${now.getUTCFullYear()}-yil ${monthNames[now.getUTCMonth()]} Mavsumi`;
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const daysRemaining = Math.max(1, daysInMonth - now.getUTCDate());

    // Aggregate student counts across leagues
    const allStudents = await this.prisma.studentGamification.findMany({
      where: { organizationId },
      select: { xp: true },
    });

    const leagueCounts: Record<LeagueTier, number> = {
      BRONZE: 0,
      SILVER: 0,
      GOLD: 0,
      PLATINUM: 0,
      DIAMOND: 0,
    };

    for (const s of allStudents) {
      leagueCounts[leagueForXp(s.xp)]++;
    }

    const leagues = (['DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE'] as LeagueTier[]).map((tier) => ({
      tier,
      ...LEAGUE_CONFIG[tier],
      studentsCount: leagueCounts[tier],
    }));

    const dailyQuests = [
      {
        id: 'quest-attendance',
        title: "Darsga o'z vaqtida kelish",
        description: "Turniket yoki QR orqali darsga o'z vaqtida qayd etilish",
        xp: XP_RULES.ATTENDANCE_ON_TIME.xp,
        coins: XP_RULES.ATTENDANCE_ON_TIME.coins,
        icon: '📍',
      },
      {
        id: 'quest-homework',
        title: "Uy vazifasini a'lo bahoga topshirish",
        description: "Vazifani o'z vaqtida topshirib, 80 balldan yuqori natija olish",
        xp: XP_RULES.HOMEWORK_ON_TIME_GOOD_GRADE.xp,
        coins: XP_RULES.HOMEWORK_ON_TIME_GOOD_GRADE.coins,
        icon: '📚',
      },
      {
        id: 'quest-exam',
        title: "Oraliq sinovda 90%+ ko'rsatkich",
        description: "Nazorat testida eng yuqori natijalardan birini qayd etish",
        xp: XP_RULES.EXAM_HIGH_SCORE.xp,
        coins: XP_RULES.EXAM_HIGH_SCORE.coins,
        icon: '🎯',
      },
    ];

    let myLeague: { tier: LeagueTier; xp: number; coins: number; level: number } | null = null;
    if (studentId) {
      const me = await this.prisma.studentGamification.findUnique({
        where: { studentId },
        select: { xp: true, coins: true, level: true },
      });
      if (me) {
        myLeague = {
          tier: leagueForXp(me.xp),
          xp: me.xp,
          coins: me.coins,
          level: me.level,
        };
      }
    }

    return {
      season: {
        id: `season-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
        title: seasonTitle,
        daysRemaining,
        totalDays: daysInMonth,
        promotionZonePct: 20,
        relegationZonePct: 15,
      },
      leagues,
      dailyQuests,
      myLeague,
    };
  }

}
