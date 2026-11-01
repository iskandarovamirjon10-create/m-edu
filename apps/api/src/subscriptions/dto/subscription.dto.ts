import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PlanTierCode {
  START = 'START',
  STANDARD = 'STANDARD',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
}

export class ChangePlanDto {
  @ApiProperty({ enum: PlanTierCode, example: 'PRO' })
  @IsEnum(PlanTierCode)
  @IsNotEmpty()
  planCode!: PlanTierCode;

  @ApiPropertyOptional({ enum: BillingCycle, default: BillingCycle.MONTHLY })
  @IsEnum(BillingCycle)
  @IsOptional()
  billingCycle?: BillingCycle = BillingCycle.MONTHLY;
}

export class CreatePlanDto {
  @ApiProperty({ example: 'PRO' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: "Pro Ta'lim" })
  @IsString()
  @IsNotEmpty()
  nameUz!: string;

  @ApiProperty({ example: 'Про Таълим' })
  @IsString()
  @IsNotEmpty()
  nameRu!: string;

  @ApiProperty({ example: 1190000 })
  @IsNumber()
  @Min(0)
  priceUzsPerMonth!: number;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(1)
  maxStudents!: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(1)
  maxBranches!: number;

  @ApiProperty({ example: 40 })
  @IsNumber()
  @Min(1)
  maxEmployees!: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  maxCameras!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  hasFaceId?: boolean = false;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  hasAiCopilot?: boolean = true;
}
