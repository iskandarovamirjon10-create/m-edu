import { Type } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Resource request DTOs (SF-4).
 *
 * Previously `@Body() dto: any` and `@Body() dto: any` on update, which let
 * callers write any Prisma column (including `organizationId`). The update
 * DTO now whitelists only the columns a client may change.
 */

export class CreateResourceDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @IsOptional() @IsString() @MaxLength(50)
  type?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  capacity?: number;

  @IsOptional() @IsString() @MaxLength(300)
  location?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @Allow()
  availability?: unknown;
}

export class UpdateResourceDto {
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(50)
  type?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  capacity?: number;

  @IsOptional() @IsString() @MaxLength(300)
  location?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @Allow()
  availability?: unknown;
}

export class ResourceQueryDto {
  @IsOptional() @IsString()
  isActive?: string;

  @IsOptional() @IsString() @MaxLength(50)
  type?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  skip?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  take?: number;
}

