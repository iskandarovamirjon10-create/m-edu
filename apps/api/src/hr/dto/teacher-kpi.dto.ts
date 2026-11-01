import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CalculateAllTeachersKpiDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  periodYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(80)
  commissionRatePercent?: number; // e.g. 35%

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(50)
  @Max(100)
  retentionTargetPercent?: number; // e.g. 85%

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  retentionBonusMultiplier?: number; // e.g. 0.10 (+10% of base)
}

export class TeacherProposalItemDto {
  @IsString()
  teacherId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grossAmount!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netAmount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bonus?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deduction?: number;
}

export class BatchApproveTeacherPayrollDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  periodYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherProposalItemDto)
  proposals!: TeacherProposalItemDto[];
}
