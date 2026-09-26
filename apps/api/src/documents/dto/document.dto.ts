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
  IsIn,
} from 'class-validator';

/**
 * Document request DTOs (SF-4).
 *
 * Enforced by the global ValidationPipe (whitelist + forbidNonWhitelisted).
 */

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export class GetUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_DOCUMENT_MIME_TYPES, {
    message: `mimeType must be one of allowed document types`,
  })
  mimeType: string;
}

export class CreateDocumentDto {
  @IsString() @IsNotEmpty() @MaxLength(300)
  title: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(100)
  category?: string;

  @IsString() @IsNotEmpty() @MaxLength(2000)
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

  @IsOptional() @IsString() @MaxLength(2000)
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
  @IsString() @IsNotEmpty() @MaxLength(2000)
  fileUrl: string;

  @IsOptional() @IsString() @MaxLength(200)
  mimeType?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(104857600)
  fileSize?: number;

  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}
