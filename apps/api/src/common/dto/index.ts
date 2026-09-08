import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Strip HTML tags from a string value (server-side XSS prevention). */
const stripHtmlTags = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : value;

// ==================== Students ====================

export class CreateStudentDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(6)
  password?: string;

  @ApiProperty() @Transform(stripHtmlTags) @IsString() @IsNotEmpty() @MaxLength(100)
  firstName: string;

  @ApiProperty() @Transform(stripHtmlTags) @IsString() @IsNotEmpty() @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional() @IsOptional() @IsEnum(['MALE', 'FEMALE', 'OTHER'])
  gender?: 'MALE' | 'FEMALE' | 'OTHER';

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  address?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  parentName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  parentPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  parentEmail?: string;
}

export class UpdateStudentDto {
  @ApiPropertyOptional() @Transform(stripHtmlTags) @IsOptional() @IsString() @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional() @Transform(stripHtmlTags) @IsOptional() @IsString() @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional() @IsOptional() @IsEnum(['MALE', 'FEMALE', 'OTHER'])
  gender?: 'MALE' | 'FEMALE' | 'OTHER';

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  address?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  parentName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  parentPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  parentEmail?: string;
}

// ==================== Teachers ====================

export class CreateTeacherDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(6)
  password?: string;

  @ApiProperty() @Transform(stripHtmlTags) @IsString() @IsNotEmpty() @MaxLength(100)
  firstName: string;

  @ApiProperty() @Transform(stripHtmlTags) @IsString() @IsNotEmpty() @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true })
  specializations?: string[];

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  experience?: number;
}

export class UpdateTeacherDto {
  @ApiPropertyOptional() @Transform(stripHtmlTags) @IsOptional() @IsString() @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional() @Transform(stripHtmlTags) @IsOptional() @IsString() @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true })
  specializations?: string[];

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  experience?: number;
}

// ==================== Courses ====================

export class CreateCourseDto {
  @ApiProperty() @Transform(stripHtmlTags) @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiProperty() @IsNumber() @Min(0)
  price: number;

  @ApiProperty() @IsNumber() @Min(1)
  duration: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  level?: string;
}

export class UpdateCourseDto {
  @ApiPropertyOptional() @Transform(stripHtmlTags) @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  price?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1)
  duration?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  level?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ==================== Groups ====================

export class CreateGroupDto {
  @ApiProperty() @Transform(stripHtmlTags) @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @ApiProperty() @IsUUID()
  courseId: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(100)
  capacity?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  room?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  startDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  endDate?: string;
}

export class UpdateGroupDto {
  @ApiPropertyOptional() @Transform(stripHtmlTags) @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  @Matches(/^$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  teacherId?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(100)
  capacity?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  room?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  startDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  endDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ==================== Leads ====================

export class CreateLeadDto {
  @ApiProperty() @Transform(stripHtmlTags) @IsString() @IsNotEmpty() @MaxLength(100)
  firstName: string;

  @ApiPropertyOptional() @Transform(stripHtmlTags) @IsOptional() @IsString() @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  source?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  ownerId?: string;
}

export class UpdateLeadDto {
  @ApiPropertyOptional() @Transform(stripHtmlTags) @IsOptional() @IsString() @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional() @Transform(stripHtmlTags) @IsOptional() @IsString() @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  source?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  ownerId?: string;
}

export class UpdateLeadStageDto {
  @ApiProperty() @IsEnum(['NEW', 'CONTACTED', 'TRIAL_LESSON', 'WON', 'LOST'])
  stage: 'NEW' | 'CONTACTED' | 'TRIAL_LESSON' | 'WON' | 'LOST';

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  lostReason?: string;
}

export class ConvertLeadDto {
  // Optional: the service falls back to the lead's own email when omitted.
  // The conversion still fails closed if neither source has an email.
  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(6)
  password?: string;
}

export class AddLeadActivityDto {
  @ApiProperty() @IsEnum(['CALL', 'MESSAGE', 'MEETING', 'REMINDER', 'TASK', 'NOTE'])
  type: 'CALL' | 'MESSAGE' | 'MEETING' | 'REMINDER' | 'TASK' | 'NOTE';

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200)
  subject: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  outcome?: string;
}

// ==================== Payments ====================

export class CreatePaymentDto {
  @ApiProperty() @IsUUID()
  studentId: string;

  @ApiProperty() @IsNumber() @Min(0.01)
  amount: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  method?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  reference?: string;
}

export class UpdatePaymentDto {
  @ApiPropertyOptional() @IsOptional() @IsEnum(['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'])
  status?: 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED';

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.01)
  amount?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  method?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  reference?: string;
}

// ==================== Expenses ====================

export class CreateExpenseDto {
  @ApiProperty() @IsEnum(['SALARY', 'RENT', 'UTILITIES', 'MARKETING', 'SUPPLIES', 'MAINTENANCE', 'SOFTWARE', 'TRAINING', 'OTHER'])
  category: 'SALARY' | 'RENT' | 'UTILITIES' | 'MARKETING' | 'SUPPLIES' | 'MAINTENANCE' | 'SOFTWARE' | 'TRAINING' | 'OTHER';

  @ApiProperty() @IsNumber() @Min(0.01)
  amount: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @ApiProperty() @IsDateString()
  date: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  receipt?: string;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional() @IsOptional() @IsEnum(['SALARY', 'RENT', 'UTILITIES', 'MARKETING', 'SUPPLIES', 'MAINTENANCE', 'SOFTWARE', 'TRAINING', 'OTHER'])
  category?: 'SALARY' | 'RENT' | 'UTILITIES' | 'MARKETING' | 'SUPPLIES' | 'MAINTENANCE' | 'SOFTWARE' | 'TRAINING' | 'OTHER';

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.01)
  amount?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  date?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  receipt?: string;
}

// ==================== Attendance ====================

export class AttendanceRecordDto {
  @ApiProperty() @IsUUID()
  studentId: string;

  @ApiProperty() @IsEnum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class MarkAttendanceDto {
  @ApiProperty() @IsUUID()
  groupId: string;

  @ApiProperty() @IsDateString()
  date: string;

  @ApiProperty({ type: [AttendanceRecordDto] }) @IsArray()
  records: AttendanceRecordDto[];
}

// ==================== Grades ====================

export class CreateGradeDto {
  @ApiProperty() @IsUUID()
  studentId: string;

  @ApiProperty() @IsUUID()
  groupId: string;

  @ApiProperty() @IsNumber() @Min(0)
  value: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1)
  maxValue?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  label?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}

export class UpdateGradeDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  value?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1)
  maxValue?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  label?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}

// ==================== Homework ====================

export class CreateHomeworkDto {
  @ApiProperty() @IsUUID()
  groupId: string;

  @ApiProperty() @Transform(stripHtmlTags) @IsString() @IsNotEmpty() @MaxLength(200)
  title: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  deadline?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1)
  maxScore?: number;
}

export class UpdateHomeworkDto {
  @ApiPropertyOptional() @Transform(stripHtmlTags) @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  deadline?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1)
  maxScore?: number;
}

// ==================== Schedule ====================

export class CreateScheduleDto {
  @ApiProperty() @IsUUID()
  groupId: string;

  @ApiProperty() @IsEnum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

  @ApiProperty() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime: string;

  @ApiProperty() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  room?: string;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional() @IsOptional() @IsEnum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])
  dayOfWeek?: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  room?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ==================== Users ====================

export class CreateUserDto {
  @ApiProperty() @IsEmail()
  email: string;

  // Optional — a user without a password signs in via Google (or is invited
  // later). The service creates a passwordless row (passwordHash: null),
  // mirroring how student/teacher accounts are created.
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(8) @MaxLength(128)
  password?: string;

  @ApiProperty() @Transform(stripHtmlTags) @IsString() @IsNotEmpty() @MaxLength(100)
  firstName: string;

  @ApiProperty() @Transform(stripHtmlTags) @IsString() @IsNotEmpty() @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiProperty() @IsEnum(['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER', 'ASSISTANT', 'STUDENT'])
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MANAGER' | 'TEACHER' | 'ASSISTANT' | 'STUDENT';
}

export class UpdateUserDto {
  @ApiPropertyOptional() @Transform(stripHtmlTags) @IsOptional() @IsString() @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional() @Transform(stripHtmlTags) @IsOptional() @IsString() @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEnum(['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER', 'ASSISTANT', 'STUDENT'])
  role?: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MANAGER' | 'TEACHER' | 'ASSISTANT' | 'STUDENT';

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateUserSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  theme?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  language?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  timezone?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  smsNotifications?: boolean;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  currentPassword: string;

  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128)
  newPassword: string;
}
