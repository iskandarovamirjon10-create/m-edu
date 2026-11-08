import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ArenaAvatarsService {
  private readonly logger = new Logger(ArenaAvatarsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all active avatars in the global catalog.
   */
  async getCatalog() {
    return this.prisma.arenaAvatar.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Returns a specific avatar by slug or ID.
   */
  async getBySlug(slug: string) {
    const avatar = await this.prisma.arenaAvatar.findUnique({
      where: { slug },
    });
    if (!avatar) {
      throw new NotFoundException(`Avatar with slug "${slug}" not found`);
    }
    return avatar;
  }

  /**
   * Retrieves all avatars unlocked by a specific student.
   */
  async getStudentUnlockedAvatars(studentId: string, organizationId: string) {
    const unlocks = await this.prisma.studentAvatarUnlock.findMany({
      where: { studentId, organizationId },
      include: { avatar: true },
      orderBy: { unlockedAt: 'asc' },
    });

    return unlocks.map((u) => ({
      unlockId: u.id,
      unlockedAt: u.unlockedAt,
      unlockedVia: u.unlockedVia,
      avatar: u.avatar,
    }));
  }

  /**
   * Ensures all default avatars are unlocked for a student (idempotent).
   */
  async ensureDefaultUnlocks(studentId: string, organizationId: string) {
    const defaultAvatars = await this.prisma.arenaAvatar.findMany({
      where: { isDefault: true, isActive: true },
    });

    for (const avatar of defaultAvatars) {
      await this.prisma.studentAvatarUnlock.upsert({
        where: {
          studentId_avatarId: {
            studentId,
            avatarId: avatar.id,
          },
        },
        update: {},
        create: {
          studentId,
          organizationId,
          avatarId: avatar.id,
          unlockedVia: 'INITIAL_CATALOG',
        },
      });
    }
  }
}
