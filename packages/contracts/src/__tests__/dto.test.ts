import { describe, it, expect } from 'vitest';
import {
  CreateEnrollmentSchema,
  EnrollmentQuerySchema,
  ReenrollStudentSchema,
  RevokeEnrollmentSchema,
} from '../enrollment.dto';
import { SubmitRecognitionAttemptSchema, CreateRecognitionSessionSchema } from '../recognition.dto';
import { RegisterDeviceSchema } from '../device.dto';
import { UpdateSettingsSchema } from '../settings.dto';

describe('Contracts request DTO validation (zod)', () => {
  it('validates CreateEnrollment', () => {
    const ok = CreateEnrollmentSchema.parse({
      studentId: '8f6f3f2e-0b1a-4a5b-9c8d-1234567890ab',
      organizationId: '8f6f3f2e-0b1a-4a5b-9c8d-1234567890ac',
    });
    expect(ok.studentId).toBeDefined();

    expect(
      () => CreateEnrollmentSchema.parse({ studentId: 'not-uuid', organizationId: 'x' }),
    ).toThrow();
  });

  it('EnrollmentQuery defaults pagination', () => {
    const parsed = EnrollmentQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.sortOrder).toBe('desc');
  });

  it('requires reason for reenroll/revoke', () => {
    expect(() => ReenrollStudentSchema.parse({ reason: '' })).toThrow();
    expect(() => RevokeEnrollmentSchema.parse({ reason: '' })).toThrow();
    expect(ReenrollStudentSchema.parse({ reason: 'ok' })).toBeDefined();
    expect(RevokeEnrollmentSchema.parse({ reason: 'ok' })).toBeDefined();
  });

  it('requires imageBase64 for recognition attempts', () => {
    expect(() => SubmitRecognitionAttemptSchema.parse({})).toThrow();
    expect(
      SubmitRecognitionAttemptSchema.parse({ imageBase64: 'AAAA' }),
    ).toBeDefined();
  });

  it('recognition session accepts optional group/lesson', () => {
    const parsed = CreateRecognitionSessionSchema.parse({ groupId: '8f6f3f2e-0b1a-4a5b-9c8d-1234567890ab' });
    expect(parsed.groupId).toBeDefined();
  });

  it('device registration requires name', () => {
    expect(() => RegisterDeviceSchema.parse({ name: '' })).toThrow();
    expect(RegisterDeviceSchema.parse({ name: 'CAM-1' })).toBeDefined();
  });

  it('settings bounds are enforced', () => {
    expect(() => UpdateSettingsSchema.parse({ minQualityScore: 1.5 })).toThrow();
    expect(() => UpdateSettingsSchema.parse({ maxCandidateCount: 0 })).toThrow();
    expect(UpdateSettingsSchema.parse({ duplicateWindowMinutes: 5 })).toBeDefined();
  });
});
