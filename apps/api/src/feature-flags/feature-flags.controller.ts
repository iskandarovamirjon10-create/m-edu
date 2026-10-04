import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeatureFlagsService } from './feature-flags.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, AllowAnyRole } from '../auth/roles.decorator';
import { ADMIN_ROLES, STAFF_ROLES } from '../auth/authorization.policy';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto } from './dto/feature-flag.dto';

@ApiTags('Feature Flags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @AllowAnyRole()
  @ApiOperation({ summary: 'List feature flags for the organization' })
  async findAll(@CurrentUser('organizationId') orgId: string) {
    return this.featureFlagsService.findAll(orgId);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a new feature flag' })
  async create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateFeatureFlagDto) {
    return this.featureFlagsService.create(orgId, dto);
  }

  @Put(':key')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Update a feature flag' })
  async update(
    @CurrentUser('organizationId') orgId: string,
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
  ) {
    return this.featureFlagsService.update(orgId, key, dto);
  }
}

