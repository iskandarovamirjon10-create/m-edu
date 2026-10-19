import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto, CreateParentLinkDto, UpdateParentLinkDto } from '../common/dto';
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

  @Post(':id/freeze')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Freeze student enrollment (medical leave / academic freeze)' })
  freeze(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') studentId: string,
    @Body() body: { startDate?: string; endDate?: string; reason?: string },
  ) {
    return this.studentsService.freeze(orgId, studentId, body);
  }

  @Post(':id/unfreeze')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Unfreeze and restore student active status' })
  unfreeze(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') studentId: string,
  ) {
    return this.studentsService.unfreeze(orgId, studentId);
  }

  // ==================== Parent Associations ====================

  @Get(':id/parents')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get parents linked to student' })
  getParents(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') studentId: string,
  ) {
    return this.studentsService.getStudentParents(orgId, studentId);
  }

  @Post(':id/parents')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create or link parent to student' })
  createParent(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') studentId: string,
    @Body() dto: CreateParentLinkDto,
  ) {
    return this.studentsService.createOrLinkParent(orgId, studentId, dto);
  }

  @Patch(':id/parents/:parentId')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update parent-student link permissions' })
  updateParentLink(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') studentId: string,
    @Param('parentId') parentId: string,
    @Body() dto: UpdateParentLinkDto,
  ) {
    return this.studentsService.updateParentLink(orgId, studentId, parentId, dto);
  }

  @Delete(':id/parents/:parentId')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Unlink parent from student' })
  unlinkParent(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') studentId: string,
    @Param('parentId') parentId: string,
  ) {
    return this.studentsService.unlinkParent(orgId, studentId, parentId);
  }
}
