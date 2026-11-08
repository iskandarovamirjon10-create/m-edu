import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CalendarService, CalendarEventQuery } from './calendar.service';
import { CreateCalendarEventDto } from './calendar.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';
import { AllowAnyRole } from '../auth/roles.decorator';
import type { RequestUser } from '../auth/types';

@ApiTags('Calendar & Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @AllowAnyRole()
  @Get('events')
  @Roles(...STAFF_ROLES, 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'Get calendar events with date filters' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: CalendarEventQuery,
  ) {
    return this.calendarService.findAll(user.organizationId, query, {
      id: user.id || user.sub,
      role: user.role,
    });
  }

  @Post('events')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create calendar event with conflict detection' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendarService.create(user.organizationId, user.id || user.sub, dto);
  }
}

