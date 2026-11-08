import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeEmail } from '../auth.utils';
import { normalizeUsername } from '../username.utils';

export class LoginDto {
  @ApiProperty({ description: 'Globally unique case-insensitive username' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ obj, value }) => {
    const raw = typeof value === 'string' && value.trim() ? value : obj?.email || obj?.username;
    return typeof raw === 'string' ? normalizeUsername(raw) : '';
  })
  username: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ParentLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Transform(({ obj, value }) => {
    const raw = typeof value === 'string' && value.trim() ? value : obj?.email || obj?.username;
    return typeof raw === 'string' ? normalizeUsername(raw) : '';
  })
  username: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ description: 'Optional center / organization ID for parents enrolled across multiple centers' })
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class RegisterDto {
  @ApiPropertyOptional({ description: 'Platform invitation code (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  inviteCode?: string;

  @ApiProperty()
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  organizationName: string;
}

export class BootstrapDto {
  @ApiPropertyOptional({ description: 'Platform Owner username' })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeUsername(value) : value))
  username?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  inviteCode?: string;

  @ApiProperty()
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  organizationName: string;
}

export class ExchangeAuthCodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Transform(({ obj, value }) => {
    const raw = typeof value === 'string' && value.trim() ? value : obj?.email || obj?.username;
    return typeof raw === 'string' ? normalizeUsername(raw) : '';
  })
  @MaxLength(254)
  username: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class ForceChangePasswordDto {
  @ApiProperty({ description: 'Current temporary or admin-generated password' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: 'New permanent password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

export * from './access-request.dto';
export * from './accept-invitation.dto';
export * from './access-whitelist.dto';
