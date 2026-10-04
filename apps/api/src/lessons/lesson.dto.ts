import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonStatus } from '@prisma/client';

export class UpdateLessonStatusDto {
  @ApiProperty({ enum: LessonStatus, example: LessonStatus.CONDUCTED })
  @IsEnum(LessonStatus)
  @IsNotEmpty()
  status!: LessonStatus;

  @ApiPropertyOptional({ example: 'Teacher fell ill' })
  @IsString()
  @IsOptional()
  cancelReason?: string;
}

export class UpdateLessonContentDto {
  @ApiPropertyOptional({ example: 't123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsOptional()
  topicId?: string;

  @ApiPropertyOptional({ example: 'Mastered irregular verbs today' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: 'Room 204' })
  @IsString()
  @IsOptional()
  room?: string;
}

export class LinkLessonMaterialDto {
  @ApiProperty({ example: 'm123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  materialId!: string;
}
