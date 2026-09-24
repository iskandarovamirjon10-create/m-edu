import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateCertificateDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  courseId: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GenerateCertificateDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  courseId: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class VerifyCertificateDto {
  @IsString()
  verificationCode: string;
}