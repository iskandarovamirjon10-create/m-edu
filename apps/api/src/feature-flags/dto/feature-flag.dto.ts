import { Type } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Feature flag request DTOs (SF-4).
 *
 * Previously `@Body() dto: any` on both create and update. Update now accepts
 * only the mutable runtime fields (`enabled`/`value`), preventing callers from
 * rewriting a flag's key or rollout list.
 */

export class CreateFeatureFlagDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  key: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(50)
  type?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @Allow()
  value?: unknown;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  rolloutPercentage?: number;
}

export class UpdateFeatureFlagDto {
  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @Allow()
  value?: unknown;

  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  rolloutPercentage?: number;
}
