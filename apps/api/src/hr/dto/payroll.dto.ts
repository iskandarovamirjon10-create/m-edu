import { IsDateString, IsOptional, IsArray, IsUUID, IsNumber, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GeneratePayrollDto {
  @IsDateString()
  month: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  employeeIds?: string[];

  @IsOptional()
  bonuses?: Record<string, number>;

  @IsOptional()
  deductions?: Record<string, number>;
}

export class PayrollDeductionDto {
  @IsUUID()
  employeeId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  reason: string;
}

export class PayrollBonusDto {
  @IsUUID()
  employeeId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  reason: string;
}

export class CreatePayrollRunDto {
  @IsUUID()
  teacherId: string;

  @IsNumber()
  @Min(2000)
  periodYear: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  periodMonth: number;

  @IsOptional() @IsString() salaryType?: string;
  @IsOptional() @IsNumber() @Min(0) baseAmount?: number;
  @IsOptional() @IsNumber() @Min(0) lessonsCount?: number;
  @IsOptional() @IsNumber() @Min(0) hoursWorked?: number;
  @IsOptional() @IsNumber() @Min(0) overtimeHours?: number;
  @IsOptional() @IsNumber() @Min(0) bonus?: number;
  @IsOptional() @IsNumber() @Min(0) absenceDays?: number;
  @IsOptional() @IsNumber() @Min(0) lateCount?: number;
  @IsOptional() @IsNumber() @Min(0) latePenaltyPerEvent?: number;
  @IsOptional() @IsNumber() @Min(0) otherDeduction?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10000) taxBasisPoints?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(31) workdaysInMonth?: number;
  @IsOptional() @IsNumber() @Min(0) overtimeMultiplier?: number;
}

export class AdjustPayrollRunDto {
  @IsOptional() @IsNumber() @Min(0) bonus?: number;
  @IsOptional() @IsNumber() @Min(0) otherDeduction?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10000) taxBasisPoints?: number;
}