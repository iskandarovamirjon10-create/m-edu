import { describe, expect, it } from 'vitest';
import { ApiError } from '../api';
import { friendlyFaceError } from '../faceErrors';

describe('friendlyFaceError', () => {
  it('maps a known face error code to a friendly message', () => {
    const err = new ApiError(422, 'Face quality 0.123 is below threshold 0.3', {
      statusCode: 422,
      code: 'FACE_QUALITY_TOO_LOW',
      message: 'Face quality 0.123 is below threshold 0.3',
    });
    expect(friendlyFaceError(err, 'en')).toContain('quality');
    expect(friendlyFaceError(err, 'en')).toContain('lighting');
    expect(friendlyFaceError(err, 'en')).not.toContain('0.123');
  });

  it('maps liveness failure to an anti-spoofing friendly message', () => {
    const err = new ApiError(422, 'Liveness check failed', {
      statusCode: 422,
      code: 'LIVENESS_FAILED',
      message: 'Liveness check failed',
    });
    expect(friendlyFaceError(err, 'en')).toContain('photo or screen replay');
  });

  it('maps enrollment-already-exists to an actionable message', () => {
    const err = new ApiError(409, 'enrollment exists', {
      statusCode: 409,
      code: 'ENROLLMENT_ALREADY_EXISTS',
      message: 'enrollment exists',
    });
    expect(friendlyFaceError(err, 'en')).toContain('Revoke it');
  });

  it('maps STUDENT_NOT_ENROLLED_IN_GROUP with student and group names', () => {
    const err = new ApiError(400, 'Student is not enrolled', {
      statusCode: 400,
      code: 'STUDENT_NOT_ENROLLED_IN_GROUP',
      studentName: 'Ali Valiyev',
      groupName: 'IELTS-1',
    });
    expect(friendlyFaceError(err, 'uz')).toContain('Ali Valiyev');
    expect(friendlyFaceError(err, 'uz')).toContain('IELTS-1');
    expect(friendlyFaceError(err, 'uz')).toContain('biriktiring');

    expect(friendlyFaceError(err, 'ru')).toContain('не зачислен');
    expect(friendlyFaceError(err, 'en')).toContain('enrolled');
  });

  it('sanitizes raw UUID enrollment error messages without code', () => {
    const err = new ApiError(
      400,
      'Student 4542f7a2-d700-4c17-a3fe-52128baa876f is not enrolled in group 27c1d6ef-4390-44b5-b0fb-9524931e1343',
    );
    const msgUz = friendlyFaceError(err, 'uz');
    expect(msgUz).toContain('biriktirilmagan');
    expect(msgUz).not.toContain('4542f7a2');
    expect(msgUz).not.toContain('27c1d6ef');

    const msgRu = friendlyFaceError(err, 'ru');
    expect(msgRu).toContain('не зачислен');

    const msgEn = friendlyFaceError(err, 'en');
    expect(msgEn).toContain('enrolled');
  });

  it('falls back to the raw message for unknown codes', () => {
    const err = new ApiError(500, 'something exploded', { code: 'UNKNOWN_CODE' });
    expect(friendlyFaceError(err)).toBe('something exploded');
  });

  it('falls back to the raw message when details carry no code', () => {
    const err = new ApiError(400, 'bad request');
    expect(friendlyFaceError(err)).toBe('bad request');
  });

  it('handles non-Error values gracefully', () => {
    expect(friendlyFaceError('boom')).toBe('boom');
    expect(friendlyFaceError(null)).toBe('null');
  });
});
