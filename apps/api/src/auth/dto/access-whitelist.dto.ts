import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeEmail } from '../auth.utils';
import { Role } from '@prisma/client';

export class AddToWhitelistDto {
  @ApiProperty({ description: 'Email to whitelist' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  email: string;

  @ApiPropertyOptional({ description: 'Optional administrative note' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @ApiPropertyOptional({ enum: Role, description: 'Default assigned role when registered' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class UpdateAccessControlSettingsDto {
  @ApiPropertyOptional({ description: 'Whether registration is invite-only' })
  @IsOptional()
  @IsBoolean()
  inviteOnly?: boolean;

  @ApiPropertyOptional({ description: 'Whether unregistered users require admin approval' })
  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;
}
