import { Transform } from 'class-transformer';
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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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
  @IsString()
  @MaxLength(50)
  gradeLevel?: string;

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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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
  @IsString()
  @MaxLength(50)
  gradeLevel?: string;

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

export class SpeechToTextDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(15_000_000)
  audioBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^(audio\/(webm|mp3|mpeg|wav|ogg|m4a|mp4|aac|x-wav|vnd.wave)|video\/webm)$/, {
    message: 'Unsupported audio format',
  })
  mimeType?: string;

  @IsOptional()
  @IsIn(['uz', 'ru', 'en'])
  language?: 'uz' | 'ru' | 'en';
}

export class TextToSpeechDto {
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  text!: string;

  @IsOptional()
  @IsIn(['uz', 'ru', 'en'])
  language?: 'uz' | 'ru' | 'en';

  @IsOptional()
  @IsIn(['male', 'female'])
  voice?: 'male' | 'female';
}

export class DraftDebtRecoveryCampaignDto {
  @IsOptional()
  @IsIn(['ALL', 'MILD_1_7_DAYS', 'MODERATE_7_30_DAYS', 'SEVERE_30_PLUS_DAYS'])
  segment?: 'ALL' | 'MILD_1_7_DAYS' | 'MODERATE_7_30_DAYS' | 'SEVERE_30_PLUS_DAYS';

  @IsOptional()
  @IsIn(['friendly', 'official', 'urgent'])
  tone?: 'friendly' | 'official' | 'urgent';

  @IsOptional()
  @IsIn(['TELEGRAM', 'SMS', 'WHATSAPP'])
  channel?: 'TELEGRAM' | 'SMS' | 'WHATSAPP';
}

export class GenerateAssessmentRubricDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2)
  @MaxLength(150)
  topic!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  courseName?: string;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(100)
  maxScore?: number;
}

export class GenerateSocialPostDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2)
  @MaxLength(150)
  topic!: string;

  @IsOptional()
  @IsIn(['TELEGRAM', 'INSTAGRAM', 'FACEBOOK', 'SMS'])
  platform?: 'TELEGRAM' | 'INSTAGRAM' | 'FACEBOOK' | 'SMS';

  @IsOptional()
  @IsIn(['NEW_GROUP', 'DISCOUNT_OFFER', 'EVENT', 'EXAM_RESULTS', 'PARENT_NOTICE', 'GENERAL'])
  goal?: 'NEW_GROUP' | 'DISCOUNT_OFFER' | 'EVENT' | 'EXAM_RESULTS' | 'PARENT_NOTICE' | 'GENERAL';

  @IsOptional()
  @IsIn(['exciting', 'professional', 'urgent', 'friendly'])
  tone?: 'exciting' | 'professional' | 'urgent' | 'friendly';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetAudience?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  keyBenefits?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  priceOffer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  callToAction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  centerAddress?: string;
}

