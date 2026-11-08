import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ArenaProfilesService } from '../services/arena-profiles.service';
import { ArenaAvatarsService } from '../services/arena-avatars.service';
import { ArenaTitlesService } from '../services/arena-titles.service';
import type { RequestUser } from '../../../auth/types';

describe('Mind Arena — Phase 1 Domain & Security Tests', () => {
  let profilesService: ArenaProfilesService;
  let avatarsService: ArenaAvatarsService;
  let titlesService: ArenaTitlesService;
  let prisma: any;

  const mockOrgId = 'org-1111-1111-1111';
  const otherOrgId = 'org-9999-9999-9999';
  const mockStudentId = 'student-2222-2222-2222';
  const mockUserId = 'user-3333-3333-3333';

  const mockUser: RequestUser = {
    id: mockUserId,
    sub: mockUserId,
    email: 'student@medu.test',
    role: 'STUDENT',
    organizationId: mockOrgId,
    username: 'teststudent',
    sid: 'session-1',
  };

  const mockAvatarUnlocked = {
    id: 'avatar-uuid-1',
    slug: 'cyber-scholar',
    name: 'Cyber Scholar',
    isActive: true,
  };

  const mockAvatarLocked = {
    id: 'avatar-uuid-2',
    slug: 'infinite-sage',
    name: 'Infinite Sage',
    isActive: true,
  };

  const mockTitleEarned = {
    id: 'title-uuid-1',
    slug: 'first-blood',
    name: 'Birinchi Zarb',
    isActive: true,
  };

  const mockTitleUnearned = {
    id: 'title-uuid-2',
    slug: 'grandmaster',
    name: 'Grandmaster',
    isActive: true,
  };

  beforeEach(() => {
    prisma = {
      student: {
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where.userId === mockUserId && where.organizationId === mockOrgId) {
            return Promise.resolve({
              id: mockStudentId,
              userId: mockUserId,
              organizationId: mockOrgId,
              user: { firstName: 'Ali', lastName: 'Valiyev', avatar: null },
            });
          }
          return Promise.resolve(null);
        }),
      },
      arenaAvatar: {
        findMany: vi.fn().mockResolvedValue([mockAvatarUnlocked, mockAvatarLocked]),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === mockAvatarUnlocked.id || where.slug === mockAvatarUnlocked.slug) {
            return Promise.resolve(mockAvatarUnlocked);
          }
          if (where.id === mockAvatarLocked.id || where.slug === mockAvatarLocked.slug) {
            return Promise.resolve(mockAvatarLocked);
          }
          return Promise.resolve(null);
        }),
        findFirst: vi.fn().mockResolvedValue(mockAvatarUnlocked),
      },
      arenaTitle: {
        findMany: vi.fn().mockResolvedValue([mockTitleEarned, mockTitleUnearned]),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === mockTitleEarned.id || where.slug === mockTitleEarned.slug) {
            return Promise.resolve(mockTitleEarned);
          }
          if (where.id === mockTitleUnearned.id || where.slug === mockTitleUnearned.slug) {
            return Promise.resolve(mockTitleUnearned);
          }
          return Promise.resolve(null);
        }),
        findFirst: vi.fn().mockResolvedValue(mockTitleEarned),
      },
      studentDuelProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'profile-uuid-1',
          studentId: mockStudentId,
          organizationId: mockOrgId,
          activeAvatarId: mockAvatarUnlocked.id,
          activeTitleId: mockTitleEarned.id,
          rating: 1000,
          peakRating: 1000,
          wins: 0,
          losses: 0,
          totalDuels: 0,
          student: {
            user: { firstName: 'Ali', lastName: 'Valiyev' },
          },
        }),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where.studentId === mockStudentId && where.organizationId === mockOrgId) {
            return Promise.resolve({
              id: 'profile-uuid-1',
              studentId: mockStudentId,
              organizationId: mockOrgId,
              rating: 1000,
            });
          }
          return Promise.resolve(null);
        }),
        upsert: vi.fn().mockImplementation(({ update, create }) =>
          Promise.resolve({
            id: 'profile-uuid-1',
            studentId: mockStudentId,
            organizationId: mockOrgId,
            ...update,
            activeAvatar: mockAvatarUnlocked,
            activeTitle: mockTitleEarned,
          }),
        ),
        findMany: vi.fn().mockImplementation(({ where }) => {
          if (where.organizationId === mockOrgId) {
            return Promise.resolve([
              {
                studentId: mockStudentId,
                organizationId: mockOrgId,
                rating: 1250,
                peakRating: 1250,
                wins: 10,
                losses: 2,
                totalDuels: 12,
                winStreak: 4,
                student: { user: { firstName: 'Ali', lastName: 'Valiyev', avatar: null } },
                activeAvatar: mockAvatarUnlocked,
                activeTitle: mockTitleEarned,
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
      studentAvatarUnlock: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'unlock-1', studentId: mockStudentId, avatar: mockAvatarUnlocked },
        ]),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const { studentId_avatarId } = where;
          if (
            studentId_avatarId.studentId === mockStudentId &&
            studentId_avatarId.avatarId === mockAvatarUnlocked.id
          ) {
            return Promise.resolve({
              id: 'unlock-1',
              studentId: mockStudentId,
              avatarId: mockAvatarUnlocked.id,
            });
          }
          return Promise.resolve(null);
        }),
        upsert: vi.fn().mockResolvedValue({ id: 'unlock-1' }),
      },
      studentArenaTitle: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'earned-1', studentId: mockStudentId, title: mockTitleEarned },
        ]),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const { studentId_titleId } = where;
          if (
            studentId_titleId.studentId === mockStudentId &&
            studentId_titleId.titleId === mockTitleEarned.id
          ) {
            return Promise.resolve({
              id: 'earned-1',
              studentId: mockStudentId,
              titleId: mockTitleEarned.id,
            });
          }
          return Promise.resolve(null);
        }),
        upsert: vi.fn().mockResolvedValue({ id: 'earned-1' }),
      },
    };

    avatarsService = new ArenaAvatarsService(prisma);
    titlesService = new ArenaTitlesService(prisma);
    profilesService = new ArenaProfilesService(prisma, avatarsService, titlesService);
  });

  describe('Avatar Catalog & Ownership', () => {
    it('should return avatar catalog sorted by sortOrder', async () => {
      const catalog = await avatarsService.getCatalog();
      expect(catalog).toHaveLength(2);
      expect(prisma.arenaAvatar.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('should find avatar by slug', async () => {
      const avatar = await avatarsService.getBySlug('cyber-scholar');
      expect(avatar.name).toBe('Cyber Scholar');
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      await expect(avatarsService.getBySlug('unknown-slug')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow student to select an unlocked avatar', async () => {
      const result = await profilesService.selectActiveAvatar(mockUser, mockAvatarUnlocked.id);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Cyber Scholar');
      expect(prisma.studentDuelProfile.upsert).toHaveBeenCalled();
    });

    it('should FORBID student from selecting an avatar they have not unlocked', async () => {
      await expect(
        profilesService.selectActiveAvatar(mockUser, mockAvatarLocked.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when selecting a non-existent avatar', async () => {
      await expect(
        profilesService.selectActiveAvatar(mockUser, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Title Catalog & Ownership', () => {
    it('should return titles catalog', async () => {
      const catalog = await titlesService.getCatalog();
      expect(catalog).toHaveLength(2);
    });

    it('should find title by slug', async () => {
      const title = await titlesService.getBySlug('first-blood');
      expect(title.name).toBe('Birinchi Zarb');
    });

    it('should throw NotFoundException for invalid title slug', async () => {
      await expect(titlesService.getBySlug('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow student to select an earned title', async () => {
      const result = await profilesService.selectActiveTitle(mockUser, mockTitleEarned.id);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Birinchi Zarb');
    });

    it('should FORBID student from selecting a title they have not earned', async () => {
      await expect(
        profilesService.selectActiveTitle(mockUser, mockTitleUnearned.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should reject profile access across different tenant organizations', async () => {
      await expect(
        profilesService.getProfileByStudentId(mockStudentId, otherOrgId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return leaderboard entries strictly scoped to the user organization', async () => {
      const leaderboard = await profilesService.getLeaderboard(mockOrgId, 10);
      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].name).toBe('Ali Valiyev');
      expect(leaderboard[0].rating).toBe(1250);

      // Other org returns empty list
      const otherLeaderboard = await profilesService.getLeaderboard(otherOrgId, 10);
      expect(otherLeaderboard).toHaveLength(0);
    });

    it('should reject student resolution when user organization does not match student', async () => {
      const foreignUser: RequestUser = {
        ...mockUser,
        organizationId: 'org-attacker-999',
      };
      await expect(profilesService.resolveStudent(foreignUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
