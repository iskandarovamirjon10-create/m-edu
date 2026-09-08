import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

import { DeviceStatus } from '@medu/contracts';
import type { DeviceStatus as DeviceStatusType } from '@medu/contracts';

const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

export class RegisterDeviceDto {
  @ApiProperty({
    description: 'Human-readable device name',
    example: 'Front Entrance Tablet',
    maxLength: 200,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;
}

export class DeviceQueryDto {
  @ApiPropertyOptional({
    enum: DeviceStatus,
    description: 'Filter devices by status',
    example: DeviceStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatusType;

  @ApiPropertyOptional({
    description: 'Search by device name',
    example: 'Front Entrance',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of devices per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}