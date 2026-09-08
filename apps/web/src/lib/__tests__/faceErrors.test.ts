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
    expect(friendlyFaceError(err)).toContain('quality');
    expect(friendlyFaceError(err)).toContain('lighting');
    expect(friendlyFaceError(err)).not.toContain('0.123');
  });

  it('maps liveness failure to an anti-spoofing friendly message', () => {
    const err = new ApiError(422, 'Liveness check failed', {
      statusCode: 422,
      code: 'LIVENESS_FAILED',
      message: 'Liveness check failed',
    });
    expect(friendlyFaceError(err)).toContain('photo or screen replay');
  });

  it('maps enrollment-already-exists to an actionable message', () => {
    const err = new ApiError(409, 'enrollment exists', {
      statusCode: 409,
      code: 'ENROLLMENT_ALREADY_EXISTS',
      message: 'enrollment exists',
    });
    expect(friendlyFaceError(err)).toContain('Revoke it');
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
