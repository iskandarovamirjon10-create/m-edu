import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreatePayrollRunDto } from './dto/payroll.dto';
import { AllowAnyRole } from '../auth/roles.decorator';

@Controller(['payroll/runs', 'hr/payroll/runs'])
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollRunController {
  constructor(private readonly payrollService: PayrollService) {}

  @AllowAnyRole()
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  async listRuns(
    @CurrentUser('organizationId') orgId: string,
    // Query params arrive as STRINGS on the wire, never as numbers — spreading
    // them straight into Prisma made periodYear/periodMonth fail validation
    // ("Expected IntFilter or Int, provided String") and returned a 500 for
    // every payroll-runs request.
    @Query() query: { year?: string; month?: string; status?: string; teacherId?: string; page?: string; limit?: string },
  ) {
    return this.payrollService.listRuns(orgId, {
      year: query.year ? Number(query.year) : undefined,
      month: query.month ? Number(query.month) : undefined,
      status: query.status,
      teacherId: query.teacherId,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @AllowAnyRole()
  @Get('period-summary')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  async getPeriodSummary(
    @CurrentUser('organizationId') orgId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const y = year ? Number(year) : new Date().getFullYear();
    const m = month ? Number(month) : new Date().getMonth() + 1;
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      throw new BadRequestException('year must be an integer in 2000..2100');
    }
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      throw new BadRequestException('month must be an integer in 1..12');
    }
    return this.payrollService.getPeriodSummary(orgId, y, m);
  }

  @AllowAnyRole()
  @Get('revenue-share')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  async getRevenueShare(
    @CurrentUser('organizationId') orgId: string,
    @Query('teacherId') teacherId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('sharePercent') sharePercent?: string,
    @Query('retentionBonus') retentionBonus?: string,
  ) {
    if (!teacherId) throw new BadRequestException('teacherId is required');
    const y = year ? Number(year) : new Date().getFullYear();
    const m = month ? Number(month) : new Date().getMonth() + 1;
    return this.payrollService.calculateRevenueShare(orgId, {
      teacherId,
      year: y,
      month: m,
      revenueSharePercentage: sharePercent ? Number(sharePercent) : 40,
      retentionBonusPercentage: retentionBonus ? Number(retentionBonus) : 10,
    });
  }

  @Post('revenue-share')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  async createRevenueShareRun(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: {
      teacherId: string;
      year: number;
      month: number;
      revenueSharePercentage?: number;
      retentionBonusPercentage?: number;
    },
  ) {
    return this.payrollService.createRevenueShareRun(orgId, userId, body);
  }

  @AllowAnyRole()
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  async getRun(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.payrollService.getRun(orgId, id);
  }

  @Post('calculate')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  async calculate(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePayrollRunDto,
  ) {
    return this.payrollService.calculateRun(orgId, userId, dto);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  async createRun(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePayrollRunDto,
  ) {
    return this.payrollService.calculateRun(orgId, userId, dto);
  }

  @Post(':id/review')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  async reviewRun(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.payrollService.review(orgId, userId, id);
  }

  @Post(':id/approve')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  async approveRun(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.payrollService.approve(orgId, userId, id);
  }

  @Post(':id/process')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  async processRun(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.payrollService.pay(orgId, userId, id);
  }

  @Post(':id/pay')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  async payRun(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.payrollService.pay(orgId, userId, id);
  }

  @Post(':id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  async cancelRun(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('reason') reason: string,
  ) {
    return this.payrollService.cancel(orgId, userId, id, reason);
  }
}

