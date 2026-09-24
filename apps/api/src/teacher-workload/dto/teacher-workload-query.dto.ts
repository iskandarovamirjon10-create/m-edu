import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TeacherWorkloadQueryDto {
  @ApiPropertyOptional({ enum: ['UNDERUTILIZED', 'BALANCED', 'OVERLOADED'] })
  @IsOptional()
  @IsIn(['UNDERUTILIZED', 'BALANCED', 'OVERLOADED'])
  status?: 'UNDERUTILIZED' | 'BALANCED' | 'OVERLOADED';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
