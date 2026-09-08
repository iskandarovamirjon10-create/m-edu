import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';

import {
  RecognitionAttemptStatus,
} from '@medu/contracts';

import type {
  RecognitionAttemptStatus as RecognitionAttemptStatusType,
} from '@medu/contracts';

import { MAX_IMAGE_BYTES } from '../image.util';

/**
 * Base64 expands binary data by approximately 4/3.
 *
 * This is only a transport-level upper bound.
 * The actual decoded byte size MUST still be verified
 * by the image processing layer before decoding/processing.
 */
const MAX_BASE64_LENGTH =
  Math.ceil((MAX_IMAGE_BYTES / 3) * 4) + 4;

const MAX_DATE_LENGTH = 64;

/**
 * Iterative Base64 validation — avoids regex stack overflow on large strings.
 */
function isValidBase64Payload(s: string): boolean {
  const len = s.length;
  if (len === 0 || len % 4 !== 0) return false;

  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);
    const isAlphaNum =
      (c >= 65 && c <= 90)
      || (c >= 97 && c <= 122)
      || (c >= 48 && c <= 57);
    const isSpecial = c === 43 || c === 47;
    const isPad = c === 61;

    if (isAlphaNum || isSpecial) continue;

    if (isPad) {
      if (i < len - 2) return false;
      continue;
    }

    return false;
  }

  return true;
}

/**
 * Custom validator that checks base64 format only when the string
 * is short enough for validation. Length validation is deferred
 * to the separate @MaxLength decorator.
 */
function IsBase64Payload(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBase64Payload',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') return true;
          if (value.length > MAX_BASE64_LENGTH) return true;
          return isValidBase64Payload(value);
        },
        defaultMessage(_args: ValidationArguments) {
          return 'imageBase64 must be valid base64 data';
        },
      },
    });
  };
}

const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

export class CreateSessionDto {
  @ApiPropertyOptional({
    description: 'Optional camera/device UUID associated with the recognition session',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'Optional student group UUID used as the recognition scope',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({
    description: 'Optional lesson UUID associated with the session',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  lessonId?: string;
}

export class SubmitAttemptDto {
  @ApiProperty({
    description:
      'Base64-encoded image used for face recognition. Maximum decoded size is enforced by the image processing layer.',
    maxLength: MAX_BASE64_LENGTH,
    example: '/9j/4AAQSkZJRgABAQAAAQ...',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BASE64_LENGTH, {
    message:
      `imageBase64 exceeds maximum allowed size ` +
      `(${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB decoded)`,
  })
  @IsBase64Payload({
    message: 'imageBase64 must be valid base64 data',
  })
  imageBase64!: string;
}

export class FinishSessionDto {
  @ApiPropertyOptional({
    enum: [
      'COMPLETED',
      'TIMEOUT',
      'CANCELLED',
      'ERROR',
    ],
    description: 'Reason for finishing the recognition session',
    example: 'COMPLETED',
  })
  @IsOptional()
  @IsEnum(
    {
      COMPLETED: 'COMPLETED',
      TIMEOUT: 'TIMEOUT',
      CANCELLED: 'CANCELLED',
      ERROR: 'ERROR',
    },
  )
  reason?: 'COMPLETED' | 'TIMEOUT' | 'CANCELLED' | 'ERROR';
}

export class RecognitionHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by recognition session UUID',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Filter by student UUID',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({
    enum: RecognitionAttemptStatus,
    description: 'Filter recognition attempts by status',
    example: RecognitionAttemptStatus.IDENTIFIED,
  })
  @IsOptional()
  @IsEnum(RecognitionAttemptStatus)
  status?: RecognitionAttemptStatusType;

  @ApiPropertyOptional({
    description: 'Start of the history date/time range',
    example: '2026-09-01T00:00:00Z',
    maxLength: MAX_DATE_LENGTH,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_DATE_LENGTH)
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'End of the history date/time range',
    example: '2026-09-06T23:59:59Z',
    maxLength: MAX_DATE_LENGTH,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_DATE_LENGTH)
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of recognition attempts per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}