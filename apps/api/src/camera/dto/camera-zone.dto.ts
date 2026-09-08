import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/* ────────────────────────────────────────────────────────────────────── */
/* Constants                                                              */
/* ────────────────────────────────────────────────────────────────────── */

export enum CameraZoneType {
  ENTRANCE = 'entrance',
  EXIT = 'exit',
  CLASSROOM = 'classroom',
  HALLWAY = 'hallway',
  RECEPTION = 'reception',
  CUSTOM = 'custom',
}

/**
 * Coordinates are intentionally bounded.
 *
 * The exact upper bound should match the coordinate system used by the
 * frontend/camera engine.  These values support normalized/HD-like layouts
 * without allowing absurd integers into the database.
 */
const MIN_COORDINATE = 0;
const MAX_COORDINATE = 100_000;

const MIN_ZONE_SIZE = 1;
const MAX_ZONE_SIZE = 100_000;

const MAX_ZONE_NAME_LENGTH = 100;

/* ────────────────────────────────────────────────────────────────────── */
/* Create                                                                 */
/* ────────────────────────────────────────────────────────────────────── */

export class CreateCameraZoneDto {
  @ApiPropertyOptional({
    description: 'Human-readable zone name.',
    example: 'Main Entrance',
    maxLength: MAX_ZONE_NAME_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ZONE_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional({
    enum: CameraZoneType,
    default: CameraZoneType.CUSTOM,
    example: CameraZoneType.ENTRANCE,
  })
  @IsOptional()
  @IsEnum(CameraZoneType)
  type?: CameraZoneType;

  @ApiPropertyOptional({
    description: 'Horizontal coordinate of the zone.',
    minimum: MIN_COORDINATE,
    maximum: MAX_COORDINATE,
    example: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_COORDINATE)
  @Max(MAX_COORDINATE)
  x?: number;

  @ApiPropertyOptional({
    description: 'Vertical coordinate of the zone.',
    minimum: MIN_COORDINATE,
    maximum: MAX_COORDINATE,
    example: 80,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_COORDINATE)
  @Max(MAX_COORDINATE)
  y?: number;

  @ApiPropertyOptional({
    description: 'Zone width in coordinate units.',
    minimum: MIN_ZONE_SIZE,
    maximum: MAX_ZONE_SIZE,
    example: 400,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_ZONE_SIZE)
  @Max(MAX_ZONE_SIZE)
  width?: number;

  @ApiPropertyOptional({
    description: 'Zone height in coordinate units.',
    minimum: MIN_ZONE_SIZE,
    maximum: MAX_ZONE_SIZE,
    example: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_ZONE_SIZE)
  @Max(MAX_ZONE_SIZE)
  height?: number;

  @ApiPropertyOptional({
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Update                                                                 */
/* ────────────────────────────────────────────────────────────────────── */

export class UpdateCameraZoneDto {
  @ApiPropertyOptional({
    description: 'Human-readable zone name.',
    example: 'Main Entrance',
    maxLength: MAX_ZONE_NAME_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ZONE_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional({
    enum: CameraZoneType,
    example: CameraZoneType.ENTRANCE,
  })
  @IsOptional()
  @IsEnum(CameraZoneType)
  type?: CameraZoneType;

  @ApiPropertyOptional({
    description: 'Horizontal coordinate of the zone.',
    minimum: MIN_COORDINATE,
    maximum: MAX_COORDINATE,
    example: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_COORDINATE)
  @Max(MAX_COORDINATE)
  x?: number;

  @ApiPropertyOptional({
    description: 'Vertical coordinate of the zone.',
    minimum: MIN_COORDINATE,
    maximum: MAX_COORDINATE,
    example: 80,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_COORDINATE)
  @Max(MAX_COORDINATE)
  y?: number;

  @ApiPropertyOptional({
    description: 'Zone width in coordinate units.',
    minimum: MIN_ZONE_SIZE,
    maximum: MAX_ZONE_SIZE,
    example: 400,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_ZONE_SIZE)
  @Max(MAX_ZONE_SIZE)
  width?: number;

  @ApiPropertyOptional({
    description: 'Zone height in coordinate units.',
    minimum: MIN_ZONE_SIZE,
    maximum: MAX_ZONE_SIZE,
    example: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_ZONE_SIZE)
  @Max(MAX_ZONE_SIZE)
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}