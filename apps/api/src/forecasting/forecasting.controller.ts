import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ForecastingService } from './forecasting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Forecasting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('forecasting')
export class ForecastingController {
  constructor(private readonly forecastingService: ForecastingService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get forecasting summary' })
  async getSummary(@CurrentUser('organizationId') orgId: string) {
    return this.forecastingService.getSummary(orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List forecast series' })
  async findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: any,
  ) {
    return this.forecastingService.findAll(orgId, query);
  }
}
