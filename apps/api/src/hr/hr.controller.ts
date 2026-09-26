import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { HremployeeService } from './hr.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  CreateLeaveRequestDto,
} from './dto/employee.dto';
import { GeneratePayrollDto } from './dto/payroll.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PaginationParams } from '../common/dto/pagination';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/types';
import { AllowAnyRole } from '../auth/roles.decorator';

@Controller('hr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HremployeeController {
  constructor(private readonly hrService: HremployeeService) {}

  // ===================== Employees =====================

  @AllowAnyRole()
  @Get('employees')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async findAllEmployees(
    @CurrentUser() user: RequestUser,
    @Query() params: PaginationParams,
  ) {
    return this.hrService.findAllEmployees(user.organizationId, params);
  }

  @AllowAnyRole()
  @Get('employees/:id')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async findEmployeeById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.hrService.findEmployeeById(user.organizationId, id);
  }

  @Post('employees')
  @Roles(Role.ORG_ADMIN)
  async createEmployee(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.hrService.createEmployee(user.organizationId, dto);
  }

  @Put('employees/:id')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async updateEmployee(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.hrService.updateEmployee(user.organizationId, id, dto);
  }

  @Post('employees/:id/terminate')
  @Roles(Role.ORG_ADMIN)
  async terminateEmployee(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.hrService.terminateEmployee(user.organizationId, id, reason);
  }

  // ===================== Leave Requests =====================

  @AllowAnyRole()
  @Get('leave-requests')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async findAllLeaveRequests(
    @CurrentUser() user: RequestUser,
    @Query() params: PaginationParams,
  ) {
    return this.hrService.findAllLeaveRequests(user.organizationId, params);
  }

  @Post('leave-requests')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER, Role.ASSISTANT)
  async createLeaveRequest(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    // If employeeId not provided, use current user's employee record
    if (!dto.employeeId) {
      const employee = await this.hrService.findEmployeeById(
        user.organizationId,
        user.id,
      );
      dto.employeeId = employee.id;
    }
    return this.hrService.createLeaveRequest(user.organizationId, dto);
  }

  @Post('leave-requests/:id/approve')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async approveLeaveRequest(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.hrService.approveLeaveRequest(user.organizationId, id, user.id);
  }

  @Post('leave-requests/:id/reject')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async rejectLeaveRequest(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.hrService.rejectLeaveRequest(user.organizationId, id, reason);
  }

  // ===================== Payroll =====================

  @AllowAnyRole()
  @Get('employees/:employeeId/salary')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  async getEmployeeSalaryHistory(
    @CurrentUser() user: RequestUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('year') year?: number,
  ) {
    return this.hrService.getEmployeeSalaryHistory(
      user.organizationId,
      employeeId,
      user.id, user.role, year,
    );
  }

  @Post('payroll/generate')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async generatePayroll(
    @CurrentUser() user: RequestUser,
    @Body() dto: GeneratePayrollDto,
  ) {
    return this.hrService.generatePayroll(user.organizationId, dto);
  }

  @AllowAnyRole()
  @Get('payroll/summary')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async getPayrollSummary(
    @CurrentUser() user: RequestUser,
    @Query('month') month: string,
  ) {
    return this.hrService.getPayrollSummary(user.organizationId, month);
  }

  @Post('payroll/:recordId/process')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async processSalaryPayment(
    @CurrentUser() user: RequestUser,
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ) {
    return this.hrService.processSalaryPayment(user.organizationId, recordId);
  }

  // ===================== Statistics =====================

  @AllowAnyRole()
  @Get('stats')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async getHRStats(@CurrentUser() user: RequestUser) {
    return this.hrService.getHRStats(user.organizationId);
  }
}
