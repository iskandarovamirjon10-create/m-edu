import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { RequestUser } from '../../../auth/types';
import { ArenaAvatarsService } from './arena-avatars.service';
import { ArenaTitlesService } from './arena-titles.service';

@Injectable()
export class ArenaProfilesService {
  private readonly logger = new Logger(ArenaProfilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarsService: ArenaAvatarsService,
    private readonly titlesService: ArenaTitlesService,
  ) {}

  /**
   * Resolves the student entity associated with the current user.
   */
  async resolveStudent(user: RequestUser) {
    let student = await this.prisma.student.findFirst({
      where: {
        userId: user.id,
        organizationId: user.organizationId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    if (!student && user.organizationId && user.role !== 'STUDENT' && this.prisma.user?.findUnique) {
      // Auto-provision a student record for testing/participation if staff member belongs to org
      const existingUser = await this.prisma.user.findUnique({
        where: { id: user.id },
      });
      if (existingUser) {
        student = await this.prisma.student.create({
          data: {
            userId: user.id,
            organizationId: user.organizationId,
          },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
          },
        });
      }
    }

    if (!student) {
      throw new NotFoundException('Student profile not found for current user');
    }
    return student;
  }

  /**
   * Retrieves or automatically initializes a student's duel profile with default avatar and title.
   */
  async getOrCreateProfile(studentId: string, organizationId: string) {
    let profile = await this.prisma.studentDuelProfile.findUnique({
      where: { studentId },
      include: {
        activeAvatar: true,
        activeTitle: true,
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      // Ensure default avatar and title exist
      await this.avatarsService.ensureDefaultUnlocks(studentId, organizationId);
      await this.titlesService.ensureDefaultStarterTitle(studentId, organizationId);

      const defaultAvatar = await this.prisma.arenaAvatar.findFirst({
        where: { slug: 'cyber-scholar', isActive: true },
      });
      const defaultTitle = await this.prisma.arenaTitle.findFirst({
        where: { slug: 'first-blood', isActive: true },
      });

      profile = await this.prisma.studentDuelProfile.create({
        data: {
          studentId,
          organizationId,
          activeAvatarId: defaultAvatar?.id,
          activeTitleId: defaultTitle?.id,
          rating: 1000,
          peakRating: 1000,
          totalDuels: 0,
          wins: 0,
          losses: 0,
          draws: 0,
        },
        include: {
          activeAvatar: true,
          activeTitle: true,
          student: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });
    }

    return profile;
  }

  /**
   * Get current authenticated student's Mind Arena duel profile.
   */
  async getMyProfile(user: RequestUser) {
    const student = await this.resolveStudent(user);
    const profile = await this.getOrCreateProfile(student.id, user.organizationId);
    const unlockedAvatars = await this.avatarsService.getStudentUnlockedAvatars(student.id, user.organizationId);
    const earnedTitles = await this.titlesService.getStudentEarnedTitles(student.id, user.organizationId);

    return {
      profile,
      unlockedAvatarsCount: unlockedAvatars.length,
      earnedTitlesCount: earnedTitles.length,
      unlockedAvatars,
      earnedTitles,
    };
  }

  /**
   * Get student duel profile by studentId with tenant isolation.
   */
  async getProfileByStudentId(studentId: string, organizationId: string) {
    const profile = await this.prisma.studentDuelProfile.findFirst({
      where: {
        studentId,
        organizationId,
      },
      include: {
        activeAvatar: true,
        activeTitle: true,
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Duel profile not found for student ${studentId}`);
    }

    return profile;
  }

  /**
   * Selects and activates an avatar for the student.
   * Enforces server-side ownership verification.
   */
  async selectActiveAvatar(user: RequestUser, avatarId: string) {
    const student = await this.resolveStudent(user);

    // Verify avatar exists
    const avatar = await this.prisma.arenaAvatar.findUnique({
      where: { id: avatarId },
    });
    if (!avatar || !avatar.isActive) {
      throw new NotFoundException('Selected avatar does not exist or is inactive');
    }

    // Verify student ownership / unlock
    const unlock = await this.prisma.studentAvatarUnlock.findUnique({
      where: {
        studentId_avatarId: {
          studentId: student.id,
          avatarId,
        },
      },
    });

    if (!unlock) {
      throw new ForbiddenException('You have not unlocked this avatar yet');
    }

    // Update active avatar in duel profile
    const updated = await this.prisma.studentDuelProfile.upsert({
      where: { studentId: student.id },
      update: { activeAvatarId: avatarId },
      create: {
        studentId: student.id,
        organizationId: user.organizationId,
        activeAvatarId: avatarId,
      },
      include: {
        activeAvatar: true,
        activeTitle: true,
      },
    });

    return {
      success: true,
      message: `Active avatar changed to "${avatar.name}"`,
      activeAvatar: updated.activeAvatar,
    };
  }

  /**
   * Selects and activates a title for the student.
   * Enforces server-side ownership verification.
   */
  async selectActiveTitle(user: RequestUser, titleId: string) {
    const student = await this.resolveStudent(user);

    // Verify title exists
    const title = await this.prisma.arenaTitle.findUnique({
      where: { id: titleId },
    });
    if (!title || !title.isActive) {
      throw new NotFoundException('Selected title does not exist or is inactive');
    }

    // Verify student earned this title
    const earned = await this.prisma.studentArenaTitle.findUnique({
      where: {
        studentId_titleId: {
          studentId: student.id,
          titleId,
        },
      },
    });

    if (!earned) {
      throw new ForbiddenException('You have not earned this title yet');
    }

    // Update active title in duel profile
    const updated = await this.prisma.studentDuelProfile.upsert({
      where: { studentId: student.id },
      update: { activeTitleId: titleId },
      create: {
        studentId: student.id,
        organizationId: user.organizationId,
        activeTitleId: titleId,
      },
      include: {
        activeAvatar: true,
        activeTitle: true,
      },
    });

    return {
      success: true,
      message: `Active title changed to "${title.name}"`,
      activeTitle: updated.activeTitle,
    };
  }

  /**
   * Returns organization-scoped duel leaderboard.
   */
  async getLeaderboard(organizationId: string, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const entries = await this.prisma.studentDuelProfile.findMany({
      where: { organizationId },
      orderBy: [{ rating: 'desc' }, { wins: 'desc' }],
      take: safeLimit,
      include: {
        activeAvatar: true,
        activeTitle: true,
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    return entries.map((entry, index) => {
      const winRate = entry.totalDuels > 0 ? Math.round((entry.wins / entry.totalDuels) * 100) : 0;
      return {
        rank: index + 1,
        studentId: entry.studentId,
        name: `${entry.student.user.firstName} ${entry.student.user.lastName}`,
        rating: entry.rating,
        peakRating: entry.peakRating,
        wins: entry.wins,
        losses: entry.losses,
        totalDuels: entry.totalDuels,
        winRate,
        winStreak: entry.winStreak,
        activeAvatar: entry.activeAvatar,
        activeTitle: entry.activeTitle,
      };
    });
  }
}
