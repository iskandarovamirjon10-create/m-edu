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
  }

  // --- OAuth state session (express-session signing secret) ---
  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_SECRET);
  if (nodeEnv === 'production' && (!env.OAUTH_SESSION_SECRET || env.OAUTH_SESSION_SECRET.length < MIN_SECRET_LENGTH)) {
    error('OAUTH_SESSION_SECRET', `Required (>= ${MIN_SECRET_LENGTH} chars) in production.`);
  } else if (googleConfigured && (!env.OAUTH_SESSION_SECRET || env.OAUTH_SESSION_SECRET.length < MIN_SECRET_LENGTH)) {
    error('OAUTH_SESSION_SECRET', `Required (>= ${MIN_SECRET_LENGTH} chars) when Google OAuth is configured.`);
  }

  // --- Biometric / camera credential encryption ---
  const encKey = env.BIOMETRIC_ENCRYPTION_KEY || env.CAMERA_ENCRYPTION_KEY;
  if (!encKey) {
    error('BIOMETRIC_ENCRYPTION_KEY', 'Required (AES-256-GCM) — also used as fallback for camera credentials.');
  } else if (encKey.length < MIN_SECRET_LENGTH) {
    error('BIOMETRIC_ENCRYPTION_KEY', `Must be at least ${MIN_SECRET_LENGTH} characters.`);
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

  // --- Camera network policy ---
  if (nodeEnv === 'production' && env.ALLOW_LOCAL_CAMERAS === 'true') {
    warn('ALLOW_LOCAL_CAMERAS', 'Allowing local/private camera addresses in production is risky; verify network boundaries.');
  }
  if (nodeEnv === 'production' && env.ALLOW_CAMERA_DISCOVERY === 'true') {
    warn('ALLOW_CAMERA_DISCOVERY', 'ONVIF discovery in production should only be enabled inside trusted networks.');
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
