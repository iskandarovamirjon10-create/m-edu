import { IsString, IsUUID, IsNumber, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEmployeeDto {
  @IsUUID()
  userId: string;

  @IsString()
  employeeNumber: string;

  @IsString()
  department: string;

  @IsString()
  position: string;

  @IsDateString()
  hireDate: string;

  @Type(() => Number)
  @IsNumber()
  salary: number;

  @IsEnum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'])
  contractType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  taxId?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salary?: number;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  taxId?: string;
}

export class CreateLeaveRequestDto {
  @IsUUID()
  employeeId: string;

  @IsEnum(['SICK', 'VACATION', 'PERSONAL', 'UNPAID'])
  type: 'SICK' | 'VACATION' | 'PERSONAL' | 'UNPAID';

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}