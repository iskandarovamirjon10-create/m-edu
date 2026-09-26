import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeacherWorkloadService } from './teacher-workload.service';
import { TeacherWorkloadQueryDto } from './dto/teacher-workload-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Teacher Workload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('teacher-workload')
export class TeacherWorkloadController {
  constructor(private readonly teacherWorkloadService: TeacherWorkloadService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get teacher workload summary' })
  async getSummary(@CurrentUser('organizationId') orgId: string) {
    return this.teacherWorkloadService.getSummary(orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List teacher workload' })
  async findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: TeacherWorkloadQueryDto,
  ) {
    return this.teacherWorkloadService.findAll(orgId, query);
  }
}
