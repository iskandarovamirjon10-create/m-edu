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
];

function redactSensitiveData(data: unknown): unknown {
  if (typeof data === 'string') {
    let redacted = data;
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
      message,
      timestamp: new Date().toISOString(),
      context: context ? redactSensitiveData(context) as Record<string, unknown> : undefined,
      error: error instanceof Error ? error.message : undefined,
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
