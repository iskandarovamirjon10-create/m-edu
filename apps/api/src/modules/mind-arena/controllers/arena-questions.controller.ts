import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../auth/roles.guard';
import { Roles, AllowAnyRole, AllowSelfService } from '../../../auth/roles.decorator';
import { CurrentUser } from '../../../auth/current-user.decorator';
import type { RequestUser } from '../../../auth/types';
import { ArenaQuestionsService } from '../services/arena-questions.service';
import { ArenaAiQuestionService } from '../services/arena-ai-question.service';
import {
  CreateArenaQuestionDto,
  GenerateAiQuestionsDto,
  QueryArenaQuestionsDto,
  RejectArenaQuestionDto,
  UpdateArenaQuestionDto,
} from '../dto/arena-question.dto';

@ApiTags('Mind Arena Questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('arena/questions')
export class ArenaQuestionsController {
  constructor(
    private readonly questionsService: ArenaQuestionsService,
    private readonly aiQuestionService: ArenaAiQuestionService,
  ) {}

  @Post('generate-ai')
  @Roles('PLATFORM_OWNER', 'SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER')
  @ApiOperation({
    summary:
      'Generate battle questions via Gemini AI with subject-specific verification (saved as PENDING_REVIEW)',
  })
  async generateAiQuestions(
    @CurrentUser() user: RequestUser,
    @Body() dto: GenerateAiQuestionsDto,
  ) {
    return this.aiQuestionService.generateQuestions(user, dto);
  }

  @Post()
  @Roles('PLATFORM_OWNER', 'SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER')
  @ApiOperation({ summary: 'Create a custom battle question manually' })
  async createQuestion(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateArenaQuestionDto,
  ) {
    return this.questionsService.createQuestion(user, dto);
  }

  @Get()
  @AllowSelfService()
  @ApiOperation({
    summary: 'List questions with multi-tenant isolation, subject and difficulty filters',
  })
  async listQuestions(
    @CurrentUser() user: RequestUser,
    @Query() query: QueryArenaQuestionsDto,
  ) {
    return this.questionsService.listQuestions(user, query);
  }

  @Get(':id')
  @AllowSelfService()
  @ApiOperation({ summary: 'Get question details and options' })
  async getQuestionById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.questionsService.getQuestionById(user, id);
  }

  @Patch(':id')
  @Roles('PLATFORM_OWNER', 'SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER')
  @ApiOperation({
    summary: 'Update question content (increments version and resets to PENDING_REVIEW)',
  })
  async updateQuestion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateArenaQuestionDto,
  ) {
    return this.questionsService.updateQuestion(user, id, dto);
  }

  @Patch(':id/approve')
  @Roles('PLATFORM_OWNER', 'SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Approve question for active duels (RBAC restricted)',
  })
  async approveQuestion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.questionsService.approveQuestion(user, id);
  }

  @Patch(':id/reject')
  @Roles('PLATFORM_OWNER', 'SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Reject question with reason',
  })
  async rejectQuestion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RejectArenaQuestionDto,
  ) {
    return this.questionsService.rejectQuestion(user, id, dto);
  }

  @Delete(':id')
  @Roles('PLATFORM_OWNER', 'SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Archive question to retire from duel rotation' })
  async archiveQuestion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.questionsService.archiveQuestion(user, id);
  }
}
