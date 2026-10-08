import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsObject, Min } from 'class-validator';

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
