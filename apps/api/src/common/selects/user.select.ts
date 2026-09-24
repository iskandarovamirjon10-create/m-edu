import { Prisma } from '@prisma/client';

/**
 * Public projection of a `User` row.
 *
 * Any endpoint that embeds a user object in a response MUST use this select
 * (or a strictly narrower one). Returning `include: { user: true }` leaks
 * `passwordHash`, `googleSubject`, `telegramChatId`, `telegramLinkToken` and
 * other authentication material — see finding F-008.
 *
 * The fields here are exactly what the UI renders for an actor profile.
 */
export const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  role: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** Relation fragment for `include`/`select` blocks that embed one user. */
export const userPublicSelect = { select: USER_PUBLIC_SELECT } as const;

/**
 * Keys that must never be present in any API response body.
 * Used by the serialization regression suite.
 */
export const FORBIDDEN_RESPONSE_KEYS: readonly string[] = [
  'passwordHash',
  'password',
  'refreshToken',
  'refreshTokenHash',
  'tokenHash',
  'apiKeyHash',
  'apiKey',
  'secret',
  'secretHash',
  'totpSecret',
  'googleSubject',
  'telegramLinkToken',
  'telegramChatId',
  'privateKey',
];
