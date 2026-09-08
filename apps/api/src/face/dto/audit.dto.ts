import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  AuditEventType,
} from '@medu/contracts';

import type {
  AuditEventType as AuditEventTypeType,
} from '@medu/contracts';

const MAX_ID_LENGTH = 64;
const MAX_SEARCH_LENGTH = 100;
const MAX_DATE_LENGTH = 64;

const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

/**
 * Validated query shape for `GET /face/audit-log`.
 *
 * `page`/`limit` arrive as URL strings and are explicitly transformed
 * to validated integers by the global ValidationPipe (`@Type(() => Number)`
 * + `@IsInt()`), so the service and adapter always receive real numbers.
 */
export class FaceAuditQueryDto {
  @ApiPropertyOptional({
    enum: AuditEventType,
    description: 'Filter audit events by event type',
    example: AuditEventType.FACE_ENROLLMENT_CREATED,
  })
  @IsOptional()
  @IsEnum(AuditEventType)
  type?: AuditEventTypeType;

  @ApiPropertyOptional({
    description: 'Filter by resource type (e.g. enrollment, device)',
    example: 'enrollment',
    maxLength: MAX_ID_LENGTH,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_ID_LENGTH)
  resourceType?: string;

  @ApiPropertyOptional({
    description: 'Filter by resource UUID',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
    maxLength: MAX_ID_LENGTH,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_ID_LENGTH)
  resourceId?: string;

  @ApiPropertyOptional({
    description: 'Filter by user UUID',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
    maxLength: MAX_ID_LENGTH,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_ID_LENGTH)
  userId?: string;

  @ApiPropertyOptional({
    description: 'Search audit events',
    example: 'enrolled',
    maxLength: MAX_SEARCH_LENGTH,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  search?: string;

  @ApiPropertyOptional({
    description: 'Start of the audit date/time range',
    example: '2026-09-01T00:00:00Z',
    maxLength: MAX_DATE_LENGTH,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_DATE_LENGTH)
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'End of the audit date/time range',
    example: '2026-09-06T23:59:59Z',
    maxLength: MAX_DATE_LENGTH,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_DATE_LENGTH)
  dateTo?: string;

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
    description: 'Number of audit events per page',
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
