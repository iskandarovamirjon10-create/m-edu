import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EarlyWarningService } from './early-warning.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Early Warning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('early-warning')
export class EarlyWarningController {
  constructor(private readonly earlyWarningService: EarlyWarningService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get early warning summary' })
  async getSummary(@CurrentUser('organizationId') orgId: string) {
    return this.earlyWarningService.getSummary(orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List early warnings' })
  async findAll(@CurrentUser('organizationId') orgId: string, @Query() query: any) {
    return this.earlyWarningService.findAll(orgId, query);
  }

  @Post('scan')
  @ApiOperation({ summary: 'Run early warning scan' })
  async runScan(@CurrentUser('organizationId') orgId: string) {
    return this.earlyWarningService.runScan(orgId);
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Resolve an early warning' })
  async resolve(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    return this.earlyWarningService.resolve(orgId, id, userId, body.note);
  }
}
