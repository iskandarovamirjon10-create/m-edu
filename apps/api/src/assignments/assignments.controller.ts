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
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: AssignmentQuery) {
    return this.assignmentsService.findAll(orgId, query);
  }

  @AllowAnyRole()
  @Get(':id')
  @Roles(...STAFF_ROLES, 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'Get assignment details and submissions' })
  findOne(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignmentsService.findOne(orgId, id);
  }

  @Post()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create a new assignment for a group' })
  create(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.assignmentsService.create(orgId, dto);
  }

  @AllowAnyRole()
  @Post(':id/submit')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Submit homework/assignment (Student only)' })
  submit(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAssignmentDto,
  ) {
    return this.assignmentsService.submit(orgId, id, userId, dto);
  }

  @Patch('submissions/:submissionId/grade')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Grade student submission and provide feedback' })
  gradeSubmission(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.assignmentsService.gradeSubmission(orgId, submissionId, userId, dto);
  }
}

