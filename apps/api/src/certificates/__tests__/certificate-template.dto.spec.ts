import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCertificateDto } from '../dto/certificate.dto';
import {
  CreateCertificateTemplateDto,
  UpdateCertificateTemplateDto,
} from '../dto/certificate-template.dto';

/**
 * Regression tests for the certificate-template mass-assignment fix.
 *
 * The template endpoints previously accepted `dto: any` and spread it into
 * Prisma create/update. These tests pin the new DTO contract: only the
 * whitelisted columns validate; unknown fields, wrong types and oversized
 * payloads must fail validation (the global ValidationPipe runs in
 * whitelist + forbidNonWhitelisted mode, so a validation failure becomes a
 * 400 before the service is ever reached).
 */
async function validateDto(dtoClass: new () => object, payload: unknown) {
  const dto = plainToInstance(dtoClass, payload as object);
  return validate(dto as object, { whitelist: true, forbidNonWhitelisted: true });
}

const VALID_CREATE = {
  name: 'Golden Achievement',
  htmlTemplate: '<html><body>{{studentName}}</body></html>',
};

describe('CreateCertificateTemplateDto (mass-assignment regression)', () => {
  it('accepts a valid template payload', async () => {
    const errors = await validateDto(CreateCertificateTemplateDto, {
      ...VALID_CREATE,
      cssStyles: 'body { color: #111 }',
      isDefault: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects injected organizationId (tenant column must come from the session, not the body)', async () => {
    const errors = await validateDto(CreateCertificateTemplateDto, {
      ...VALID_CREATE,
      organizationId: '00000000-0000-4000-8000-000000000000',
    });
    // forbidNonWhitelisted reports the non-DTO property as a
    // whitelistValidation constraint — the request must fail.
    const props = errors.flatMap((e) => Object.keys(e.constraints ?? {}));
    expect(errors.length).toBeGreaterThan(0);
    expect(props).toContain('whitelistValidation');
    expect(props).not.toContain('isString');
  });

  it('rejects injected id/createdAt/updatedAt', async () => {
    const errors = await validateDto(CreateCertificateTemplateDto, {
      ...VALID_CREATE,
      id: '00000000-0000-4000-8000-000000000001',
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects a non-string htmlTemplate (object injection)', async () => {
    const errors = await validateDto(CreateCertificateTemplateDto, {
      name: 'X',
      htmlTemplate: { evil: true },
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an oversized htmlTemplate (>100k chars)', async () => {
    const errors = await validateDto(CreateCertificateTemplateDto, {
      ...VALID_CREATE,
      htmlTemplate: 'a'.repeat(100_001),
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects empty name', async () => {
    const errors = await validateDto(CreateCertificateTemplateDto, {
      name: '',
      htmlTemplate: '<html></html>',
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateCertificateTemplateDto', () => {
  it('allows a partial update with only isDefault', async () => {
    const errors = await validateDto(UpdateCertificateTemplateDto, { isDefault: false });
    expect(errors).toHaveLength(0);
  });

  it('rejects unknown fields on update', async () => {
    const errors = await validateDto(UpdateCertificateTemplateDto, {
      isDefault: true,
      organizationId: '00000000-0000-4000-8000-000000000000',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('allows an empty partial payload (all fields optional)', async () => {
    // An empty object is valid for a partial DTO; the guard against "no-op
    // updates" lives at the service level. This assertion documents the
    // intended behavior so a future tightening is conscious.
    const errors = await validateDto(UpdateCertificateTemplateDto, {});
    expect(errors).toHaveLength(0);
  });
});

describe('CreateCertificateDto (existing contract stays intact)', () => {
  it('still rejects non-whitelisted fields', async () => {
    const errors = await validateDto(CreateCertificateDto, {
      studentId: '00000000-0000-4000-8000-000000000002',
      courseId: '00000000-0000-4000-8000-000000000003',
      evil: true,
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
