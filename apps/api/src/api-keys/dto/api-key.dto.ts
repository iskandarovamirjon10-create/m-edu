import { IsArray, IsDateString, IsInt, IsOptional, IsString, MaxLength, Min, ArrayMaxSize, ArrayMinSize, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export const API_KEY_SCOPES = [
  'students:read', 'students:write',
  'teachers:read', 'teachers:write',
  'groups:read', 'groups:write',
  'courses:read', 'courses:write',
  'attendance:read', 'attendance:write',
  'payments:read', 'payments:write',
  'expenses:read', 'expenses:write',
  'grades:read', 'grades:write',
  'homework:read', 'homework:write',
  'leads:read', 'leads:write',
  'reports:read',
  'analytics:read',
  'settings:read', 'settings:write',
  'users:read',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Production Read-Only Key', description: 'Name of the API key', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: ['students:read', 'courses:read'],
    description: 'List of scopes/permissions granted to this key',
    isArray: true,
    enum: API_KEY_SCOPES
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsIn(API_KEY_SCOPES, { each: true })
  scopes!: string[];

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z', description: 'Expiration date in ISO format' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 1000, description: 'Rate limit in requests per hour/minute depending on config', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimit?: number;
}

export class RotateApiKeyDto {
  @ApiPropertyOptional({ example: 'Production Read-Only Key', description: 'Name of the API key', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: ['students:read', 'courses:read'],
    description: 'List of scopes/permissions granted to this key',
    isArray: true,
    enum: API_KEY_SCOPES
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsIn(API_KEY_SCOPES, { each: true })
  scopes?: string[];

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z', description: 'Expiration date in ISO format' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 1000, description: 'Rate limit in requests per hour/minute depending on config', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimit?: number;
}
