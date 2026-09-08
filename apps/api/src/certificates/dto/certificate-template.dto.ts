import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Certificate template CRUD DTOs.
 *
 * The template endpoints previously accepted `dto: any` and spread it
 * straight into Prisma `create`/`update`. With the global ValidationPipe in
 * whitelist mode only when a DTO is applied, `any` disabled validation
 * entirely — allowing a caller to persist arbitrary fields (e.g.
 * `organizationId`, `id`, `createdAt`) or oversized HTML payloads.
 *
 * These DTOs pin the writable surface to exactly the template columns:
 * name, htmlTemplate, cssStyles, isDefault. `organizationId` is always
 * taken from the authenticated user, never from the body.
 */
export class CreateCertificateTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  /**
   * Template HTML. Substituted values are HTML-escaped at render time
   * (see CertificatesService.renderTemplate), but the template size is
   * bounded here so a request cannot store unbounded payloads.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  htmlTemplate: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  cssStyles?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCertificateTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  htmlTemplate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  cssStyles?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
