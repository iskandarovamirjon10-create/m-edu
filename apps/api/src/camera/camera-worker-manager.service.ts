import type Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Camera } from '@prisma/client';

import { SecureLogger } from '@medu/face-security';
import type { FaceEngine } from '@medu/core';
import type { VaultCredentials } from '@medu/camera-engine';
import { CredentialVault, NetworkSecurity } from '@medu/camera-engine';

import { getErrorMessage } from '../lib/error';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationEventService } from '../notifications/events/notification-event.service';
import { AttendanceDecisionEngine } from './attendance-decision.engine';
import { CameraWorkerSession } from './camera-worker-session';
import {
  DEFAULT_AMBIGUITY_MARGIN,
  DEFAULT_SIMILARITY_THRESHOLD,
} from './camera-thresholds';
import { CameraAlertingService } from './camera-alerting.service';
import { RedisPubSubService } from '../common/redis/redis-pubsub.service';
import {
  FACE_TEMPLATES_CHANGED_CHANNEL,
  type FaceTemplatesChangedPayload,
} from '../face/face-events';

// ===========================================================================
// 1. STRICT DOMAIN TYPES & CONTRACTS
// ===========================================================================

export type WorkerState =
  | 'STARTING'
  | 'CONNECTING'
  | 'RUNNING'
  | 'DEGRADED'
  | 'ERROR'
  | 'STOPPING'
  | 'DISABLED';

export interface CameraWorkerConfig {
  readonly cameraId: string;
  readonly organizationId: string;
  readonly name: string;
  readonly streamUri: string;
  readonly processingFps: number;
  readonly rtspTransport: 'tcp' | 'udp';
  readonly location: string | null;
  readonly recognitionEnabled: boolean;
  readonly attendanceEnabled: boolean;
  readonly similarityThreshold: number;
  readonly minAmbiguityMargin?: number;
}

interface WorkerRecord {
  readonly cameraId: string;
  readonly organizationId: string;
  readonly cameraName: string;
  /** Monotonic generation token to ignore stale events from destroyed sessions */
  readonly generationId: string;
  state: WorkerState;
  readonly session: CameraWorkerSession;
  readonly startedAt: Date;
  lastFrameOrRecoveryAt: Date;
  consecutiveLockFailures: number;
  readonly cleanupListeners: () => void;
}

interface DistributedCameraCommand {
  readonly commandId: string;
  readonly action: 'STOP' | 'STOP_ACK';
  readonly cameraId: string;
  readonly organizationId?: string;
  readonly sender: string;
  readonly targetCommandId?: string;
  readonly timestamp: number;
}

type CameraStartProjection = Pick<
  Camera,
  | 'id'
  | 'organizationId'
  | 'name'
  | 'host'
  | 'port'
  | 'protocol'
  | 'streamPath'
  | 'metadata'
  | 'rtspTransport'
  | 'encryptedCredentials'
  | 'processingFps'
  | 'location'
  | 'credentialConfigured'
  | 'enabled'
  | 'recognitionEnabled'
  | 'attendanceEnabled'
>;

// ===========================================================================
// 2. CONSTANTS & LUA SCRIPTS
// ===========================================================================

const ENV = {
  NODE_ENV: 'NODE_ENV',
  REDIS_URL: 'REDIS_URL',
  BIOMETRIC_ENCRYPTION_KEY: 'BIOMETRIC_ENCRYPTION_KEY',
  CAMERA_ENCRYPTION_KEY: 'CAMERA_ENCRYPTION_KEY',
  ALLOW_LOCAL_CAMERAS: 'ALLOW_LOCAL_CAMERAS',
  MAX_CAMERA_WORKERS: 'MAX_CAMERA_WORKERS',
  MAX_CAMERA_WORKERS_PER_ORG: 'MAX_CAMERA_WORKERS_PER_ORG',
  FACE_SIMILARITY_THRESHOLD: 'FACE_SIMILARITY_THRESHOLD',
  FACE_AMBIGUITY_MARGIN: 'FACE_AMBIGUITY_MARGIN',
  CAMERA_WORKER_START_TIMEOUT_MS: 'CAMERA_WORKER_START_TIMEOUT_MS',
  CAMERA_WORKER_STOP_TIMEOUT_MS: 'CAMERA_WORKER_STOP_TIMEOUT_MS',
} as const;

const DEFAULT_MAX_CONCURRENT_WORKERS = 10;
const DEFAULT_MAX_WORKERS_PER_ORG = 3;
const DEFAULT_PROCESSING_FPS = 3;
const DEFAULT_START_TIMEOUT_MS = 30_000;
const DEFAULT_STOP_TIMEOUT_MS = 10_000;
const DISTRIBUTED_STOP_WAIT_TIMEOUT_MS = 6_000;

const CAMERA_LOCK_TTL_SECONDS = 15;
const CAMERA_LOCK_RENEW_INTERVAL_MS = 4_000;
/** Self-fence worker if Redis lock cannot be verified for 3 consecutive heartbeats */
const MAX_CONSECUTIVE_LOCK_FAILURES = 3;

const HEALTH_PERSIST_INTERVAL_MS = 60_000;
const HEALTH_ERROR_PERSIST_MIN_INTERVAL_MS = 30_000;
const REDIS_ERROR_LOG_THROTTLE_MS = 30_000;

const CAMERA_COMMANDS_CHANNEL = 'camera-commands';
const AES_256_KEY_BYTES = 32;
const PROCESSING_FPS_MIN = 0.5;
const PROCESSING_FPS_MAX = 30;

/**
 * Atomic Lua script: Acquire or re-enter lock with TTL.
 * KEYS[1] = camera lock key
 * ARGV[1] = replicaId
 * ARGV[2] = TTL in seconds
 * Returns 1 if acquired/owned, 0 otherwise.
 */
const LUA_ACQUIRE_LOCK = `
local current = redis.call("GET", KEYS[1])
if not current or current == ARGV[1] then
  redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[2]))
  return 1
end
return 0
`;

/**
 * Atomic Lua script: Renew multiple camera locks in a single network round-trip.
 * KEYS = [lockKey1, lockKey2, ...]
 * ARGV[1] = replicaId
 * ARGV[2] = TTL in seconds
 * Returns array of 1 (renewed) or 0 (lost) matching KEYS order.
 */
const LUA_BATCH_RENEW_LOCKS = `
local owner = ARGV[1]
local ttl = tonumber(ARGV[2])
local results = {}
for i, key in ipairs(KEYS) do
  if redis.call("GET", key) == owner then
    redis.call("EXPIRE", key, ttl)
    results[i] = 1
  else
    results[i] = 0
  end
end
return results
`;

/**
 * Atomic Lua script: Release lock only if owned by this replica.
 */
const LUA_RELEASE_LOCK = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

// ===========================================================================
// 3. PER-CAMERA ASYNC LIFECYCLE SERIALIZER & ABORT COORDINATOR
// ===========================================================================

/**
 * Coordinates per-camera start/stop transitions:
 * - Prevents duplicate concurrent starts (409 Conflict).
 * - Allows a STOP request to immediately abort an in-flight START handshake
 *   and queue cleanly behind it, guaranteeing STOP commands are NEVER dropped.
 */
class CameraLifecycleCoordinator {
  private readonly activeOp = new Map<string, 'START' | 'STOP'>();
  private readonly startAbortControllers = new Map<string, AbortController>();
  private readonly chains = new Map<string, Promise<void>>();

  public isBusy(cameraId: string): boolean {
    return this.activeOp.has(cameraId);
  }

  public getActiveOperation(cameraId: string): 'START' | 'STOP' | undefined {
    return this.activeOp.get(cameraId);
  }

  /**
   * Abort any in-flight start operation for `cameraId` so a pending stop can take over immediately.
   */
  public abortInFlightStart(cameraId: string): void {
    const controller = this.startAbortControllers.get(cameraId);
    if (controller && !controller.signal.aborted) {
      controller.abort(new Error(`Start aborted due to incoming STOP for camera ${cameraId}`));
    }
  }

  public async runStart<T>(
    cameraId: string,
    fn: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (this.activeOp.has(cameraId)) {
      throw new HttpException(
        `Camera worker lifecycle operation (${this.activeOp.get(cameraId)}) already in progress`,
        HttpStatus.CONFLICT,
      );
    }

    const abortController = new AbortController();
    this.activeOp.set(cameraId, 'START');
    this.startAbortControllers.set(cameraId, abortController);

    const prev = this.chains.get(cameraId) ?? Promise.resolve();
    let resolveChain!: () => void;
    const nextChain = new Promise<void>((r) => {
      resolveChain = r;
    });
    this.chains.set(cameraId, nextChain);

    try {
      await prev;
      return await fn(abortController.signal);
    } finally {
      this.startAbortControllers.delete(cameraId);
      if (this.activeOp.get(cameraId) === 'START') {
        this.activeOp.delete(cameraId);
      }
      resolveChain();
      if (this.chains.get(cameraId) === nextChain) {
        this.chains.delete(cameraId);
      }
    }
  }

  /**
   * Preempts any in-flight START and serializes the STOP execution.
   */
  public async runStop(cameraId: string, fn: () => Promise<void>): Promise<void> {
    this.abortInFlightStart(cameraId);
    this.activeOp.set(cameraId, 'STOP');

    const prev = this.chains.get(cameraId) ?? Promise.resolve();
    let resolveChain!: () => void;
    const nextChain = new Promise<void>((r) => {
      resolveChain = r;
    });
    this.chains.set(cameraId, nextChain);

    try {
      await prev.catch(() => {});
      await fn();
    } finally {
      if (this.activeOp.get(cameraId) === 'STOP') {
        this.activeOp.delete(cameraId);
      }
      resolveChain();
      if (this.chains.get(cameraId) === nextChain) {
        this.chains.delete(cameraId);
      }
    }
  }
}

// ===========================================================================
// 4. MAIN SERVICE IMPLEMENTATION
// ===========================================================================

@Injectable()
export class CameraWorkerManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new SecureLogger('info');
  private readonly replicaId = randomUUID();

  /** Active workers owned by this replica: cameraId -> WorkerRecord */
  private readonly workers = new Map<string, WorkerRecord>();

  /** Locks held in Redis during pre-session startup phase so heartbeat renews them too */
  private readonly activeLocks = new Set<string>();

  /** Per-camera lifecycle coordinator (preemptible start / serialized stop) */
  private readonly coordinator = new CameraLifecycleCoordinator();

  /** Waiters for distributed STOP_ACK handshakes: commandId -> resolver */
  private readonly stopAckWaiters = new Map<string, () => void>();

  /** Serialized DB status persistence queue per camera to prevent out-of-order SQL updates */
  private readonly dbStatusChains = new Map<string, Promise<void>>();

  /** cameraId -> epoch ms of the last persisted stream-error write */
  private readonly lastHealthErrorPersist = new Map<string, number>();

  /** organizationId -> Set<cameraId> */
  private readonly orgWorkerCounts = new Map<string, Set<string>>();

  /** Synchronous pre-await capacity reservations */
  private readonly pendingOrgStarts = new Map<string, number>();
  private pendingGlobalStarts = 0;

  private redis: Redis | null = null;
  private pubRedis: Redis | null = null;
  private subRedis: Redis | null = null;

  private heartbeatInterval: NodeJS.Timeout | null = null;
  private healthPersistInterval: NodeJS.Timeout | null = null;
  private renewLocksInFlight = false;
  private persistHealthInFlight = false;
  private isShuttingDown = false;
  private startupAbortController: AbortController | null = null;

  private readonly maxConcurrentWorkers = this.readPositiveIntEnv(
    ENV.MAX_CAMERA_WORKERS,
    DEFAULT_MAX_CONCURRENT_WORKERS,
  );

  private readonly maxWorkersPerOrg = this.readPositiveIntEnv(
    ENV.MAX_CAMERA_WORKERS_PER_ORG,
    DEFAULT_MAX_WORKERS_PER_ORG,
  );

  private readonly startTimeoutMs = this.readPositiveIntEnv(
    ENV.CAMERA_WORKER_START_TIMEOUT_MS,
    DEFAULT_START_TIMEOUT_MS,
  );

  private readonly stopTimeoutMs = this.readPositiveIntEnv(
    ENV.CAMERA_WORKER_STOP_TIMEOUT_MS,
    DEFAULT_STOP_TIMEOUT_MS,
  );

  private credentialVault!: CredentialVault;
  private faceEngine: FaceEngine | null = null;
  private attendanceEngine!: AttendanceDecisionEngine;
  private readonly networkSecurity: NetworkSecurity;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerting: CameraAlertingService,
    private readonly notificationEvents: NotificationEventService,
    private readonly redisPubSub: RedisPubSubService,
  ) {
    const allowLocal =
      process.env[ENV.ALLOW_LOCAL_CAMERAS] === 'true' ||
      process.env[ENV.NODE_ENV] !== 'production';

    this.networkSecurity = new NetworkSecurity({
      allowPrivateIps: allowLocal,
      allowLoopback: allowLocal,
    });
  }

  // =====================================================================
  // LIFECYCLE (Non-Blocking Init & Deterministic Graceful Shutdown)
  // =====================================================================

  async onModuleInit(): Promise<void> {
    this.isShuttingDown = false;
    this.startupAbortController = new AbortController();

    await this.initializeRedis();
    this.initializeCredentialVault();
    await this.initializeFaceEngine();

    this.attendanceEngine = new AttendanceDecisionEngine(
      this.prisma,
      this.redisPubSub,
      this.notificationEvents,
    );

    this.subscribeToTemplateChanges();
    this.startHealthPersistence();

    // Non-blocking background bootstrap so slow RTSP handshakes NEVER block
    // NestJS HTTP server startup or Kubernetes readiness/liveness probes.
    const signal = this.startupAbortController.signal;
    void this.startEnabledCameras(signal).catch((err: unknown) => {
      if (!signal.aborted) {
        this.logger.error('Failed during background camera bootstrap', {
          error: getErrorMessage(err),
        });
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

    // 1. Cancel any background bootstrap in progress
    this.startupAbortController?.abort();
    this.startupAbortController = null;

    // 2. Clear periodic timers
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.healthPersistInterval) {
      clearInterval(this.healthPersistInterval);
      this.healthPersistInterval = null;
    }

    // 3. Release any pending STOP_ACK waiters
    for (const resolve of this.stopAckWaiters.values()) {
      resolve();
    }
    this.stopAckWaiters.clear();

    // 4. Stop all active or starting workers while Redis and DB connections are still alive
    const cameraIds = new Set<string>([
      ...this.workers.keys(),
      ...this.activeLocks.keys(),
    ]);

    if (cameraIds.size > 0) {
      this.logger.info('Stopping camera workers during application shutdown', {
        workerCount: cameraIds.size,
      });

      await Promise.allSettled(
        Array.from(cameraIds).map(async (cameraId) => {
          try {
            await this.stopWorkerInternal(cameraId);
          } catch (err: unknown) {
            this.logger.error('Failed to stop camera worker during shutdown', {
              cameraId,
              error: getErrorMessage(err),
            });
          }
        }),
      );
    }

    // 5. Flush all pending serialized DB status updates before Prisma disconnects
    if (this.dbStatusChains.size > 0) {
      await Promise.allSettled(Array.from(this.dbStatusChains.values()));
      this.dbStatusChains.clear();
    }

    // 6. Gracefully close Redis connections (quit flushes pending DEL lock commands)
    const uniqueClients = new Set(
      [this.subRedis, this.pubRedis, this.redis].filter(
        (c): c is Redis => c !== null,
      ),
    );

    await Promise.allSettled(
      Array.from(uniqueClients).map(async (client) => {
        try {
          client.removeAllListeners();
          await this.withTimeout(client.quit(), 1_500, 'Redis quit timeout');
        } catch {
          try {
            client.disconnect();
          } catch {
            // Ignore already-closed socket
          }
        }
      }),
    );

    this.redis = null;
    this.pubRedis = null;
    this.subRedis = null;
  }

  // =====================================================================
  // REDIS COORDINATION & DISTRIBUTED PUB/SUB HANDSHAKE
  // =====================================================================

  private redisClientOptions(): Record<string, unknown> {
    const isTest =
      process.env.VITEST === 'true' || process.env[ENV.NODE_ENV] === 'test';

    if (isTest) {
      return {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 500,
        retryStrategy: (times: number) => (times >= 3 ? null : 50),
      };
    }

    return {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3_000,
      retryStrategy: (times: number) => Math.min(times * 250, 5_000),
    };
  }

  private createRedisClient(
    RedisCtor: new (url: string, options: Record<string, unknown>) => Redis,
    url: string,
  ): Redis {
    const client = new RedisCtor(url, this.redisClientOptions());
    let lastErrorLogAt = 0;

    client.on('error', (err: unknown) => {
      const now = Date.now();
      if (now - lastErrorLogAt < REDIS_ERROR_LOG_THROTTLE_MS) return;
      lastErrorLogAt = now;
      this.logger.warn('Redis coordination client unavailable', {
        error: getErrorMessage(err),
      });
    });

    return client;
  }

  private async initializeRedis(): Promise<void> {
    try {
      const mod = await import('ioredis');
      const RedisCtor = (mod.default ||
        (mod as unknown as { Redis?: unknown }).Redis ||
        mod) as unknown as new (
        url: string,
        options: Record<string, unknown>,
      ) => Redis;

      const url = process.env[ENV.REDIS_URL] || 'redis://localhost:6379';

      this.redis = this.createRedisClient(RedisCtor, url);
      this.pubRedis = this.redis;
      this.subRedis = this.createRedisClient(RedisCtor, url);

      await this.subRedis
        .subscribe(CAMERA_COMMANDS_CHANNEL)
        .catch((err: unknown) => {
          this.logger.debug('Failed to subscribe to camera-commands', {
            error: getErrorMessage(err),
          });
        });

      this.subRedis.on('message', (channel: string, message: string) => {
        if (channel !== CAMERA_COMMANDS_CHANNEL || this.isShuttingDown) return;
        void this.handleCameraCommand(message);
      });

      this.heartbeatInterval = setInterval(() => {
        void this.renewLocks();
      }, CAMERA_LOCK_RENEW_INTERVAL_MS);
      this.heartbeatInterval.unref?.();
    } catch (err: unknown) {
      this.logger.warn(
        'Redis unavailable, camera distributed coordination disabled',
        { error: getErrorMessage(err) },
      );
    }
  }

  private async handleCameraCommand(rawMessage: string): Promise<void> {
    let payload: DistributedCameraCommand;
    try {
      payload = JSON.parse(rawMessage) as DistributedCameraCommand;
    } catch (err: unknown) {
      this.logger.warn('Ignoring malformed camera-commands payload', {
        error: getErrorMessage(err),
      });
      return;
    }

    if (!payload?.cameraId || payload.sender === this.replicaId) return;

    if (payload.action === 'STOP_ACK' && payload.targetCommandId) {
      const resolver = this.stopAckWaiters.get(payload.targetCommandId);
      if (resolver) {
        this.stopAckWaiters.delete(payload.targetCommandId);
        resolver();
      }
      return;
    }

    if (payload.action === 'STOP') {
      const ownsCamera =
        this.workers.has(payload.cameraId) ||
        this.activeLocks.has(payload.cameraId) ||
        this.coordinator.isBusy(payload.cameraId);

      if (!ownsCamera) return;

      this.logger.info(`Received distributed STOP for camera ${payload.cameraId}`, {
        fromReplica: payload.sender,
      });

      try {
        await this.stopWorkerInternal(payload.cameraId);
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to apply distributed STOP for camera ${payload.cameraId}`,
          { error: getErrorMessage(err) },
        );
      } finally {
        // Notify the requesting replica that teardown & lock release completed
        if (payload.commandId && this.pubRedis && this.isRedisReady()) {
          const ack: DistributedCameraCommand = {
            commandId: randomUUID(),
            action: 'STOP_ACK',
            cameraId: payload.cameraId,
            sender: this.replicaId,
            targetCommandId: payload.commandId,
            timestamp: Date.now(),
          };
          void this.pubRedis
            .publish(CAMERA_COMMANDS_CHANNEL, JSON.stringify(ack))
            .catch(() => {});
        }
      }
    }
  }

  /**
   * Single-flight batched lock renewal with Self-Fencing protection against Split-Brain.
   * Also renews locks for cameras currently in the middle of a slow RTSP startup.
   */
  private async renewLocks(): Promise<void> {
    if (this.renewLocksInFlight || this.isShuttingDown || !this.redis) return;

    const trackedCameraIds = Array.from(
      new Set([...this.workers.keys(), ...this.activeLocks.keys()]),
    );
    if (trackedCameraIds.length === 0) return;

    this.renewLocksInFlight = true;

    try {
      if (!this.isRedisReady()) {
        // Redis connection degraded — increment failure counters and self-fence if exceeded
        await this.handleLockRenewalDegradation(trackedCameraIds);
        return;
      }

      const lockKeys = trackedCameraIds.map((id) => this.cameraLockKey(id));
      const rawResults = (await this.redis.eval(
        LUA_BATCH_RENEW_LOCKS,
        lockKeys.length,
        ...lockKeys,
        this.replicaId,
        CAMERA_LOCK_TTL_SECONDS,
      )) as number[];

      await Promise.allSettled(
        trackedCameraIds.map(async (cameraId, idx) => {
          const renewed = rawResults[idx] === 1;
          const worker = this.workers.get(cameraId);

          if (renewed) {
            if (worker) worker.consecutiveLockFailures = 0;
            return;
          }

          this.logger.warn(
            `Lost distributed lock ownership for camera ${cameraId}; fencing local worker`,
          );
          await this.stopWorkerInternal(cameraId).catch(() => {});
        }),
      );
    } catch (err: unknown) {
      this.logger.warn('Batch lock renewal failed', {
        error: getErrorMessage(err),
      });
      await this.handleLockRenewalDegradation(trackedCameraIds);
    } finally {
      this.renewLocksInFlight = false;
    }
  }

  private async handleLockRenewalDegradation(cameraIds: string[]): Promise<void> {
    await Promise.allSettled(
      cameraIds.map(async (cameraId) => {
        const worker = this.workers.get(cameraId);
        if (!worker) return;

        worker.consecutiveLockFailures += 1;
        if (worker.consecutiveLockFailures >= MAX_CONSECUTIVE_LOCK_FAILURES) {
          this.logger.error(
            `Self-fencing camera ${cameraId} after ${worker.consecutiveLockFailures} failed Redis lock renewals to prevent split-brain`,
          );
          await this.stopWorkerInternal(cameraId).catch(() => {});
        }
      }),
    );
  }

  // =====================================================================
  // DISTRIBUTED CAMERA LOCK
  // =====================================================================

  private cameraLockKey(cameraId: string): string {
    return `camera:${cameraId}:lock`;
  }

  private isRedisReady(): boolean {
    return this.redis !== null && this.redis.status === 'ready';
  }

  private async acquireCameraLock(cameraId: string): Promise<boolean> {
    if (!this.isRedisReady() || !this.redis) {
      if (this.redis) {
        this.logger.warn(
          'Redis not ready — camera worker lock skipped (single-node fallback)',
          { cameraId, status: this.redis.status },
        );
      }
      this.activeLocks.add(cameraId);
      return true;
    }

    try {
      const key = this.cameraLockKey(cameraId);
      const result = await this.redis.eval(
        LUA_ACQUIRE_LOCK,
        1,
        key,
        this.replicaId,
        CAMERA_LOCK_TTL_SECONDS,
      );

      if (result === 1) {
        this.activeLocks.add(cameraId);
        return true;
      }

      const owner = await this.redis.get(key).catch(() => 'unknown');
      this.logger.info(
        `Camera ${cameraId} is already owned by another replica`,
        { owner },
      );
      return false;
    } catch (err: unknown) {
      this.logger.warn(
        'Redis lock acquire failed — proceeding in degraded local mode',
        { cameraId, error: getErrorMessage(err) },
      );
      this.activeLocks.add(cameraId);
      return true;
    }
  }

  private async releaseCameraLock(cameraId: string): Promise<void> {
    this.activeLocks.delete(cameraId);

    const redis = this.redis;
    if (!redis || redis.status !== 'ready') return;

    try {
      await redis.eval(
        LUA_RELEASE_LOCK,
        1,
        this.cameraLockKey(cameraId),
        this.replicaId,
      );
    } catch (err: unknown) {
      this.logger.warn(`Failed to release camera lock for ${cameraId}`, {
        error: getErrorMessage(err),
      });
    }
  }

  // =====================================================================
  // TEMPLATE INVALIDATION
  // =====================================================================

  private subscribeToTemplateChanges(): void {
    if (typeof this.redisPubSub?.subscribe !== 'function') return;

    void this.redisPubSub.subscribe(
      FACE_TEMPLATES_CHANGED_CHANNEL,
      (rawPayload: string) => {
        if (this.isShuttingDown) return;

        try {
          const payload = JSON.parse(rawPayload) as FaceTemplatesChangedPayload;
          if (!payload?.organizationId) return;

          const orgCameraIds = this.orgWorkerCounts.get(payload.organizationId);
          if (!orgCameraIds || orgCameraIds.size === 0) return;

          let invalidated = 0;
          for (const cameraId of orgCameraIds) {
            const worker = this.workers.get(cameraId);
            if (worker) {
              worker.session.invalidateTemplateCache();
              invalidated += 1;
            }
          }

          this.logger.debug(
            'Invalidated camera template caches after enrollment change',
            {
              organizationId: payload.organizationId,
              invalidated,
            },
          );
        } catch (err: unknown) {
          this.logger.warn('Ignoring malformed face-templates-changed payload', {
            error: getErrorMessage(err),
          });
        }
      },
    );
  }

  // =====================================================================
  // STATE-ACCURATE & ORDERED HEALTH PERSISTENCE
  // =====================================================================

  private startHealthPersistence(): void {
    if (this.healthPersistInterval) return;

    this.healthPersistInterval = setInterval(() => {
      void this.persistRunningCameraHealth();
    }, HEALTH_PERSIST_INTERVAL_MS);

    this.healthPersistInterval.unref?.();
  }

  /**
   * Serializes database status writes per camera so a slow `ONLINE` query
   * can NEVER resolve after a subsequent `CONFIGURED` (stop) query.
   */
  private enqueueCameraDbUpdate(
    cameraId: string,
    task: () => Promise<unknown>,
  ): void {
    const prev = this.dbStatusChains.get(cameraId) ?? Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(async () => {
        await task();
      })
      .catch((err: unknown) => {
        this.logger.debug('Failed to persist camera status transition', {
          cameraId,
          error: getErrorMessage(err),
        });
      })
      .finally(() => {
        if (this.dbStatusChains.get(cameraId) === next) {
          this.dbStatusChains.delete(cameraId);
        }
      });

    this.dbStatusChains.set(cameraId, next);
  }

  /**
   * Only persists `ONLINE` and `lastSeenAt` for genuinely `RUNNING` workers.
   * `DEGRADED` cameras are NEVER overwritten back to `ONLINE`!
   */
  private async persistRunningCameraHealth(): Promise<void> {
    if (this.persistHealthInFlight || this.isShuttingDown) return;

    const runningWorkers = Array.from(this.workers.values()).filter(
      (worker) => worker.state === 'RUNNING',
    );
    if (runningWorkers.length === 0) return;

    this.persistHealthInFlight = true;

    try {
      const byOrg = new Map<string, string[]>();
      for (const worker of runningWorkers) {
        // Double-check the worker hasn't entered a stop/error transition
        if (this.coordinator.getActiveOperation(worker.cameraId) === 'STOP') {
          continue;
        }
        const ids = byOrg.get(worker.organizationId) ?? [];
        ids.push(worker.cameraId);
        byOrg.set(worker.organizationId, ids);
      }

      const now = new Date();
      await Promise.all(
        Array.from(byOrg.entries()).map(([organizationId, cameraIds]) =>
          this.prisma.camera.updateMany({
            where: { id: { in: cameraIds }, organizationId },
            data: { status: 'ONLINE', lastSeenAt: now },
          }),
        ),
      );
    } catch (err: unknown) {
      this.logger.debug('Failed to persist camera health heartbeat', {
        error: getErrorMessage(err),
      });
    } finally {
      this.persistHealthInFlight = false;
    }
  }

  private persistCameraOnline(organizationId: string, cameraId: string): void {
    const now = new Date();
    this.enqueueCameraDbUpdate(cameraId, () =>
      this.prisma.camera.updateMany({
        where: { id: cameraId, organizationId },
        data: { status: 'ONLINE', lastSeenAt: now },
      }),
    );
  }

  private persistCameraError(
    organizationId: string,
    cameraId: string,
    error: string,
    errorCode: string = 'STREAM_ERROR',
  ): void {
    const nowMs = Date.now();
    const last = this.lastHealthErrorPersist.get(cameraId) ?? 0;
    if (nowMs - last < HEALTH_ERROR_PERSIST_MIN_INTERVAL_MS) return;

    this.lastHealthErrorPersist.set(cameraId, nowMs);
    const now = new Date(nowMs);
    const safeErrorMessage = error.slice(0, 500);

    this.enqueueCameraDbUpdate(cameraId, () =>
      this.prisma.camera.updateMany({
        where: { id: cameraId, organizationId },
        data: {
          status: 'ERROR',
          lastErrorAt: now,
          lastErrorCode: errorCode,
          lastErrorMessage: safeErrorMessage,
          reconnectCount: { increment: 1 },
        },
      }),
    );
  }

  private persistCameraStopped(organizationId: string, cameraId: string): void {
    this.lastHealthErrorPersist.delete(cameraId);

    this.enqueueCameraDbUpdate(cameraId, () =>
      this.prisma.camera.updateMany({
        where: {
          id: cameraId,
          organizationId,
          status: { in: ['ONLINE', 'ERROR', 'CONNECTING'] },
        },
        data: { status: 'CONFIGURED' },
      }),
    );
  }

  // =====================================================================
  // INITIALIZATION HELPERS
  // =====================================================================

  private initializeCredentialVault(): void {
    const encryptionKey =
      process.env[ENV.BIOMETRIC_ENCRYPTION_KEY] ||
      process.env[ENV.CAMERA_ENCRYPTION_KEY];

    if (!encryptionKey) {
      throw new Error(
        `${ENV.BIOMETRIC_ENCRYPTION_KEY} or ${ENV.CAMERA_ENCRYPTION_KEY} must be configured`,
      );
    }

    const byteLength = Buffer.byteLength(encryptionKey, 'utf8');
    if (byteLength < AES_256_KEY_BYTES) {
      throw new Error(
        `${ENV.BIOMETRIC_ENCRYPTION_KEY} / ${ENV.CAMERA_ENCRYPTION_KEY} must be at least ` +
          `${AES_256_KEY_BYTES} bytes (UTF-8); got ${byteLength}`,
      );
    }

    this.credentialVault = new CredentialVault(encryptionKey);
  }

  private async initializeFaceEngine(): Promise<void> {
    try {
      const { getSharedFaceEngine } = await import(
        '../face/face-engine.factory.js'
      );
      this.faceEngine = await getSharedFaceEngine();
      this.logger.info(
        'Face engine initialized via shared factory for camera workers',
      );
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      this.logger.error('Face engine initialization failed: ' + message, {
        error: message,
      });

      if (process.env[ENV.NODE_ENV] === 'production') {
        throw new Error(
          `Face engine initialization failed in production: ${message}`,
        );
      }

      this.logger.warn('Face engine initialization failed in development', {
        error: message,
      });
    }
  }

  /**
   * Cluster-Aware Bootstrap:
   * Iterates over all enabled cameras for each tenant instead of slicing the
   * first `maxWorkersPerOrg` rows blindly — if cameras 1..3 are already locked by
   * Replica A, Replica B seamlessly skips them and picks up cameras 4..6!
   */
  private async startEnabledCameras(signal: AbortSignal): Promise<void> {
    if (!this.faceEngine) {
      this.logger.warn(
        'Skipping automatic camera startup because FaceEngine is unavailable',
      );
      return;
    }

    const cameras = await this.prisma.camera.findMany({
      where: { enabled: true, recognitionEnabled: true },
      select: { id: true, organizationId: true },
      orderBy: { id: 'asc' },
    });

    if (cameras.length === 0 || signal.aborted) {
      this.logger.info('No enabled recognition cameras found');
      return;
    }

    const byOrg = new Map<string, string[]>();
    for (const camera of cameras) {
      const ids = byOrg.get(camera.organizationId) ?? [];
      ids.push(camera.id);
      byOrg.set(camera.organizationId, ids);
    }

    for (const [organizationId, cameraIds] of byOrg.entries()) {
      if (signal.aborted || this.isShuttingDown) break;
      if (this.getEffectiveGlobalCount() >= this.maxConcurrentWorkers) break;

      for (const cameraId of cameraIds) {
        if (signal.aborted || this.isShuttingDown) break;
        if (this.getEffectiveGlobalCount() >= this.maxConcurrentWorkers) break;
        if (this.getEffectiveOrgCount(organizationId) >= this.maxWorkersPerOrg) {
          break;
        }

        try {
          await this.startWorkerInternal(organizationId, cameraId, {
            ignorePeerOwnedConflict: true,
          });
        } catch (err: unknown) {
          this.logger.error('Failed to start configured camera worker', {
            cameraId,
            organizationId,
            error: getErrorMessage(err),
          });
        }
      }
    }
  }

  // =====================================================================
  // START WORKER
  // =====================================================================

  public async startWorker(
    organizationId: string,
    cameraId: string,
  ): Promise<void> {
    await this.startWorkerInternal(organizationId, cameraId, {
      ignorePeerOwnedConflict: false,
    });
  }

  private async startWorkerInternal(
    organizationId: string,
    cameraId: string,
    options: { ignorePeerOwnedConflict: boolean },
  ): Promise<void> {
    this.assertNonEmptyIdentifier(organizationId, 'organizationId');
    this.assertNonEmptyIdentifier(cameraId, 'cameraId');

    if (this.isShuttingDown) {
      throw new HttpException(
        'Service is shutting down',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!this.faceEngine) {
      throw new HttpException(
        'Face recognition engine is not initialized',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (this.workers.has(cameraId)) return;

    await this.coordinator.runStart(cameraId, async (abortSignal) => {
      if (this.workers.has(cameraId) || abortSignal.aborted || this.isShuttingDown) {
        return;
      }

      let started = false;
      let lockHeld = false;
      let capacityReserved = false;

      try {
        // 1. Reserve capacity synchronously before first await
        this.reserveWorkerCapacity(organizationId);
        capacityReserved = true;

        // 2. Verify ownership & configuration BEFORE acquiring distributed lock
        const camera = await this.findOwnedCamera(organizationId, cameraId);
        this.validateCameraCanStart(camera);
        this.throwIfAborted(abortSignal);

        // 3. Acquire distributed lock (also registers in `activeLocks` so heartbeat renews it during slow RTSP connect)
        lockHeld = await this.acquireCameraLock(cameraId);
        if (!lockHeld) {
          if (options.ignorePeerOwnedConflict) return;
          throw new HttpException(
            'Camera worker is already running on another cluster replica',
            HttpStatus.CONFLICT,
          );
        }

        this.throwIfAborted(abortSignal);

        const credentials = await this.decryptCredentials(camera);
        const streamUri = await this.buildStreamUri(camera, credentials);
        this.throwIfAborted(abortSignal);

        const config = this.buildWorkerConfig(camera, streamUri);
        const session = new CameraWorkerSession(
          config,
          this.faceEngine!,
          this.attendanceEngine,
          this.prisma,
          this.credentialVault.encryption,
        );

        const generationId = randomUUID();

        // 4. Attach listeners BEFORE session.start() with generation-token guards
        // so early events are captured and post-stop zombie events are ignored.
        const onOffline = (evt: {
          cameraId: string;
          organizationId: string;
          error: string;
          errorCode?: string;
        }) => {
          const current = this.workers.get(camera.id);
          if (
            !current ||
            current.generationId !== generationId ||
            current.state === 'STOPPING'
          ) {
            return;
          }

          current.state = 'DEGRADED';
          this.persistCameraError(
            current.organizationId,
            evt.cameraId,
            evt.error,
            evt.errorCode ?? 'STREAM_ERROR',
          );
          void this.alerting.sendOfflineAlert({
            cameraId: evt.cameraId,
            organizationId: evt.organizationId,
            error: evt.error,
            cameraName: current.cameraName,
          });
        };

        const onRecovered = () => {
          const current = this.workers.get(camera.id);
          if (
            !current ||
            current.generationId !== generationId ||
            current.state === 'STOPPING'
          ) {
            return;
          }

          current.state = 'RUNNING';
          current.lastFrameOrRecoveryAt = new Date();
          this.persistCameraOnline(current.organizationId, current.cameraId);
          void this.alerting.sendRecoveredAlert({
            cameraId: current.cameraId,
            organizationId: current.organizationId,
          });
        };

        session.on('camera-offline', onOffline);
        session.on('camera-recovered', onRecovered);

        const cleanupListeners = () => {
          if (typeof session.off === 'function') {
            session.off('camera-offline', onOffline);
            session.off('camera-recovered', onRecovered);
          } else if (typeof session.removeAllListeners === 'function') {
            session.removeAllListeners('camera-offline');
            session.removeAllListeners('camera-recovered');
          }
        };

        const now = new Date();
        const worker: WorkerRecord = {
          cameraId: camera.id,
          organizationId: camera.organizationId,
          cameraName: camera.name,
          generationId,
          state: 'STARTING',
          session,
          startedAt: now,
          lastFrameOrRecoveryAt: now,
          consecutiveLockFailures: 0,
          cleanupListeners,
        };

        this.workers.set(camera.id, worker);
        this.addOrgWorker(camera.organizationId, camera.id);

        if (capacityReserved) {
          this.releaseWorkerCapacity(camera.organizationId);
          capacityReserved = false;
        }

        try {
          worker.state = 'CONNECTING';

          await this.withTimeoutAndAbort(
            session.start(),
            this.startTimeoutMs,
            abortSignal,
            `session.start() timed out after ${this.startTimeoutMs}ms`,
          );

          started = true;
          worker.state = 'RUNNING';
          worker.lastFrameOrRecoveryAt = new Date();
          this.persistCameraOnline(camera.organizationId, camera.id);

          this.logger.info('Camera worker started successfully', {
            cameraId: camera.id,
            organizationId: camera.organizationId,
            name: camera.name,
          });
        } catch (err: unknown) {
          worker.state = 'ERROR';
          this.logger.error('Camera worker failed during startup', {
            cameraId: camera.id,
            organizationId: camera.organizationId,
            error: getErrorMessage(err),
          });

          await this.cleanupFailedWorker(camera.id, worker);
          throw err;
        }
      } finally {
        if (capacityReserved) {
          this.releaseWorkerCapacity(organizationId);
        }
        if (!started && lockHeld) {
          await this.releaseCameraLock(cameraId);
        }
      }
    });
  }

  // =====================================================================
  // STOP WORKER (Preemptible & Cluster-Synchronized)
  // =====================================================================

  public async stopWorker(
    organizationId: string,
    cameraId: string,
    localOnly = false,
  ): Promise<void> {
    this.assertNonEmptyIdentifier(organizationId, 'organizationId');
    this.assertNonEmptyIdentifier(cameraId, 'cameraId');

    await this.assertCameraOwnership(organizationId, cameraId);

    const isOwnedLocally =
      this.workers.has(cameraId) ||
      this.activeLocks.has(cameraId) ||
      this.coordinator.isBusy(cameraId);

    let ackPromise: Promise<void> | null = null;

    if (!localOnly && this.pubRedis && this.isRedisReady()) {
      const commandId = randomUUID();

      // If the worker is running on a peer replica, prepare an ACK waiter
      // so stopWorker/restartWorker waits until the peer actually releases the lock!
      if (!isOwnedLocally) {
        ackPromise = this.waitForPeerStopAndLockRelease(cameraId, commandId);
      }

      const cmd: DistributedCameraCommand = {
        commandId,
        action: 'STOP',
        cameraId,
        organizationId,
        sender: this.replicaId,
        timestamp: Date.now(),
      };

      try {
        await this.pubRedis.publish(
          CAMERA_COMMANDS_CHANNEL,
          JSON.stringify(cmd),
        );
      } catch (err: unknown) {
        this.stopAckWaiters.delete(commandId);
        ackPromise = null;
        this.logger.warn('Failed to broadcast distributed STOP', {
          cameraId,
          error: getErrorMessage(err),
        });
      }
    }

    await this.stopWorkerInternal(cameraId);

    if (ackPromise) {
      await ackPromise;
    }
  }

  private async waitForPeerStopAndLockRelease(
    cameraId: string,
    commandId: string,
  ): Promise<void> {
    if (!this.redis || !this.isRedisReady()) return;

    const lockKey = this.cameraLockKey(cameraId);
    const currentOwner = await this.redis.get(lockKey).catch(() => null);
    if (!currentOwner || currentOwner === this.replicaId) {
      this.stopAckWaiters.delete(commandId);
      return;
    }

    await new Promise<void>((resolve) => {
      const deadline = Date.now() + DISTRIBUTED_STOP_WAIT_TIMEOUT_MS;

      const finish = () => {
        this.stopAckWaiters.delete(commandId);
        clearInterval(pollTimer);
        clearTimeout(timeoutTimer);
        resolve();
      };

      this.stopAckWaiters.set(commandId, finish);

      const pollTimer = setInterval(async () => {
        if (!this.redis || Date.now() >= deadline) {
          finish();
          return;
        }
        const owner = await this.redis.get(lockKey).catch(() => null);
        if (!owner) finish();
      }, 150);
      pollTimer.unref?.();

      const timeoutTimer = setTimeout(finish, DISTRIBUTED_STOP_WAIT_TIMEOUT_MS);
      timeoutTimer.unref?.();
    });
  }

  private async stopWorkerInternal(cameraId: string): Promise<void> {
    await this.coordinator.runStop(cameraId, async () => {
      const worker = this.workers.get(cameraId);
      if (!worker) {
        if (this.activeLocks.has(cameraId)) {
          await this.releaseCameraLock(cameraId);
        }
        return;
      }

      worker.state = 'STOPPING';
      worker.cleanupListeners();

      try {
        await this.withTimeout(
          worker.session.stop(),
          this.stopTimeoutMs,
          `session.stop() timed out after ${this.stopTimeoutMs}ms`,
        );
      } catch (err: unknown) {
        worker.state = 'ERROR';
        this.logger.error('Camera worker session failed to stop cleanly', {
          cameraId,
          organizationId: worker.organizationId,
          error: getErrorMessage(err),
        });
        throw err;
      } finally {
        this.workers.delete(cameraId);
        this.removeOrgWorker(worker.organizationId, cameraId);
        this.persistCameraStopped(worker.organizationId, cameraId);
        await this.releaseCameraLock(cameraId);
      }

      this.logger.info('Camera worker stopped', {
        cameraId,
        organizationId: worker.organizationId,
      });
    });
  }

  // =====================================================================
  // RESTART (Cluster-Safe)
  // =====================================================================

  public async restartWorker(organizationId: string, cameraId: string) {
    this.assertNonEmptyIdentifier(organizationId, 'organizationId');
    this.assertNonEmptyIdentifier(cameraId, 'cameraId');

    await this.assertCameraOwnership(organizationId, cameraId);

    // `stopWorker` now waits for both local teardown AND peer STOP_ACK / lock release!
    await this.stopWorker(organizationId, cameraId, false);
    await this.startWorker(organizationId, cameraId);

    return this.getWorkerStatus(organizationId, cameraId);
  }

  // =====================================================================
  // STATUS & INTROSPECTION
  // =====================================================================

  public async getWorkerStatus(organizationId: string, cameraId: string) {
    this.assertNonEmptyIdentifier(organizationId, 'organizationId');
    this.assertNonEmptyIdentifier(cameraId, 'cameraId');

    await this.assertCameraOwnership(organizationId, cameraId);

    const worker = this.workers.get(cameraId);

    if (!worker) {
      const remoteOwner =
        this.isRedisReady() && this.redis
          ? await this.redis.get(this.cameraLockKey(cameraId)).catch(() => null)
          : null;

      const isPeerRunning =
        Boolean(remoteOwner) && remoteOwner !== this.replicaId;

      return {
        cameraId,
        state: isPeerRunning ? ('RUNNING' as WorkerState) : null,
        health: null,
        running: isPeerRunning,
        ownedByThisReplica: false,
        remoteOwnerReplicaId: isPeerRunning ? remoteOwner : null,
      };
    }

    return {
      cameraId,
      state: worker.state,
      health: worker.session.getHealth(),
      running:
        worker.state === 'RUNNING' ||
        worker.state === 'CONNECTING' ||
        worker.state === 'DEGRADED',
      startedAt: worker.startedAt,
      ownedByThisReplica: true,
      remoteOwnerReplicaId: null,
    };
  }

  public getWorkerState(cameraId: string): WorkerState | null {
    return this.workers.get(cameraId)?.state ?? null;
  }

  public getWorkerHealth(cameraId: string) {
    return this.workers.get(cameraId)?.session.getHealth() ?? null;
  }

  public getAllWorkersStatus() {
    return Array.from(this.workers.values()).map((worker) => ({
      cameraId: worker.cameraId,
      organizationId: worker.organizationId,
      state: worker.state,
      health: worker.session.getHealth(),
      startedAt: worker.startedAt,
    }));
  }

  public async getOrganizationWorkersStatus(organizationId: string) {
    this.assertNonEmptyIdentifier(organizationId, 'organizationId');

    const cameraIds =
      this.orgWorkerCounts.get(organizationId) ?? new Set<string>();

    return Array.from(cameraIds)
      .map((cameraId) => {
        const worker = this.workers.get(cameraId);
        if (!worker) return null;

        return {
          cameraId: worker.cameraId,
          organizationId: worker.organizationId,
          state: worker.state,
          health: worker.session.getHealth(),
          startedAt: worker.startedAt,
        };
      })
      .filter(
        (worker): worker is NonNullable<typeof worker> => worker !== null,
      );
  }

  // =====================================================================
  // CAPACITY RESERVATION
  // =====================================================================

  private getEffectiveOrgCount(organizationId: string): number {
    const active = this.orgWorkerCounts.get(organizationId)?.size ?? 0;
    const pending = this.pendingOrgStarts.get(organizationId) ?? 0;
    return active + pending;
  }

  private getEffectiveGlobalCount(): number {
    return this.workers.size + this.pendingGlobalStarts;
  }

  private reserveWorkerCapacity(organizationId: string): void {
    if (this.getEffectiveOrgCount(organizationId) >= this.maxWorkersPerOrg) {
      throw new HttpException(
        `Maximum concurrent camera workers (${this.maxWorkersPerOrg}) reached for this organization`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.getEffectiveGlobalCount() >= this.maxConcurrentWorkers) {
      throw new HttpException(
        `Maximum concurrent camera workers (${this.maxConcurrentWorkers}) reached globally`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.pendingOrgStarts.set(
      organizationId,
      (this.pendingOrgStarts.get(organizationId) ?? 0) + 1,
    );
    this.pendingGlobalStarts += 1;
  }

  private releaseWorkerCapacity(organizationId: string): void {
    const pending = this.pendingOrgStarts.get(organizationId) ?? 0;
    if (pending > 1) {
      this.pendingOrgStarts.set(organizationId, pending - 1);
    } else {
      this.pendingOrgStarts.delete(organizationId);
    }

    if (this.pendingGlobalStarts > 0) {
      this.pendingGlobalStarts -= 1;
    }
  }

  // =====================================================================
  // CAMERA LOOKUP / VALIDATION / CREDENTIALS
  // =====================================================================

  private async findOwnedCamera(
    organizationId: string,
    cameraId: string,
  ): Promise<CameraStartProjection> {
    const camera = await this.prisma.camera.findFirst({
      where: { id: cameraId, organizationId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        host: true,
        port: true,
        protocol: true,
        streamPath: true,
        metadata: true,
        rtspTransport: true,
        encryptedCredentials: true,
        processingFps: true,
        location: true,
        credentialConfigured: true,
        enabled: true,
        recognitionEnabled: true,
        attendanceEnabled: true,
      },
    });

    if (!camera) throw new NotFoundException('Camera not found');
    return camera;
  }

  private async assertCameraOwnership(
    organizationId: string,
    cameraId: string,
  ): Promise<void> {
    const camera = await this.prisma.camera.findFirst({
      where: { id: cameraId, organizationId },
      select: { id: true },
    });

    if (!camera) throw new NotFoundException('Camera not found');
  }

  private validateCameraCanStart(
    camera: Pick<
      Camera,
      'enabled' | 'recognitionEnabled' | 'attendanceEnabled' | 'host' | 'protocol'
    >,
  ): void {
    if (!camera.enabled) {
      throw new BadRequestException('Camera is disabled');
    }
    if (!camera.recognitionEnabled) {
      throw new BadRequestException('Recognition is disabled for this camera');
    }
    if (!camera.host?.trim()) {
      throw new BadRequestException('Camera host is not configured');
    }
    if (!camera.protocol) {
      throw new BadRequestException('Camera protocol is not configured');
    }
  }

  private async decryptCredentials(
    camera: Pick<Camera, 'credentialConfigured' | 'encryptedCredentials'>,
  ): Promise<VaultCredentials> {
    if (!camera.credentialConfigured || !camera.encryptedCredentials) {
      return {};
    }

    try {
      return await this.credentialVault.decrypt(camera.encryptedCredentials);
    } catch (err: unknown) {
      this.logger.error('Failed to decrypt camera credentials', {
        error: getErrorMessage(err),
      });
      throw new BadRequestException('Camera credentials could not be decrypted');
    }
  }

  // =====================================================================
  // WORKER CONFIG & STRICT RFC-3986 RTSP URI BUILDER
  // =====================================================================

  private buildWorkerConfig(
    camera: Pick<
      Camera,
      | 'id'
      | 'organizationId'
      | 'name'
      | 'processingFps'
      | 'rtspTransport'
      | 'location'
      | 'recognitionEnabled'
      | 'attendanceEnabled'
    >,
    streamUri: string,
  ): CameraWorkerConfig {
    return {
      cameraId: camera.id,
      organizationId: camera.organizationId,
      name: camera.name,
      streamUri,
      processingFps: this.normalizeProcessingFps(camera.processingFps),
      rtspTransport: camera.rtspTransport === 'udp' ? 'udp' : 'tcp',
      location: camera.location?.trim() || null,
      recognitionEnabled: camera.recognitionEnabled,
      attendanceEnabled: camera.attendanceEnabled,
      similarityThreshold: this.readNumberEnv(
        ENV.FACE_SIMILARITY_THRESHOLD,
        DEFAULT_SIMILARITY_THRESHOLD,
        0,
        1,
      ),
      minAmbiguityMargin: this.readNumberEnv(
        ENV.FACE_AMBIGUITY_MARGIN,
        DEFAULT_AMBIGUITY_MARGIN,
        0,
        1,
      ),
    };
  }

  private normalizeProcessingFps(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_PROCESSING_FPS;
    }
    return Math.min(Math.max(parsed, PROCESSING_FPS_MIN), PROCESSING_FPS_MAX);
  }

  private async buildStreamUri(
    camera: Pick<
      Camera,
      'host' | 'port' | 'protocol' | 'streamPath' | 'metadata'
    >,
    credentials: VaultCredentials,
  ): Promise<string> {
    if (camera.protocol !== 'RTSP' && camera.protocol !== 'ONVIF') {
      throw new BadRequestException(
        `Unsupported camera protocol: ${camera.protocol}`,
      );
    }

    const rawHost = camera.host?.trim();
    if (!rawHost) {
      throw new BadRequestException('Camera host is missing');
    }

    const host = await this.resolveStreamHost(rawHost, camera.metadata);
    const hostInUri =
      host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;

    const port = camera.port ?? (camera.protocol === 'ONVIF' ? 80 : 554);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new BadRequestException('Invalid camera port');
    }

    const path = this.normalizeStreamPath(camera.streamPath);
    const username = this.encodeRfc3986UserInfo(credentials.username);
    const password = this.encodeRfc3986UserInfo(credentials.password);

    const auth =
      username && password
        ? `${username}:${password}@`
        : username
          ? `${username}@`
          : '';

    return `rtsp://${auth}${hostInUri}:${port}${path}`;
  }

  private readAddressPin(
    metadata: unknown,
  ): { validatedIp: string; validatedHost: string } | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    const record = metadata as Record<string, unknown>;
    const validatedIp =
      typeof record.validatedIp === 'string' ? record.validatedIp.trim() : '';

    if (!validatedIp) return null;

    return {
      validatedIp,
      validatedHost:
        typeof record.validatedHost === 'string'
          ? record.validatedHost.trim()
          : '',
    };
  }

  private async resolveStreamHost(
    rawHost: string,
    metadata: unknown,
  ): Promise<string> {
    const pin = this.readAddressPin(metadata);

    if (pin && (pin.validatedHost === '' || pin.validatedHost === rawHost)) {
      try {
        return this.networkSecurity.validateIp(pin.validatedIp);
      } catch (err: unknown) {
        this.logger.warn(
          'Pinned camera destination failed re-validation; falling back to resolving the host',
          { host: rawHost, error: getErrorMessage(err) },
        );
      }
    }

    return this.networkSecurity.validateHost(rawHost);
  }

  private normalizeStreamPath(streamPath: string | null): string {
    if (!streamPath?.trim()) return '/';

    const normalized = streamPath.trim();
    if (/[\r\n\x00-\x1F\x7F\s]/.test(normalized)) {
      throw new BadRequestException(
        'Stream path contains invalid control or whitespace characters',
      );
    }

    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  /**
   * Strict RFC-3986 userinfo encoding (escapes `!`, `'`, `(`, `)`, `*` which
   * standard `encodeURIComponent` leaves unescaped and which break FFmpeg RTSP auth).
   */
  private encodeRfc3986UserInfo(value: string | undefined): string {
    if (!value) return '';
    return encodeURIComponent(value).replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  // =====================================================================
  // WORKER REGISTRY & CLEANUP
  // =====================================================================

  private addOrgWorker(organizationId: string, cameraId: string): void {
    const workers =
      this.orgWorkerCounts.get(organizationId) ?? new Set<string>();
    workers.add(cameraId);
    this.orgWorkerCounts.set(organizationId, workers);
  }

  private removeOrgWorker(organizationId: string, cameraId: string): void {
    const workers = this.orgWorkerCounts.get(organizationId);
    if (!workers) return;

    workers.delete(cameraId);
    if (workers.size === 0) this.orgWorkerCounts.delete(organizationId);
  }

  private async cleanupFailedWorker(
    cameraId: string,
    worker: WorkerRecord,
  ): Promise<void> {
    worker.cleanupListeners();

    try {
      await this.withTimeout(
        worker.session.stop(),
        this.stopTimeoutMs,
        `Cleanup session.stop() timed out after ${this.stopTimeoutMs}ms`,
      );
    } catch (err: unknown) {
      this.logger.error(
        'Failed to cleanup camera worker after startup failure',
        {
          cameraId,
          organizationId: worker.organizationId,
          error: getErrorMessage(err),
        },
      );
    } finally {
      this.workers.delete(cameraId);
      this.removeOrgWorker(worker.organizationId, cameraId);
    }
  }

  // =====================================================================
  // UTILITIES & CANCELLABLE TIMERS
  // =====================================================================

  private readPositiveIntEnv(name: string, fallback: number): number {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;

    const value = Number.parseInt(raw, 10);
    if (!Number.isInteger(value) || value <= 0) {
      this.logger.warn(
        'Invalid positive integer environment value; using default',
        { variable: name, fallback, raw },
      );
      return fallback;
    }

    return value;
  }

  private readNumberEnv(
    name: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const raw = process.env[name];
    if (!raw) return fallback;

    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
      return fallback;
    }

    return value;
  }

  private assertNonEmptyIdentifier(value: string, name: string): void {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${name} is required`);
    }
  }

  private throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new HttpException(
        'Camera start operation was cancelled by an incoming stop request',
        HttpStatus.CONFLICT,
      );
    }
  }

  private withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    message: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      timer.unref?.();

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  private withTimeoutAndAbort<T>(
    promise: Promise<T>,
    ms: number,
    signal: AbortSignal,
    timeoutMessage: string,
  ): Promise<T> {
    if (signal.aborted) {
      return Promise.reject(
        new HttpException(
          'Operation aborted before completion',
          HttpStatus.CONFLICT,
        ),
      );
    }

    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        reject(
          new HttpException(
            'Camera start preempted by stop request',
            HttpStatus.CONFLICT,
          ),
        );
      };

      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        reject(new Error(timeoutMessage));
      }, ms);
      timer.unref?.();

      signal.addEventListener('abort', onAbort, { once: true });

      promise.then(
        (value) => {
          clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          reject(err);
        },
      );
    });
  }
}