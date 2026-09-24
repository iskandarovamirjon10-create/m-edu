import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AcademicRiskQueryDto {
  @IsOptional()
  @IsIn(['HIGH', 'MEDIUM', 'LOW'])
  riskLevel?: 'HIGH' | 'MEDIUM' | 'LOW';

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
