import { IsString, IsNotEmpty, IsArray, IsEnum, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { EmailCategory } from '@prisma/client';

export class CreateEmailTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  htmlBody: string;

  @IsString()
  @IsOptional()
  textBody?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variables?: string[];

  @IsEnum(EmailCategory)
  category: EmailCategory;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateEmailTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  htmlBody?: string;

  @IsString()
  @IsOptional()
  textBody?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variables?: string[];

  @IsEnum(EmailCategory)
  @IsOptional()
  category?: EmailCategory;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class SendEmailDto {
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  @IsOptional()
  variables?: Record<string, string>;
}
