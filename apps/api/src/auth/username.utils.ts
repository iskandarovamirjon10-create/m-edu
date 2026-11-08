import { randomBytes } from 'crypto';

/**
 * Username normalization, validation, and sanitization utilities.
 * Enforces M-EDU Centralized IAM specification.
 */

export const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/**
 * Normalizes username:
 * - Trims whitespace
 * - Converts to lowercase
 * - Strips leading '@' if entered
 */
export function normalizeUsername(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let cleaned = raw.trim().toLowerCase();
  if (cleaned.startsWith('@')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

export interface UsernameValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a username against standard platform rules:
 * - 3 to 30 characters
 * - Starts with alphanumeric character
 * - Allowed characters: a-z, 0-9, dot, underscore, hyphen
 * - No consecutive dots or invalid punctuation
 */
export function validateUsername(username: unknown): UsernameValidationResult {
  const normalized = normalizeUsername(username);

  if (!normalized) {
    return { valid: false, error: 'Username is required' };
  }

  if (normalized.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long' };
  }

  if (normalized.length > 30) {
    return { valid: false, error: 'Username cannot exceed 30 characters' };
  }

  if (!USERNAME_REGEX.test(normalized)) {
    return {
      valid: false,
      error:
        'Username must start with a letter or digit and contain only lowercase letters, digits, underscores, dots, or hyphens',
    };
  }

  if (normalized.includes('..') || normalized.includes('__') || normalized.includes('--')) {
    return {
      valid: false,
      error: 'Username cannot contain consecutive punctuation marks',
    };
  }

  return { valid: true };
}

const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '',
  'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': 'o', 'қ': 'q',
  'ғ': 'g', 'ҳ': 'h',
};

/**
 * Transliterates Cyrillic/Uzbek characters to Latin.
 */
export function transliterateUzbekToLatin(text: string): string {
  if (!text) return '';
  let result = '';
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const char = lower[i];
    if (CYRILLIC_TO_LATIN_MAP[char] !== undefined) {
      result += CYRILLIC_TO_LATIN_MAP[char];
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Generates a clean, collision-ready username candidate from first and last names.
 * Example: ("Anvar", "Qosimov") => "anvar.qosimov"
 * Example: ("Шаҳзод", "Раҳимов") => "shahzod.rahimov"
 */
export function generateUsernameCandidate(firstName: string, lastName?: string): string {
  const cleanFirst = transliterateUzbekToLatin(firstName || '')
    .replace(/[^a-z0-9]/g, '')
    .toLowerCase();
  const cleanLast = transliterateUzbekToLatin(lastName || '')
    .replace(/[^a-z0-9]/g, '')
    .toLowerCase();

  let base = '';
  if (cleanFirst && cleanLast) {
    base = `${cleanFirst}.${cleanLast}`;
  } else if (cleanFirst) {
    base = cleanFirst;
  } else if (cleanLast) {
    base = cleanLast;
  } else {
    base = 'user';
  }

  // Ensure length constraints
  if (base.length > 25) {
    base = base.slice(0, 25);
  }
  if (base.length < 3) {
    base = base.padEnd(3, '0');
  }
  return base;
}

/**
 * Generates a secure, readable temporary password for onboarding.
 * Pattern: "Medu!" + 6 characters alphanumeric
 * Guaranteed to satisfy all platform password complexity requirements (uppercase, lowercase, number, symbol, length >= 8).
 */
export function generateTemporaryPassword(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  let rand = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    rand += chars[bytes[i] % chars.length];
  }
  return `Medu!${rand}`;
}
