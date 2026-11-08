import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ArenaTitlesService {
  private readonly logger = new Logger(ArenaTitlesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all active titles in the catalog.
   */
  async getCatalog() {
    return this.prisma.arenaTitle.findMany({
      where: { isActive: true },
      orderBy: [{ rarity: 'asc' }, { requirementValue: 'asc' }],
    });
  }

  /**
   * Returns a specific title by slug.
   */
  async getBySlug(slug: string) {
    const title = await this.prisma.arenaTitle.findUnique({
      where: { slug },
    });
    if (!title) {
      throw new NotFoundException(`Title with slug "${slug}" not found`);
    }
    return title;
  }

  /**
   * Returns all titles earned by a specific student.
   */
  async getStudentEarnedTitles(studentId: string, organizationId: string) {
    const earned = await this.prisma.studentArenaTitle.findMany({
      where: { studentId, organizationId },
      include: { title: true },
      orderBy: { earnedAt: 'asc' },
    });

    return earned.map((e) => ({
      earnedId: e.id,
      earnedAt: e.earnedAt,
      earnedVia: e.earnedVia,
      title: e.title,
    }));
  }

  /**
   * Ensures the starter title ('first-blood') is granted to a student.
   */
  async ensureDefaultStarterTitle(studentId: string, organizationId: string) {
    const starterTitle = await this.prisma.arenaTitle.findFirst({
      where: { slug: 'first-blood', isActive: true },
    });
    if (!starterTitle) return;

    await this.prisma.studentArenaTitle.upsert({
      where: {
        studentId_titleId: {
          studentId,
          titleId: starterTitle.id,
        },
      },
      update: {},
      create: {
        studentId,
        organizationId,
        titleId: starterTitle.id,
        earnedVia: 'STARTER_TITLE',
      },
    });
  }

  /**
   * Checks if student qualifies for any new titles and grants them.
   */
  async checkAndUnlockTitles(
    studentId: string,
    rating: number,
    wins: number,
    winStreak: number,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { organizationId: true },
    });
    if (!student) return null;

    const allTitles = await this.prisma.arenaTitle.findMany({
      where: { isActive: true },
    });

    const alreadyEarned = await this.prisma.studentArenaTitle.findMany({
      where: { studentId },
      select: { titleId: true },
    });
    const earnedSet = new Set(alreadyEarned.map((e) => e.titleId));

    let newlyUnlockedTitle: any = null;

    for (const title of allTitles) {
      if (earnedSet.has(title.id)) continue;

      let eligible = false;
      if (title.requirementType === 'WINS' && wins >= title.requirementValue) {
        eligible = true;
      } else if (title.requirementType === 'STREAK' && winStreak >= title.requirementValue) {
        eligible = true;
      } else if (title.requirementType === 'RATING' && rating >= title.requirementValue) {
        eligible = true;
      }

      if (eligible) {
        await this.prisma.studentArenaTitle.create({
          data: {
            studentId,
            organizationId: student.organizationId,
            titleId: title.id,
            earnedVia: `ACHIEVEMENT_${title.requirementType}`,
          },
        });
        newlyUnlockedTitle = title;
        this.logger.log(`Student ${studentId} unlocked Title: "${title.name}" (${title.slug})!`);
      }
    }

    return newlyUnlockedTitle;
  }
}
