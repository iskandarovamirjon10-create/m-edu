import { describe, it, expect, afterEach } from 'vitest';
import {
  BCRYPT_ROUNDS_DEFAULT,
  BCRYPT_ROUNDS_MAX,
  BCRYPT_ROUNDS_MIN,
  PASSWORD_RESET_GENERIC_MESSAGE,
  PASSWORD_RESET_TTL_MS,
  resolveBcryptRounds,
} from '../auth.config';

describe('resolveBcryptRounds', () => {
  afterEach(() => {
    delete process.env.BCRYPT_ROUNDS;
  });

  it('defaults to 12 when unset or empty', () => {
    delete process.env.BCRYPT_ROUNDS;
    expect(resolveBcryptRounds()).toBe(BCRYPT_ROUNDS_DEFAULT);
    expect(resolveBcryptRounds(undefined)).toBe(BCRYPT_ROUNDS_DEFAULT);
    expect(resolveBcryptRounds('')).toBe(BCRYPT_ROUNDS_DEFAULT);
    expect(resolveBcryptRounds('   ')).toBe(BCRYPT_ROUNDS_DEFAULT);
    expect(resolveBcryptRounds(null)).toBe(BCRYPT_ROUNDS_DEFAULT);
  });

  it('reads BCRYPT_ROUNDS from the environment', () => {
    process.env.BCRYPT_ROUNDS = '14';
    expect(resolveBcryptRounds()).toBe(14);
  });

  it.each([BCRYPT_ROUNDS_MIN, 12, BCRYPT_ROUNDS_MAX])('accepts %i', (rounds) => {
    expect(resolveBcryptRounds(String(rounds))).toBe(rounds);
  });

  it.each(['8', '9', '16', '20', '0', '-1', '12.5', 'abc', '1e3', 'NaN'])(
    'fails configuration validation for %s',
    (raw) => {
      expect(() => resolveBcryptRounds(raw)).toThrow(/BCRYPT_ROUNDS/);
    },
  );

  it('names the allowed range in the error message', () => {
    expect(() => resolveBcryptRounds('4')).toThrow('10');
    expect(() => resolveBcryptRounds('4')).toThrow('15');
  });
});

describe('password reset constants', () => {
  it('keeps reset tokens valid for one hour', () => {
    expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000);
  });

  it('exposes a single generic message (anti-enumeration)', () => {
    expect(PASSWORD_RESET_GENERIC_MESSAGE).toBe(
      'If an account with that email exists, a password reset link has been sent.',
    );
  });
});
