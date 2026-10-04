import { ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementAudience, AnnouncementStatus } from '@prisma/client';

export class SendMessageDto {
  @ApiProperty({ example: 's123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  studentId!: string;

  @ApiPropertyOptional({ example: 'p123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsOptional()
  receiverParentId?: string;

  @ApiPropertyOptional({ example: 'u123e456-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsOptional()
  receiverUserId?: string;

  @ApiProperty({ example: 'Hello, your child performed exceptionally well today!' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  attachments?: string[];
}

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Parent-Teacher Meeting next Monday' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'All parents are invited to attend the quarterly academic review.' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ enum: AnnouncementAudience, default: AnnouncementAudience.ALL })
  @IsEnum(AnnouncementAudience)
  @IsOptional()
  audience?: AnnouncementAudience;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  groupId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  courseId?: string;

  @ApiPropertyOptional({ enum: AnnouncementStatus, default: AnnouncementStatus.PUBLISHED })
  @IsEnum(AnnouncementStatus)
  @IsOptional()
  status?: AnnouncementStatus;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  publishAt?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expireAt?: string;
}
