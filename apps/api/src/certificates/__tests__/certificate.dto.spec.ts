import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateCertificateDto,
  GenerateCertificateDto,
  VerifyCertificateDto,
} from '../dto/certificate.dto';

describe('Certificate DTOs Validation', () => {
  describe('CreateCertificateDto', () => {
    it('should validate valid payload', async () => {
      const dto = plainToInstance(CreateCertificateDto, {
        studentId: '11111111-1111-4111-8111-111111111111',
        courseId: '22222222-2222-4222-8222-222222222222',
        templateId: '33333333-3333-4333-8333-333333333333',
        notes: 'Passed with distinction',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow optional fields to be omitted', async () => {
      const dto = plainToInstance(CreateCertificateDto, {
        studentId: '11111111-1111-4111-8111-111111111111',
        courseId: '22222222-2222-4222-8222-222222222222',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when studentId or courseId is not a UUID', async () => {
      const dto = plainToInstance(CreateCertificateDto, {
        studentId: 'not-a-uuid',
        courseId: 'invalid-course',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThanOrEqual(2);
      const props = errors.map((e) => e.property);
      expect(props).toContain('studentId');
      expect(props).toContain('courseId');
    });

    it('should fail when templateId is provided but not a UUID', async () => {
      const dto = plainToInstance(CreateCertificateDto, {
        studentId: '11111111-1111-4111-8111-111111111111',
        courseId: '22222222-2222-4222-8222-222222222222',
        templateId: 'non-uuid-template',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('templateId');
    });
  });

  describe('GenerateCertificateDto', () => {
    it('should validate valid payload', async () => {
      const dto = plainToInstance(GenerateCertificateDto, {
        studentId: '11111111-1111-4111-8111-111111111111',
        courseId: '22222222-2222-4222-8222-222222222222',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when missing required UUIDs', async () => {
      const dto = plainToInstance(GenerateCertificateDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(2);
    });
  });

  describe('VerifyCertificateDto', () => {
    it('should validate valid verificationCode', async () => {
      const dto = plainToInstance(VerifyCertificateDto, {
        verificationCode: 'CERT-1234-ABCD',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when verificationCode is missing or not a string', async () => {
      const dto = plainToInstance(VerifyCertificateDto, {
        verificationCode: 12345,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('verificationCode');
    });
  });
});
