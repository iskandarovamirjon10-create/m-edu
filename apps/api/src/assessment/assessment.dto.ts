import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionDifficulty, QuestionType } from '@prisma/client';

export class CreateQuestionOptionDto {
  @ApiProperty({ example: 'Has been' })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isCorrect!: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @IsOptional()
  order?: number;
}

export class CreateQuestionDto {
  @ApiPropertyOptional({ example: 's123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  topicId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  objectiveId?: string;

  @ApiProperty({ enum: QuestionType, example: QuestionType.SINGLE_CHOICE })
  @IsEnum(QuestionType)
  @IsNotEmpty()
  type!: QuestionType;

  @ApiPropertyOptional({ enum: QuestionDifficulty, default: QuestionDifficulty.MEDIUM })
  @IsEnum(QuestionDifficulty)
  @IsOptional()
  difficulty?: QuestionDifficulty;

  @ApiProperty({ example: 'Which tense is used for an action completed in the immediate past?' })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiPropertyOptional({ example: 'Present Perfect is used with just, already etc.' })
  @IsString()
  @IsOptional()
  explanation?: string;

  @ApiPropertyOptional({ default: 1.0 })
  @IsNumber()
  @Min(0.5)
  @IsOptional()
  points?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ type: [CreateQuestionOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  @IsOptional()
  options?: CreateQuestionOptionDto[];
}

export class CreateQuizDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  groupId?: string;

  @ApiProperty({ example: 'Midterm Grammar Test' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: 30 })
  @IsInt()
  @Min(5)
  @IsOptional()
  durationMinutes?: number;

  @ApiPropertyOptional({ default: 60.0 })
  @IsNumber()
  @IsOptional()
  passingScore?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxAttempts?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  randomizeQuestions?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  randomizeAnswers?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['q123e456-e89b-12d3-a456-426614174000'] })
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMaxSize(200)
  @IsOptional()
  questionIds?: string[];
}

export class SubmitAnswerItemDto {
  @ApiProperty({ example: 'q123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  questionId!: string;

  @ApiPropertyOptional({ type: [String], example: ['opt-1'] })
  @IsArray()
  @IsOptional()
  selectedOptionIds?: string[];

  @ApiPropertyOptional({ example: 'My written answer' })
  @IsString()
  @IsOptional()
  textAnswer?: string;
}

export class SubmitQuizAttemptDto {
  @ApiProperty({ type: [SubmitAnswerItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerItemDto)
  answers!: SubmitAnswerItemDto[];
}
