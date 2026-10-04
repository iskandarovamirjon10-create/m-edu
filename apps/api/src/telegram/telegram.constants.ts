/**
 * Telegram integration tunables and user-facing strings.
 *
 * Single place for the values that define the linking security envelope, so a
 * reviewer can audit them without reading the services.
 */

/**
 * Deep-link token time-to-live. Deliberately short: the user opens the M-EDU
 * settings screen and clicks the link immediately.
 */
export const TELEGRAM_LINK_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** 32 random bytes => 256-bit token => 64 lowercase hex characters. */
export const TELEGRAM_LINK_TOKEN_BYTES = 32;

/**
 * Accepted raw token shape. Enforced BEFORE any database lookup so malformed
 * input cannot reach the token table (and so brute-force garbage is cheap).
 */
export const TELEGRAM_LINK_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

/** Failed `/start` attempts per chat before the chat is temporarily ignored. */
export const TELEGRAM_LINK_MAX_FAILED_ATTEMPTS = 10;

/** Sliding window for the distributed failed-attempt counter. */
export const TELEGRAM_LINK_ATTEMPT_WINDOW_SECONDS = 60 * 60; // 1 hour

/** Hard cap on the accepted webhook body. Telegram updates are a few KB. */
export const TELEGRAM_WEBHOOK_MAX_BODY_BYTES = 256 * 1024;

/**
 * Path the webhook is served on (after the global `api` prefix).
 *
 * Used to mount a route-scoped JSON parser with the byte cap above, so the
 * limit also holds for requests that do not send `Content-Length`.
 */
export const TELEGRAM_WEBHOOK_PATH = '/api/webhooks/telegram';

/**
 * Command/callback flood limits, per chat, counted in the distributed Redis
 * limiter. Deliberately generous: normal navigation must never be throttled,
 * only sustained abuse.
 */
export const TELEGRAM_COMMAND_WINDOW_SECONDS = 60;
export const TELEGRAM_COMMAND_MAX_PER_WINDOW = 30;
export const TELEGRAM_CALLBACK_WINDOW_SECONDS = 60;
export const TELEGRAM_CALLBACK_MAX_PER_WINDOW = 45;

/** Cap on the command text parsed from an update (Telegram allows 4096). */
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

/**
 * `/copilot` budget.
 *
 * An AI turn costs a model invocation, so it gets a much tighter window than
 * the generic command flood limit — counted per chat in the distributed Redis
 * limiter, therefore enforced across every API instance.
 */
export const TELEGRAM_COPILOT_WINDOW_SECONDS = 60;
export const TELEGRAM_COPILOT_MAX_PER_WINDOW = 10;

/** Cap on the question forwarded to the model (untrusted user input). */
export const TELEGRAM_COPILOT_MAX_QUESTION_LENGTH = 1000;

/**
 * Cap on the rendered Copilot reply. Telegram rejects messages over 4096
 * characters; the remainder of the budget is taken by the title and blank line.
 */
export const TELEGRAM_COPILOT_MAX_ANSWER_LENGTH = 3500;

/** Commands understood by the webhook in this (foundation) slice. */
export const TELEGRAM_START_COMMAND = '/start';
export const TELEGRAM_UNLINK_COMMAND = '/unlink';

/**
 * Set of audit action names emitted by the Telegram integration.
 *
 * Stored in the free-form `AuditLog.action` column; `AuditService.mapAction`
 * reports them as `CUSTOM`, which is why the raw value is listed here — it is
 * the contract the operator searches on.
 */
export const TelegramAuditActions = {
  LINK_CREATED: 'TELEGRAM_LINK_CREATED',
  LINK_CONSUMED: 'TELEGRAM_LINK_CONSUMED',
  LINK_FAILED: 'TELEGRAM_LINK_FAILED',
  CONNECTED: 'TELEGRAM_CONNECTED',
  DISCONNECTED: 'TELEGRAM_DISCONNECTED',
  /** ACTIVE -> BLOCKED after a permanent provider failure (bot blocked / chat gone). */
  BLOCKED: 'TELEGRAM_ACCOUNT_BLOCKED',
  /** Quiet-hours deferral: a Telegram delivery was scheduled, not dropped. */
  DELIVERY_DEFERRED: 'TELEGRAM_DELIVERY_DEFERRED',
} as const;

/**
 * i18n keys used by the webhook's pre-context link flow.
 *
 * The link flow can run before an M-EDU context exists (that is the point of
 * linking), so its replies are looked up directly from the catalogue rather
 * than through a request-bound translator.
 */
export const TELEGRAM_LINK_MESSAGE_KEYS = {
  LINKED: 'start.linked',
  INVALID_TOKEN: 'start.invalidToken',
  IDENTITY_CONFLICT: 'start.conflict',
  RATE_LIMITED: 'start.rateLimited',
  NOT_LINKED: 'error.notLinked',
  LINK_HINT: 'error.notLinkedHint',
  HELP: 'help.hint',
  GENERIC_ERROR: 'error.generic',
} as const;
