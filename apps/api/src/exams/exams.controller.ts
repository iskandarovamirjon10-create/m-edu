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
import type { RequestUser } from '../auth/types';
import { AllowAnyRole } from '../auth/roles.decorator';
import { ADMIN_ROLES, STAFF_ROLES } from '../auth/authorization.policy';

@Controller('exams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  // ===================== Exams =====================

  @AllowAnyRole()
  @Get()
  @Roles(...STAFF_ROLES, Role.STUDENT, Role.PARENT)
  async findAllExams(
    @CurrentUser() user: RequestUser,
    @Query() params: PaginationParams,
  ) {
    return this.examsService.findAllExams(user.organizationId, params, {
      id: user.id || user.sub,
      role: user.role,
    });
  }

  // NOTE: static routes MUST be declared before the parameterized `:id`
  // route — NestJS matches in declaration order, so `GET /exams/stats` and
  // `GET /exams/student/:id` would otherwise be captured by `:id` and
  // rejected by ParseUUIDPipe with a 400 before reaching their handlers.
  @AllowAnyRole()
  @Get('stats')
  @Roles(...ADMIN_ROLES)
  async getExamStats(@CurrentUser() user: RequestUser) {
    return this.examsService.getExamStats(user.organizationId);
  }

  @AllowAnyRole()
  @Get('student/:studentId')
  @Roles(...STAFF_ROLES, Role.STUDENT, Role.PARENT)
  async getStudentExamResults(
    @CurrentUser() user: RequestUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.examsService.getStudentExamResults(user.organizationId, studentId, {
      id: user.id || user.sub,
      role: user.role,
    });
  }

  @AllowAnyRole()
  @Get(':id')
  @Roles(...STAFF_ROLES, Role.STUDENT, Role.PARENT)
  async findExamById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.examsService.findExamById(user.organizationId, id, {
      id: user.id || user.sub,
      role: user.role,
    });
  }

  @Post()
  @Roles(...STAFF_ROLES)
  async createExam(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateExamDto,
  ) {
    return this.examsService.createExam(user.organizationId, dto, {
      id: user.id || user.sub,
      role: user.role,
    });
  }

  @Put(':id')
  @Roles(...STAFF_ROLES)
  async updateExam(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.examsService.updateExam(user.organizationId, id, dto, {
      id: user.id || user.sub,
      role: user.role,
    });
  }

  @Delete(':id')
  @Roles(...STAFF_ROLES)
  async deleteExam(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.examsService.deleteExam(user.organizationId, id, {
      id: user.id || user.sub,
      role: user.role,
    });
  }

  @Post(':id/publish')
  @Roles(...STAFF_ROLES)
  async publishExam(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishExamDto,
  ) {
    return this.examsService.publishExam(user.organizationId, id, dto, {
      id: user.id || user.sub,
      role: user.role,
    });
  }

  // ===================== Exam Results =====================

  @AllowAnyRole()
  @Get(':examId/results')
  @Roles(...STAFF_ROLES, Role.STUDENT, Role.PARENT)
  async getExamResults(
    @CurrentUser() user: RequestUser,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.examsService.getExamResults(user.organizationId, examId, studentId, {
      id: user.id || user.sub,
      role: user.role,
    });
  }

  @Post(':examId/results')
  @Roles(...STAFF_ROLES)
  async createExamResult(
    @CurrentUser() user: RequestUser,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Body() dto: CreateExamResultDto,
  ) {
    return this.examsService.createExamResult(user.organizationId, examId, dto, {
      id: user.id || user.sub,
      role: user.role,
    });
  }
}
