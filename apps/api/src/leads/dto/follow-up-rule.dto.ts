import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Follow-up automation rule DTOs (SF-4).
 *
 * Previously inline object literals in `@Body()` — TypeScript types with no
 * runtime constructor, so the global ValidationPipe skipped them.
 */

export class CreateFollowUpRuleDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @IsString() @IsNotEmpty() @MaxLength(50)
  triggerType: string;

  @Type(() => Number) @IsInt() @Min(0)
  triggerDays: number;

  @IsOptional() @IsString() @MaxLength(50)
  targetStage?: string;

  @IsString() @IsNotEmpty() @MaxLength(50)
  actionType: string;

  @IsOptional() @IsString() @MaxLength(50)
  channel?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  message?: string;
}

export class UpdateFollowUpRuleDto {
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(50)
  triggerType?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  triggerDays?: number;

  @IsOptional() @IsString() @MaxLength(50)
  targetStage?: string;

  @IsOptional() @IsString() @MaxLength(50)
  actionType?: string;

  @IsOptional() @IsString() @MaxLength(50)
  channel?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  message?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
