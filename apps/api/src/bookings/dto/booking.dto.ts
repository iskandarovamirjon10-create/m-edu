import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Resource booking DTOs (SF-4).
 *
 * Previously `@Body() dto: any` — the service then constructed `new Date()`
 * from arbitrary input. `startAt`/`endAt` are now validated as ISO date
 * strings before the service ever sees them.
 */

export class CreateBookingDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  resourceId: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  title: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsOptional() @IsString() @MaxLength(50)
  status?: string;

  @IsOptional() @IsString() @MaxLength(100)
  bookedBy?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  attendees?: number;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}

export class BookingQueryDto {
  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  bookedBy?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}

