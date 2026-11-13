import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { GamificationController } from '../gamification.controller';
import { GamificationService } from '../gamification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';
import type { RequestUser } from '../../auth/types';

describe('GamificationController', () => {
  let controller: GamificationController;
  let service: {
    getLeaderboard: ReturnType<typeof vi.fn>;
    getMyStats: ReturnType<typeof vi.fn>;
    getRecentEvents: ReturnType<typeof vi.fn>;
    getOrgStats: ReturnType<typeof vi.fn>;
    getLeagueOverview: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    student: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  const adminUser: RequestUser = {
    id: 'admin-1',
    sub: 'admin-1',
    email: 'admin@medu.uz',
    role: Role.ORG_ADMIN,
    organizationId: 'org-1',
    sid: 'session-1',
  };

  const studentUser: RequestUser = {
    id: 'user-st-1',
    sub: 'user-st-1',
    email: 'student@medu.uz',
    role: Role.STUDENT,
    organizationId: 'org-1',
    sid: 'session-2',
  };

  beforeEach(() => {
    service = {
      getLeaderboard: vi.fn(),
      getMyStats: vi.fn(),
      getRecentEvents: vi.fn(),
      getOrgStats: vi.fn(),
      getLeagueOverview: vi.fn(),
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
    it('returns leaderboard items and total count for admin', async () => {
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

      const result = await controller.getLeaderboard(adminUser, {
        groupId: 'grp-1',
        limit: 10,
      });

      expect(service.getLeaderboard).toHaveBeenCalledWith('org-1', {
        groupId: 'grp-1',
        limit: 10,
        requester: {
          id: 'admin-1',
          role: Role.ORG_ADMIN,
          studentId: undefined,
        },
      });
      expect(result).toEqual({ items: mockItems, total: 1 });
    });

    it('resolves student profile and passes requester for student', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'student-st-1' });
      service.getLeaderboard.mockResolvedValue([]);

      await controller.getLeaderboard(studentUser, { limit: 20 });

      expect(prisma.student.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-st-1', organizationId: 'org-1' },
        select: { id: true },
      });
      expect(service.getLeaderboard).toHaveBeenCalledWith('org-1', {
        groupId: undefined,
        limit: 20,
        requester: {
          id: 'user-st-1',
          role: Role.STUDENT,
          studentId: 'student-st-1',
        },
      });
    });
  });

  describe('getMyStats', () => {
    it('returns null if student profile does not exist (e.g. staff/admin user)', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      const result = await controller.getMyStats('org-1', 'user-1');
      expect(result).toBeNull();
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
    it('returns empty items list if student profile does not exist', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      const result = await controller.getMyEvents('org-1', 'user-1', { limit: 10 });
      expect(result).toEqual({ items: [] });
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

  describe('getLeagueOverview', () => {
    it('resolves student and delegates to service.getLeagueOverview', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's1' });
      const mockOverview = {
        season: { title: '2026-yil Oktyabr Mavsumi' },
        leagues: [],
      };
      service.getLeagueOverview.mockResolvedValue(mockOverview);

      const result = await controller.getLeagueOverview('org-1', 'user-1');

      expect(prisma.student.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', organizationId: 'org-1' },
        select: { id: true },
      });
      expect(service.getLeagueOverview).toHaveBeenCalledWith('org-1', 's1');
      expect(result).toEqual(mockOverview);
    });
  });

});
