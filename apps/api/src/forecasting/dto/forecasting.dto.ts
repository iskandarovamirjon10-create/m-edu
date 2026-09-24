import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { ForecastMethod, ForecastMetric } from '../forecasting.service';

export class ForecastQueryDto {
  @ApiPropertyOptional({ enum: ['revenue', 'enrollments', 'attendance'] })
  @IsOptional()
  @IsIn(['revenue', 'enrollments', 'attendance'])
  metric?: ForecastMetric;

  @ApiPropertyOptional({ enum: ['MOVING_AVG', 'LINEAR', 'SEASONAL_NAIVE'] })
  @IsOptional()
  @IsIn(['MOVING_AVG', 'LINEAR', 'SEASONAL_NAIVE'])
  method?: ForecastMethod;
}
