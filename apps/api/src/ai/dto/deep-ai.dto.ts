import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class DraftParentMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  studentId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  studentName!: string;

  @IsOptional()
  @IsIn(['friendly', 'formal', 'urgent'])
  tone?: 'friendly' | 'formal' | 'urgent';

  @IsOptional()
  @IsIn(['attendance', 'debt', 'praise', 'exam', 'custom'])
  topic?: 'attendance' | 'debt' | 'praise' | 'exam' | 'custom';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  balanceDue?: number;
}

export class GenerateQuizDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  topic!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  level?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  questionCount?: number;
}
