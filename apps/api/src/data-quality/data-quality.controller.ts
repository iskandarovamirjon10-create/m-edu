import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DataQualityService } from './data-quality.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Data Quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('data-quality')
export class DataQualityController {
  constructor(private readonly dataQualityService: DataQualityService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get data quality summary' })
  async getSummary() {
    const user = { organizationId: 'dummy' } as any;
    return this.dataQualityService.getSummary(user.organizationId);
  }

  @Get('issues')
  @ApiOperation({ summary: 'List data quality issues' })
  async getIssues(@Query() query: any) {
    const user = { organizationId: 'dummy' } as any;
    return this.dataQualityService.getIssues(user.organizationId, query);
  }

  @Post('run')
  @ApiOperation({ summary: 'Run all data quality checks' })
  async runChecks() {
    const user = { organizationId: 'dummy' } as any;
    return this.dataQualityService.runAllChecks(user.organizationId);
  }

  @Post('issues/:id/resolve')
  @ApiOperation({ summary: 'Mark an issue as resolved' })
  async resolve(@Param('id') id: string, @Body() body: { note?: string }) {
    const user = { organizationId: 'dummy', id: 'dummy' } as any;
    return this.dataQualityService.resolveIssue(user.organizationId, id, user.id, body.note);
  }
}
