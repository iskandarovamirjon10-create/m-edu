import type Redis from 'ioredis';
import { randomUUID } from 'crypto';
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

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

type WorkerState =
  | 'STARTING'
  | 'CONNECTING'
  | 'RUNNING'
  | 'DEGRADED'
  | 'ERROR'
  | 'STOPPING'
  | 'DISABLED';

interface WorkerRecord {
  cameraId: string;
  organizationId: string;
  /** Cached camera name for alerts — never re-read after startup. */
  cameraName: string;
  state: WorkerState;
  session: CameraWorkerSession;
  startedAt: Date;
}

interface CameraWorkerConfig {
  cameraId: string;
  organizationId: string;
  name: string;
  streamUri: string;
  processingFps: number;
  rtspTransport: 'tcp' | 'udp';
  location: string | null;
  recognitionEnabled: boolean;
  attendanceEnabled: boolean;
  similarityThreshold: number;
  minAmbiguityMargin?: number;
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const ENV = {
  NODE_ENV: 'NODE_ENV',
  REDIS_URL: 'REDIS_URL',
  BIOMETRIC_ENCRYPTION_KEY: 'BIOMETRIC_ENCRYPTION_KEY',
  CAMERA_ENCRYPTION_KEY: 'CAMERA_ENCRYPTION_KEY',
  ALLOW_LOCAL_CAMERAS: 'ALLOW_LOCAL_CAMERAS',
  MAX_CAMERA_WORKERS: 'MAX_CAMERA_WORKERS',
  MAX_CAMERA_WORKERS_PER_ORG: 'MAX_CAMERA_WORKERS_PER_ORG',
  // Shared with FaceService so both pipelines are calibrated with the SAME
  // knobs (previously camera workers used compile-time constants).
  FACE_SIMILARITY_THRESHOLD: 'FACE_SIMILARITY_THRESHOLD',
  FACE_AMBIGUITY_MARGIN: 'FACE_AMBIGUITY_MARGIN',
  // Bound on session.start() so a hung RTSP handshake can never hold a Redis
  // lock or the in-process lifecycle lock forever.
  CAMERA_WORKER_START_TIMEOUT_MS: 'CAMERA_WORKER_START_TIMEOUT_MS',
} as const;

const DEFAULT_MAX_CONCURRENT_WORKERS = 10;
const DEFAULT_MAX_WORKERS_PER_ORG = 3;
const DEFAULT_PROCESSING_FPS = 3;
const DEFAULT_START_TIMEOUT_MS = 30_000;

const CAMERA_LOCK_TTL_SECONDS = 10;
const CAMERA_LOCK_RENEW_INTERVAL_MS = 5_000;
const HEALTH_PERSIST_INTERVAL_MS = 60_000;
const HEALTH_ERROR_PERSIST_MIN_INTERVAL_MS = 30_000;
const REDIS_ERROR_LOG_THROTTLE_MS = 30_000;

const CAMERA_COMMANDS_CHANNEL = 'camera-commands';
const AES_256_KEY_BYTES = 32;

const PROCESSING_FPS_MIN = 0.5;
const PROCESSING_FPS_MAX = 30;

// ===========================================================================
// SERVICE
// ===========================================================================

@Injectable()
export class CameraWorkerManagerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new SecureLogger('info');

  private readonly workers = new Map<string, WorkerRecord>();

  /**
   * Cameras currently being started/stopped. Prevents two concurrent
   * startWorker(A) calls from creating two sessions.
   */
  private readonly lifecycleLocks = new Set<string>();

  private redis: Redis | null = null;
  private pubRedis: Redis | null = null;
  private subRedis: Redis | null = null;
  private readonly replicaId = randomUUID();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private healthPersistInterval: NodeJS.Timeout | null = null;

  /** cameraId -> epoch ms of the last persisted stream-error write. */
  private readonly lastHealthErrorPersist = new Map<string, number>();

  /** organizationId -> cameraIds (tenant fairness + O(1) removal). */
  private readonly orgWorkerCounts = new Map<string, Set<string>>();

  /**
   * Starts that have RESERVED a capacity slot but have not yet registered a
   * WorkerRecord.
   *
   * Capacity used to be read from `orgWorkerCounts` / `workers` after one or
   * more `await`s, so N concurrent `startWorker` calls for the same tenant all
   * observed `orgCount = max - 1` and all proceeded — the per-org cap was
   * advisory under load. Reserving synchronously (before the first await) and
   * releasing the moment the real record lands makes the cap exact.
   */
  private readonly pendingOrgStarts = new Map<string, number>();
  private pendingGlobalStarts = 0;

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

  private credentialVault!: CredentialVault;
  private faceEngine!: FaceEngine;
  private attendanceEngine!: AttendanceDecisionEngine;
  private networkSecurity!: NetworkSecurity;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerting: CameraAlertingService,
    private readonly notificationEvents: NotificationEventService,
    private readonly redisPubSub: RedisPubSubService,
  ) {
    // Loopback and private IPs are unlocked by the SAME flag — previously
    // `allowPrivateIps` was on in dev but `allowLoopback` was off, which made
    // `127.0.0.1` cameras unreachable while `192.168.x.x` ones worked.
    const allowLocal =
      process.env[ENV.ALLOW_LOCAL_CAMERAS] === 'true' ||
      process.env[ENV.NODE_ENV] !== 'production';

    this.networkSecurity = new NetworkSecurity({
      allowPrivateIps: allowLocal,
      allowLoopback: allowLocal,
    });
  }

  // =====================================================================
  // LIFECYCLE
  // =====================================================================

  async onModuleInit(): Promise<void> {
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

    await this.startEnabledCameras();
  }

  /**
   * Shutdown order matters: clear timers → stop workers (releases Redis
   * locks while the connection is still alive) → close Redis. The previous
   * order closed Redis first, so every `releaseCameraLock` was a no-op and
   * the lock lingered for its full TTL after a clean shutdown.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.healthPersistInterval) {
      clearInterval(this.healthPersistInterval);
      this.healthPersistInterval = null;
    }

    const workers = Array.from(this.workers.values());

    if (workers.length > 0) {
      this.logger.info(
        'Stopping camera workers during application shutdown',
        { workerCount: workers.length },
      );

      await Promise.allSettled(
        workers.map(async (worker) => {
          try {
            await this.stopWorkerInternal(worker.cameraId);
          } catch (err: unknown) {
            this.logger.error(
              'Failed to stop camera worker during shutdown',
              {
                cameraId: worker.cameraId,
                organizationId: worker.organizationId,
                error: getErrorMessage(err),
              },
            );
          }
        }),
      );

      this.logger.info('Camera worker shutdown completed');
    }

    for (const client of [this.redis, this.pubRedis, this.subRedis]) {
      try {
        client?.disconnect();
      } catch {
        // Already closed / never connected.
      }
    }
    this.redis = null;
    this.pubRedis = null;
    this.subRedis = null;
  }

  // =====================================================================
  // REDIS
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

      const url =
        process.env[ENV.REDIS_URL] || 'redis://localhost:6379';

      // `pub` shares the general-purpose client — publishing never needs a
      // dedicated connection. Only `sub` requires its own socket (RESP2
      // subscriber mode is exclusive).
      this.redis = this.createRedisClient(RedisCtor, url);
      this.pubRedis = this.redis;
      this.subRedis = this.createRedisClient(RedisCtor, url);

      this.subRedis
        .subscribe(CAMERA_COMMANDS_CHANNEL)
        .catch((err: unknown) => {
          this.logger.debug('Failed to subscribe to camera-commands', {
            error: getErrorMessage(err),
          });
        });

      this.subRedis.on('message', (channel, message) => {
        if (channel !== CAMERA_COMMANDS_CHANNEL) return;
        void this.handleCameraCommand(message);
      });

      this.heartbeatInterval = setInterval(() => {
        void this.renewLocks().catch((err: unknown) => {
          this.logger.warn('renewLocks failed', {
            error: getErrorMessage(err),
          });
        });
      }, CAMERA_LOCK_RENEW_INTERVAL_MS);
      this.heartbeatInterval.unref?.();
    } catch (err: unknown) {
      this.logger.warn(
        'Redis unavailable, camera distributed coordination disabled',
        { error: getErrorMessage(err) },
      );
    }
  }

  private async handleCameraCommand(message: string): Promise<void> {
    try {
      const { action, cameraId, sender } = JSON.parse(message) as {
        action?: string;
        cameraId?: string;
        sender?: string;
      };

      if (!cameraId || sender === this.replicaId) return;

      if (action === 'STOP') {
        const worker = this.workers.get(cameraId);
        if (!worker) return;

        this.logger.info(`Received distributed STOP for camera ${cameraId}`);

        // A peer owns the camera now — stop locally WITHOUT re-broadcasting,
        // otherwise two replicas ping-pong STOPs forever.
        await this.stopWorkerInternal(cameraId).catch((err: unknown) => {
          this.logger.warn(
            `Failed to apply distributed STOP for camera ${cameraId}`,
            { error: getErrorMessage(err) },
          );
        });
      }
    } catch (err: unknown) {
      this.logger.warn('Ignoring malformed camera-commands payload', {
        error: getErrorMessage(err),
      });
    }
  }

  /**
   * Renew every owned camera lock in parallel. The previous sequential loop
   * could exceed the 10s lock TTL when Redis is slow and it holds 10 workers.
   */
  private async renewLocks(): Promise<void> {
    if (!this.redis) return;

    const entries = Array.from(this.workers.entries());

    await Promise.allSettled(
      entries.map(async ([cameraId, worker]) => {
        try {
          const renewed = await this.renewCameraLock(cameraId);
          if (renewed) return;

          this.logger.warn(
            `Lost lock for camera ${cameraId}, stopping local worker`,
          );

          // Peer replica took ownership — stop only locally.
          await this.stopWorkerInternal(cameraId).catch(() => {});
        } catch (err: unknown) {
          this.logger.warn(`Failed to renew lock for camera ${cameraId}`, {
            error: getErrorMessage(err),
          });
        }
      }),
    );
  }

  // =====================================================================
  // DISTRIBUTED CAMERA LOCK (owner-aware)
  // =====================================================================

  private cameraLockKey(cameraId: string): string {
    return `camera:${cameraId}:lock`;
  }

  private isRedisReady(): boolean {
    const redis = this.redis;
    return redis !== null && redis.status === 'ready';
  }

  private async acquireCameraLock(cameraId: string): Promise<boolean> {
    if (!this.isRedisReady()) {
      const redis = this.redis;
      if (redis) {
        this.logger.warn(
          'Redis not ready — camera worker lock skipped (multi-replica coordination unavailable)',
          { cameraId, status: redis.status },
        );
      }
      return true;
    }

    const redis = this.redis;
    if (!redis) return true;

    try {
      const key = this.cameraLockKey(cameraId);
      const acquired = await redis.set(
        key,
        this.replicaId,
        'EX',
        CAMERA_LOCK_TTL_SECONDS,
        'NX',
      );
      if (acquired) return true;

      const owner = await redis.get(key);
      if (owner === this.replicaId) return true;

      this.logger.info(
        `Camera ${cameraId} is already running on another replica`,
        { owner },
      );
      return false;
    } catch (err: unknown) {
      this.logger.warn(
        'Redis lock acquire failed — proceeding without coordination',
        { cameraId, error: getErrorMessage(err) },
      );
      return true;
    }
  }

  private async renewCameraLock(cameraId: string): Promise<boolean> {
    const redis = this.redis;
    if (!redis || redis.status !== 'ready') return true;

    const result = await redis.eval(
      'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("EXPIRE", KEYS[1], ARGV[2]) else return 0 end',
      1,
      this.cameraLockKey(cameraId),
      this.replicaId,
      CAMERA_LOCK_TTL_SECONDS,
    );

    return result === 1;
  }

  private async releaseCameraLock(cameraId: string): Promise<void> {
    const redis = this.redis;
    if (!redis || redis.status !== 'ready') return;

    try {
      const result = await redis.eval(
        'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
        1,
        this.cameraLockKey(cameraId),
        this.replicaId,
      );

      if (result !== 1) {
        this.logger.warn(
          `Camera ${cameraId} lock was not owned by this replica; not released`,
        );
      }
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
    if (typeof this.redisPubSub?.subscribe !== 'function') {
      return;
    }

    void this.redisPubSub.subscribe(
      FACE_TEMPLATES_CHANGED_CHANNEL,
      (rawPayload: string) => {
        try {
          const payload = JSON.parse(
            rawPayload,
          ) as FaceTemplatesChangedPayload;

          if (!payload?.organizationId) return;

          let invalidated = 0;

          for (const worker of this.workers.values()) {
            if (worker.organizationId === payload.organizationId) {
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
          this.logger.warn(
            'Ignoring malformed face-templates-changed payload',
            { error: getErrorMessage(err) },
          );
        }
      },
    );
  }

  // =====================================================================
  // HEALTH PERSISTENCE
  // =====================================================================

  private startHealthPersistence(): void {
    if (this.healthPersistInterval) return;

    this.healthPersistInterval = setInterval(() => {
      void this.persistRunningCameraHealth();
    }, HEALTH_PERSIST_INTERVAL_MS);

    this.healthPersistInterval.unref?.();
  }

  private async persistRunningCameraHealth(): Promise<void> {
    // DEGRADED workers are still alive and trying — their lastSeenAt must
    // advance, otherwise the dashboard shows a stale "last seen" for a
    // camera that is actively reconnecting.
    const activeWorkers = [...this.workers.values()].filter(
      (worker) =>
        worker.state === 'RUNNING' ||
        worker.state === 'CONNECTING' ||
        worker.state === 'DEGRADED',
    );

    if (activeWorkers.length === 0) return;

    // Group by org so the WHERE clause can be tenant-scoped — defence in
    // depth against ever mutating a row outside this worker's org.
    const byOrg = new Map<string, string[]>();

    for (const worker of activeWorkers) {
      const ids = byOrg.get(worker.organizationId) ?? [];
      ids.push(worker.cameraId);
      byOrg.set(worker.organizationId, ids);
    }

    try {
      await Promise.all(
        Array.from(byOrg.entries()).map(([organizationId, cameraIds]) =>
          this.prisma.camera.updateMany({
            where: { id: { in: cameraIds }, organizationId },
            data: { status: 'ONLINE', lastSeenAt: new Date() },
          }),
        ),
      );
    } catch (err: unknown) {
      this.logger.debug('Failed to persist camera health heartbeat', {
        error: getErrorMessage(err),
      });
    }
  }

  private persistCameraOnline(
    organizationId: string,
    cameraId: string,
  ): void {
    void this.prisma.camera
      .updateMany({
        where: { id: cameraId, organizationId },
        data: { status: 'ONLINE', lastSeenAt: new Date() },
      })
      .catch((err: unknown) => {
        this.logger.debug('Failed to persist camera ONLINE status', {
          cameraId,
          error: getErrorMessage(err),
        });
      });
  }

  private persistCameraError(
    organizationId: string,
    cameraId: string,
    error: string,
    errorCode: string = 'STREAM_ERROR',
  ): void {
    const now = Date.now();
    const last = this.lastHealthErrorPersist.get(cameraId) ?? 0;

    if (now - last < HEALTH_ERROR_PERSIST_MIN_INTERVAL_MS) return;

    this.lastHealthErrorPersist.set(cameraId, now);

    void this.prisma.camera
      .updateMany({
        where: { id: cameraId, organizationId },
        data: {
          status: 'ERROR',
          lastErrorAt: new Date(),
          lastErrorCode: errorCode,
          lastErrorMessage: error.slice(0, 500),
          reconnectCount: { increment: 1 },
        },
      })
      .catch((err: unknown) => {
        this.logger.debug('Failed to persist camera ERROR status', {
          cameraId,
          error: getErrorMessage(err),
        });
      });
  }

  private persistCameraStopped(
    organizationId: string,
    cameraId: string,
  ): void {
    this.lastHealthErrorPersist.delete(cameraId);

    void this.prisma.camera
      .updateMany({
        where: {
          id: cameraId,
          organizationId,
          status: { in: ['ONLINE', 'ERROR', 'CONNECTING'] },
        },
        data: { status: 'CONFIGURED' },
      })
      .catch((err: unknown) => {
        this.logger.debug('Failed to persist camera stop status', {
          cameraId,
          error: getErrorMessage(err),
        });
      });
  }

  // =====================================================================
  // INITIALIZATION
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

    // AES-256 needs 32 BYTES, not 32 UTF-16 code units. A 32-char multibyte
    // string encodes to 33+ bytes and would silently fail at cipher time.
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
      // No `as any`: getSharedFaceEngine already returns an initialized,
      // ready-to-use FaceEngine — the previous cast implied an unused
      // initialize() contract.
      this.faceEngine = await getSharedFaceEngine();
      this.logger.info(
        'Face engine initialized via shared factory for camera workers',
      );
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      this.logger.error(
        'Face engine initialization failed: ' + message,
        { error: message },
      );

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

  private async startEnabledCameras(): Promise<void> {
    const cameras = await this.prisma.camera.findMany({
      where: { enabled: true, recognitionEnabled: true },
      select: { id: true, organizationId: true },
      orderBy: { id: 'asc' },
    });

    if (cameras.length === 0) {
      this.logger.info('No enabled recognition cameras found');
      return;
    }

    // Group by org and start at most N in parallel so a single slow RTSP
    // endpoint cannot stall startup for every other tenant. Sequential
    // iteration over hundreds of cameras was previously a startup bottleneck.
    const byOrg = new Map<string, string[]>();
    for (const camera of cameras) {
      const ids = byOrg.get(camera.organizationId) ?? [];
      ids.push(camera.id);
      byOrg.set(camera.organizationId, ids);
    }

    for (const [organizationId, cameraIds] of byOrg.entries()) {
      const slice = cameraIds.slice(0, this.maxWorkersPerOrg);

      await Promise.allSettled(
        slice.map(async (cameraId) => {
          if (this.workers.size >= this.maxConcurrentWorkers) return;

          try {
            await this.startWorker(organizationId, cameraId);
          } catch (err: unknown) {
            this.logger.error(
              'Failed to start configured camera worker',
              {
                cameraId,
                organizationId,
                error: getErrorMessage(err),
              },
            );
          }
        }),
      );
    }
  }

  // =====================================================================
  // START WORKER
  // =====================================================================

  async startWorker(
    organizationId: string,
    cameraId: string,
  ): Promise<void> {
    this.assertNonEmptyIdentifier(organizationId, 'organizationId');
    this.assertNonEmptyIdentifier(cameraId, 'cameraId');

    if (this.lifecycleLocks.has(cameraId)) {
      throw new HttpException(
        'Camera worker lifecycle operation already in progress',
        HttpStatus.CONFLICT,
      );
    }

    if (this.workers.has(cameraId)) return;

    this.lifecycleLocks.add(cameraId);
    let started = false;
    let lockHeld = false;
    let capacityReserved = false;

    try {
      if (this.workers.has(cameraId)) return;

      /*
       * Reserve BEFORE the first `await`. Two rounds of `assertWorkerCapacity`
       * split by `await acquireCameraLock(...)` still left a window in which
       * several starts for the SAME org read the same count and all passed.
       */
      this.reserveWorkerCapacity(organizationId);
      capacityReserved = true;

      lockHeld = await this.acquireCameraLock(cameraId);
      if (!lockHeld) return;

      const camera = await this.findOwnedCamera(organizationId, cameraId);
      this.validateCameraCanStart(camera);

      const credentials = await this.decryptCredentials(camera);
      const streamUri = await this.buildStreamUri(camera, credentials);
      const config = this.buildWorkerConfig(camera, streamUri);

      const session = new CameraWorkerSession(
        config,
        this.faceEngine,
        this.attendanceEngine,
        this.prisma,
        this.credentialVault.encryption,
      );

      const worker: WorkerRecord = {
        cameraId: camera.id,
        organizationId: camera.organizationId,
        cameraName: camera.name,
        state: 'STARTING',
        session,
        startedAt: new Date(),
      };

      this.workers.set(camera.id, worker);
      this.addOrgWorker(camera.organizationId, camera.id);
      // The reservation is now represented by a real record — hand the slot
      // back so a concurrently starting camera is not double-counted.
      if (capacityReserved) {
        this.releaseWorkerCapacity(camera.organizationId);
        capacityReserved = false;
      }

      try {
        worker.state = 'CONNECTING';

        await this.withTimeout(
          session.start(),
          this.startTimeoutMs,
          `session.start() timed out after ${this.startTimeoutMs}ms`,
        );

        // Flip `started` BEFORE attaching event handlers: if any handler
        // wiring throws, we must NOT release the Redis lock while a live
        // session is running.
        started = true;

        session.on('camera-offline', (evt) => {
          worker.state = 'DEGRADED';
          this.persistCameraError(
            worker.organizationId,
            evt.cameraId,
            evt.error,
            evt.errorCode ?? 'STREAM_ERROR',
          );
          void this.alerting.sendOfflineAlert({
            cameraId: evt.cameraId,
            organizationId: evt.organizationId,
            error: evt.error,
            cameraName: worker.cameraName,
          });
        });

        session.on('camera-recovered', () => {
          worker.state = 'RUNNING';
          this.persistCameraOnline(worker.organizationId, worker.cameraId);
          void this.alerting.sendRecoveredAlert({
            cameraId: worker.cameraId,
            organizationId: worker.organizationId,
          });
        });

        worker.state = 'RUNNING';
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
      this.lifecycleLocks.delete(cameraId);

      if (capacityReserved) {
        this.releaseWorkerCapacity(organizationId);
      }

      if (!started && lockHeld) {
        await this.releaseCameraLock(cameraId);
      }
    }
  }

  // =====================================================================
  // STOP WORKER
  // =====================================================================

  async stopWorker(
    organizationId: string,
    cameraId: string,
    localOnly = false,
  ): Promise<void> {
    await this.assertCameraOwnership(organizationId, cameraId);

    // Refuse to broadcast a distributed STOP when this replica cannot even
    // perform the local stop — otherwise peers kill their workers while the
    // API returns an error and the local worker is still running.
    if (this.lifecycleLocks.has(cameraId)) {
      throw new HttpException(
        'Camera worker lifecycle operation already in progress',
        HttpStatus.CONFLICT,
      );
    }

    if (!localOnly && this.pubRedis) {
      try {
        const published = this.pubRedis.publish(
          CAMERA_COMMANDS_CHANNEL,
          JSON.stringify({
            action: 'STOP',
            cameraId,
            sender: this.replicaId,
          }),
        );

        void Promise.resolve(published).catch((err: unknown) => {
          this.logger.warn('Failed to broadcast distributed STOP', {
            cameraId,
            error: getErrorMessage(err),
          });
        });
      } catch (err: unknown) {
        this.logger.warn('Failed to broadcast distributed STOP', {
          cameraId,
          error: getErrorMessage(err),
        });
      }
    }

    await this.stopWorkerInternal(cameraId);
  }

  private async stopWorkerInternal(cameraId: string): Promise<void> {
    const worker = this.workers.get(cameraId);
    if (!worker) return;

    if (this.lifecycleLocks.has(cameraId)) {
      throw new HttpException(
        'Camera worker lifecycle operation already in progress',
        HttpStatus.CONFLICT,
      );
    }

    this.lifecycleLocks.add(cameraId);
    worker.state = 'STOPPING';

    try {
      await worker.session.stop();
    } catch (err: unknown) {
      worker.state = 'ERROR';
      this.logger.error(
        'Camera worker session failed to stop cleanly',
        {
          cameraId,
          organizationId: worker.organizationId,
          error: getErrorMessage(err),
        },
      );
      throw err;
    } finally {
      this.workers.delete(cameraId);
      this.removeOrgWorker(worker.organizationId, cameraId);
      this.persistCameraStopped(worker.organizationId, cameraId);
      await this.releaseCameraLock(cameraId);
      this.lifecycleLocks.delete(cameraId);
    }

    this.logger.info('Camera worker stopped', {
      cameraId,
      organizationId: worker.organizationId,
    });
  }

  // =====================================================================
  // RESTART
  // =====================================================================

  async restartWorker(organizationId: string, cameraId: string) {
    await this.assertCameraOwnership(organizationId, cameraId);

    if (this.lifecycleLocks.has(cameraId)) {
      throw new HttpException(
        'Camera worker lifecycle operation already in progress',
        HttpStatus.CONFLICT,
      );
    }

    // Broadcast distributed STOP so a peer-owned worker is torn down too —
    // previously restart only affected the local replica.
    await this.stopWorker(organizationId, cameraId);

    await this.startWorker(organizationId, cameraId);

    return this.getWorkerStatus(organizationId, cameraId);
  }

  // =====================================================================
  // STATUS
  // =====================================================================

  async getWorkerStatus(organizationId: string, cameraId: string) {
    await this.assertCameraOwnership(organizationId, cameraId);

    const worker = this.workers.get(cameraId);

    if (!worker) {
      // Distinguish "this replica does not own the camera" from "the camera
      // is truly not running" — dashboards must not tell an operator to
      // restart a camera that a peer replica is actively driving.
      const remoteOwner =
        this.isRedisReady() && this.redis
          ? await this.redis.get(this.cameraLockKey(cameraId)).catch(() => null)
          : null;

      return {
        cameraId,
        state: null,
        health: null,
        running: false,
        ownedByThisReplica: false,
        remoteOwnerReplicaId:
          remoteOwner && remoteOwner !== this.replicaId ? remoteOwner : null,
      };
    }

    return {
      cameraId,
      state: worker.state,
      health: worker.session.getHealth(),
      running: true,
      startedAt: worker.startedAt,
      ownedByThisReplica: true,
    };
  }

  getWorkerState(cameraId: string): WorkerState | null {
    return this.workers.get(cameraId)?.state ?? null;
  }

  getWorkerHealth(cameraId: string) {
    return this.workers.get(cameraId)?.session.getHealth() ?? null;
  }

  /**
   * INTERNAL ONLY — admin/system endpoint must scope by organization.
   */
  getAllWorkersStatus() {
    return Array.from(this.workers.values()).map((worker) => ({
      cameraId: worker.cameraId,
      organizationId: worker.organizationId,
      state: worker.state,
      health: worker.session.getHealth(),
      startedAt: worker.startedAt,
    }));
  }

  async getOrganizationWorkersStatus(organizationId: string) {
    const cameraIds =
      this.orgWorkerCounts.get(organizationId) ?? new Set<string>();

    return Array.from(cameraIds)
      .map((cameraId) => {
        const worker = this.workers.get(cameraId);
        if (!worker) return null;

        return {
          cameraId,
          organizationId,
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
  // CAPACITY
  // =====================================================================

  /** Effective occupancy = registered workers + not-yet-registered starts. */
  private assertWorkerCapacityFor(
    organizationId: string,
    orgCount: number,
    orgPending: number,
  ): void {
    if (orgCount + orgPending >= this.maxWorkersPerOrg) {
      throw new HttpException(
        `Maximum concurrent camera workers (${this.maxWorkersPerOrg}) reached for this organization`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.workers.size + this.pendingGlobalStarts >= this.maxConcurrentWorkers) {
      throw new HttpException(
        `Maximum concurrent camera workers (${this.maxConcurrentWorkers}) reached globally`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Atomically (in JS terms — no `await` between read and write) take one
   * capacity slot for `organizationId`. Throws 429 when either cap is full.
   */
  private reserveWorkerCapacity(organizationId: string): void {
    this.assertWorkerCapacityFor(
      organizationId,
      this.orgWorkerCounts.get(organizationId)?.size ?? 0,
      this.pendingOrgStarts.get(organizationId) ?? 0,
    );

    this.pendingOrgStarts.set(
      organizationId,
      (this.pendingOrgStarts.get(organizationId) ?? 0) + 1,
    );
    this.pendingGlobalStarts += 1;
  }

  /** Give a reserved slot back (paired with {@link reserveWorkerCapacity}). */
  private releaseWorkerCapacity(organizationId: string): void {
    const pending = this.pendingOrgStarts.get(organizationId) ?? 0;
    if (pending > 1) {
      this.pendingOrgStarts.set(organizationId, pending - 1);
    } else {
      this.pendingOrgStarts.delete(organizationId);
    }

    if (this.pendingGlobalStarts > 0) this.pendingGlobalStarts -= 1;
  }

  // =====================================================================
  // CAMERA LOOKUP / VALIDATION
  // =====================================================================

  private async findOwnedCamera(organizationId: string, cameraId: string) {
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
      | 'enabled'
      | 'recognitionEnabled'
      | 'attendanceEnabled'
      | 'host'
      | 'protocol'
    >,
  ): void {
    if (!camera.enabled) {
      throw new BadRequestException('Camera is disabled');
    }

    if (!camera.recognitionEnabled) {
      throw new BadRequestException(
        'Recognition is disabled for this camera',
      );
    }

    if (!camera.host?.trim()) {
      throw new BadRequestException('Camera host is not configured');
    }

    if (!camera.protocol) {
      throw new BadRequestException('Camera protocol is not configured');
    }
  }

  // =====================================================================
  // CREDENTIALS
  // =====================================================================

  private async decryptCredentials(
    camera: Pick<Camera, 'credentialConfigured' | 'encryptedCredentials'>,
  ): Promise<VaultCredentials> {
    if (!camera.credentialConfigured || !camera.encryptedCredentials) {
      return {};
    }

    try {
      return await this.credentialVault.decrypt(
        camera.encryptedCredentials,
      );
    } catch (err: unknown) {
      this.logger.error('Failed to decrypt camera credentials', {
        error: getErrorMessage(err),
      });

      throw new BadRequestException(
        'Camera credentials could not be decrypted',
      );
    }
  }

  // =====================================================================
  // WORKER CONFIG
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
      // Same env-tunable thresholds FaceService uses — a single operator
      // calibration must apply to BOTH pipelines.
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

    return Math.min(
      Math.max(parsed, PROCESSING_FPS_MIN),
      PROCESSING_FPS_MAX,
    );
  }

  // =====================================================================
  // STREAM URI
  // =====================================================================

  private async buildStreamUri(
    camera: Pick<
      Camera,
      'host' | 'port' | 'protocol' | 'streamPath' | 'metadata'
    >,
    credentials: VaultCredentials,
  ): Promise<string> {
    // Protocol check FIRST — no point resolving DNS for an unsupported one.
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

    const port =
      camera.port ?? (camera.protocol === 'ONVIF' ? 80 : 554);

    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new BadRequestException('Invalid camera port');
    }

    const path = this.normalizeStreamPath(camera.streamPath);

    const username = this.encodeCredential(credentials.username);
    const password = this.encodeCredential(credentials.password);

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
    if (
      !metadata ||
      typeof metadata !== 'object' ||
      Array.isArray(metadata)
    ) {
      return null;
    }

    const record = metadata as Record<string, unknown>;

    const validatedIp =
      typeof record.validatedIp === 'string'
        ? record.validatedIp.trim()
        : '';

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

    if (
      pin &&
      (pin.validatedHost === '' || pin.validatedHost === rawHost)
    ) {
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

    // Client-input error, not a server fault — must be a 400, not a 500.
    if (/[\r\n\x00-\x1F]/.test(normalized)) {
      throw new BadRequestException(
        'Stream path contains invalid control characters',
      );
    }

    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  private encodeCredential(value: string | undefined): string {
    if (!value) return '';
    return encodeURIComponent(value);
  }

  // =====================================================================
  // WORKER REGISTRY
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
    try {
      await worker.session.stop();
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
  // HELPERS
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

  /**
   * Race a promise against a timeout. The underlying operation keeps running
   * on timeout (Node has no cancellation primitive), but the CALLER is
   * released — the lifecycle lock and Redis lock are no longer held hostage
   * by a hung RTSP handshake.
   */
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
}
