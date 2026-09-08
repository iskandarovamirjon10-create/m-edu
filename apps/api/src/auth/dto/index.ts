import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty() @IsEmail()
  email: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  password: string;
}

export class RegisterDto {
  @ApiProperty() @IsEmail()
  email: string;

  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128)
  password: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100)
  firstName: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200)
  organizationName: string;
}


export class BootstrapDto {
  @ApiProperty() @IsEmail()
  email: string;

  // Platform-admin bootstrap is the single highest-privilege account
  // creation path in the system — enforce a stronger password than the
  // self-service register flow (MinLength 12).
  @ApiProperty() @IsString() @MinLength(12) @MaxLength(128)
  password: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100)
  firstName: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200)
  organizationName: string;
}

export class ExchangeAuthCodeDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  code: string;
}

export class ForgotPasswordDto {
  @ApiProperty() @IsEmail() @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(128)
  token: string;

  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128)
  password: string;
}
