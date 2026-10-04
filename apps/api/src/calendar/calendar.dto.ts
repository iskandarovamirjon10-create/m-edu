import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarEventType } from '@prisma/client';

export class CreateCalendarEventDto {
  @ApiProperty({ example: 'Final Term Mathematics Examination' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: CalendarEventType, example: CalendarEventType.EXAM })
  @IsEnum(CalendarEventType)
  @IsNotEmpty()
  type!: CalendarEventType;

  @ApiProperty({ example: '2026-10-20T09:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({ example: '2026-10-20T12:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isAllDay?: boolean;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  groupId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  teacherId?: string;

  @ApiPropertyOptional({ example: 'Auditorium A' })
  @IsString()
  @IsOptional()
  room?: string;
}
