import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min, Max,
  IsUrl,
} from 'class-validator';

/**
 * Document request DTOs (SF-4).
 *
 * Previously `@Body() body: any` — every field reached Prisma unvalidated.
 * These classes are enforced by the global ValidationPipe
 * (whitelist + forbidNonWhitelisted).
 */

export class CreateDocumentDto {
  @IsString() @IsNotEmpty() @MaxLength(300)
  title: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(100)
  category?: string;

  @IsUrl({ protocols: ['http', 'https'], require_tld: false }) @IsString() @IsNotEmpty() @MaxLength(2000)
  fileUrl: string;

  @IsOptional() @IsString() @MaxLength(200)
  mimeType?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(104857600)
  fileSize?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsString() @MaxLength(100)
  relatedEntityType?: string;

  @IsOptional() @IsString() @MaxLength(100)
  relatedEntityId?: string;
}

export class UpdateDocumentDto {
  @IsOptional() @IsString() @MaxLength(300)
  title?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(100)
  category?: string;

  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_tld: false }) @IsString() @MaxLength(2000)
  fileUrl?: string;

  @IsOptional() @IsString() @MaxLength(200)
  mimeType?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(104857600)
  fileSize?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsString() @MaxLength(100)
  relatedEntityType?: string;

  @IsOptional() @IsString() @MaxLength(100)
  relatedEntityId?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class DocumentQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  tags?: string | string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relatedEntityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relatedEntityId?: string;
}

export class UploadDocumentVersionDto {
  @IsUrl({ protocols: ['http', 'https'], require_tld: false }) @IsString() @IsNotEmpty() @MaxLength(2000)
  fileUrl: string;

  @IsOptional() @IsString() @MaxLength(200)
  mimeType?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(104857600)
  fileSize?: number;

  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

