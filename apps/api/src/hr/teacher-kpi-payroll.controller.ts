import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ADMIN_ROLES } from '../auth/authorization.policy';
import { TeacherKpiPayrollService } from './teacher-kpi-payroll.service';
import {
  BatchApproveTeacherPayrollDto,
  CalculateAllTeachersKpiDto,
} from './dto/teacher-kpi.dto';

@ApiTags('Teacher KPI & Batch Payroll Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/teacher-kpi')
export class TeacherKpiPayrollController {
  constructor(private readonly kpiService: TeacherKpiPayrollService) {}

  @Post('calculate-batch')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Calculate compensation proposals & KPI performance metrics for all teachers in batch',
  })
  async calculateBatch(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CalculateAllTeachersKpiDto,
  ) {
    return this.kpiService.calculateBatchTeacherProposals(orgId, dto);
  }

  @Post('approve-batch')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({
    summary: 'Atomically approve and commit batch payroll runs for all teachers with audit log',
  })
  async approveBatch(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: BatchApproveTeacherPayrollDto,
  ) {
    return this.kpiService.batchApproveAndCommit(orgId, actorId, dto);
  }
}
