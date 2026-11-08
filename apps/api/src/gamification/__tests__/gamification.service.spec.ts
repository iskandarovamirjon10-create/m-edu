import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  GamificationService,
  levelForXp,
  leagueForXp,
  computeZone,
  XP_RULES,
} from '../gamification.service';
import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  const tx = {
    gamificationXpEvent: {
      create: vi.fn(),
    },
    studentGamification: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    $transaction: vi.fn((cb: (prismaTx: typeof tx) => Promise<unknown>) => cb(tx)),
    $queryRaw: vi.fn(),
    student: {
      findFirst: vi.fn(),
    },
    gamificationXpEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    studentGamification: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    gamificationReward: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    rewardClaim: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    tx,
  };
}

describe('GamificationService', () => {
  let service: GamificationService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    service = new GamificationService(mockPrisma as unknown as PrismaService);
  });

  describe('levelForXp calculation helper', () => {
    it('calculates levels correctly across XP thresholds', () => {
      expect(levelForXp(0)).toBe(1);
      expect(levelForXp(50)).toBe(1);
      expect(levelForXp(99)).toBe(1);
      expect(levelForXp(100)).toBe(2);
      expect(levelForXp(199)).toBe(2);
      expect(levelForXp(200)).toBe(3);
      expect(levelForXp(1050)).toBe(11);
    });
  });

  describe('award', () => {
    const studentId = 'student-uuid-1';
    const organizationId = 'org-uuid-1';

    it('awards XP and coins successfully and detects level up', async () => {
      // Prisma's `upsert` with an `increment` update returns the post-increment
      // balance, so the mock must too (the service derives the level from it).
      mockPrisma.tx.studentGamification.upsert.mockResolvedValue({
        xp: 110,
        coins: 50,
        level: 1,
      });
      mockPrisma.tx.studentGamification.update.mockResolvedValue({
        xp: 110,
        coins: 50,
        level: 2,
      });

      const result = await service.award(
        studentId,
        organizationId,
        'HOMEWORK_ON_TIME_GOOD_GRADE',
        { type: 'submission', id: 'sub-1' },
      );

      expect(mockPrisma.tx.gamificationXpEvent.create).toHaveBeenCalledWith({
        data: {
          organizationId,
          studentId,
          type: 'HOMEWORK_ON_TIME_GOOD_GRADE',
          xp: XP_RULES.HOMEWORK_ON_TIME_GOOD_GRADE.xp,
          coins: XP_RULES.HOMEWORK_ON_TIME_GOOD_GRADE.coins,
          refType: 'submission',
          refId: 'sub-1',
        },
      });

      expect(result).toEqual({
        awarded: true,
        xp: 110,
        coins: 50,
        level: 2,
        levelUp: true,
      });
    });

    it('awards XP and coins without level up when within same 100-xp bracket', async () => {
      mockPrisma.tx.studentGamification.upsert.mockResolvedValue({
        xp: 20,
        coins: 10,
        level: 1,
      });
      mockPrisma.tx.studentGamification.update.mockResolvedValue({
        xp: 20,
        coins: 10,
        level: 1,
      });

      const result = await service.award(
        studentId,
        organizationId,
        'ATTENDANCE_ON_TIME',
      );

      expect(result).toEqual({
        awarded: true,
        xp: 20,
        coins: 10,
        level: 1,
        levelUp: false,
      });
    });

    it('handles duplicate P2002 error gracefully and returns current balance', async () => {
      const p2002Err = new Error('Unique constraint violation');
      (p2002Err as { code?: string }).code = 'P2002';
      mockPrisma.$transaction.mockRejectedValue(p2002Err);

      mockPrisma.studentGamification.findUnique.mockResolvedValue({
        xp: 150,
        coins: 75,
        level: 2,
      });

      const result = await service.award(
        studentId,
        organizationId,
        'EXAM_HIGH_SCORE',
        { type: 'exam', id: 'exam-1' },
      );

      expect(result).toEqual({
        awarded: false,
        reason: 'duplicate',
        xp: 150,
        coins: 75,
        level: 2,
        levelUp: false,
      });
    });

    it('handles general errors without throwing (fail-safe for business caller)', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('DB connection failed'));
      mockPrisma.studentGamification.findUnique.mockResolvedValue(null);

      const result = await service.award(
        studentId,
        organizationId,
        'ATTENDANCE_ON_TIME',
      );

      expect(result).toEqual({
        awarded: false,
        xp: 0,
        coins: 0,
        level: 1,
        levelUp: false,
      });
    });
  });

  describe('getMyStats', () => {
    it('returns default statistics when student has no gamification profile yet', async () => {
      mockPrisma.studentGamification.findUnique.mockResolvedValue(null);

      const stats = await service.getMyStats('student-1', 'org-1');

      expect(stats).toEqual({
        xp: 0,
        coins: 0,
        level: 1,
        xpToNextLevel: 100,
        rank: null,
        rankTotal: 0,
      });
    });

    it('calculates current balance, next level XP, and rank correctly', async () => {
      mockPrisma.studentGamification.findUnique.mockResolvedValue({
        xp: 260,
        coins: 120,
        level: 3,
        updatedAt: new Date(),
      });
      // 2 students have more XP
      mockPrisma.studentGamification.count.mockResolvedValueOnce(2);
      // 50 total students in org
      mockPrisma.studentGamification.count.mockResolvedValueOnce(50);

      const stats = await service.getMyStats('student-1', 'org-1');

      expect(stats).toEqual({
        xp: 260,
        coins: 120,
        level: 3,
        xpToNextLevel: 40, // 100 - (260 % 100) = 40
        rank: 3, // rankRow (2) + 1
        rankTotal: 50,
      });
    });
  });

  describe('getLeaderboard', () => {
    it('queries and maps organization-wide leaderboard entries', async () => {
      const dbRows = [
        {
          studentId: 's1',
          first_name: 'Ali',
          last_name: 'Valiyev',
          avatar: 'https://avatar.png',
          group_id: 'g1',
          group_name: 'Group A',
          xp: 500,
          coins: 200,
          level: 6,
          rank: 1n,
        },
      ];
      mockPrisma.$queryRaw.mockResolvedValue(dbRows);

      const result = await service.getLeaderboard('org-1', { limit: 10 });

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual([
        {
          rank: 1,
          studentId: 's1',
          studentName: 'Ali Valiyev',
          avatar: 'https://avatar.png',
          groupId: 'g1',
          groupName: 'Group A',
          xp: 500,
          coins: 200,
          level: 6,
          league: 'SILVER',
          zone: 'SAFE',
        },
      ]);
    });

    it('queries and maps group-scoped leaderboard entries', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getLeaderboard('org-1', {
        groupId: 'group-uuid-1',
        limit: 25,
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('getRecentEvents', () => {
    it('retrieves recent XP events up to the specified limit', async () => {
      const mockEvents = [
        {
          id: 'ev-1',
          type: 'ATTENDANCE_ON_TIME',
          xp: 10,
          coins: 5,
          refType: 'session',
          refId: 'sess-1',
          createdAt: new Date(),
        },
      ];
      mockPrisma.gamificationXpEvent.findMany.mockResolvedValue(mockEvents);

      const events = await service.getRecentEvents('s1', 5);

      expect(mockPrisma.gamificationXpEvent.findMany).toHaveBeenCalledWith({
        where: { studentId: 's1' },
        orderBy: { createdAt: 'desc' },
        take: 5,
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
      expect(events).toBe(mockEvents);
    });
  });

  describe('getOrgStats', () => {
    it('aggregates organization level gamification metrics', async () => {
      mockPrisma.studentGamification.count.mockResolvedValue(100);
      mockPrisma.studentGamification.aggregate
        .mockResolvedValueOnce({ _sum: { xp: 15000, coins: 7500 } })
        .mockResolvedValueOnce({ _max: { level: 12 } });
      mockPrisma.studentGamification.groupBy.mockResolvedValue([
        { level: 12, _count: { level: 2 } },
        { level: 10, _count: { level: 5 } },
      ]);

      const stats = await service.getOrgStats('org-1');

      expect(stats).toEqual({
        participants: 100,
        totalXp: 15000,
        totalCoins: 7500,
        maxLevel: 12,
        levelDistribution: [
          { level: 12, students: 2 },
          { level: 10, students: 5 },
        ],
      });
    });
  });

  describe('leagueForXp and computeZone helpers', () => {
    it('correctly categorizes students into leagues based on XP', () => {
      expect(leagueForXp(0)).toBe('BRONZE');
      expect(leagueForXp(299)).toBe('BRONZE');
      expect(leagueForXp(300)).toBe('SILVER');
      expect(leagueForXp(699)).toBe('SILVER');
      expect(leagueForXp(700)).toBe('GOLD');
      expect(leagueForXp(1499)).toBe('GOLD');
      expect(leagueForXp(1500)).toBe('PLATINUM');
      expect(leagueForXp(2999)).toBe('PLATINUM');
      expect(leagueForXp(3000)).toBe('DIAMOND');
      expect(leagueForXp(10000)).toBe('DIAMOND');
    });

    it('determines promotion, safe, and relegation zones accurately', () => {
      expect(computeZone(1, 10)).toBe('PROMOTION');
      expect(computeZone(2, 10)).toBe('PROMOTION');
      expect(computeZone(5, 10)).toBe('SAFE');
      expect(computeZone(10, 10)).toBe('RELEGATION');
      expect(computeZone(1, 1)).toBe('SAFE');
    });
  });

  describe('getLeagueOverview', () => {
    it('returns monthly season details, league counts, and daily quests', async () => {
      mockPrisma.studentGamification.findMany.mockResolvedValue([
        { xp: 50 },
        { xp: 350 },
        { xp: 750 },
        { xp: 1600 },
        { xp: 3200 },
      ]);

      mockPrisma.studentGamification.findUnique.mockResolvedValue({
        xp: 1600,
        coins: 80,
        level: 17,
      });

      const res = await service.getLeagueOverview('org-1', 'student-1');

      expect(res.season).toBeDefined();
      expect(res.season.daysRemaining).toBeGreaterThanOrEqual(1);
      expect(res.leagues).toHaveLength(5);
      expect(res.dailyQuests).toHaveLength(3);
      expect(res.myLeague?.tier).toBe('PLATINUM');

      const diamond = res.leagues.find((l) => l.tier === 'DIAMOND');
      expect(diamond?.studentsCount).toBe(1);
    });
  });

  describe('getLeaderboard (Coins Privacy)', () => {
    const rawRows = [
      {
        studentId: 'st-own',
        first_name: 'John',
        last_name: 'Doe',
        avatar: null,
        group_id: 'grp-1',
        group_name: 'Group 1',
        xp: 1500,
        coins: 100,
        level: 16,
        rank: 1,
      },
      {
        studentId: 'st-other',
        first_name: 'Jane',
        last_name: 'Smith',
        avatar: null,
        group_id: 'grp-1',
        group_name: 'Group 1',
        xp: 1200,
        coins: 80,
        level: 13,
        rank: 2,
      },
    ];

    it('ensures students only view their own coins (other students coins masked as 0)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue(rawRows);

      const result = await service.getLeaderboard('org-1', {
        requester: {
          id: 'user-st-1',
          role: 'STUDENT',
          studentId: 'st-own',
        },
      });

      expect(result).toHaveLength(2);
      const ownEntry = result.find((r) => r.studentId === 'st-own');
      const otherEntry = result.find((r) => r.studentId === 'st-other');

      expect(ownEntry?.coins).toBe(100);
      expect(otherEntry?.coins).toBe(0); // Masked
    });

    it('allows staff to view all students coins', async () => {
      mockPrisma.$queryRaw.mockResolvedValue(rawRows);

      const result = await service.getLeaderboard('org-1', {
        requester: {
          id: 'admin-user-1',
          role: 'ORG_ADMIN',
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0].coins).toBe(100);
      expect(result[1].coins).toBe(80);
    });
  });

  describe('claimReward (Spend Coins)', () => {
    it('successfully debits coins and claims reward for student in organization', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({ id: 'st-1', organizationId: 'org-1' });
      mockPrisma.studentGamification.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.studentGamification.findFirstOrThrow.mockResolvedValue({
        coins: 50,
        xp: 300,
        level: 4,
      });

      const res = await service.claimReward('st-1', 'org-1', 'book-programming');

      expect(res.success).toBe(true);
      expect(res.remainingCoins).toBe(50);
      expect(mockPrisma.studentGamification.updateMany).toHaveBeenCalledWith({
        where: {
          studentId: 'st-1',
          organizationId: 'org-1',
          coins: { gte: 100 },
        },
        data: {
          coins: { decrement: 100 },
        },
      });
    });

    it('rejects claim if student does not belong to organization', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(
        service.claimReward('st-other-org', 'org-1', 'book-programming'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects claim if student does not have enough coins', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({ id: 'st-1', organizationId: 'org-1' });
      mockPrisma.studentGamification.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.studentGamification.findFirst.mockResolvedValue({ coins: 20 });

      await expect(
        service.claimReward('st-1', 'org-1', 'book-programming'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
