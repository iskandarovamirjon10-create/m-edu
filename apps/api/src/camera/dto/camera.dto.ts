import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from 'class-validator';

/* ────────────────────────────────────────────────────────────────────── */
/* Constants                                                              */
/* ────────────────────────────────────────────────────────────────────── */

const MAX_NAME_LENGTH = 120;
const MAX_VENDOR_LENGTH = 100;
const MAX_MODEL_LENGTH = 100;
const MAX_LOCATION_LENGTH = 200;
const MAX_USERNAME_LENGTH = 255;
const MAX_PASSWORD_LENGTH = 1024;
const MAX_STREAM_PATH_LENGTH = 2048;

const FPS_MIN = 0.5;
const FPS_MAX = 30;

const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

/* ────────────────────────────────────────────────────────────────────── */
/* Enums                                                                  */
/* ────────────────────────────────────────────────────────────────────── */

export enum CameraProtocol {
  RTSP = 'RTSP',
  ONVIF = 'ONVIF',
}

export enum RtspTransport {
  TCP = 'tcp',
  UDP = 'udp',
}

/**
 * Keep this synchronized with the Prisma Camera.status enum.
 * If Prisma already exports/generated this enum, prefer reusing that
 * type rather than maintaining a second source of truth.
 */
export enum CameraStatus {
  CONFIGURED = 'CONFIGURED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
  DISABLED = 'DISABLED',
}

/* ────────────────────────────────────────────────────────────────────── */
/* Shared validation                                                      */
/* ────────────────────────────────────────────────────────────────────── */

function IsCameraHost() {
  return Matches(HOSTNAME_PATTERN, {
    message: 'host must be a valid hostname or IP address',
  });
}

/* ────────────────────────────────────────────────────────────────────── */
/* Create Camera                                                          */
/* ────────────────────────────────────────────────────────────────────── */

export class CreateCameraApiDto {
  @ApiProperty({
    example: 'Main Entrance Camera',
    maxLength: MAX_NAME_LENGTH,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_NAME_LENGTH)
  name!: string;

  @ApiPropertyOptional({
    example: 'Hikvision',
    maxLength: MAX_VENDOR_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_VENDOR_LENGTH)
  vendor?: string;

  @ApiPropertyOptional({
    example: 'DS-2CD2143G2',
    maxLength: MAX_MODEL_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MODEL_LENGTH)
  model?: string;

  @ApiPropertyOptional({
    enum: CameraProtocol,
    default: CameraProtocol.RTSP,
  })
  @IsOptional()
  @IsEnum(CameraProtocol)
  protocol?: CameraProtocol;

  @ApiProperty({
    example: '192.168.1.50',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  @IsCameraHost()
  host!: string;

  @ApiPropertyOptional({
    example: 554,
    minimum: 1,
    maximum: 65535,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({
    example: 'admin',
    maxLength: MAX_USERNAME_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_USERNAME_LENGTH)
  username?: string;

  @ApiPropertyOptional({
    description: 'Camera password. Never return this field in API responses.',
    writeOnly: true,
    maxLength: MAX_PASSWORD_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password?: string;

  @ApiPropertyOptional({
    example: '/Streaming/Channels/101',
    maxLength: MAX_STREAM_PATH_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_STREAM_PATH_LENGTH)
  streamPath?: string;

  @ApiPropertyOptional({
    enum: RtspTransport,
    default: RtspTransport.TCP,
  })
  @IsOptional()
  @IsEnum(RtspTransport)
  rtspTransport?: RtspTransport;

  @ApiPropertyOptional({
    example: 'Main entrance',
    maxLength: MAX_LOCATION_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCATION_LENGTH)
  location?: string;

  @ApiPropertyOptional({
    minimum: FPS_MIN,
    maximum: FPS_MAX,
    default: 3,
    example: 3,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(FPS_MIN)
  @Max(FPS_MAX)
  processingFps?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  recognitionEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  attendanceEnabled?: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Update Camera                                                          */
/* ────────────────────────────────────────────────────────────────────── */

export class UpdateCameraApiDto {
  @ApiPropertyOptional({
    example: 'Main Entrance Camera',
    maxLength: MAX_NAME_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional({
    example: 'Hikvision',
    maxLength: MAX_VENDOR_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_VENDOR_LENGTH)
  vendor?: string;

  @ApiPropertyOptional({
    example: 'DS-2CD2143G2',
    maxLength: MAX_MODEL_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MODEL_LENGTH)
  model?: string;

  @ApiPropertyOptional({ enum: CameraProtocol })
  @IsOptional()
  @IsEnum(CameraProtocol)
  protocol?: CameraProtocol;

  @ApiPropertyOptional({ example: '192.168.1.50' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  @IsCameraHost()
  host?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 65535,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({
    maxLength: MAX_USERNAME_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_USERNAME_LENGTH)
  username?: string;

  @ApiPropertyOptional({
    writeOnly: true,
    maxLength: MAX_PASSWORD_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password?: string;

  @ApiPropertyOptional({
    maxLength: MAX_STREAM_PATH_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_STREAM_PATH_LENGTH)
  streamPath?: string;

  @ApiPropertyOptional({ enum: RtspTransport })
  @IsOptional()
  @IsEnum(RtspTransport)
  rtspTransport?: RtspTransport;

  @ApiPropertyOptional({
    maxLength: MAX_LOCATION_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCATION_LENGTH)
  location?: string;

  @ApiPropertyOptional({
    minimum: FPS_MIN,
    maximum: FPS_MAX,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(FPS_MIN)
  @Max(FPS_MAX)
  processingFps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  recognitionEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  attendanceEnabled?: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Test Connection                                                        */
/* ────────────────────────────────────────────────────────────────────── */

export class TestCameraConnectionApiDto {
  @ApiProperty({ example: '192.168.1.50' })
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  @IsCameraHost()
  host!: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 65535,
    example: 554,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ enum: CameraProtocol })
  @IsOptional()
  @IsEnum(CameraProtocol)
  protocol?: CameraProtocol;

  @ApiPropertyOptional({ maxLength: MAX_USERNAME_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_USERNAME_LENGTH)
  username?: string;

  @ApiPropertyOptional({
    writeOnly: true,
    maxLength: MAX_PASSWORD_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password?: string;

  @ApiPropertyOptional({ maxLength: MAX_STREAM_PATH_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_STREAM_PATH_LENGTH)
  streamPath?: string;

  @ApiPropertyOptional({ enum: RtspTransport })
  @IsOptional()
  @IsEnum(RtspTransport)
  rtspTransport?: RtspTransport;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Discovery                                                              */
/* ────────────────────────────────────────────────────────────────────── */

export class DiscoverCamerasApiDto {
  @ApiPropertyOptional({
    minimum: 1000,
    maximum: 30000,
    default: 5000,
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(30000)
  timeoutMs?: number;

  @ApiPropertyOptional({
    description: 'Private/local subnet only. Public subnets must be rejected.',
    example: '192.168.1.0/24',
  })
  @IsOptional()
  @IsString()
  @MaxLength(43)
  subnet?: string;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Camera Query                                                           */
/* ────────────────────────────────────────────────────────────────────── */

export class CameraQueryApiDto {
  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: CameraStatus,
  })
  @IsOptional()
  @IsEnum(CameraStatus)
  status?: CameraStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    maxLength: MAX_LOCATION_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCATION_LENGTH)
  location?: string;

  @ApiPropertyOptional({
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Runtime Configuration                                                  */
/* ────────────────────────────────────────────────────────────────────── */

export class UpdateCameraConfigDto {
  @ApiPropertyOptional({
    minimum: FPS_MIN,
    maximum: FPS_MAX,
    example: 3,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(FPS_MIN)
  @Max(FPS_MAX)
  processingFps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  recognitionEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  attendanceEnabled?: boolean;
}