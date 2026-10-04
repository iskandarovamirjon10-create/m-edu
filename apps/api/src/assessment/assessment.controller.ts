import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssessmentService, QuestionQuery, QuizQuery } from './assessment.service';
import { CreateQuestionDto, CreateQuizDto, SubmitQuizAttemptDto } from './assessment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Assessment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  // ==================== QUESTION BANK ====================

  @Get('questions')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List questions in the question bank' })
  findAllQuestions(@CurrentUser('organizationId') orgId: string, @Query() query: QuestionQuery) {
    return this.assessmentService.findAllQuestions(orgId, query);
  }

  @Post('questions')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create a new question in the question bank' })
  createQuestion(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateQuestionDto) {
    return this.assessmentService.createQuestion(orgId, dto);
  }

  // ==================== QUIZZES ====================

  @AllowAnyRole()
  @Get('quizzes')
  @Roles(...STAFF_ROLES, 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'List quizzes' })
  findAllQuizzes(@CurrentUser('organizationId') orgId: string, @Query() query: QuizQuery) {
    return this.assessmentService.findAllQuizzes(orgId, query);
  }

  @Get('quizzes/:id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get full quiz configuration with answers for teachers' })
  findQuizForTeacher(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assessmentService.findQuizForTeacher(orgId, id);
  }

  @Post('quizzes')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create a new quiz' })
  createQuiz(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateQuizDto) {
    return this.assessmentService.createQuiz(orgId, dto);
  }

  // ==================== STUDENT TEST TAKING ====================

  @AllowAnyRole()
  @Post('quizzes/:id/start')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Start a quiz attempt (Correct answers stripped, authoritative timer starts)' })
  startAttempt(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assessmentService.startAttempt(orgId, id, userId);
  }

  @AllowAnyRole()
  @Post('attempts/:attemptId/submit')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Submit quiz answers (Auto-graded immediately)' })
  submitAttempt(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: SubmitQuizAttemptDto,
  ) {
    return this.assessmentService.submitAttempt(orgId, attemptId, userId, dto);
  }
}

