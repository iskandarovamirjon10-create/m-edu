/**
 * Password hashing configuration.
 *
 * BCRYPT_ROUNDS is validated eagerly (at AuthService construction) so an
 * unusable value fails configuration loudly at boot instead of silently
 * producing a weak hash.
 *
 * Notes:
 *  - bcrypt stores its own cost inside each hash, so raising the value never
 *    invalidates existing hashes; they simply keep verifying at their own
 *    cost. Rehashing on login is a separate, deliberate migration.
 *  - The project uses `bcryptjs` (pure JS, no native binary). Each extra round
 *    is materially slower than with the native binding, which is why the range
 *    is capped rather than allowed to grow unbounded.
 */

import * as bcrypt from 'bcryptjs';

export const BCRYPT_ROUNDS_DEFAULT = 12;
export const BCRYPT_ROUNDS_MIN = 10;
export const BCRYPT_ROUNDS_MAX = 15;

/** Lifetime of a password-reset token. Delivered links die with it. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/**
 * The ONLY response text of `POST /auth/forgot-password`. Identical whether
 * the account exists or not — the response must not leak user existence.
 */
export const PASSWORD_RESET_GENERIC_MESSAGE =
  'If an account with that email exists, a password reset link has been sent.';

/**
 * Resolve and validate the configured bcrypt cost.
 *
 * @throws Error when the value is present but is not an integer inside
 *         [BCRYPT_ROUNDS_MIN, BCRYPT_ROUNDS_MAX].
 */
export function resolveBcryptRounds(
  raw: string | null | undefined = process.env.BCRYPT_ROUNDS,
): number {
  if (raw === null || raw === undefined || raw.trim() === '') {
    return BCRYPT_ROUNDS_DEFAULT;
  }

  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < BCRYPT_ROUNDS_MIN || value > BCRYPT_ROUNDS_MAX) {
    throw new Error(
      `Invalid BCRYPT_ROUNDS "${raw}": expected an integer between ` +
        `${BCRYPT_ROUNDS_MIN} and ${BCRYPT_ROUNDS_MAX}.`,
    );
  }
  return value;
}

/**
 * Hash a password with the configured (environment-tunable) bcrypt cost.
 *
 * Single source of truth for every password write-path in the codebase:
 * student/teacher/lead/user account creation used to hardcode rounds 10,
 * which silently bypassed BCRYPT_ROUNDS and produced weaker hashes than the
 * auth service policy.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, resolveBcryptRounds());
}
