/**
 * Socket.IO base URL resolution — shared by every realtime hook.
 *
 * Rules:
 *  - Explicit `VITE_API_URL` wins (cross-origin API deployments).
 *  - Otherwise connect same-origin: the SPA is co-deployed with the API
 *    behind nginx (dev: vite proxies `/socket.io`).
 *
 * The previous per-hook fallbacks disagreed: one hardcoded
 * `http://localhost:4000` (broken + misleading in any deployed build), the
 * other had a dev-port heuristic. One helper, one behavior.
 */
export function getSocketBaseUrl(): string {
  const explicit = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  if (explicit) return explicit;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000'; // SSR/test fallback only
}
