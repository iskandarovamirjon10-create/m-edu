/**
 * Google OAuth configuration helpers.
 *
 * Google OAuth is optional: when credentials are missing OR still look like
 * placeholders the API must NOT send users to Google with a bogus client_id
 * (Google answers 401 invalid_client on an unknown client). Instead the
 * initiation endpoint fails fast with a friendly message.
 */

export const GOOGLE_CLIENT_ID_PLACEHOLDER = 'PLACEHOLDER_CLIENT_ID';

/** Values that are clearly not real Google credentials. */
const PLACEHOLDER_PATTERNS = [
  'placeholder',
  'your-google',
  'your_google',
  'changeme',
  'change-me',
  'example',
  'redacted',
  'todo',
  'fixme',
];

function isPlaceholderValue(raw: string | undefined): boolean {
  const value = (raw || '').trim().toLowerCase();
  if (!value) return true;
  if (value === GOOGLE_CLIENT_ID_PLACEHOLDER.toLowerCase()) return true;
  return PLACEHOLDER_PATTERNS.some((p) => value.includes(p));
}

/**
 * True only when BOTH values look like real Google OAuth web-client
 * credentials (not empty, not template text, client id in Google's
 * `*.apps.googleusercontent.com` form).
 */
export function isGoogleOAuthConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const clientId = (env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) return false;
  if (isPlaceholderValue(clientId) || isPlaceholderValue(clientSecret)) {
    return false;
  }
  // Google web application client IDs always end with this suffix.
  if (!clientId.endsWith('.apps.googleusercontent.com')) return false;
  return true;
}
