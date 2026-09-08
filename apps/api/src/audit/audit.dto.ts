import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsInt, Min, Max, IsDateString } from 'class-validator';
import { AuditActionEnum, AuditEntityTypeEnum } from './audit.types';
import type { SystemAuditEventDto, AuditAction, AuditEntityType } from './audit.types';

export class AuditQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @ApiPropertyOptional({ enum: AuditActionEnum })
  @IsOptional()
  @IsEnum(AuditActionEnum)
  action?: AuditAction;

  @ApiPropertyOptional({ enum: AuditEntityTypeEnum })
  @IsOptional()
  @IsEnum(AuditEntityTypeEnum)
  entityType?: AuditEntityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class AuditResponseDto {
  @ApiProperty({ type: [Object] })
  items: SystemAuditEventDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

// SystemAuditEventDto, AuditAction, and AuditEntityType live in audit.types
// (the canonical interface). Re-export them here for ergonomic imports
// (`import { SystemAuditEventDto } from './audit.dto'`).
export { AuditAction, AuditEntityType, SystemAuditEventDto } from './audit.types';
