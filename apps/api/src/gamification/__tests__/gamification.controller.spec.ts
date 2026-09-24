import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { GamificationController } from '../gamification.controller';
import { GamificationService } from '../gamification.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('GamificationController', () => {
  let controller: GamificationController;
  let service: {
    getLeaderboard: ReturnType<typeof vi.fn>;
    getMyStats: ReturnType<typeof vi.fn>;
    getRecentEvents: ReturnType<typeof vi.fn>;
    getOrgStats: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    student: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    service = {
      getLeaderboard: vi.fn(),
      getMyStats: vi.fn(),
      getRecentEvents: vi.fn(),
      getOrgStats: vi.fn(),
    };
    prisma = {
      student: {
        findFirst: vi.fn(),
      },
    };
    controller = new GamificationController(
      service as unknown as GamificationService,
      prisma as unknown as PrismaService,
    );
  });

  describe('getLeaderboard', () => {
    it('returns leaderboard items and total count', async () => {
      const mockItems = [
        {
          rank: 1,
          studentId: 's1',
          studentName: 'Ali',
          avatar: null,
          groupId: null,
          groupName: null,
          xp: 100,
          coins: 50,
          level: 2,
        },
      ];
      service.getLeaderboard.mockResolvedValue(mockItems);

      const result = await controller.getLeaderboard('org-1', {
        groupId: 'grp-1',
        limit: 10,
      });

      expect(service.getLeaderboard).toHaveBeenCalledWith('org-1', {
        groupId: 'grp-1',
        limit: 10,
      });
      expect(result).toEqual({ items: mockItems, total: 1 });
    });
  });

  describe('getMyStats', () => {
    it('throws ForbiddenException if student profile does not exist', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(
        controller.getMyStats('org-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns student stats when profile exists', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'student-123' });
      const mockStats = {
        xp: 150,
        coins: 70,
        level: 2,
        xpToNextLevel: 50,
        rank: 5,
        rankTotal: 50,
      };
      service.getMyStats.mockResolvedValue(mockStats);

      const result = await controller.getMyStats('org-1', 'user-1');

      expect(prisma.student.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', organizationId: 'org-1' },
        select: { id: true },
      });
      expect(service.getMyStats).toHaveBeenCalledWith('student-123', 'org-1');
      expect(result).toEqual(mockStats);
    });
  });

  describe('getMyEvents', () => {
    it('throws ForbiddenException if student profile does not exist', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(
        controller.getMyEvents('org-1', 'user-1', { limit: 10 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns student events when profile exists', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'student-123' });
      const mockEvents = [{ id: 'ev-1', xp: 10, coins: 5 }];
      service.getRecentEvents.mockResolvedValue(mockEvents);

      const result = await controller.getMyEvents('org-1', 'user-1', { limit: 15 });

      expect(service.getRecentEvents).toHaveBeenCalledWith('student-123', 15);
      expect(result).toEqual({ items: mockEvents });
    });
  });

  describe('getOrgStats', () => {
    it('returns org-wide gamification statistics', async () => {
      const mockOrgStats = {
        participants: 25,
        totalXp: 5000,
        totalCoins: 2500,
        maxLevel: 5,
        levelDistribution: [],
      };
      service.getOrgStats.mockResolvedValue(mockOrgStats);

      const result = await controller.getOrgStats('org-1');

      expect(service.getOrgStats).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(mockOrgStats);
    });
  });
});
