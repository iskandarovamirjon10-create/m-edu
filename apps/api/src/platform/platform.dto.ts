import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsObject,
  Min,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class CreatePlatformInvitationDto {
  @ApiProperty({ description: 'Maximum number of times this code can be used' })
  @IsInt()
  @Min(1)
  maxUses: number;

  @ApiProperty({ description: 'Expiration date in ISO format' })
  @IsDateString()
  expiresAt: string;

  @ApiPropertyOptional({ description: 'Optional metadata attached to this invite' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateOrganizationSubscriptionDto {
  @ApiPropertyOptional({ description: 'Target SaaS plan ID or tier name' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus, description: 'Subscription state override' })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'Trial expiration date override' })
  @IsOptional()
  @IsDateString()
  trialEndAt?: string;

  @ApiPropertyOptional({ description: 'Billing cycle expiration date override' })
  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string;

  @ApiPropertyOptional({ description: 'Custom monthly price in UZS' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceUzs?: number;

  @ApiPropertyOptional({ description: 'Student quota override' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @ApiPropertyOptional({ description: 'Branch quota override' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxBranches?: number;

  @ApiPropertyOptional({ description: 'Employee quota override' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxEmployees?: number;

  @ApiPropertyOptional({ description: 'Face ID biometric access toggle' })
  @IsOptional()
  @IsBoolean()
  hasFaceId?: boolean;

  @ApiPropertyOptional({ description: 'AI Copilot access toggle' })
  @IsOptional()
  @IsBoolean()
  hasAiCopilot?: boolean;
}

export class UpdateSaaSPlanDto {
  @ApiPropertyOptional({ description: 'Plan display name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Price in UZS' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceUzs?: number;

  @ApiPropertyOptional({ description: 'Max students allowed' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @ApiPropertyOptional({ description: 'Max branches allowed' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxBranches?: number;

  @ApiPropertyOptional({ description: 'Max employees allowed' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxEmployees?: number;

  @ApiPropertyOptional({ description: 'Include Face ID' })
  @IsOptional()
  @IsBoolean()
  hasFaceId?: boolean;

  @ApiPropertyOptional({ description: 'Include AI Copilot' })
  @IsOptional()
  @IsBoolean()
  hasAiCopilot?: boolean;

  @ApiPropertyOptional({ description: 'Whether plan is active for purchase' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
