/**
 * Central friendly-error mapping for the UI.
 *
 * `getErrorMessage` is the single entry point pages use to turn any thrown
 * value / react-query error into a user-safe message:
 *  - ApiError already carries a friendly message (see api.ts
 *    friendlyHttpMessage) — returned as-is.
 *  - Face/recognition domain error codes are translated by
 *    friendlyFaceError (liveness, quality, matching, tenant, ...).
 *  - Anything else becomes a generic message — never raw stack traces or
 *    internal server text.
 */
import { ApiError } from './api';
import { friendlyFaceError } from './faceErrors';

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    // Face domain errors carry a stable `code` — prefer the friendly
    // face-specific copy; otherwise ApiError.message is already sanitized.
    const details = err.details as { code?: string } | null | undefined;
    if (details?.code) return friendlyFaceError(err);
    return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}
