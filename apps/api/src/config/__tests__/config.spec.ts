import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateConfig, assertValidConfig, configWarnings } from '../config.validate';
import { isRedisEnabled, redisQueueConnection } from '../redis.config';
import { RequestLoggerMiddleware } from '../request-logger.middleware';

describe('Config Module Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('config.validate', () => {
    it('should report missing DATABASE_URL and JWT_SECRET as errors', () => {
      delete process.env.DATABASE_URL;
      delete process.env.JWT_SECRET;

      const problems = validateConfig('development');
      const vars = problems.filter((p) => p.severity === 'error').map((p) => p.variable);

      expect(vars).toContain('DATABASE_URL');
      expect(vars).toContain('JWT_SECRET');
    });

    it('should report error if JWT_SECRET is shorter than 32 characters', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/medu';
      process.env.JWT_SECRET = 'short-secret';

      const problems = validateConfig('development');
      const jwtProblem = problems.find((p) => p.variable === 'JWT_SECRET');

      expect(jwtProblem?.severity).toBe('error');
      expect(jwtProblem?.message).toContain('at least 32 characters');
    });

    it('should require CORS_ORIGIN and production models in production mode', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/medu';
      process.env.JWT_SECRET = '12345678901234567890123456789012';
      process.env.BIOMETRIC_ENCRYPTION_KEY = '12345678901234567890123456789012';
      process.env.FACE_ENGINE_PROVIDER = 'real-local';
      delete process.env.CORS_ORIGIN;
      delete process.env.FACE_DETECTOR_MODEL_PATH;

      const problems = validateConfig('production');
      const errorVars = problems.filter((p) => p.severity === 'error').map((p) => p.variable);

      expect(errorVars).toContain('CORS_ORIGIN');
      expect(errorVars).toContain('FACE_DETECTOR_MODEL_PATH');
    });

    it('rejects unsafe placeholder secrets in production mode', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/medu';
      process.env.JWT_SECRET = 'your-jwt-secret-here-minimum-32-chars-long';
      process.env.OAUTH_SESSION_SECRET = 'changeme-please-set-at-least-32-characters-long';
      process.env.BIOMETRIC_ENCRYPTION_KEY = 'your-biometric-key-here-32-chars';
      process.env.FACE_ENGINE_PROVIDER = 'real-local';
      process.env.CORS_ORIGIN = 'https://app.medu.uz';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.medu.uz';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.FACE_DETECTOR_MODEL_PATH = '/path/to/detector.onnx';
      process.env.FACE_EMBEDDER_MODEL_PATH = '/path/to/embedder.onnx';

      const problems = validateConfig('production');
      const errorVars = problems.filter((p) => p.severity === 'error').map((p) => p.variable);

      expect(errorVars).toContain('JWT_SECRET');
      expect(errorVars).toContain('OAUTH_SESSION_SECRET');
      expect(errorVars).toContain('BIOMETRIC_ENCRYPTION_KEY');
    });

    it('assertValidConfig throws aggregated error when errors exist', () => {
      delete process.env.DATABASE_URL;
      delete process.env.JWT_SECRET;

      expect(() => assertValidConfig('development')).toThrow(/Invalid environment configuration/);
    });

    // ---- SMS production safety (fail-fast, no silent fake SMS) ----
    describe('SMS_PROVIDER production safety', () => {
      const primeValidProductionEnv = () => {
        process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/medu';
        process.env.JWT_SECRET = '12345678901234567890123456789012';
        process.env.OAUTH_SESSION_SECRET = '12345678901234567890123456789012';
        process.env.BIOMETRIC_ENCRYPTION_KEY = '12345678901234567890123456789012';
        process.env.FACE_ENGINE_PROVIDER = 'real-local';
        process.env.FACE_DETECTOR_MODEL_PATH = '/models/detector.onnx';
        process.env.FACE_EMBEDDER_MODEL_PATH = '/models/embedder.onnx';
        process.env.CORS_ORIGIN = 'https://app.medu.uz';
        process.env.NEXT_PUBLIC_APP_URL = 'https://app.medu.uz';
        process.env.REDIS_URL = 'redis://localhost:6379';
      };

      it('production refuses to boot when SMS_PROVIDER is unset (would default to STUB)', () => {
        primeValidProductionEnv();
        delete process.env.SMS_PROVIDER;

        const problems = validateConfig('production');
        const sms = problems.find((p) => p.variable === 'SMS_PROVIDER');

        expect(sms?.severity).toBe('error');
        expect(sms?.message).toContain('STUB');
        // The whole boot must fail, not just warn:
        expect(() => assertValidConfig('production')).toThrow(/SMS_PROVIDER/);
      });

      it('production refuses to boot when SMS_PROVIDER=STUB (silent discard)', () => {
        primeValidProductionEnv();
        process.env.SMS_PROVIDER = 'STUB';

        const problems = validateConfig('production');
        const sms = problems.find((p) => p.variable === 'SMS_PROVIDER');

        expect(sms?.severity).toBe('error');
        expect(() => assertValidConfig('production')).toThrow(/SMS_PROVIDER/);
      });

      it('development and test keep SMS_PROVIDER=STUB working', () => {
        process.env.SMS_PROVIDER = 'STUB';

        for (const envName of ['development', 'test'] as const) {
          const problems = validateConfig(envName);
          expect(problems.find((p) => p.variable === 'SMS_PROVIDER')).toBeUndefined();
        }
        // Local iteration must not throw (prime the unconditional checks):
        process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/medu';
        process.env.JWT_SECRET = '12345678901234567890123456789012';
        process.env.OAUTH_SESSION_SECRET = '12345678901234567890123456789012';
        process.env.BIOMETRIC_ENCRYPTION_KEY = '12345678901234567890123456789012';
        process.env.FACE_ENGINE_PROVIDER = 'real-local';
        process.env.GOOGLE_CLIENT_ID = '';
        process.env.GOOGLE_CLIENT_SECRET = '';
        expect(() => assertValidConfig('test')).not.toThrow();
      });

      it('production accepts a real provider with credentials', () => {
        primeValidProductionEnv();
        process.env.SMS_PROVIDER = 'Eskiz';
        process.env.ESKIZ_EMAIL = 'sender@example.uz';
        process.env.ESKIZ_PASSWORD = 'real-password';

        const problems = validateConfig('production');
        const errorVars = problems
          .filter((p) => p.severity === 'error')
          .map((p) => p.variable);

        expect(errorVars).not.toContain('SMS_PROVIDER');
        expect(errorVars).not.toContain('ESKIZ_EMAIL');
      });

      it('production rejects a real provider with missing credentials', () => {
        primeValidProductionEnv();
        process.env.SMS_PROVIDER = 'Eskiz';
        delete process.env.ESKIZ_EMAIL;
        delete process.env.ESKIZ_PASSWORD;

        const problems = validateConfig('production');
        const eskiz = problems.find((p) => p.variable === 'ESKIZ_EMAIL');

        expect(eskiz?.severity).toBe('error');
      });

      it('production rejects an unknown provider (SmsService would treat it as STUB)', () => {
        primeValidProductionEnv();
        process.env.SMS_PROVIDER = 'SomeFutureProvider';

        const problems = validateConfig('production');
        const sms = problems.find((p) => p.variable === 'SMS_PROVIDER');

        expect(sms?.severity).toBe('error');
        expect(sms?.message).toContain('Unknown provider');
      });
    });

    it('configWarnings returns only warnings', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/medu';
      process.env.JWT_SECRET = '12345678901234567890123456789012';
      delete process.env.NEXT_PUBLIC_APP_URL;

      const warnings = configWarnings('development');
      expect(warnings.every((w) => w.severity === 'warning')).toBe(true);
    });
  });

  describe('redis.config', () => {
    it('isRedisEnabled defaults to true unless explicitly false', () => {
      expect(isRedisEnabled({})).toBe(true);
      expect(isRedisEnabled({ REDIS_ENABLED: 'true' })).toBe(true);
      expect(isRedisEnabled({ REDIS_ENABLED: 'false' })).toBe(false);
    });

    it('redisQueueConnection parses REDIS_URL correctly', () => {
      const options = redisQueueConnection({
        REDIS_URL: 'redis://:mypassword@redis-host:6380/2',
      });

      expect(options.host).toBe('redis-host');
      expect(options.port).toBe(6380);
      expect(options.password).toBe('mypassword');
      expect(options.db).toBe(2);
    });

    it('redisQueueConnection falls back to discrete host/port variables', () => {
      const options = redisQueueConnection({
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: '6385',
        REDIS_PASSWORD: 'secretpassword',
      });

      expect(options.host).toBe('127.0.0.1');
      expect(options.port).toBe(6385);
      expect(options.password).toBe('secretpassword');
    });

    it('throws when REDIS_URL is malformed', () => {
      expect(() => redisQueueConnection({ REDIS_URL: 'not-a-valid-url::' })).toThrow(/REDIS_URL is not a valid URL/);
    });
  });

  describe('request-logger.middleware', () => {
    it('attaches X-Request-Id header and calls next', () => {
      const middleware = new RequestLoggerMiddleware();

      const req = {
        headers: {},
        method: 'GET',
        originalUrl: '/api/courses',
        on: vi.fn(),
      } as unknown as Parameters<typeof middleware.use>[0];

      const setHeaderMock = vi.fn();
      const onMock = vi.fn();
      const res = {
        setHeader: setHeaderMock,
        on: onMock,
        statusCode: 200,
      } as unknown as Parameters<typeof middleware.use>[1];

      const next = vi.fn();

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.headers['x-request-id']).toBeDefined();
      expect(setHeaderMock).toHaveBeenCalledWith('X-Request-Id', req.headers['x-request-id']);
      expect(onMock).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });
});
