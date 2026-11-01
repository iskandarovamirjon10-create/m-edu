import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ArrayMinSize,
} from 'class-validator';

export class BulkTeacherStatusDto {
  @ApiProperty({ description: 'List of teacher IDs to update' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  teacherIds!: string[];

  @ApiProperty({ description: 'Active status to apply' })
  @IsBoolean()
  isActive!: boolean;
}

export class BulkTeacherSalaryDto {
  @ApiProperty({ description: 'List of teacher IDs to update' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  teacherIds!: string[];

  @ApiPropertyOptional({ enum: ['MONTHLY', 'HOURLY', 'PER_LESSON'] })
  @IsOptional()
  @IsIn(['MONTHLY', 'HOURLY', 'PER_LESSON'])
  salaryType?: 'MONTHLY' | 'HOURLY' | 'PER_LESSON';

  @ApiPropertyOptional({ description: 'Hourly billing rate' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional({ description: 'Per-lesson rate' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lessonRate?: number;
}

export class BulkTeacherSpecializationsDto {
  @ApiProperty({ description: 'List of teacher IDs to update' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  teacherIds!: string[];

  @ApiProperty({ description: 'Specializations or subjects' })
  @IsArray()
  @IsString({ each: true })
  specializations!: string[];

  @ApiPropertyOptional({ enum: ['add', 'replace'], default: 'add' })
  @IsOptional()
  @IsIn(['add', 'replace'])
  mode?: 'add' | 'replace';
}

export class AssignTeacherGroupDto {
  @ApiProperty({ description: 'Group ID to assign to the teacher' })
  @IsString()
  @IsNotEmpty()
  groupId!: string;
}
