import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AcademicRiskService } from './academic-risk.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Academic Risk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('academic-risk')
export class AcademicRiskController {
  constructor(private readonly academicRiskService: AcademicRiskService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get academic risk summary' })
  async getSummary(@CurrentUser('organizationId') orgId: string) {
    return this.academicRiskService.getSummary(orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List academic risk assessments' })
  async findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: any,
  ) {
    return this.academicRiskService.findAll(orgId, query);
  }
}
