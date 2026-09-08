import { describe, it, expect } from 'vitest';
import {
  EnrollmentNotFoundError,
  FaceNotDetectedError,
  LivenessFailedError,
  BiometricAccessDeniedError,
  TenantMismatchError,
  DeviceRevokedError,
} from '../domain/errors';

describe('Domain Errors', () => {
  it('EnrollmentNotFoundError has correct code and status', () => {
    const err = new EnrollmentNotFoundError('test-id');
    expect(err.code).toBe('ENROLLMENT_NOT_FOUND');
    expect(err.httpStatus).toBe(404);
    expect(err.message).toContain('test-id');
  });

  it('FaceNotDetectedError has correct code', () => {
    const err = new FaceNotDetectedError();
    expect(err.code).toBe('FACE_NOT_DETECTED');
    expect(err.httpStatus).toBe(422);
  });

  it('LivenessFailedError includes result', () => {
    const err = new LivenessFailedError('FAIL');
    expect(err.code).toBe('LIVENESS_FAILED');
    expect(err.message).toContain('FAIL');
  });

  it('BiometricAccessDeniedError has 403 status', () => {
    const err = new BiometricAccessDeniedError('student', '123');
    expect(err.httpStatus).toBe(403);
  });

  it('TenantMismatchError has 403 status', () => {
    const err = new TenantMismatchError();
    expect(err.httpStatus).toBe(403);
  });

  it('toClientError returns safe object', () => {
    const err = new DeviceRevokedError('device-1');
    const client = err.toClientError();
    expect(client.code).toBe('DEVICE_REVOKED');
    expect(client.message).toBeDefined();
    // Should not contain internal details
  });

  it('errors are instances of Error', () => {
    const err = new FaceNotDetectedError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FaceNotDetectedError);
  });
});
