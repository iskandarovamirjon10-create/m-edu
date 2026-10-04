import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurriculumStatus } from '@prisma/client';

export class CreateCurriculumDto {
  @ApiProperty({ example: 's123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  subjectId!: string;

  @ApiPropertyOptional({ example: 'c123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsOptional()
  courseId?: string;

  @ApiProperty({ example: 'General English Level 1 Curriculum' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: '1.0', default: '1.0' })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: 40 })
  @IsInt()
  @IsOptional()
  totalHours?: number;

  @ApiPropertyOptional({ enum: CurriculumStatus, default: CurriculumStatus.DRAFT })
  @IsEnum(CurriculumStatus)
  @IsOptional()
  status?: CurriculumStatus;
}

export class UpdateCurriculumDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: CurriculumStatus })
  @IsEnum(CurriculumStatus)
  @IsOptional()
  status?: CurriculumStatus;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  totalHours?: number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  courseId?: string;
}

export class CreateModuleDto {
  @ApiProperty({ example: 'Module 1: Foundations' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;
}

export class CreateTopicDto {
  @ApiProperty({ example: 'Present Perfect Tense' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;

  @ApiPropertyOptional({ default: 60 })
  @IsInt()
  @Min(5)
  @IsOptional()
  durationMin?: number;
}

export class CreateObjectiveDto {
  @ApiProperty({ example: 'OBJ-1.1' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Student can form positive and negative Present Perfect sentences.' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ example: 'UNDERSTAND', default: 'UNDERSTAND' })
  @IsString()
  @IsOptional()
  bloomLevel?: string;
}
