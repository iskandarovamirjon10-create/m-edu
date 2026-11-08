import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  ArenaQuestionSource,
  ArenaQuestionStatus,
  ArenaSubjectCategory,
  QuestionDifficulty,
} from '@prisma/client';

export class ArenaQuestionOptionInputDto {
  @ApiProperty({ description: 'Option key: A, B, C, or D', example: 'A' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['A', 'B', 'C', 'D'])
  optionKey!: string;

  @ApiProperty({ description: 'Text of the option', example: 'x = 4' })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  optionText!: string;

  @ApiProperty({ description: 'True if this is the correct answer', example: true })
  @IsBoolean()
  isCorrect!: boolean;

  @ApiPropertyOptional({ description: 'Explanation specific to this option' })
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiPropertyOptional({ description: 'Display order (0-3)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  orderIndex?: number = 0;
}

export class GenerateAiQuestionsDto {
  @ApiProperty({
    description: 'Subject category',
    enum: ArenaSubjectCategory,
    example: ArenaSubjectCategory.MATHEMATICS,
  })
  @IsNotEmpty()
  @IsEnum(ArenaSubjectCategory)
  subjectCategory!: ArenaSubjectCategory;

  @ApiProperty({
    description: 'Difficulty level',
    enum: QuestionDifficulty,
    example: QuestionDifficulty.MEDIUM,
  })
  @IsNotEmpty()
  @IsEnum(QuestionDifficulty)
  difficulty!: QuestionDifficulty;

  @ApiProperty({
    description: 'Specific topic or concept for question generation',
    example: 'Kvadrat tenglamalar va Viyet teoremasi',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  topic!: string;

  @ApiPropertyOptional({
    description: 'Number of questions to generate (1-5)',
    default: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  count?: number = 3;

  @ApiPropertyOptional({
    description: 'Language of the question (uz, ru, en)',
    default: 'uz',
  })
  @IsOptional()
  @IsString()
  @IsIn(['uz', 'ru', 'en'])
  language?: string = 'uz';

  @ApiPropertyOptional({
    description: 'Target grade or audience (e.g. "8-sinf", "Oliy toifa")',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetGrade?: string;
}

export class CreateArenaQuestionDto {
  @ApiProperty({
    description: 'Subject category',
    enum: ArenaSubjectCategory,
  })
  @IsNotEmpty()
  @IsEnum(ArenaSubjectCategory)
  subjectCategory!: ArenaSubjectCategory;

  @ApiProperty({
    description: 'Difficulty level',
    enum: QuestionDifficulty,
    default: QuestionDifficulty.MEDIUM,
  })
  @IsNotEmpty()
  @IsEnum(QuestionDifficulty)
  difficulty!: QuestionDifficulty;

  @ApiProperty({
    description: 'Full question text',
    example: 'Agar 2x + 6 = 14 boʻlsa, x ning qiymatini toping.',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  questionText!: string;

  @ApiPropertyOptional({ description: 'Optional code snippet' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  codeSnippet?: string;

  @ApiPropertyOptional({ description: 'Programming language of the snippet' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  codeLanguage?: string;

  @ApiPropertyOptional({ description: 'Optional diagram or illustration URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: 'Comprehensive pedagogical explanation',
    example: '2x = 14 - 6 = 8, shuning uchun x = 8 / 2 = 4 boʻladi.',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  explanation!: string;

  @ApiPropertyOptional({
    description: 'Time limit for answering in seconds (5-60)',
    default: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  timeLimitSec?: number = 15;

  @ApiPropertyOptional({ description: 'Tags for categorization' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] = [];

  @ApiProperty({
    description: 'Exact 4 options (A, B, C, D)',
    type: [ArenaQuestionOptionInputDto],
  })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ArenaQuestionOptionInputDto)
  options!: ArenaQuestionOptionInputDto[];

  @ApiPropertyOptional({
    description: 'Create as global question (PLATFORM_OWNER/SUPER_ADMIN only)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean = false;
}

export class UpdateArenaQuestionDto {
  @ApiPropertyOptional({ description: 'Updated question text' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  questionText?: string;

  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ enum: ArenaSubjectCategory })
  @IsOptional()
  @IsEnum(ArenaSubjectCategory)
  subjectCategory?: ArenaSubjectCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codeSnippet?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codeLanguage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  timeLimitSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Updated 4 options',
    type: [ArenaQuestionOptionInputDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ArenaQuestionOptionInputDto)
  options?: ArenaQuestionOptionInputDto[];
}

export class RejectArenaQuestionDto {
  @ApiProperty({
    description: 'Reason for rejection',
    example: 'Matematik yechimda noaniqlik mavjud yoki xato variant kiritilgan.',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class QueryArenaQuestionsDto {
  @ApiPropertyOptional({ enum: ArenaSubjectCategory })
  @IsOptional()
  @IsEnum(ArenaSubjectCategory)
  subjectCategory?: ArenaSubjectCategory;

  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ enum: ArenaQuestionStatus })
  @IsOptional()
  @IsEnum(ArenaQuestionStatus)
  status?: ArenaQuestionStatus;

  @ApiPropertyOptional({ enum: ArenaQuestionSource })
  @IsOptional()
  @IsEnum(ArenaQuestionSource)
  source?: ArenaQuestionSource;

  @ApiPropertyOptional({
    description: 'Scope: "all" (tenant + global), "global", or "tenant"',
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'global', 'tenant'])
  scope?: 'all' | 'global' | 'tenant' = 'all';

  @ApiPropertyOptional({ description: 'Search in questionText or tags' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
