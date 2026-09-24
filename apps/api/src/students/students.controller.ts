import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto } from '../common/dto';
import { StudentQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ADMIN_ROLES, STAFF_ROLES } from '../auth/authorization.policy';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List students' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: StudentQuery) {
    return this.studentsService.findAll(orgId, query);
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get student details' })
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.studentsService.findOne(orgId, id);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a student' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateStudentDto) {
    return this.studentsService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update a student' })
  update(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Delete a student (no historical records) or deactivate otherwise' })
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.studentsService.remove(orgId, id);
  }

  @Post(':id/groups/:groupId')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Assign student to a group' })
  assignToGroup(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') studentId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.studentsService.assignToGroup(orgId, studentId, groupId);
  }

  @Delete(':id/groups/:groupId')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Remove student from a group' })
  removeFromGroup(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') studentId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.studentsService.removeFromGroup(orgId, studentId, groupId);
  }
}
