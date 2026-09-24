import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GamificationService,
  levelForXp,
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
    gamificationXpEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    studentGamification: {
      findUnique: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
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
});
