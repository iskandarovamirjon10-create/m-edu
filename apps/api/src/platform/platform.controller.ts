import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { PlatformGuard } from '../common/guards/platform.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreatePlatformInvitationDto,
  UpdateOrganizationSubscriptionDto,
  UpdateSaaSPlanDto,
} from './platform.dto';
import { TokenUser } from '../auth/types';
import { Request } from 'express';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('statistics')
  @ApiOperation({ summary: 'Get overall SaaS platform statistics, MRR, ARR and subscriber counts' })
  getStatistics() {
    return this.platformService.getStatistics();
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List all tenant organizations with their subscription state and quotas' })
  getOrganizations() {
    return this.platformService.getOrganizations();
  }

  @Patch('organizations/:id/subscription')
  @ApiOperation({ summary: 'Override an organization subscription, quotas, or expiration' })
  updateOrganizationSubscription(
    @Param('id') orgId: string,
    @Body() dto: UpdateOrganizationSubscriptionDto,
    @Req() req: Request & { user: TokenUser },
  ) {
    return this.platformService.updateOrganizationSubscription(orgId, dto, req.user.id);
  }

  @Post('organizations/:id/suspend')
  @ApiOperation({ summary: 'Suspend tenant organization access' })
  suspendOrganization(
    @Param('id') orgId: string,
    @Req() req: Request & { user: TokenUser },
  ) {
    return this.platformService.suspendOrganization(orgId, req.user.id);
  }

  @Post('organizations/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate tenant organization access' })
  reactivateOrganization(
    @Param('id') orgId: string,
    @Req() req: Request & { user: TokenUser },
  ) {
    return this.platformService.reactivateOrganization(orgId, req.user.id);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get SaaS pricing plans' })
  getPlans() {
    return this.platformService.getPlans();
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Update a SaaS pricing plan configuration' })
  updatePlan(
    @Param('id') planId: string,
    @Body() dto: UpdateSaaSPlanDto,
  ) {
    return this.platformService.updatePlan(planId, dto);
  }

  @Post('invitations')
  @ApiOperation({ summary: 'Create a new Platform Invitation' })
  createInvitation(
    @Req() req: Request & { user: TokenUser },
    @Body() dto: CreatePlatformInvitationDto,
  ) {
    return this.platformService.createInvitation(req.user.id, dto);
  }
}
