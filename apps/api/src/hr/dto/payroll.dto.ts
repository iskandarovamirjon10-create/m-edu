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