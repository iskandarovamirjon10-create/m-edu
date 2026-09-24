/**
 * Shared error utilities.
 *
 * Centralizes the (annoying but necessary) narrowing of `unknown` thrown
 * values so production code never has to type `catch (err: any)` just to
 * read a message.
 */

/** Guards the AggregateError walk against a cyclic `errors` list. */
const MAX_ERROR_NESTING = 5;

/**
 * Best-effort string for any thrown value (Error, string, object, null).
 *
 * Node reports multi-address connection failures (e.g. a Redis/loopback
 * connect to several resolved addresses) as an `AggregateError` whose own
 * `message` is EMPTY — `error.message` alone logs `"error":""`, which tells an
 * operator nothing. When the message is blank the first nested error, or the
 * errno `code`, is surfaced instead.
 */
export function getErrorMessage(error: unknown): string {
  return describeError(error, 0);
}

function describeError(error: unknown, depth: number): string {
  if (error instanceof Error) {
    if (error.message) return error.message;

    const nested = (error as { errors?: unknown }).errors;
    if (depth < MAX_ERROR_NESTING && Array.isArray(nested) && nested.length > 0) {
      const inner = describeError(nested[0], depth + 1);
      if (inner) return inner;
    }

    const code = (error as NodeJS.ErrnoException).code;
    if (typeof code === 'string' && code) return `${error.name}: ${code}`;
    return error.name || String(error);
  }

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
