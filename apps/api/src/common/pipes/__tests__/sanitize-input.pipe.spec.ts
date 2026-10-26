import { describe, it, expect } from 'vitest';
import { SanitizeInputPipe } from '../sanitize-input.pipe';

describe('SanitizeInputPipe (Enterprise Input Sanitization)', () => {
  const pipe = new SanitizeInputPipe();

  it('preserves primitive non-string values intact', () => {
    expect(pipe.transform(42, { type: 'body' })).toBe(42);
    expect(pipe.transform(true, { type: 'body' })).toBe(true);
    expect(pipe.transform(null, { type: 'body' })).toBeNull();
    expect(pipe.transform(undefined, { type: 'body' })).toBeUndefined();
  });

  it('trims leading and trailing whitespace on regular strings', () => {
    const input = '   hello world   ';
    expect(pipe.transform(input, { type: 'body' })).toBe('hello world');
  });

  it('strips dangerous null bytes and hidden control characters', () => {
    const malicious = 'evil\u0000payload\u200B\u202E';
    expect(pipe.transform(malicious, { type: 'body' })).toBe('evilpayload');
  });

  it('preserves intentional whitespace in password fields', () => {
    const passwordWithSpaces = '  secret p@ssword  ';
    const payload = {
      email: '  user@medu.uz  ',
      password: passwordWithSpaces,
      confirmPassword: passwordWithSpaces,
    };

    const sanitized = pipe.transform(payload, { type: 'body' }) as typeof payload;
    expect(sanitized.email).toBe('user@medu.uz');
    expect(sanitized.password).toBe(passwordWithSpaces);
    expect(sanitized.confirmPassword).toBe(passwordWithSpaces);
  });

  it('neutralizes prototype pollution keys', () => {
    const maliciousPayload = JSON.parse('{"name":"Test","__proto__":{"admin":true},"constructor":{"name":"evil"}}');
    const sanitized = pipe.transform(maliciousPayload, { type: 'body' }) as Record<string, unknown>;

    expect(sanitized.name).toBe('Test');
    expect(sanitized.__proto__).toBe(Object.prototype);
    expect(sanitized.constructor).toBe(Object);
  });

  it('recursively sanitizes nested objects and arrays', () => {
    const payload = {
      title: '  Course Title  ',
      tags: ['  math  ', '  science \u0000 '],
      metadata: {
        author: '  Dr. Smith  ',
      },
    };

    const sanitized = pipe.transform(payload, { type: 'body' }) as typeof payload;
    expect(sanitized.title).toBe('Course Title');
    expect(sanitized.tags).toEqual(['math', 'science']);
    expect(sanitized.metadata.author).toBe('Dr. Smith');
  });
});
