/**
 * Secure Logger — structured logging with sensitive data redaction.
 *
 * CRITICAL: Never log:
 * - Biometric templates or embeddings
 * - Raw face images
 * - Credentials, passwords, or API keys
 * - Access tokens
 * - Encryption keys
 * - Student PII beyond IDs
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: string;
}

/**
 * Keyword forms (free-form messages) whose adjacent value must be redacted.
 * A secret interpolated into a plain message — "password hunter2",
 * "token=abc123", "apikey fp_deadbeef" — never matched the quoted-style
 * patterns below and leaked straight to stdout before these were added.
 */
const SENSITIVE_KEYWORD =
  '(?:password|passwd|pwd|access[_-]?token|refresh[_-]?token|token|secret|api[_-]?key|apikey|client[_-]?secret|private[_-]?key|authorization)';

/** Patterns that should be redacted from log output */
const SENSITIVE_PATTERNS = [
  /password[^"]*"[^"]*"/gi,
  /apiKey[^"]*"[^"]*"/gi,
  /token[^"]*"[^"]*"/gi,
  /secret[^"]*"[^"]*"/gi,
  /embedding/gi,
  /templateData/gi,
  /face_encoding/gi,
  /biometric/gi,
  // Authorization: Bearer <token> — the keyword pattern alone would only
  // redact the word "Bearer" and leave the token visible.
  /\b(?:authorization|Authorization)\s*[:=]\s*Bearer\s+\S+/gi,
  // key=value / key: value assignments in free-form text.
  new RegExp(`\\b${SENSITIVE_KEYWORD}\\b\\s*[:=]\\s*\\S+`, 'gi'),
  // key value (whitespace) — "password hunter2", "apikey fp_...".
  // Slightly over-redacts ("token stored"), which we accept: readability is
  // cheaper than a credential leak.
  new RegExp(`\\b${SENSITIVE_KEYWORD}\\b\\s+\\S+`, 'gi'),
];

function redactSensitiveData(data: unknown): unknown {
  if (typeof data === 'string') {
    let redacted = data;
    // Mask URL userinfo first: rtsp://user:pass@host → rtsp://***:***@host.
    // (Not in SENSITIVE_PATTERNS: after masking, *** would re-match and
    // wipe the whole scheme prefix down to [REDACTED].)
    redacted = redacted.replace(
      /\b(rtsp|rtsps|http|https):\/\/[^:@/\s]+:[^@/\s]+@/gi,
      '$1://***:***@',
    );
    for (const pattern of SENSITIVE_PATTERNS) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    return redacted;
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  if (data && typeof data === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Redact known sensitive keys
      const sensitiveKeys = [
        'password', 'passwordHash', 'apiKey', 'apiKeyHash',
        'token', 'secret', 'encryptionKey', 'biometric',
        'templateData', 'embedding', 'face_encoding',
      ];
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }
    return redacted;
  }

  return data;
}

export class SecureLogger {
  constructor(
    private readonly minLevel: LogLevel = 'info'
  ) {}

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      // Message may embed a full stream URI — run the same redaction as context.
      message: redactSensitiveData(message) as string,
      timestamp: new Date().toISOString(),
      context: context ? redactSensitiveData(context) as Record<string, unknown> : undefined,
      error: error instanceof Error ? (redactSensitiveData(error.message) as string) : undefined,
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>, error?: unknown): void {
    this.log('error', message, context, error);
  }
}