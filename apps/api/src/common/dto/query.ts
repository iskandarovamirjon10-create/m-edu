import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Typed query-string shapes for listing endpoints.
 *
 * Every `@Query()` object in a controller is validated by the global
 * ValidationPipe (whitelist + forbidNonWhitelisted). Because these are now
 * classes with validation decorators, `whitelist` correctly drops arbitrary 
 * object injections.
 */

export class PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  page?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  limit?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  examType?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  isPublished?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  department?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  isActive?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  employeeId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  type?: string;
}

export class SearchQuery extends PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  override search?: string;
}

export class StudentQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  groupId?: string;

  /** Restrict to students taught by this teacher (Teaching roles). */
  @ApiPropertyOptional() @IsOptional() @IsString()
  teacherId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  override isActive?: string;
}

export class TeacherQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  override isActive?: string;
}

export class CourseQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  override isActive?: string;
}

export class GroupQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  courseId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  teacherId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  override isActive?: string;
}

export class GradeQuery extends PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  studentId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  groupId?: string;
}

export class PaymentQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  studentId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  override status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  method?: string;
}

export class ExpenseQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  category?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  dateFrom?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  dateTo?: string;
}

export class LeadQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  stage?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  override status?: string;
}

export class HomeworkQuery extends PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  groupId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  override isActive?: string;
}

export class NotificationQuery extends PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  isRead?: string;
}

export class UserQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  role?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  override isActive?: string;
}

export class ScheduleQuery extends PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  groupId?: string;

  /** Restrict to lessons of the groups taught by this teacher. */
  @ApiPropertyOptional() @IsOptional() @IsString()
  teacherId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  dayOfWeek?: string;
}

export class AttendanceQuery extends PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  groupId?: string;

  /** Restrict to one student's records (used for self-service reads). */
  @ApiPropertyOptional() @IsOptional() @IsString()
  studentId?: string;

  /** Restrict to the groups taught by this teacher. */
  @ApiPropertyOptional() @IsOptional() @IsString()
  teacherId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  override status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  date?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  dateFrom?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  dateTo?: string;
}

export class CameraEventQuery extends PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  override status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  override type?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  dateFrom?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  dateTo?: string;
}
