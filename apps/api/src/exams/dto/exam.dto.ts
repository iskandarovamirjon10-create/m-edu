import { IsString, IsUUID, IsNumber, IsOptional, IsDateString, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExamDto {
  @IsUUID()
  groupId: string;

  @IsString()
  subject: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  examDate: string;

  @Type(() => Number)
  @IsNumber()
  duration: number; // minutes

  @Type(() => Number)
  @IsNumber()
  totalMarks: number;

  @Type(() => Number)
  @IsNumber()
  passingMarks: number;

  @IsEnum(['MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT'])
  examType: 'MIDTERM' | 'FINAL' | 'QUIZ' | 'ASSIGNMENT';
}

export class UpdateExamDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  examDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  duration?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  passingMarks?: number;
}

export class PublishExamDto {
  @IsBoolean()
  isPublished: boolean;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class CreateExamResultDto {
  @IsUUID()
  studentId: string;

  @Type(() => Number)
  @IsNumber()
  marksObtained: number;

  @IsOptional()
  @IsString()
  notes?: string;
}