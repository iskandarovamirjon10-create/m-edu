import { Type } from 'class-transformer';
import {
  Allow,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQuery } from '../../common/dto/query';

/**
 * Communication history DTOs (SF-4).
 *
 * `HistoryFilters` and `RecordCommunicationData` were interfaces in
 * communication-history.service.ts, so both `@Query() query: HistoryFilters`
 * and `@Body() data: RecordCommunicationData` bypassed validation.
 */

export class HistoryFiltersDto extends PaginationQuery {
  @IsOptional() @IsString() @MaxLength(100)
  entityType?: string;

  @IsOptional() @IsString() @MaxLength(100)
  entityId?: string;

  @IsOptional() @IsString() @MaxLength(50)
  channel?: string;

  @IsOptional() @IsString() @MaxLength(50)
  direction?: string;

  @IsOptional() @IsString() @MaxLength(50)
  status?: string;

  @IsOptional() @IsString()
  startDate?: string;

  @IsOptional() @IsString()
  endDate?: string;
}

export class RecordCommunicationDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  entityType: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  entityId: string;

  @IsString() @IsNotEmpty() @MaxLength(50)
  channel: string;

  @IsOptional() @IsString() @MaxLength(50)
  direction?: string;

  @IsOptional() @IsString() @MaxLength(500)
  subject?: string;

  @IsString() @IsNotEmpty() @MaxLength(10000)
  content: string;

  @IsOptional() @IsString() @MaxLength(50)
  status?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  failureReason?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  retryCount?: number;

  @IsOptional() @IsString() @MaxLength(100)
  relatedEntityId?: string;

  @IsOptional() @IsString() @MaxLength(100)
  relatedEntityType?: string;

  @IsOptional() @Allow()
  metadata?: Record<string, unknown>;
}
