import { Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { GamificationService } from './gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowAnyRole } from '../auth/roles.decorator';

/** GET /gamification/leaderboard?groupId=&limit= query params. */
export class LeaderboardQueryDto {
  @ApiPropertyOptional({ description: 'Filter by specific group UUID' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ description: 'Number of leaderboard entries to return (1-100)', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class GamificationEventsQueryDto {
  @ApiPropertyOptional({ description: 'Number of events to return (1-50)', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

@ApiTags('Gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gamification')
export class GamificationController {
  constructor(
    private readonly gamification: GamificationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/gamification/leaderboard?groupId=<uuid>&limit=20
   *
   * XP leaderboard across the whole organization (default) or scoped to a
   * single group.
   */
  @AllowAnyRole()
  @Get('leaderboard')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ORG_ADMIN,
    Role.MANAGER,
    Role.TEACHER,
    Role.ASSISTANT,
    Role.STUDENT,
  )
  @ApiOperation({ summary: 'XP leaderboard (organization-wide or per group)' })
  async getLeaderboard(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: LeaderboardQueryDto,
  ) {
    const entries = await this.gamification.getLeaderboard(organizationId, {
      groupId: query.groupId,
      limit: query.limit,
    });
    return { items: entries, total: entries.length };
  }

  /**
   * GET /api/gamification/me
   *
   * The authenticated student's own balance: XP, coins, level, progress to
   * the next level and their org-wide rank.
   */
  @AllowAnyRole()
  @Get('me')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ORG_ADMIN,
    Role.MANAGER,
    Role.TEACHER,
    Role.ASSISTANT,
    Role.STUDENT,
  )
  @ApiOperation({ summary: 'My gamification stats (XP, coins, level, rank)' })
  async getMyStats(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    const studentId = await this.resolveStudentId(organizationId, userId);
    if (!studentId) {
      throw new ForbiddenException('Student profile not found for this account');
    }
    return this.gamification.getMyStats(studentId, organizationId);
  }

  /** GET /api/gamification/me/events — recent XP activity feed. */
  @AllowAnyRole()
  @Get('me/events')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ORG_ADMIN,
    Role.MANAGER,
    Role.TEACHER,
    Role.ASSISTANT,
    Role.STUDENT,
  )
  @ApiOperation({ summary: 'My recent XP events' })
  async getMyEvents(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() query: GamificationEventsQueryDto,
  ) {
    const studentId = await this.resolveStudentId(organizationId, userId);
    if (!studentId) {
      throw new ForbiddenException('Student profile not found for this account');
    }
    const events = await this.gamification.getRecentEvents(
      studentId,
      query.limit ?? 10,
    );
    return { items: events };
  }

  /** Admin/teacher overview of gamification engagement. */
  @AllowAnyRole()
  @Get('stats')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  @ApiOperation({ summary: 'Gamification engagement stats for the organization' })
  async getOrgStats(@CurrentUser('organizationId') organizationId: string) {
    return this.gamification.getOrgStats(organizationId);
  }

  
  /** GET /api/gamification/rewards — catalog of available items in coin shop */
  @AllowAnyRole()
  @Get('rewards')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'M-Coins reward shop catalog' })
  async getRewards() {
    const items = await this.gamification.getRewards();
    return { items };
  }

  /** POST /api/gamification/rewards/:id/claim — redeem a reward */
  @AllowAnyRole()
  @Post('rewards/:id/claim')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Redeem an item using M-Coins' })
  async claimReward(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') rewardId: string,
  ) {
    const studentId = await this.resolveStudentId(organizationId, userId);
    if (!studentId) {
      throw new ForbiddenException('Student profile not found for this account');
    }
    return this.gamification.claimReward(studentId, organizationId, rewardId);
  }

  /** Resolve the Student profile row for the authenticated account. */

  private async resolveStudentId(
    organizationId: string,
    userId: string,
  ): Promise<string | null> {
    const student = await this.prisma.student.findFirst({
      where: { userId, organizationId },
      select: { id: true },
    });
    return student?.id ?? null;
  }
}

