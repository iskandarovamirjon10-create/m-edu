import { describe, it, expect } from 'vitest';
import { isGoogleOAuthConfigured } from '../google-oauth-config';

describe('isGoogleOAuthConfigured', () => {
  it('is false when both credentials are missing', () => {
    expect(isGoogleOAuthConfigured({})).toBe(false);
  });

  it('is false when only one credential is set', () => {
    expect(isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: 'x.apps.googleusercontent.com' })).toBe(false);
    expect(isGoogleOAuthConfigured({ GOOGLE_CLIENT_SECRET: 'secret' })).toBe(false);
  });

  it('is false when the placeholder client id is in use (invalid_client guard)', () => {
    expect(
      isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: 'PLACEHOLDER_CLIENT_ID', GOOGLE_CLIENT_SECRET: 's' }),
    ).toBe(false);
  });

  it('is true when real client id + secret are configured', () => {
    expect(
      isGoogleOAuthConfigured({
        GOOGLE_CLIENT_ID: '1234567890-abc.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'GOCSPX-secret-value',
      }),
    ).toBe(true);
  });
});
