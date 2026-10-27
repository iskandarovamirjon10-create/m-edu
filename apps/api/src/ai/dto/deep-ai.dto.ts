import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

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
  @Max(20)
  questionCount?: number;

  @IsOptional()
  @IsIn(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'])
  bloomsTaxonomyLevel?: string;

  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: string;
}

export class GenerateLessonPlanDto {
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
  @Min(15)
  @Max(180)
  durationMinutes?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  learningObjectives?: string[];

  @IsOptional()
  @IsIn(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'])
  bloomsTaxonomyLevel?: string;
}

export class GenerateReportDto {
  @IsString()
  @IsIn([
    'ATTENDANCE_WEEKLY',
    'ENROLLMENT_TRENDS',
    'TEACHER_WORKLOAD',
    'FINANCIAL_SUMMARY',
    'CUSTOM',
  ])
  reportType!:
    | 'ATTENDANCE_WEEKLY'
    | 'ENROLLMENT_TRENDS'
    | 'TEACHER_WORKLOAD'
    | 'FINANCIAL_SUMMARY'
    | 'CUSTOM';

  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'all'])
  timeRange?: '7d' | '30d' | '90d' | 'all';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  query?: string;
}

export class AnalyzeDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(12_000_000) // ~9 MB limit
  base64!: string;

  @IsString()
  @Matches(/^(application\/pdf|image\/(jpeg|png|webp)|text\/plain)$/, {
    message: 'Fayl formati PDF, rasm (JPEG/PNG/WEBP) yoki matn (TXT) bo\'lishi shart',
  })
  mimeType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instruction?: string;

  @IsOptional()
  @IsIn(['curriculum', 'policy', 'quiz_extraction', 'summary'])
  analysisType?: 'curriculum' | 'policy' | 'quiz_extraction' | 'summary';
}
