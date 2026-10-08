import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { PlatformGuard } from '../common/guards/platform.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePlatformInvitationDto } from './platform.dto';
import { TokenUser } from '../auth/types';
import { Request } from 'express';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('statistics')
  @ApiOperation({ summary: 'Get overall SaaS platform statistics' })
  getStatistics() {
    return this.platformService.getStatistics();
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations (tenants)' })
  getOrganizations() {
    return this.platformService.getOrganizations();
  }

  @Post('invitations')
  @ApiOperation({ summary: 'Create a new Platform Invitation' })
  createInvitation(@Req() req: Request & { user: TokenUser }, @Body() dto: CreatePlatformInvitationDto) {
    return this.platformService.createInvitation(req.user.id, dto);
  }
}

