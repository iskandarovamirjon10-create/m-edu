/**
 * Central startup configuration validation.
 *
 * Fail-fast, aggregated validation: in production every problem is listed in
 * a single error so operators see the full picture at once instead of
 * fixing one variable and re-deploying. Never silently fall back to insecure
 * defaults in production.
 *
 * In development/test the same checks run as warnings, so developers get
 * early feedback without blocking local iteration (except where a missing
 * value would make the app unusable even locally).
 */

export interface ConfigProblem {
  variable: string;
  message: string;
  severity: 'error' | 'warning';
}

const MIN_SECRET_LENGTH = 32;

const INSECURE_PLACEHOLDER_SUBSTRINGS = [
  'changeme',
  'your-jwt-secret',
  'your-biometric-key',
  'your-camera-key',
  'your-telegram',
  'this-is-a-very-long-secret',
  'placeholder',
  'secret-here',
];

function isUnsafePlaceholder(val: string | undefined): boolean {
  if (!val) return false;
  const lower = val.toLowerCase();
  return INSECURE_PLACEHOLDER_SUBSTRINGS.some((s) => lower.includes(s));
}

export function validateConfig(nodeEnv: string = process.env.NODE_ENV || 'development'): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const env = process.env;

  const error = (variable: string, message: string) =>
    problems.push({ variable, message, severity: 'error' });
  const warn = (variable: string, message: string) =>
    problems.push({ variable, message, severity: 'warning' });

  // --- Database ---
  if (!env.DATABASE_URL) {
    error('DATABASE_URL', 'Database connection string is required.');
  } else if (!env.DATABASE_URL.startsWith('postgresql://') && !env.DATABASE_URL.startsWith('postgres://')) {
    error('DATABASE_URL', 'Must be a postgresql:// connection string.');
  }

  // --- Auth / JWT ---
  if (!env.JWT_SECRET) {
    error('JWT_SECRET', 'Required to sign and verify session tokens.');
  } else if (env.JWT_SECRET.length < MIN_SECRET_LENGTH) {
    error('JWT_SECRET', `Must be at least ${MIN_SECRET_LENGTH} characters.`);
  } else if (nodeEnv === 'production' && isUnsafePlaceholder(env.JWT_SECRET)) {
    error('JWT_SECRET', 'Unsafe placeholder secret detected. Production must use a cryptographically random secret.');
  }

  // --- OAuth state session (express-session signing secret) ---
  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_SECRET);
  if (nodeEnv === 'production') {
    if (!env.OAUTH_SESSION_SECRET || env.OAUTH_SESSION_SECRET.length < MIN_SECRET_LENGTH) {
      error('OAUTH_SESSION_SECRET', `Required (>= ${MIN_SECRET_LENGTH} chars) in production.`);
    } else if (isUnsafePlaceholder(env.OAUTH_SESSION_SECRET)) {
      error('OAUTH_SESSION_SECRET', 'Unsafe placeholder secret detected. Production must use a cryptographically random secret.');
    }
  } else if (googleConfigured && (!env.OAUTH_SESSION_SECRET || env.OAUTH_SESSION_SECRET.length < MIN_SECRET_LENGTH)) {
    error('OAUTH_SESSION_SECRET', `Required (>= ${MIN_SECRET_LENGTH} chars) when Google OAuth is configured.`);
  }

  // --- Biometric / camera credential encryption ---
  const encKey = env.BIOMETRIC_ENCRYPTION_KEY || env.CAMERA_ENCRYPTION_KEY;
  if (!encKey) {
    error('BIOMETRIC_ENCRYPTION_KEY', 'Required (AES-256-GCM) — also used as fallback for camera credentials.');
  } else if (encKey.length < MIN_SECRET_LENGTH) {
    error('BIOMETRIC_ENCRYPTION_KEY', `Must be at least ${MIN_SECRET_LENGTH} characters.`);
  } else if (nodeEnv === 'production' && isUnsafePlaceholder(encKey)) {
    error('BIOMETRIC_ENCRYPTION_KEY', 'Unsafe placeholder encryption key detected. Production must use a cryptographically random 256-bit key.');
  }

  // --- Face recognition ---
  if (!env.FACE_ENGINE_PROVIDER) {
    error('FACE_ENGINE_PROVIDER', 'Required. Use "real-local" for the real ONNX engine.');
  } else if (env.FACE_ENGINE_PROVIDER !== 'real-local') {
    if (nodeEnv === 'production') {
      error('FACE_ENGINE_PROVIDER', 'Mock engines are forbidden in production. Set FACE_ENGINE_PROVIDER=real-local.');
    } else {
      warn('FACE_ENGINE_PROVIDER', `Provider "${env.FACE_ENGINE_PROVIDER}" is not real — face recognition is not genuine.`);
    }
  }
  if (nodeEnv === 'production') {
    if (!env.FACE_DETECTOR_MODEL_PATH) error('FACE_DETECTOR_MODEL_PATH', 'Required (YuNet ONNX) in production.');
    if (!env.FACE_EMBEDDER_MODEL_PATH) error('FACE_EMBEDDER_MODEL_PATH', 'Required (SFace ONNX) in production.');
    if (!env.FACE_LIVENESS_MODEL_PATH) {
      warn('FACE_LIVENESS_MODEL_PATH', 'Not set — liveness will be UNAVAILABLE and recognition will fail closed.');
    }
  }

  // --- CORS ---
  if (nodeEnv === 'production' && !env.CORS_ORIGIN) {
    error('CORS_ORIGIN', 'Required in production (browser origin of the web app).');
  }

  // --- SMTP outbound email ---
  // Not boot-blocking: a deployment may run Telegram/SMS-only on purpose.
  // Operators still must see it - without SMTP_HOST every password-reset
  // and invitation email fails at send time in production.
  if (nodeEnv === 'production' && !env.SMTP_HOST) {
    warn('SMTP_HOST', 'Not set - outbound email fails at send time in production.');
  }
  if (env.SMTP_HOST && !env.SMTP_FROM) {
    warn(
      'SMTP_FROM',
      'Not set - emails fall back to noreply@m-edu.io, which is NOT a domain ' +
        'you control (SPF/DKIM). Set SMTP_FROM to your own sender.',
    );
  }

  // --- Frontend URL (OAuth redirects) ---
  if (nodeEnv === 'production' && !env.NEXT_PUBLIC_APP_URL) {
    error('NEXT_PUBLIC_APP_URL', 'Required in production (used for OAuth callback redirects).');
  } else if (nodeEnv !== 'production' && !env.NEXT_PUBLIC_APP_URL) {
    warn('NEXT_PUBLIC_APP_URL', 'Not set — OAuth redirects will fall back to http://localhost:3000.');
  }

  // --- Server ---
  if (env.PORT && !/^\d+$/.test(env.PORT)) {
    error('PORT', 'Must be a numeric port.');
  }

  // --- Redis (notification pipeline + scheduled jobs) ---
  if (nodeEnv === 'production') {
    if (env.REDIS_ENABLED === 'false') {
      error('REDIS_ENABLED', 'Must not be "false" in production (notifications and cron jobs require Redis).');
    }
    if (!env.REDIS_URL && !env.REDIS_HOST) {
      error('REDIS_URL', 'REDIS_URL or REDIS_HOST is required in production.');
    }
  }

  // --- SMS delivery ---
  //
  // SmsService treats an unset/unknown SMS_PROVIDER as "STUB" — a no-op that
  // logs instead of sending. In production that silently swallows OTP codes,
  // password-reset messages and alerts while the UI reports success. Refuse
  // to boot instead of degrading to a fake provider; development/test keep
  // STUB so local iteration needs no real gateway.
  if (nodeEnv === 'production') {
    const smsProvider = env.SMS_PROVIDER || 'STUB';
    if (smsProvider.toUpperCase() === 'STUB') {
      error(
        'SMS_PROVIDER',
        'STUB (or unset) silently discards every SMS in production. ' +
          'Configure a real provider: Eskiz (ESKIZ_EMAIL/ESKIZ_PASSWORD) or ' +
          'PlayMobile (PLAYMOBILE_BASE_URL/PLAYMOBILE_TOKEN).',
      );
    } else if (smsProvider === 'Eskiz') {
      if (!env.ESKIZ_EMAIL || !env.ESKIZ_PASSWORD) {
        error(
          'ESKIZ_EMAIL',
          'Required when SMS_PROVIDER=Eskiz in production (ESKIZ_EMAIL / ESKIZ_PASSWORD).',
        );
      }
    } else if (smsProvider === 'PlayMobile') {
      if (!env.PLAYMOBILE_BASE_URL || !env.PLAYMOBILE_TOKEN) {
        error(
          'PLAYMOBILE_BASE_URL',
          'Required when SMS_PROVIDER=PlayMobile in production (PLAYMOBILE_BASE_URL / PLAYMOBILE_TOKEN).',
        );
      }
    } else {
      error(
        'SMS_PROVIDER',
        `Unknown provider "${smsProvider}" — expected Eskiz or PlayMobile (STUB is forbidden in production).`,
      );
    }
  }

  // --- Telegram integration ---
  //
  // Telegram is optional, but when it is switched on in production the webhook
  // MUST be authenticatable and deep links MUST be buildable — an enabled bot
  // without a webhook secret would accept unauthenticated updates.
  if (env.TELEGRAM_ENABLED === 'true') {
    const missing: string[] = [];
    if (!env.TELEGRAM_BOT_TOKEN) missing.push('TELEGRAM_BOT_TOKEN');
    if (!env.TELEGRAM_BOT_USERNAME) missing.push('TELEGRAM_BOT_USERNAME');
    if (!env.TELEGRAM_WEBHOOK_SECRET) {
      missing.push('TELEGRAM_WEBHOOK_SECRET');
    } else if (env.TELEGRAM_WEBHOOK_SECRET.length < MIN_SECRET_LENGTH) {
      error(
        'TELEGRAM_WEBHOOK_SECRET',
        `Must be at least ${MIN_SECRET_LENGTH} characters when TELEGRAM_ENABLED=true.`,
      );
    } else if (nodeEnv === 'production' && isUnsafePlaceholder(env.TELEGRAM_WEBHOOK_SECRET)) {
      error('TELEGRAM_WEBHOOK_SECRET', 'Unsafe placeholder secret detected. Production must use a cryptographically random secret.');
    }

    if (missing.length > 0) {
      const message = `Required when TELEGRAM_ENABLED=true (missing: ${missing.join(', ')}).`;
      if (nodeEnv === 'production') {
        for (const variable of missing) error(variable, message);
      } else {
        for (const variable of missing) warn(variable, message);
      }
    }

    // Inline-keyboard callbacks are HMAC-signed. A dedicated secret is
    // recommended (key separation from session tokens); JWT_SECRET is used as
    // a fallback so the feature cannot silently break.
    if (!env.TELEGRAM_CALLBACK_SECRET) {
      warn(
        'TELEGRAM_CALLBACK_SECRET',
        'Not set — Telegram callback signing falls back to JWT_SECRET. Set a dedicated value for key separation.',
      );
    }
  } else if (env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_WEBHOOK_SECRET) {
    // Credentials present but the integration is not switched on: this is the
    // configuration an operator almost never wants (silent half-enabled bot).
    warn(
      'TELEGRAM_ENABLED',
      'Telegram credentials are set but TELEGRAM_ENABLED is not "true". The webhook route still requires TELEGRAM_WEBHOOK_SECRET.',
    );
  }

  // --- Camera network policy ---
  if (nodeEnv === 'production' && env.ALLOW_LOCAL_CAMERAS === 'true') {
    error('ALLOW_LOCAL_CAMERAS', 'Allowing local/private camera addresses in production is forbidden (SSRF risk).');
  }
  if (nodeEnv === 'production' && env.ALLOW_CAMERA_DISCOVERY === 'true') {
    error('ALLOW_CAMERA_DISCOVERY', 'ONVIF discovery in production should only be enabled inside trusted networks.');
  }

  return problems;
}

/** Throw with a single aggregated message when any error-severity problem exists. */
export function assertValidConfig(nodeEnv?: string): void {
  const problems = validateConfig(nodeEnv);
  const errors = problems.filter((p) => p.severity === 'error');
  if (errors.length === 0) return;
  const lines = errors.map((p) => `  - ${p.variable}: ${p.message}`);
  throw new Error(
    `Invalid environment configuration (${errors.length} error${errors.length === 1 ? '' : 's'}):\n${lines.join('\n')}`,
  );
}

/** List of warning-severity problems (logged at startup, never fatal). */
export function configWarnings(nodeEnv?: string): ConfigProblem[] {
  return validateConfig(nodeEnv).filter((p) => p.severity === 'warning');
}

