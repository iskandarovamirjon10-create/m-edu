import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Accent keys the web client can render (kept narrow on purpose). */
export const STUDY_ACCENTS = [
  'indigo',
  'violet',
  'emerald',
  'amber',
  'rose',
  'sky',
] as const;
export type StudyAccent = (typeof STUDY_ACCENTS)[number];

/** SM-2 review grades exposed by the flashcard UI. */
export const STUDY_RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type StudyRating = (typeof STUDY_RATINGS)[number];

export class CreateStudyDeckDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @IsIn(STUDY_ACCENTS)
  accent?: StudyAccent;
}

export class UpdateStudyDeckDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @IsIn(STUDY_ACCENTS)
  accent?: StudyAccent;
}

export class CreateStudyCardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  front: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  back: string;
}

export class CreateStudyCardsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateStudyCardDto)
  cards: CreateStudyCardDto[];
}

export class UpdateStudyCardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  front?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  back?: string;
}

export class ReviewStudyCardDto {
  @IsIn(STUDY_RATINGS)
  rating: StudyRating;
}

export class CreateFocusSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  minutes: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  mode?: string;

  @IsOptional()
  @IsUUID()
  deckId?: string;
}
