import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EvaluateStudentDiscountsDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsNumber()
  @Min(0)
  tuitionAmount!: number;
}

export class ApplySiblingGroupDiscountsDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  discountPercentTier2?: number; // default 10%

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(70)
  discountPercentTier3?: number; // default 20%
}
