import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssignmentsService, AssignmentQuery } from './assignments.service';
import { CreateAssignmentDto, GradeSubmissionDto, SubmitAssignmentDto } from './assignment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';
import { AllowAnyRole } from '../auth/roles.decorator';
import type { RequestUser } from '../auth/types';

@ApiTags('Assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @AllowAnyRole()
  @Get()
  @Roles(...STAFF_ROLES, 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'List assignments' })
  findAll(@CurrentUser() user: RequestUser, @Query() query: AssignmentQuery) {
    return this.assignmentsService.findAll(user.organizationId, query, {
      id: user.sub,
      role: user.role,
    });
  }

  @AllowAnyRole()
  @Get(':id')
  @Roles(...STAFF_ROLES, 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'Get assignment details and submissions' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignmentsService.findOne(user.organizationId, id, {
      id: user.sub,
      role: user.role,
    });
  }

  @Post()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create a new assignment for a group' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.assignmentsService.create(user.organizationId, dto, {
      id: user.id || user.sub,
      role: user.role,
    });
  }

  @AllowAnyRole()
  @Post(':id/submit')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Submit homework/assignment (Student only)' })
  submit(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAssignmentDto,
  ) {
    return this.assignmentsService.submit(user.organizationId, id, user.id || user.sub, dto);
  }

  @Patch('submissions/:submissionId/grade')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Grade student submission and provide feedback' })
  gradeSubmission(
    @CurrentUser() user: RequestUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.assignmentsService.gradeSubmission(
      user.organizationId,
      submissionId,
      user.id || user.sub,
      dto,
      { id: user.id || user.sub, role: user.role },
    );
  }
}

