import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiError, userStore } from '@/lib/api';

describe('userStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('persists and clears the user', () => {
    const u = { id: '1', email: 'a@b.c', role: 'ORG_ADMIN' as const };
    userStore.set(u);
    expect(userStore.get()).toEqual(u);
    userStore.clear();
    expect(userStore.get()).toBeNull();
  });

  it('strips sensitive credential fields before saving to localStorage', () => {
    const sensitiveUser = {
      id: '1',
      email: 'a@b.c',
      role: 'ORG_ADMIN' as const,
      password: 'plain_password',
      passwordHash: '$2b$10$...',
      token: 'jwt_secret_token',
      accessToken: 'access_123',
      refreshToken: 'refresh_123',
      twoFactorSecret: 'TOTP_SECRET',
    };
    userStore.set(sensitiveUser);
    const stored = userStore.get<typeof sensitiveUser>();
    expect(stored).toEqual({ id: '1', email: 'a@b.c', role: 'ORG_ADMIN' });
    expect(stored).not.toHaveProperty('password');
    expect(stored).not.toHaveProperty('accessToken');
    expect(stored).not.toHaveProperty('twoFactorSecret');
  });

  it('returns null for corrupted user JSON', () => {
    localStorage.setItem('medu_user', '{broken');
    expect(userStore.get()).toBeNull();
  });
});

describe('ApiError', () => {
  it('carries status and details', () => {
    const err = new ApiError(403, 'Forbidden', { path: '/x' });
    expect(err.status).toBe(403);
    expect(err.message).toBe('Forbidden');
    expect(err.details).toEqual({ path: '/x' });
    expect(err).toBeInstanceOf(Error);
  });
});

describe('friendlyHttpMessage', () => {
  it('maps 429 rate limits to a friendly message regardless of server text', async () => {
    const { friendlyHttpMessage } = await import('@/lib/api');
    expect(friendlyHttpMessage(429, 'Rate limit exceeded for analytics-overview (max 30 per 60s per organization)')).toBe(
      'Too many requests — please wait a moment and try again.',
    );
    expect(friendlyHttpMessage(429, 'ThrottlerException: Too Many Requests')).toBe(
      'Too many requests — please wait a moment and try again.',
    );
  });

  it('preserves friendly server messages for 4xx errors', async () => {
    const { friendlyHttpMessage } = await import('@/lib/api');
    expect(friendlyHttpMessage(400, 'A payment with this reference already exists')).toBe(
      'A payment with this reference already exists',
    );
    expect(friendlyHttpMessage(404, 'Course not found')).toBe('Course not found');
  });

  it('strips technical ThrottlerException text and falls back to generic copy', async () => {
    const { friendlyHttpMessage } = await import('@/lib/api');
    expect(friendlyHttpMessage(403, 'ThrottlerException: Too Many Requests')).toBe(
      'You do not have permission to perform this action.',
    );
    expect(friendlyHttpMessage(500, null)).toBe('Request failed with status 500.');
  });
});
