/**
 * Typed query-string shapes for listing endpoints.
 *
 * Every `@Query()` object in a controller is validated by the global
 * ValidationPipe (whitelist + forbidNonWhitelisted), so the services can
 * trust these fields. `page`/`limit` come through as strings from the URL
 * and are normalized by `parsePagination`.
 */

export interface PaginationQuery {
  page?: string | number;
  limit?: string | number;
  search?: string;
  examType?: string;
  isPublished?: string;
  department?: string;
  isActive?: string;
  employeeId?: string;
  status?: string;
  type?: string;
}

export interface SearchQuery extends PaginationQuery {
  search?: string;
}

export interface StudentQuery extends SearchQuery {
  groupId?: string;
  isActive?: string;
}

export interface TeacherQuery extends SearchQuery {
  isActive?: string;
}

export interface CourseQuery extends SearchQuery {
  isActive?: string;
}

export interface GroupQuery extends SearchQuery {
  courseId?: string;
  teacherId?: string;
  isActive?: string;
}

export interface GradeQuery extends PaginationQuery {
  studentId?: string;
  groupId?: string;
}

export interface PaymentQuery extends SearchQuery {
  studentId?: string;
  status?: string;
  method?: string;
}

export interface ExpenseQuery extends SearchQuery {
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface LeadQuery extends SearchQuery {
  stage?: string;
  status?: string;
}

export interface HomeworkQuery extends PaginationQuery {
  groupId?: string;
  isActive?: string;
}

export interface NotificationQuery extends PaginationQuery {
  isRead?: string;
}

export interface UserQuery extends SearchQuery {
  role?: string;
  isActive?: string;
}

export interface ScheduleQuery extends PaginationQuery {
  groupId?: string;
  dayOfWeek?: string;
}

export interface AttendanceQuery extends PaginationQuery {
  groupId?: string;
  status?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CameraEventQuery extends PaginationQuery {
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
}
