import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { GamificationService } from './gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowAnyRole } from '../auth/roles.decorator';
import type { RequestUser } from '../auth/types';

/** GET /gamification/leaderboard?groupId=&limit=&period= query params. */
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

  @ApiPropertyOptional({ description: 'Period filter (week, month, all)', default: 'all' })
  @IsOptional()
  @IsString()
  period?: string;
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

export class CreateRewardDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  costCoins: number;

  @IsOptional()
  @IsString()
  type?: 'PRODUCT' | 'COUPON';

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRewardDto extends PartialType(CreateRewardDto) {}

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
    @CurrentUser() user: RequestUser,
    @Query() query: LeaderboardQueryDto,
  ) {
    const studentId =
      user.role === Role.STUDENT
        ? await this.resolveStudentId(user.organizationId, user.id || user.sub)
        : null;

    const entries = await this.gamification.getLeaderboard(user.organizationId, {
      groupId: query.groupId,
      limit: query.limit,
      requester: {
        id: user.id || user.sub,
        role: user.role,
        studentId: studentId ?? undefined,
      },
    });
    return { items: entries, total: entries.length };
  }

  /**
   * GET /api/gamification/leagues
   *
   * League tiers overview, season countdown, and daily quests.
   */
  @AllowAnyRole()
  @Get('leagues')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ORG_ADMIN,
    Role.MANAGER,
    Role.TEACHER,
    Role.ASSISTANT,
    Role.STUDENT,
  )
  @ApiOperation({ summary: 'League tiers overview, monthly season and daily quests' })
  async getLeagueOverview(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    const studentId = await this.resolveStudentId(organizationId, userId);
    return this.gamification.getLeagueOverview(organizationId, studentId ?? undefined);
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
      return null;
    }
    return this.gamification.getMyStats(studentId, organizationId);
  }

  /**
   * POST /api/gamification/check-in
   *
   * Daily streak check-in: awards XP/Coins, updates streak counter,
   * and prevents duplicate check-ins on the same calendar day.
   */
  @AllowAnyRole()
  @Post('check-in')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ORG_ADMIN,
    Role.MANAGER,
    Role.TEACHER,
    Role.ASSISTANT,
    Role.STUDENT,
  )
  @ApiOperation({ summary: 'Daily student streak check-in' })
  async checkIn(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    const studentId = await this.resolveStudentId(organizationId, userId);
    if (!studentId) {
      throw new BadRequestException('Faqat talabalar kunlik check-in qila oladi');
    }
    return this.gamification.checkIn(studentId, organizationId);
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
      return { items: [] };
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
  @Roles(
    Role.SUPER_ADMIN,
    Role.ORG_ADMIN,
    Role.MANAGER,
    Role.TEACHER,
    Role.ASSISTANT,
    Role.STUDENT,
  )
  @ApiOperation({ summary: 'M-Coins reward shop catalog' })
  async getRewards(@CurrentUser() user: RequestUser) {
    const isAdmin = ([Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER] as Role[]).includes(user.role as Role);
    const items = await this.gamification.getRewards(user.organizationId, isAdmin);
    return { items };
  }

  /** POST /api/gamification/rewards — create a new reward (Admin only) */
  @Post('rewards')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create a new reward item' })
  async createReward(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateRewardDto,
  ) {
    return this.gamification.createReward(organizationId, dto);
  }

  /** PATCH /api/gamification/rewards/:id — update a reward item (Admin only) */
  @Patch('rewards/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Update an existing reward item' })
  async updateReward(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRewardDto,
  ) {
    return this.gamification.updateReward(organizationId, id, dto);
  }

  /** DELETE /api/gamification/rewards/:id — delete a reward item (Admin only) */
  @Delete('rewards/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Delete a reward item' })
  async deleteReward(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.gamification.deleteReward(organizationId, id);
  }

  /** POST /api/gamification/rewards/:id/claim — redeem a reward */
  @AllowAnyRole()
  @Post('rewards/:id/claim')
  @Roles(Role.STUDENT, Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Redeem an item using M-Coins' })
  async claimReward(
    @CurrentUser() user: RequestUser,
    @Param('id') rewardId: string,
  ) {
    const studentId =
      user.role === Role.STUDENT
        ? await this.resolveStudentId(user.organizationId, user.id || user.sub)
        : (await this.prisma.student.findFirst({
            where: { organizationId: user.organizationId },
            select: { id: true },
          }))?.id;

    if (!studentId) {
      throw new ForbiddenException('Student profile not found for this account');
    }
    return this.gamification.claimReward(studentId, user.organizationId, rewardId);
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

