import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AiEntityContextDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  type!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id!: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  route?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiEntityContextDto)
  entity?: AiEntityContextDto;

  @IsOptional()
  @IsIn(['uz', 'ru', 'en'])
  locale?: 'uz' | 'ru' | 'en';
}
