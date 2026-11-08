import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto, CreateParentLinkDto, UpdateParentLinkDto, BulkAssignGroupDto, BulkFreezeDto, BulkUnfreezeDto, BulkStatusDto, BulkDeleteStudentsDto } from '../common/dto';
import { StudentQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ADMIN_ROLES, STAFF_ROLES } from '../auth/authorization.policy';
import type { RequestUser } from '../auth/types';
import { QuotaGuard, RequireQuota } from '../subscriptions/guards/quota.guard';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List students' })
  findAll(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser() userOrQuery: RequestUser | StudentQuery,
    @Query() queryOrUser?: StudentQuery | RequestUser,
  ) {
    let user: RequestUser | undefined;
    let query: StudentQuery = {};
    if (userOrQuery && typeof userOrQuery === 'object' && ('role' in userOrQuery || 'sub' in userOrQuery)) {
      user = userOrQuery as RequestUser;
      query = (queryOrUser as StudentQuery) || {};
    } else {
      query = (userOrQuery as StudentQuery) || {};
      user = queryOrUser && typeof queryOrUser === 'object' && ('role' in queryOrUser || 'sub' in queryOrUser)
        ? (queryOrUser as RequestUser)
        : undefined;
    }
    return user
      ? this.studentsService.findAll(orgId, query, user)
      : this.studentsService.findAll(orgId, query);
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get student details' })
  findOne(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser() userOrId: RequestUser | string,
    @Param('id') idOrUser?: string | RequestUser,
  ) {
    let user: RequestUser | undefined;
    let id: string = '';
    if (typeof userOrId === 'string') {
      id = userOrId;
      user = idOrUser && typeof idOrUser === 'object' && ('role' in idOrUser || 'sub' in idOrUser)
        ? (idOrUser as RequestUser)
        : undefined;
    } else {
      user = userOrId;
      id = typeof idOrUser === 'string' ? idOrUser : '';
    }
    return user
      ? this.studentsService.findOne(orgId, id, user)
      : this.studentsService.findOne(orgId, id);
  }

  @Post()
  @UseGuards(QuotaGuard)
  @RequireQuota('students')
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

  @Post('bulk-assign-group')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Bulk assign students to a group' })
  bulkAssignGroup(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: BulkAssignGroupDto,
  ) {
    return this.studentsService.bulkAssignGroup(orgId, dto);
  }

  @Post('bulk-freeze')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Bulk freeze students' })
  bulkFreeze(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: BulkFreezeDto,
  ) {
    return this.studentsService.bulkFreeze(orgId, dto);
  }

  @Post('bulk-unfreeze')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Bulk unfreeze students' })
  bulkUnfreeze(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: BulkUnfreezeDto,
  ) {
    return this.studentsService.bulkUnfreeze(orgId, dto);
  }

  @Post('bulk-status')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Bulk update student status' })
  bulkStatus(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: BulkStatusDto,
  ) {
    return this.studentsService.bulkStatus(orgId, dto);
  }

  @Post('bulk-delete')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Bulk delete or archive students' })
  bulkDelete(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: BulkDeleteStudentsDto,
  ) {
    return this.studentsService.bulkDelete(orgId, dto);
  }

}
