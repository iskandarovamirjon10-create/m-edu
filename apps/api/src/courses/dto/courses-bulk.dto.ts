import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ArrayMinSize,
} from 'class-validator';

export class BulkCourseStatusDto {
  @ApiProperty({ description: 'List of course IDs to update' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  courseIds!: string[];

  @ApiProperty({ description: 'Active status to apply' })
  @IsBoolean()
  isActive!: boolean;
}

export class BulkCoursePriceDto {
  @ApiProperty({ description: 'List of course IDs to update' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  courseIds!: string[];

  @ApiPropertyOptional({ enum: ['set', 'increase_percent', 'decrease_percent'], default: 'set' })
  @IsOptional()
  @IsIn(['set', 'increase_percent', 'decrease_percent'])
  mode?: 'set' | 'increase_percent' | 'decrease_percent';

  @ApiProperty({ description: 'Price value (or percentage if mode is percent)' })
  @IsNumber()
  @Min(0)
  value!: number;
}
