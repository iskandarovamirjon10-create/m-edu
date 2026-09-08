import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../errorMessages';
import { ApiError } from '../api';

describe('getErrorMessage', () => {
  it('returns the friendly face message when an ApiError carries a domain code', () => {
    const err = new ApiError(409, 'raw technical enrollment message', { code: 'ENROLLMENT_ALREADY_EXISTS' });
    expect(getErrorMessage(err)).toContain('already has an active enrollment');
  });

  it('returns the sanitized ApiError message when no domain code is present', () => {
    const err = new ApiError(401, 'Invalid credentials');
    expect(getErrorMessage(err)).toBe('Invalid credentials');
  });

  it('passes through regular Error messages', () => {
    expect(getErrorMessage(new Error('Network request failed'))).toBe('Network request failed');
  });

  it('returns a generic fallback for unknown thrown values', () => {
    expect(getErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage(42)).toBe('Something went wrong. Please try again.');
  });

  it('falls back to the message when the domain code is unknown', () => {
    const err = new ApiError(500, 'Internal server error', { code: 'SOME_UNKNOWN_CODE' });
    expect(getErrorMessage(err)).toBe('Internal server error');
  });
});
