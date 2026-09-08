import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeatureFlagsService } from './feature-flags.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Feature Flags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @ApiOperation({ summary: 'List feature flags for the organization' })
  async findAll(@CurrentUser('organizationId') orgId: string) {
    return this.featureFlagsService.findAll(orgId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new feature flag' })
  async create(@Body() dto: any) {
    return this.featureFlagsService.create(dto);
  }

  @Put(':key')
  @ApiOperation({ summary: 'Update a feature flag' })
  async update(
    @CurrentUser('organizationId') orgId: string,
    @Param('key') key: string,
    @Body() dto: any,
  ) {
    return this.featureFlagsService.update(orgId, key, dto);
  }
}
