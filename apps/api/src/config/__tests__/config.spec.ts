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

    it('assertValidConfig throws aggregated error when errors exist', () => {
      delete process.env.DATABASE_URL;
      delete process.env.JWT_SECRET;

      expect(() => assertValidConfig('development')).toThrow(/Invalid environment configuration/);
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
