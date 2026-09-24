import { describe, it, expect } from 'vitest';
import { errorMessage } from '../types';

describe('errorMessage helper', () => {
  it('extracts message from Error instance', () => {
    expect(errorMessage(new Error('something failed'))).toBe('something failed');
  });

  it('converts string primitives directly', () => {
    expect(errorMessage('plain string error')).toBe('plain string error');
  });

  it('converts non-error objects via String()', () => {
    expect(errorMessage(12345)).toBe('12345');
    expect(errorMessage({ code: 500 })).toBe('[object Object]');
  });
});
