import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ExamsService } from './exams.service';
import {
  CreateExamDto,
  UpdateExamDto,
  CreateExamResultDto,
  PublishExamDto,
} from './dto/exam.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PaginationParams } from '../common/dto/pagination';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowAnyRole } from '../auth/roles.decorator';

@Controller('exams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  // ===================== Exams =====================

  @AllowAnyRole()
  @Get()
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  async findAllExams(
    @CurrentUser() user: any,
    @Query() params: PaginationParams,
  ) {
    return this.examsService.findAllExams(user.organizationId, params);
  }

  // NOTE: static routes MUST be declared before the parameterized `:id`
  // route — NestJS matches in declaration order, so `GET /exams/stats` and
  // `GET /exams/student/:id` would otherwise be captured by `:id` and
  // rejected by ParseUUIDPipe with a 400 before reaching their handlers.
  @AllowAnyRole()
  @Get('stats')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async getExamStats(@CurrentUser() user: any) {
    return this.examsService.getExamStats(user.organizationId);
  }

  @AllowAnyRole()
  @Get('student/:studentId')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  async getStudentExamResults(
    @CurrentUser() user: any,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.examsService.getStudentExamResults(user.organizationId, studentId);
  }

  @AllowAnyRole()
  @Get(':id')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  async findExamById(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.examsService.findExamById(user.organizationId, id);
  }

  @Post()
  @Roles(Role.ORG_ADMIN, Role.TEACHER)
  async createExam(
    @CurrentUser() user: any,
    @Body() dto: CreateExamDto,
  ) {
    return this.examsService.createExam(user.organizationId, dto);
  }

  @Put(':id')
  @Roles(Role.ORG_ADMIN, Role.TEACHER)
  async updateExam(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.examsService.updateExam(user.organizationId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ORG_ADMIN, Role.TEACHER)
  async deleteExam(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.examsService.deleteExam(user.organizationId, id);
  }

  @Post(':id/publish')
  @Roles(Role.ORG_ADMIN, Role.TEACHER)
  async publishExam(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishExamDto,
  ) {
    return this.examsService.publishExam(user.organizationId, id, dto);
  }

  // ===================== Exam Results =====================

  @AllowAnyRole()
  @Get(':examId/results')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  async getExamResults(
    @CurrentUser() user: any,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.examsService.getExamResults(user.organizationId, examId, studentId);
  }

  @Post(':examId/results')
  @Roles(Role.ORG_ADMIN, Role.TEACHER)
  async createExamResult(
    @CurrentUser() user: any,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Body() dto: CreateExamResultDto,
  ) {
    return this.examsService.createExamResult(user.organizationId, examId, dto);
  }
}