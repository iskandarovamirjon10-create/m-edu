import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowAnyRole } from '../auth/roles.decorator';

/**
 * Exposes GET /payroll/period-summary
 *
 * The main PayrollRunController lives under @Controller('payroll/runs').
 * NestJS would register period-summary there as /payroll/runs/period-summary,
 * which does NOT match the frontend contract (/payroll/period-summary).
 * This separate controller handles the top-level /payroll route.
 */
@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['payroll', 'hr/payroll'])
export class PayrollPeriodController {
  constructor(private readonly payrollService: PayrollService) {}

  @AllowAnyRole()
  @Get('period-summary')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get payroll period summary for a given year/month' })
  getPeriodSummary(
    @CurrentUser('organizationId') orgId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.payrollService.getPeriodSummary(
      orgId,
      Number(year),
      Number(month),
    );
  }
}

