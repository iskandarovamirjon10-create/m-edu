/**
 * Shared error utilities.
 *
 * Centralizes the (annoying but necessary) narrowing of `unknown` thrown
 * values so production code never has to type `catch (err: any)` just to
 * read a message.
 */

/** Best-effort string for any thrown value (Error, string, object, null). */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === 'string') return msg;
    return String(msg);
  }
  return String(error);
}

/** Best-effort error object for logging stacks (falls back to a new Error). */
export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(getErrorMessage(error));
}
