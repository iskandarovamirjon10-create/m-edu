import { ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentStatus, SubmissionStatus } from '@prisma/client';

export class CreateAssignmentDto {
  @ApiProperty({ example: 'g123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  groupId!: string;

  @ApiPropertyOptional({ example: 'l123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsOptional()
  lessonId?: string;

  @ApiPropertyOptional({ example: 't123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsOptional()
  topicId?: string;

  @ApiProperty({ example: 'Essay: The impact of Industrial Revolution' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2026-10-15T23:59:59.000Z' })
  @IsDateString()
  @IsNotEmpty()
  dueDate!: string;

  @ApiPropertyOptional({ default: 100.0 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxScore?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxAttempts?: number;

  @ApiPropertyOptional({ enum: AssignmentStatus, default: AssignmentStatus.PUBLISHED })
  @IsEnum(AssignmentStatus)
  @IsOptional()
  status?: AssignmentStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  attachments?: string[];
}

export class SubmitAssignmentDto {
  @ApiPropertyOptional({ example: 'Here is my essay text...' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ type: [String], example: ['https://storage.medu.uz/submissions/essay.pdf'] })
  @IsArray()
  @IsOptional()
  attachments?: string[];
}

export class GradeSubmissionDto {
  @ApiProperty({ example: 95.0 })
  @IsNumber()
  @Min(0)
  score!: number;

  @ApiPropertyOptional({ example: 'Well structured arguments and clear references.' })
  @IsString()
  @IsOptional()
  feedback?: string;
}
