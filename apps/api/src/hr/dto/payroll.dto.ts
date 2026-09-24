import { IsDateString, IsOptional, IsArray, IsUUID, IsNumber, IsString } from 'class-validator';
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
  amount: number;

  @IsString()
  reason: string;
}

export class PayrollBonusDto {
  @IsUUID()
  employeeId: string;

  @Type(() => Number)
  @IsNumber()
  amount: number;

  @IsString()
  reason: string;
}

export class CreatePayrollRunDto {
  @IsUUID()
  teacherId: string;

  @IsNumber()
  periodYear: number;

  @IsNumber()
  periodMonth: number;

  @IsOptional() @IsString() salaryType?: string;
  @IsOptional() @IsNumber() baseAmount?: number;
  @IsOptional() @IsNumber() lessonsCount?: number;
  @IsOptional() @IsNumber() hoursWorked?: number;
  @IsOptional() @IsNumber() overtimeHours?: number;
  @IsOptional() @IsNumber() bonus?: number;
  @IsOptional() @IsNumber() absenceDays?: number;
  @IsOptional() @IsNumber() lateCount?: number;
  @IsOptional() @IsNumber() latePenaltyPerEvent?: number;
  @IsOptional() @IsNumber() otherDeduction?: number;
  @IsOptional() @IsNumber() taxBasisPoints?: number;
  @IsOptional() @IsNumber() workdaysInMonth?: number;
  @IsOptional() @IsNumber() overtimeMultiplier?: number;
}

export class AdjustPayrollRunDto {
  @IsOptional() @IsNumber() bonus?: number;
  @IsOptional() @IsNumber() otherDeduction?: number;
  @IsOptional() @IsNumber() taxBasisPoints?: number;
}