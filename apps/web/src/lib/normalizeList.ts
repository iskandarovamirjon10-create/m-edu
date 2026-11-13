/**
 * Normalizes list responses from the API, which may arrive either as a bare
 * array or wrapped in a `{ data }` / `{ items }` envelope.
 *
 * Keeps call sites typed without scattering `as any` across the app.
 */
export function toList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === 'object') {
    const box = res as { data?: unknown; items?: unknown };
    if (Array.isArray(box.data)) return box.data as T[];
    if (Array.isArray(box.items)) return box.items as T[];
  }
  return [];
}
