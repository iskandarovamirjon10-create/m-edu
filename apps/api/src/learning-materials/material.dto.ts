import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaterialType, MaterialVisibility } from '@prisma/client';

export class CreateFolderDto {
  @ApiProperty({ example: 'Grammar Worksheets' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'f123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}

export class CreateMaterialDto {
  @ApiProperty({ example: 'Unit 1 Grammar Guide.pdf' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: MaterialType, example: MaterialType.PDF })
  @IsEnum(MaterialType)
  @IsNotEmpty()
  type!: MaterialType;

  @ApiProperty({ example: 'https://storage.medu.uz/materials/guide.pdf' })
  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  fileSize?: number;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @ApiPropertyOptional({ enum: MaterialVisibility, default: MaterialVisibility.ALL })
  @IsEnum(MaterialVisibility)
  @IsOptional()
  visibility?: MaterialVisibility;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  folderId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  topicId?: string;
}
