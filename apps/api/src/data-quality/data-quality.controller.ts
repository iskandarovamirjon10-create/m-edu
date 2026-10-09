import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DataQualityService } from './data-quality.service';
import { DataQualityQueryDto, ResolveIssueDto } from './dto/data-quality.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ADMIN_ROLES, STAFF_ROLES } from '../auth/authorization.policy';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Data Quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('data-quality')
export class DataQualityController {
  constructor(private readonly dataQualityService: DataQualityService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get data quality summary' })
  async getSummary(@CurrentUser('organizationId') orgId: string) {
    return this.dataQualityService.getSummary(orgId);
  }

  @Get('issues')
  @ApiOperation({ summary: 'List data quality issues' })
  async getIssues(@CurrentUser('organizationId') orgId: string, @Query() query: DataQualityQueryDto) {
    return this.dataQualityService.getIssues(orgId, query);
  }

  @Post('run')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Run all data quality checks' })
  async runChecks(@CurrentUser('organizationId') orgId: string) {
    return this.dataQualityService.runAllChecks(orgId);
  }

  @Post('issues/:id/resolve')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Mark an issue as resolved' })
  async resolve(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: ResolveIssueDto
  ) {
    return this.dataQualityService.resolveIssue(orgId, id, userId, body?.note);
  }
}
