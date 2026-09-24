import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto, UpdateAttendanceDto } from '../common/dto';
import { AttendanceQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/types';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @ApiOperation({ summary: 'Mark attendance for group session' })
  markAttendance(@CurrentUser('organizationId') orgId: string, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.markAttendance(orgId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List attendance records' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: AttendanceQuery) {
    return this.attendanceService.findAll(orgId, query);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get attendance analytics' })
  getAnalytics(@CurrentUser('organizationId') orgId: string, @Query() query: AttendanceQuery) {
    return this.attendanceService.getAnalytics(orgId, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit an attendance record (status/note)' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Void (delete) an attendance record' })
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attendanceService.remove(user, id);
  }
}
