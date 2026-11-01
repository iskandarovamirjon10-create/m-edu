import {
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { DayOfWeek } from '@prisma/client';

export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export class ConflictAuditQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;
}

export class ResolveConflictDto {
  @IsString()
  @IsNotEmpty()
  scheduleId!: string;

  @IsOptional()
  @IsIn(['MORNING', 'AFTERNOON', 'EVENING'])
  preferredTimeOfDay?: 'MORNING' | 'AFTERNOON' | 'EVENING';

  @IsOptional()
  @IsArray()
  preferredDays?: DayOfWeek[];
}

export class AutoFixScheduleConflictDto {
  @IsString()
  @IsNotEmpty()
  scheduleId!: string;

  @IsString()
  @IsNotEmpty()
  targetRoom!: string;

  @IsEnum(DayOfWeek)
  targetDayOfWeek!: DayOfWeek;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'targetStartTime must be in HH:mm 24h format',
  })
  targetStartTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'targetEndTime must be in HH:mm 24h format',
  })
  targetEndTime!: string;
}
