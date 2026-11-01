import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';

export class BulkGroupStatusDto {
  @ApiProperty({ description: 'List of group IDs to update' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  groupIds!: string[];

  @ApiProperty({ description: 'Active status to apply' })
  @IsBoolean()
  isActive!: boolean;
}

export class BulkGroupTeacherDto {
  @ApiProperty({ description: 'List of group IDs to update' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  groupIds!: string[];

  @ApiPropertyOptional({ description: 'Teacher ID to assign (or null to unassign)' })
  @IsOptional()
  @IsString()
  teacherId?: string | null;
}

export class BulkGroupRoomDto {
  @ApiProperty({ description: 'List of group IDs to update' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  groupIds!: string[];

  @ApiPropertyOptional({ description: 'Room name or number to assign (or null to unassign)' })
  @IsOptional()
  @IsString()
  room?: string | null;
}
