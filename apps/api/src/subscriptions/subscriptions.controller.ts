import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { ChangePlanDto } from './dto/subscription.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Request } from 'express';
import { TokenUser } from '../auth/types';

@ApiTags('Subscriptions & Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get all available subscription plans with pricing in UZS' })
  async getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Get('current')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'PLATFORM_OWNER')
  @ApiOperation({ summary: 'Get current organization subscription, usage, and trial status' })
  async getCurrentSubscription(@CurrentUser('organizationId') orgId: string) {
    return this.subscriptionsService.getSubscription(orgId);
  }

  @Post('trial')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'PLATFORM_OWNER')
  @ApiOperation({ summary: 'Initialize or verify 7-day free trial' })
  async initializeTrial(@CurrentUser('organizationId') orgId: string) {
    return this.subscriptionsService.createTrial(orgId);
  }

  @Post('change-plan')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'PLATFORM_OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upgrade, downgrade, or change subscription plan' })
  async changePlan(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.subscriptionsService.changePlan(orgId, dto);
  }

  @Post('cancel')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'PLATFORM_OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel subscription renewal' })
  async cancelSubscription(@CurrentUser('organizationId') orgId: string) {
    return this.subscriptionsService.cancelSubscription(orgId);
  }

  @Get('usage')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'PLATFORM_OWNER')
  @ApiOperation({ summary: 'Get live usage metrics vs plan resource quotas' })
  async getUsage(@CurrentUser('organizationId') orgId: string) {
    return this.subscriptionsService.getUsage(orgId);
  }
}
