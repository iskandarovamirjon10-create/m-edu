import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Body for resolving an early-warning item (SF-4 — was an inline object type). */
export class ResolveEarlyWarningDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class EarlyWarningQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ruleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;
}

