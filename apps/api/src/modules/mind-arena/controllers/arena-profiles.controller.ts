import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../auth/roles.guard';
import { AllowSelfService, AllowAnyRole } from '../../../auth/roles.decorator';
import { CurrentUser } from '../../../auth/current-user.decorator';
import type { RequestUser } from '../../../auth/types';
import { ArenaProfilesService } from '../services/arena-profiles.service';
import {
  ArenaLeaderboardQueryDto,
  SelectAvatarDto,
  SelectTitleDto,
} from '../dto/arena-profile.dto';

@ApiTags('Mind Arena Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('arena/profiles')
export class ArenaProfilesController {
  constructor(private readonly profilesService: ArenaProfilesService) {}

  @Get('me')
  @AllowSelfService()
  @ApiOperation({ summary: "Get current student's Mind Arena duel profile and unlocked assets" })
  async getMyProfile(@CurrentUser() user: RequestUser) {
    return this.profilesService.getMyProfile(user);
  }

  @Post('select-avatar')
  @AllowSelfService()
  @ApiOperation({ summary: 'Select and activate an unlocked avatar for duels' })
  async selectAvatar(@CurrentUser() user: RequestUser, @Body() dto: SelectAvatarDto) {
    return this.profilesService.selectActiveAvatar(user, dto.avatarId);
  }

  @Post('select-title')
  @AllowSelfService()
  @ApiOperation({ summary: 'Select and activate an earned title for duels' })
  async selectTitle(@CurrentUser() user: RequestUser, @Body() dto: SelectTitleDto) {
    return this.profilesService.selectActiveTitle(user, dto.titleId);
  }

  @Get('leaderboard')
  @AllowSelfService()
  @ApiOperation({ summary: 'Get organization-scoped Mind Arena duel leaderboard' })
  async getLeaderboard(
    @CurrentUser() user: RequestUser,
    @Query() query: ArenaLeaderboardQueryDto,
  ) {
    return this.profilesService.getLeaderboard(user.organizationId, query.limit);
  }

  @Get(':studentId')
  @AllowAnyRole()
  @ApiOperation({ summary: 'Get duel profile of a specific student by studentId' })
  async getProfileById(
    @CurrentUser() user: RequestUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.profilesService.getProfileByStudentId(studentId, user.organizationId);
  }
}
