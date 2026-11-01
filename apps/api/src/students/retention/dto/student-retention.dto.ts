import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export type ChurnRiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RetentionInterventionType =
  | 'ACADEMIC_TUTORING'
  | 'FINANCIAL_DISCOUNT'
  | 'DIRECTOR_CALL'
  | 'PARENT_MEETING'
  | 'SCHEDULE_CHANGE'
  | 'SPECIAL_RECOGNITION';

export class RetentionQueryDto {
  @IsOptional()
  @IsString()
  tier?: ChurnRiskTier;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

export class RecordInterventionDto {
  @IsString()
  @IsNotEmpty()
  type!: RetentionInterventionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  notes!: string;

  @IsOptional()
  @IsString()
  promisedOutcome?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  followUpDays?: number;
}
