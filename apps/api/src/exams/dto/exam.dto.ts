import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExamType } from '@prisma/client';

export class CreateExamDto {
  @IsUUID()
  groupId: string;

  @IsString()
  @MaxLength(100)
  subject: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsDateString()
  examDate: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  duration: number; // minutes

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  totalMarks: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  passingMarks: number;

  @IsEnum(ExamType)
  examType: ExamType;
}

export class UpdateExamDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  examDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  duration?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  totalMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  passingMarks?: number;

  @IsOptional()
  @IsEnum(ExamType)
  examType?: ExamType;
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
  @Min(0)
  marksObtained: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}