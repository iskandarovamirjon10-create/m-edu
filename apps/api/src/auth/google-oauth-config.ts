/**
 * Google OAuth configuration helpers.
 *
 * Google OAuth is optional: when credentials are missing the API must NOT
 * send users to Google with a bogus client_id (Google answers 401
 * invalid_client on an unknown client). Instead the initiation endpoint
 * fails fast with a friendly message.
 */

export const GOOGLE_CLIENT_ID_PLACEHOLDER = 'PLACEHOLDER_CLIENT_ID';

export function isGoogleOAuthConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const clientId = env.GOOGLE_CLIENT_ID || '';
  const clientSecret = env.GOOGLE_CLIENT_SECRET || '';
  return (
    clientId.length > 0 &&
    clientSecret.length > 0 &&
    clientId !== GOOGLE_CLIENT_ID_PLACEHOLDER
  );
}
