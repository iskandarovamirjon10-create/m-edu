/**
 * Production error reporting (lightweight Sentry-analog).
 *
 * Design decisions:
 *  - NO third-party SDK: the payload is POSTed to the project's own
 *    `POST /api/client-errors` sink (or any URL you set via
 *    VITE_ERROR_REPORTING_URL) where it becomes one structured API log line
 *    that existing log shipping can ingest.
 *  - Disabled unless BOTH conditions hold: a production build AND
 *    VITE_ERROR_REPORTING_URL is configured. Development stays untouched.
 *  - `credentials: 'omit'` — the sink is anonymous, so no CSRF cookie dance
 *    and no session association (errors are never tied to a user session).
 *  - Truncates message/stack before sending; never attaches cookies,
 *    headers, request bodies or user content.
 *  - Per-message dedupe: a crash-looping widget reports once per minute
 *    instead of flooding (the API additionally throttles to 30/min/IP).
 */

export type ErrorSource = 'window' | 'promise' | 'boundary' | 'sw';

export interface ErrorReport {
  message: string;
  stack?: string;
  route?: string;
  source: ErrorSource;
  release?: string;
}

export interface ErrorReporterOptions {
  enabled: boolean;
  endpoint?: string;
  release?: string;
  /** Test seam: replaces fetch/sendBeacon. Receives the JSON payload. */
  transport?: (payload: string) => void;
}

const MESSAGE_LIMIT = 500;
const STACK_LIMIT = 4000;
const DEDUPE_WINDOW_MS = 60_000;
const DEDUPE_MAX_KEYS = 50;

/** Recent message -> last-sent timestamp, for crash-loop dedupe. */
const recent = new Map<string, number>();
let installed = false;
let listeners: Array<[string, EventListener]> = [];

function defaults(): ErrorReporterOptions {
  const endpoint =
    typeof import.meta.env.VITE_ERROR_REPORTING_URL === 'string'
      ? import.meta.env.VITE_ERROR_REPORTING_URL
      : '';
  return {
    enabled: Boolean(import.meta.env.PROD && endpoint),
    endpoint: endpoint || undefined,
    release:
      typeof import.meta.env.VITE_APP_RELEASE === 'string'
        ? import.meta.env.VITE_APP_RELEASE
        : undefined,
  };
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? value.slice(0, limit) : value;
}

function currentRoute(): string {
  if (typeof window === 'undefined') return '';
  return truncate(`${window.location.pathname}${window.location.search}`, 300);
}

function shouldSend(key: string, now: number): boolean {
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return false;
  recent.set(key, now);
  if (recent.size > DEDUPE_MAX_KEYS) {
    // Drop the oldest half — bounded memory even under error storms.
    const entries = [...recent.entries()].sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < Math.floor(DEDUPE_MAX_KEYS / 2); i++) {
      recent.delete(entries[i][0]);
    }
  }
  return true;
}

/**
 * Report a single error. Returns true when the payload was handed to the
 * transport. ALWAYS safe to call: a no-op in development or when no
 * endpoint is configured.
 */
export function reportClientError(
  error: unknown,
  source: ErrorSource = 'window',
  overrides?: Partial<ErrorReporterOptions>,
): boolean {
  const opts = { ...defaults(), ...overrides };
  if (!opts.enabled || !opts.endpoint) return false;

  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : safeStringify(error));

  const message = truncate(err.message || String(error), MESSAGE_LIMIT);
  if (!shouldSend(`${source}:${message}`, Date.now())) return false;

  const report: ErrorReport = {
    message,
    stack: err.stack ? truncate(err.stack, STACK_LIMIT) : undefined,
    route: currentRoute(),
    source,
    release: opts.release,
  };
  const payload = JSON.stringify(report);

  try {
    if (opts.transport) {
      opts.transport(payload);
      return true;
    }
    void fetch(opts.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      credentials: 'omit',
      keepalive: true,
    }).catch(() => {
      // Telemetry must never break the app.
    });
    return true;
  } catch {
    return false;
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '[unserializable error]';
  }
}

/**
 * Install the global window/unhandledrejection listeners.
 * Returns true when listeners were installed (prod + endpoint configured).
 * Calling it twice is a no-op.
 */
export function initErrorReporting(
  overrides?: Partial<ErrorReporterOptions>,
): boolean {
  if (installed || typeof window === 'undefined') return installed;
  const opts = { ...defaults(), ...overrides };
  if (!opts.enabled || !opts.endpoint) return false;

  const onError = (event: Event) => {
    const errorEvent = event as ErrorEvent;
    reportClientError(
      errorEvent.error ?? errorEvent.message ?? 'Unknown error',
      'window',
      opts,
    );
  };
  const onRejection = (event: Event) => {
    const rejectionEvent = event as PromiseRejectionEvent;
    reportClientError(
      rejectionEvent.reason ?? 'Unhandled rejection',
      'promise',
      opts,
    );
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  listeners = [
    ['error', onError],
    ['unhandledrejection', onRejection],
  ];
  installed = true;
  return true;
}

/** Remove the global listeners (test teardown / hot reload hygiene). */
export function uninstallErrorReporting(): void {
  if (typeof window === 'undefined') return;
  for (const [name, listener] of listeners) {
    window.removeEventListener(name, listener);
  }
  listeners = [];
  installed = false;
  recent.clear();
}
