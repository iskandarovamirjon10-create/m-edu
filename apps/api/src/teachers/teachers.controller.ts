import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto, UpdateTeacherDto } from '../common/dto';
import { TeacherQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { QuotaGuard, RequireQuota } from '../subscriptions/guards/quota.guard';
import { ADMIN_ROLES, STAFF_ROLES } from '../auth/authorization.policy';
import {
  BulkTeacherStatusDto,
  BulkTeacherSalaryDto,
  BulkTeacherSpecializationsDto,
  AssignTeacherGroupDto,
} from './dto/teachers-bulk.dto';

@ApiTags('Teachers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List teachers with advanced filtering and metrics' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: TeacherQuery) {
    return this.teachersService.findAll(orgId, query);
  }

  @Get('stats')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get aggregated teacher & faculty statistics' })
  getStats(@CurrentUser('organizationId') orgId: string) {
    return this.teachersService.getStats(orgId);
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get teacher details' })
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.teachersService.findOne(orgId, id);
  }

  @Get(':id/analytics')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get deep teacher workload & performance analytics' })
  getAnalytics(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.teachersService.getTeacherAnalytics(orgId, id);
  }

  @Post()
  @UseGuards(QuotaGuard)
  @RequireQuota('employees')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a teacher' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateTeacherDto) {
    return this.teachersService.create(orgId, dto);
  }

  @Post('bulk/status')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Bulk update teacher active status' })
  bulkStatus(@CurrentUser('organizationId') orgId: string, @Body() dto: BulkTeacherStatusDto) {
    return this.teachersService.bulkStatus(orgId, dto);
  }

  @Post('bulk/salary')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Bulk update teacher compensation models and rates' })
  bulkSalary(@CurrentUser('organizationId') orgId: string, @Body() dto: BulkTeacherSalaryDto) {
    return this.teachersService.bulkSalary(orgId, dto);
  }

  @Post('bulk/specializations')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Bulk update teacher specializations or subjects' })
  bulkSpecializations(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: BulkTeacherSpecializationsDto,
  ) {
    return this.teachersService.bulkSpecializations(orgId, dto);
  }

  @Post(':id/assign-group')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Quickly assign a group to a teacher' })
  assignGroup(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: AssignTeacherGroupDto,
  ) {
    return this.teachersService.assignGroup(orgId, id, dto.groupId);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update a teacher' })
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.teachersService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Delete a teacher (not assigned to groups) or deactivate otherwise' })
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.teachersService.remove(orgId, id);
  }
}
