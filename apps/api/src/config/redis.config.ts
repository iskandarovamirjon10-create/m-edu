/**
 * Redis / BullMQ connection configuration.
 *
 * The platform runs two BullMQ queues:
 *   - `notification-events` (notifications/events) — domain event fan-out to
 *     in-app notifications, parent SMS and Telegram.
 *   - `background-jobs` (cron) — scheduled cleanup, overdue-invoice marking,
 *     follow-up rule and automation rule evaluation.
 *
 * Redis is therefore part of the runtime contract in production:
 * `assertValidConfig()` refuses to start production without `REDIS_URL` or
 * `REDIS_HOST`, and refuses to start production with `REDIS_ENABLED=false`.
 *
 * `REDIS_ENABLED=false` is a DEVELOPMENT-ONLY escape hatch for machines
 * without a Redis server (see docs/DEVELOPMENT.md). It is never silent: the
 * app logs a warning at boot, and the notification/job schedulers are not
 * registered at all, so no work is queued that would never be consumed.
 */

export interface RedisConnectionOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, unknown>;
}

/** Whether queue-backed processing is enabled. Only `false` disables it. */
export function isRedisEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.REDIS_ENABLED !== 'false';
}

/**
 * Connection options for BullMQ (`BullModule.forRoot`) and the workers.
 *
 * `REDIS_URL` wins when present (the convention used by managed Redis
 * providers); otherwise discrete `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`
 * variables are used, defaulting to the local Redis.
 */
export function redisQueueConnection(
  env: NodeJS.ProcessEnv = process.env,
): RedisConnectionOptions {
  const url = env.REDIS_URL?.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
        throw new Error('REDIS_URL must use redis: or rediss: protocol');
      }
      const options: RedisConnectionOptions = {
        host: parsed.hostname,
        port: Number(parsed.port || 6379),
      };
      if (parsed.username) options.username = decodeURIComponent(parsed.username);
      if (parsed.password) options.password = decodeURIComponent(parsed.password);
      if (parsed.pathname && parsed.pathname !== '/') {
        const db = Number(parsed.pathname.slice(1));
        if (Number.isFinite(db)) options.db = db;
      }
      if (parsed.protocol === 'rediss:') options.tls = {};
      return options;
    } catch {
      // A malformed REDIS_URL must not be silently treated as "no Redis":
      // fail loudly so the operator fixes the variable.
      throw new Error('REDIS_URL is not a valid URL.');
    }
  }

  const options: RedisConnectionOptions = {
    host: env.REDIS_HOST?.trim() || 'localhost',
    port: Number(env.REDIS_PORT) || 6379,
  };
  if (env.REDIS_PASSWORD) options.password = env.REDIS_PASSWORD;
  if (env.REDIS_DB) {
    const db = Number(env.REDIS_DB);
    if (Number.isFinite(db)) options.db = db;
  }
  return options;
}
