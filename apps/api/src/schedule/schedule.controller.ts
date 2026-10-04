import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScheduleService, ScheduleQuery } from './schedule.service';
import { CreateScheduleDto, UpdateScheduleDto } from '../common/dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/types';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @AllowAnyRole()
  @Get()
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER', 'ASSISTANT', 'STUDENT')
  @ApiOperation({ summary: 'List schedules' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: ScheduleQuery, @CurrentUser() user: RequestUser) {
    return this.scheduleService.findAll(orgId, query, user);
  }

  @AllowAnyRole()
  @Get(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER', 'ASSISTANT', 'STUDENT')
  @ApiOperation({ summary: 'Get schedule entry' })
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.scheduleService.findOne(orgId, id, user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a schedule entry' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateScheduleDto) {
    return this.scheduleService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update a schedule entry' })
  update(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.scheduleService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Deactivate a schedule entry' })
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.scheduleService.remove(orgId, id);
  }
}

