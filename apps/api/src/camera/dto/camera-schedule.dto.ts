import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/* ────────────────────────────────────────────────────────────────────── */
/* Constants                                                              */
/* ────────────────────────────────────────────────────────────────────── */

export enum CameraScheduleDay {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

const TIME_PATTERN =
  /^([01]\d|2[0-3]):[0-5]\d$/;

const MIN_PROCESSING_FPS = 0.5;
const MAX_PROCESSING_FPS = 30;

/* ────────────────────────────────────────────────────────────────────── */
/* Cross-field validation                                                 */
/* ────────────────────────────────────────────────────────────────────── */

@ValidatorConstraint({
  name: 'validScheduleTimeRange',
  async: false,
})
class ValidScheduleTimeRangeConstraint
  implements ValidatorConstraintInterface
{
  validate(
    _value: unknown,
    args: ValidationArguments,
  ): boolean {
    const object = args.object as {
      startTime?: string;
      endTime?: string;
    };

    if (
      !object.startTime ||
      !object.endTime
    ) {
      return true;
    }

    if (
      !TIME_PATTERN.test(object.startTime) ||
      !TIME_PATTERN.test(object.endTime)
    ) {
      return true;
    }

    return (
      this.toMinutes(object.endTime) >
      this.toMinutes(object.startTime)
    );
  }

  defaultMessage(): string {
    return 'endTime must be later than startTime';
  }

  private toMinutes(time: string): number {
    const [hours, minutes] =
      time.split(':').map(Number);

    return hours * 60 + minutes;
  }
}

/* ────────────────────────────────────────────────────────────────────── */
/* Create                                                                 */
/* ────────────────────────────────────────────────────────────────────── */

export class CreateCameraScheduleDto {
  @ApiPropertyOptional({
    description:
      'Human-readable schedule name.',
    example: 'Morning attendance',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    enum: CameraScheduleDay,
    example:
      CameraScheduleDay.MONDAY,
  })
  @IsEnum(CameraScheduleDay)
  dayOfWeek: CameraScheduleDay;

  @ApiProperty({
    description:
      'Schedule start time in 24-hour HH:MM format.',
    example: '08:00',
    pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
  })
  @IsString()
  @Matches(TIME_PATTERN, {
    message:
      'startTime must be in HH:MM format (24h)',
  })
  @Validate(
    ValidScheduleTimeRangeConstraint,
  )
  startTime: string;

  @ApiProperty({
    description:
      'Schedule end time in 24-hour HH:MM format.',
    example: '09:30',
    pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
  })
  @IsString()
  @Matches(TIME_PATTERN, {
    message:
      'endTime must be in HH:MM format (24h)',
  })
  endTime: string;

  @ApiPropertyOptional({
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    minimum: MIN_PROCESSING_FPS,
    maximum: MAX_PROCESSING_FPS,
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(MIN_PROCESSING_FPS)
  @Max(MAX_PROCESSING_FPS)
  processingFps?: number;

  @ApiPropertyOptional({
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  recognitionEnabled?: boolean;

  @ApiPropertyOptional({
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  attendanceEnabled?: boolean;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Update                                                                 */
/* ────────────────────────────────────────────────────────────────────── */

export class UpdateCameraScheduleDto {
  @ApiPropertyOptional({
    description:
      'Human-readable schedule name.',
    example: 'Morning attendance',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    enum: CameraScheduleDay,
    example:
      CameraScheduleDay.MONDAY,
  })
  @IsOptional()
  @IsEnum(CameraScheduleDay)
  dayOfWeek?: CameraScheduleDay;

  @ApiPropertyOptional({
    description:
      'Schedule start time in 24-hour HH:MM format.',
    example: '08:00',
  })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, {
    message:
      'startTime must be in HH:MM format (24h)',
  })
  @Validate(
    ValidScheduleTimeRangeConstraint,
  )
  startTime?: string;

  @ApiPropertyOptional({
    description:
      'Schedule end time in 24-hour HH:MM format.',
    example: '09:30',
  })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, {
    message:
      'endTime must be in HH:MM format (24h)',
  })
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    minimum: MIN_PROCESSING_FPS,
    maximum: MAX_PROCESSING_FPS,
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(MIN_PROCESSING_FPS)
  @Max(MAX_PROCESSING_FPS)
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