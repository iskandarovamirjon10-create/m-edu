import { describe, it, expect, afterEach } from 'vitest';
import { escapeHtml, isPrismaUniqueError, normalizeEmail, resolveFrontendUrl } from '../auth.utils';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
    expect(normalizeEmail('a@b.c')).toBe('a@b.c');
  });

  it('is idempotent', () => {
    const once = normalizeEmail('  Mixed.Case@Example.com ');
    expect(normalizeEmail(once)).toBe(once);
  });

  it('matches what the DTO layer applies on input', () => {
    // Service-level and DTO-level normalization must never disagree, otherwise
    // the same address could produce two different identities.
    const raw = '  Student@School.uz ';
    expect(normalizeEmail(raw)).toBe(raw.toLowerCase().trim());
  });
});

describe('isPrismaUniqueError', () => {
  it('accepts a P2002 violation', () => {
    expect(isPrismaUniqueError({ code: 'P2002', meta: {} })).toBe(true);
    expect(isPrismaUniqueError(new Error('x'))).toBe(false);
    expect(isPrismaUniqueError(Object.assign(new Error('dup'), { code: 'P2002' }))).toBe(true);
  });

  it.each([null, undefined, 'P2002', 42, {}, { code: 'P2005' }, { code: null }])(
    'rejects %p',
    (value) => {
      expect(isPrismaUniqueError(value)).toBe(false);
    },
  );
});

describe('escapeHtml', () => {
  it('escapes every HTML metacharacter', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });

  it('leaves safe text untouched', () => {
    expect(escapeHtml('M-EDU')).toBe('M-EDU');
    expect(escapeHtml('')).toBe('');
  });

  it('is idempotent for plain text (no double-escaping of static content)', () => {
    const plain = 'Demo Education Center';
    expect(escapeHtml(escapeHtml(plain))).toBe(escapeHtml(plain));
  });
});

describe('resolveFrontendUrl', () => {
  afterEach(() => {
    delete process.env.FRONTEND_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('prefers the canonical FRONTEND_URL', () => {
    process.env.FRONTEND_URL = 'https://canonical.example';
    process.env.NEXT_PUBLIC_APP_URL = 'https://legacy.example';
    expect(resolveFrontendUrl()).toBe('https://canonical.example');
  });

  it('falls back to NEXT_PUBLIC_APP_URL only when FRONTEND_URL is unset', () => {
    delete process.env.FRONTEND_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://legacy.example';
    expect(resolveFrontendUrl()).toBe('https://legacy.example');
  });

  it('falls back to the default when neither is set', () => {
    expect(resolveFrontendUrl()).toBe('http://localhost:3000');
    expect(resolveFrontendUrl('https://explicit.example')).toBe('https://explicit.example');
  });
});
