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
import { AttendanceDecisionEngine } from './attendance-decision.engine';
import { CameraWorkerSession } from './camera-worker-session';
import { CameraAlertingService } from './camera-alerting.service';
import { RedisPubSubService } from '../common/redis/redis-pubsub.service';

interface CameraFaceEngine extends FaceEngine {
  initialize(): Promise<void>;
}

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

const DEFAULT_MAX_CONCURRENT_WORKERS = 10;
const DEFAULT_MAX_WORKERS_PER_ORG = 3;
const DEFAULT_PROCESSING_FPS = 3;
const DEFAULT_SIMILARITY_THRESHOLD = 0.6;

@Injectable()
export class CameraWorkerManagerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new SecureLogger('info');

  private readonly workers = new Map<string, WorkerRecord>();

  /**
   * Cameras currently being started/stopped.
   *
   * This prevents:
   *
   * startWorker(A)
   * startWorker(A)
   *
   * from creating two sessions concurrently.
   */
  private readonly lifecycleLocks = new Set<string>();

  private redis: Redis | null = null;
  private pubRedis: Redis | null = null;
  private subRedis: Redis | null = null;
  private readonly replicaId = randomUUID();
  private heartbeatInterval: NodeJS.Timeout | null = null;


  /**
   * organizationId -> cameraIds
   *
   * Used for tenant fairness and O(1) worker removal.
   */
  private readonly orgWorkerCounts = new Map<
    string,
    Set<string>
  >();

  private readonly maxConcurrentWorkers = this.readPositiveIntEnv(
    'MAX_CAMERA_WORKERS',
    DEFAULT_MAX_CONCURRENT_WORKERS,
  );

  private readonly maxWorkersPerOrg = this.readPositiveIntEnv(
    'MAX_CAMERA_WORKERS_PER_ORG',
    DEFAULT_MAX_WORKERS_PER_ORG,
  );

  private credentialVault!: CredentialVault;
  private faceEngine!: CameraFaceEngine;
  private attendanceEngine!: AttendanceDecisionEngine;
  private networkSecurity!: NetworkSecurity;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerting: CameraAlertingService,
    private readonly redisPubSub: RedisPubSubService,
  ) {
    this.networkSecurity = new NetworkSecurity({
      allowPrivateIps: process.env.ALLOW_LOCAL_CAMERAS === 'true' || process.env.NODE_ENV !== 'production',
      allowLoopback: process.env.ALLOW_LOCAL_CAMERAS === 'true' || process.env.NODE_ENV === 'test',
    });
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  /**
   * ioredis options for the coordination clients.
   *
   * Production keeps ioredis' default "retry forever with backoff" so a Redis
   * restart is transparent: the lock is skipped while the connection is down
   * and coordination resumes on reconnect.
   *
   * Tests must terminate deterministically even when nothing is listening on
   * the Redis port: retries stop after a bounded number of attempts, ioredis
   * reaches `end`, and its socket/timers are released instead of keeping the
   * Vitest worker alive forever (`[ioredis] Unhandled error event` /
   * `AggregateError` timeouts).
   *
   * `enableOfflineQueue: false` applies in both environments: a command issued
   * while the connection is down fails fast rather than being buffered in a
   * queue that never flushes (which used to stall worker start-up).
   */
  private redisClientOptions(): Record<string, unknown> {
    const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

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

  /**
   * Build an ioredis client that can never take the process down.
   *
   * A client without an `'error'` listener reports connection failures as
   * `[ioredis] Unhandled error event` and crashes Node. An unreachable server
   * emits a continuous stream of errors, so they are logged at most once every
   * 30s.
   */
  private createRedisClient(
    RedisCtor: new (url: string, options: Record<string, unknown>) => Redis,
    url: string,
  ): Redis {
    const client = new RedisCtor(url, this.redisClientOptions());
    let lastErrorLogAt = 0;
    client.on('error', (err: unknown) => {
      const now = Date.now();
      if (now - lastErrorLogAt < 30_000) return;
      lastErrorLogAt = now;
      this.logger.warn('Redis coordination client unavailable', {
        error: getErrorMessage(err),
      });
    });
    return client;
  }

  private async initializeRedis() {
    try {
      const mod = await import('ioredis');
      const RedisCtor = (mod.default ||
        (mod as unknown as { Redis?: unknown }).Redis ||
        mod) as unknown as new (
        url: string,
        options: Record<string, unknown>,
      ) => Redis;
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = this.createRedisClient(RedisCtor, url);
      this.pubRedis = this.createRedisClient(RedisCtor, url);
      this.subRedis = this.createRedisClient(RedisCtor, url);

      // A failed SUBSCRIBE is the same condition the client's own 'error'
      // listener already reports (and rate-limits), so it is logged at debug
      // level to keep one outage to one warning.
      this.subRedis?.subscribe('camera-commands').catch((err: unknown) => {
        this.logger.debug('Failed to subscribe to camera-commands', {
          error: getErrorMessage(err),
        });
      });
      this.subRedis?.on('message', (channel, message) => {
        if (channel !== 'camera-commands') return;
        // A malformed payload must never crash the process (previously an
        // unguarded JSON.parse inside an async listener could reject
        // unhandled).
        void (async () => {
          try {
            const { action, cameraId, sender } = JSON.parse(message) as {
              action?: string;
              cameraId?: string;
              sender?: string;
            };
            if (!cameraId || sender === this.replicaId) return;
            if (action === 'STOP') {
              const worker = this.workers.get(cameraId);
              if (worker) {
                this.logger.info(`Received distributed STOP for camera ${cameraId}`);
                await this.stopWorker(worker.organizationId, cameraId, true).catch(() => {});
              }
            }
          } catch (err: unknown) {
            this.logger.warn('Ignoring malformed camera-commands payload', {
              error: getErrorMessage(err),
            });
          }
        })();
      });

      this.heartbeatInterval = setInterval(() => {
        void this.renewLocks().catch((err: unknown) => {
          this.logger.warn('renewLocks failed', { error: getErrorMessage(err) });
        });
      }, 5000);
      this.heartbeatInterval.unref?.();
    } catch (err: unknown) {
      this.logger.warn(
        'Redis unavailable, camera distributed coordination disabled',
        { error: getErrorMessage(err) },
      );
    }
  }

  private async renewLocks() {
    if (!this.redis) return;
    for (const [cameraId, worker] of this.workers.entries()) {
      try {
        const renewed = await this.renewCameraLock(cameraId);
        if (!renewed) {
          this.logger.warn(`Lost lock for camera ${cameraId}, stopping local worker`);
          await this.stopWorker(worker.organizationId, cameraId, true).catch(() => {});
        }
      } catch (err: unknown) {
        this.logger.warn(`Failed to renew lock for camera ${cameraId}`, {
          error: getErrorMessage(err),
        });
      }
    }
  }

  // ============================================================
  // DISTRIBUTED CAMERA LOCK (owner-aware)
  //
  // One lock per camera, owned by exactly one replica. Every mutation is
  // atomic and verifies ownership, so a replica can never release or extend
  // a peer's lock:
  //
  //   acquire : SET key <replicaId> EX 10 NX
  //   renew   : Lua "if get(key)==me then expire(key,10)"
  //   release : Lua "if get(key)==me then del(key)"
  //
  // When Redis is unavailable the lock is skipped, and a single-replica
  // deployment keeps working; multi-replica coordination is then the caller's
  // explicit responsibility (see config validation for production).
  // ============================================================

  private cameraLockKey(cameraId: string): string {
    return `camera:${cameraId}:lock`;
  }

  /**
   * True only when the coordination client can actually talk to Redis.
   *
   * The clients run with `enableOfflineQueue: false`, so a command issued
   * while the connection is down rejects immediately instead of buffering —
   * but there is no reason to pay for that rejection when no lock can be
   * acquired anyway. Skipping here degrades to single-replica behaviour and is
   * surfaced as a warning; production additionally fails fast on a missing
   * Redis configuration (config.validate).
   */
  private isRedisReady(): boolean {
    const redis = this.redis;
    return redis !== null && redis.status === 'ready';
  }

  /**
   * Try to take ownership of a camera. Returns true when this replica holds
   * the lock (either freshly acquired or already owned by us — an idempotent
   * re-start must not be mistaken for "another replica owns it").
   *
   * A Redis failure degrades to `true` (single-replica semantics) rather than
   * failing the whole start: losing coordination must never take cameras down.
   */
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
      const acquired = await redis.set(key, this.replicaId, 'EX', 10, 'NX');
      if (acquired) return true;

      const owner = await redis.get(key);
      if (owner === this.replicaId) return true;

      this.logger.info(`Camera ${cameraId} is already running on another replica`, { owner });
      return false;
    } catch (err: unknown) {
      this.logger.warn('Redis lock acquire failed — proceeding without coordination', {
        cameraId,
        error: getErrorMessage(err),
      });
      return true;
    }
  }

  /** Atomically extend the lock only while this replica still owns it. */
  private async renewCameraLock(cameraId: string): Promise<boolean> {
    const redis = this.redis;
    if (!redis || redis.status !== 'ready') return true;
    const result = await redis.eval(
      'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("EXPIRE", KEYS[1], ARGV[2]) else return 0 end',
      1,
      this.cameraLockKey(cameraId),
      this.replicaId,
      10,
    );
    return result === 1;
  }

  /** Atomically release the lock only if this replica owns it. */
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
        this.logger.warn(`Camera ${cameraId} lock was not owned by this replica; not released`);
      }
    } catch (err: unknown) {
      this.logger.warn(`Failed to release camera lock for ${cameraId}`, {
        error: getErrorMessage(err),
      });
    }
  }


  async onModuleInit(): Promise<void> {
    await this.initializeRedis();
    this.initializeCredentialVault();

    await this.initializeFaceEngine();

    this.attendanceEngine =
      new AttendanceDecisionEngine(this.prisma, this.redisPubSub);

    await this.startEnabledCameras();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const client of [this.redis, this.pubRedis, this.subRedis]) {
      try {
        client?.disconnect();
      } catch {
        // Already closed / never connected — nothing to release.
      }
    }
    this.redis = null;
    this.pubRedis = null;
    this.subRedis = null;
    const workers = Array.from(
      this.workers.values(),
    );

    if (workers.length === 0) {
      return;
    }

    this.logger.info(
      'Stopping camera workers during application shutdown',
      {
        workerCount: workers.length,
      },
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

    this.logger.info(
      'Camera worker shutdown completed',
    );
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  private initializeCredentialVault(): void {
    const encryptionKey =
      process.env.BIOMETRIC_ENCRYPTION_KEY ||
      process.env.CAMERA_ENCRYPTION_KEY;

    // Fail-closed: never use a hardcoded fallback key regardless of NODE_ENV.
    // The previous implementation allowed the well-known dev key to be used
    // whenever NODE_ENV was not 'production'.
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error(
        'BIOMETRIC_ENCRYPTION_KEY or CAMERA_ENCRYPTION_KEY must be ' +
          'configured with at least 32 characters in all non-test environments.',
      );
    }

    this.credentialVault = new CredentialVault(encryptionKey);
  }

  private async initializeFaceEngine(): Promise<void> {
    try {
      const { getSharedFaceEngine } = await import('../face/face-engine.factory.js');
      this.faceEngine = await getSharedFaceEngine() as any;
      this.logger.info('Face engine initialized via shared factory for camera workers');
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      this.logger.error('Face engine initialization failed: ' + message, { error: message });
      // Fail-closed in production: a broken face engine must abort startup
      // rather than silently continuing without biometric recognition.
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `Face engine initialization failed in production: ${message}`,
        );
      }
      this.logger.warn('Face engine initialization failed in development', { error: message });
    }
  }
  private async startEnabledCameras(): Promise<void> {
    const cameras =
      await this.prisma.camera.findMany({
        where: {
          enabled: true,
          recognitionEnabled: true,
        },

        select: {
          id: true,
          organizationId: true,
        },

        orderBy: {
          id: 'asc',
        },
      });

    if (cameras.length === 0) {
      this.logger.info(
        'No enabled recognition cameras found',
      );
      return;
    }

    for (const camera of cameras) {
      if (
        this.workers.size >=
        this.maxConcurrentWorkers
      ) {
        this.logger.warn(
          'Global camera worker capacity reached',
          {
            limit: this.maxConcurrentWorkers,
          },
        );

        break;
      }

      try {
        await this.startWorker(
          camera.organizationId,
          camera.id,
        );
      } catch (err: unknown) {
        this.logger.error(
          'Failed to start configured camera worker',
          {
            cameraId: camera.id,
            organizationId: camera.organizationId,
            error: getErrorMessage(err),
          },
        );
      }
    }
  }

  // ============================================================
  // START WORKER
  // ============================================================

  async startWorker(
    organizationId: string,
    cameraId: string,
  ): Promise<void> {
    this.assertNonEmptyIdentifier(
      organizationId,
      'organizationId',
    );

    this.assertNonEmptyIdentifier(
      cameraId,
      'cameraId',
    );

    if (this.lifecycleLocks.has(cameraId)) {
      throw new HttpException(
        'Camera worker lifecycle operation already in progress',
        HttpStatus.CONFLICT,
      );
    }

    // Idempotent start: a worker for this camera already runs here.
    if (this.workers.has(cameraId)) {
      return;
    }

    /**
     * P0: take the lifecycle lock SYNCHRONOUSLY before any await. The old
     * order (check → await acquireCameraLock → add lock) let two concurrent
     * same-replica startWorker(A) calls both pass the checks: the second
     * SET NX failed but the owner check saw our own replicaId and returned
     * true, spawning a duplicate session and orphaning an FFmpeg child.
     */
    this.lifecycleLocks.add(cameraId);
    let started = false;
    let lockHeld = false;

    try {
      // Re-check after acquiring the in-process lock (another start may have
      // completed while we were still in the synchronous prologue — cheap
      // defence in depth).
      if (this.workers.has(cameraId)) {
        return;
      }

      // Capacity is checked BEFORE taking the distributed lock so a rejected
      // start can never leave a stale Redis lock behind for the next 10s.
      this.assertWorkerCapacity(organizationId);

      lockHeld = await this.acquireCameraLock(cameraId);
      if (!lockHeld) {
        return;
      }
      const camera =
        await this.findOwnedCamera(
          organizationId,
          cameraId,
        );

      this.validateCameraCanStart(camera);

      const credentials =
        await this.decryptCredentials(camera);

      const streamUri =
        await this.buildStreamUri(
          camera,
          credentials,
        );

      const config =
        this.buildWorkerConfig(
          camera,
          streamUri,
        );

      const session =
        new CameraWorkerSession(
          config,
          this.faceEngine,
          this.attendanceEngine,
          this.prisma,
          this.credentialVault.encryption,
        );

      const worker: WorkerRecord = {
        cameraId: camera.id,
        organizationId: camera.organizationId,
        state: 'STARTING',
        session,
        startedAt: new Date(),
      };

      /**
       * Register worker only after the complete object exists.
       */
      this.workers.set(
        camera.id,
        worker,
      );

      this.addOrgWorker(
        camera.organizationId,
        camera.id,
      );

      try {
        worker.state = 'CONNECTING';

        await session.start();

        // FIX-4: wire camera alerting events (offline/recovered/frozen)
        session.on('camera-offline', (evt) => {
          void this.alerting.sendOfflineAlert({
            cameraId: evt.cameraId,
            organizationId: evt.organizationId,
            error: evt.error,
            cameraName: worker.session?.getHealth?.()?.cameraId ?? evt.cameraId,
          });
        });
        session.on('camera-recovered', () => {
          void this.alerting.sendRecoveredAlert({
            cameraId: worker.cameraId,
            organizationId: worker.organizationId,
          });
        });

        worker.state = 'RUNNING';
        started = true;

        this.logger.info(
          'Camera worker started successfully',
          {
            cameraId: camera.id,
            organizationId:
              camera.organizationId,
            name: camera.name,
          },
        );
      } catch (err: unknown) {
        worker.state = 'ERROR';

        this.logger.error(
          'Camera worker failed during startup',
          {
            cameraId: camera.id,
            organizationId:
              camera.organizationId,
            error: getErrorMessage(err),
          },
        );

        /**
         * Never leave a failed worker registered as active.
         */
        await this.cleanupFailedWorker(
          camera.id,
          worker,
        );

        throw err;
      }
    } finally {
      this.lifecycleLocks.delete(cameraId);
      // Never keep ownership of a camera whose worker failed to start —
      // otherwise the camera could not be retried until the lock TTL.
      if (!started && lockHeld) {
        await this.releaseCameraLock(cameraId);
      }
    }
  }

  // ============================================================
  // STOP WORKER
  // ============================================================

  async stopWorker(
    organizationId: string,
    cameraId: string,
    localOnly = false
  ): Promise<void> {
    await this.assertCameraOwnership(organizationId, cameraId);
    if (!localOnly && this.pubRedis) {
      try {
        // Fire-and-forget on purpose: a broadcast must never delay (or block)
        // the local teardown of the worker. The client runs with
        // `enableOfflineQueue: false`, so a broadcast attempted while Redis is
        // down rejects instead of being flushed — possibly much later — after
        // the camera has already been restarted elsewhere.
        const published = this.pubRedis.publish(
          'camera-commands',
          JSON.stringify({ action: 'STOP', cameraId, sender: this.replicaId }),
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
    // The lock is released by stopWorkerInternal (owner-aware), and never by a
    // blind DEL: a peer replica may have taken ownership meanwhile.
    await this.stopWorkerInternal(cameraId);
  }

  private async stopWorkerInternal(
    cameraId: string,
  ): Promise<void> {
    const worker =
      this.workers.get(cameraId);

    if (!worker) {
      return;
    }

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
          organizationId:
            worker.organizationId,
          error: getErrorMessage(err),
        },
      );

      throw err;
    } finally {
      this.workers.delete(cameraId);

      this.removeOrgWorker(
        worker.organizationId,
        cameraId,
      );

      // Release ownership so the camera can be started again immediately
      // (restart, failover). Owner-aware: a peer's lock is never touched.
      await this.releaseCameraLock(cameraId);

      this.lifecycleLocks.delete(
        cameraId,
      );
    }

    this.logger.info(
      'Camera worker stopped',
      {
        cameraId,
        organizationId:
          worker.organizationId,
      },
    );
  }

  // ============================================================
  // RESTART
  // ============================================================

  /**
   * Restart = stop (releasing this replica's ownership) then start.
   *
   * Previously the stop path kept the Redis lock, so the following `SET NX`
   * failed and the camera silently stayed down while the API reported
   * "RESTARTED" (F-003). Ownership is now released inside the stop path and
   * the caller receives the *actual* resulting worker status.
   */
  async restartWorker(
    organizationId: string,
    cameraId: string,
  ) {
    await this.assertCameraOwnership(
      organizationId,
      cameraId,
    );

    if (this.lifecycleLocks.has(cameraId)) {
      throw new HttpException(
        'Camera worker lifecycle operation already in progress',
        HttpStatus.CONFLICT,
      );
    }

    await this.stopWorkerInternal(cameraId);

    await this.startWorker(organizationId, cameraId);

    return this.getWorkerStatus(organizationId, cameraId);
  }

  // ============================================================
  // STATUS
  // ============================================================

  async getWorkerStatus(
    organizationId: string,
    cameraId: string,
  ) {
    await this.assertCameraOwnership(
      organizationId,
      cameraId,
    );

    const worker =
      this.workers.get(cameraId);

    if (!worker) {
      return {
        cameraId,
        state: null,
        health: null,
        running: false,
      };
    }

    return {
      cameraId,
      state: worker.state,
      health:
        worker.session.getHealth(),
      running: true,
      startedAt:
        worker.startedAt,
    };
  }

  getWorkerState(
    cameraId: string,
  ): WorkerState | null {
    return (
      this.workers.get(cameraId)
        ?.state ?? null
    );
  }

  getWorkerHealth(
    cameraId: string,
  ) {
    const worker =
      this.workers.get(cameraId);

    if (!worker) {
      return null;
    }

    return worker.session.getHealth();
  }

  /**
   * INTERNAL ONLY.
   *
   * Never expose this directly to a normal tenant-facing endpoint.
   * An admin/system endpoint must explicitly filter by organization.
   */
  getAllWorkersStatus() {
    return Array.from(
      this.workers.values(),
    ).map((worker) => ({
      cameraId: worker.cameraId,
      organizationId:
        worker.organizationId,
      state: worker.state,
      health:
        worker.session.getHealth(),
      startedAt:
        worker.startedAt,
    }));
  }

  /**
   * Tenant-safe version for organization dashboards.
   */
  async getOrganizationWorkersStatus(
    organizationId: string,
  ) {
    const cameraIds =
      this.orgWorkerCounts.get(
        organizationId,
      ) ?? new Set<string>();

    return Array.from(cameraIds)
      .map((cameraId) => {
        const worker =
          this.workers.get(cameraId);

        if (!worker) {
          return null;
        }

        return {
          cameraId,
          organizationId,
          state: worker.state,
          health:
            worker.session.getHealth(),
          startedAt:
            worker.startedAt,
        };
      })
      .filter(
        (
          worker,
        ): worker is NonNullable<
          typeof worker
        > => worker !== null,
      );
  }

  // ============================================================
  // CAPACITY
  // ============================================================

  private assertWorkerCapacity(
    organizationId: string,
  ): void {
    const orgWorkers =
      this.orgWorkerCounts.get(
        organizationId,
      );

    const orgCount =
      orgWorkers?.size ?? 0;

    if (
      orgCount >=
      this.maxWorkersPerOrg
    ) {
      throw new HttpException(
        `Maximum concurrent camera workers (${this.maxWorkersPerOrg}) reached for this organization`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      this.workers.size >=
      this.maxConcurrentWorkers
    ) {
      throw new HttpException(
        `Maximum concurrent camera workers (${this.maxConcurrentWorkers}) reached globally`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  // ============================================================
  // CAMERA LOOKUP / VALIDATION
  // ============================================================

  private async findOwnedCamera(
    organizationId: string,
    cameraId: string,
  ) {
    const camera =
      await this.prisma.camera.findFirst({
        where: {
          id: cameraId,
          organizationId,
        },

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

    if (!camera) {
      throw new NotFoundException(
        'Camera not found',
      );
    }

    return camera;
  }

  private async assertCameraOwnership(
    organizationId: string,
    cameraId: string,
  ): Promise<void> {
    const camera =
      await this.prisma.camera.findFirst({
        where: {
          id: cameraId,
          organizationId,
        },

        select: {
          id: true,
        },
      });

    if (!camera) {
      throw new NotFoundException(
        'Camera not found',
      );
    }
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
      throw new BadRequestException(
        'Camera is disabled',
      );
    }

    if (!camera.recognitionEnabled) {
      throw new BadRequestException(
        'Recognition is disabled for this camera',
      );
    }

    if (!camera.host?.trim()) {
      throw new BadRequestException(
        'Camera host is not configured',
      );
    }

    if (!camera.protocol) {
      throw new BadRequestException(
        'Camera protocol is not configured',
      );
    }
  }

  // ============================================================
  // CREDENTIALS
  // ============================================================

  private async decryptCredentials(
    camera: Pick<
      Camera,
      'credentialConfigured' |
      'encryptedCredentials'
    >,
  ): Promise<VaultCredentials> {
    if (
      !camera.credentialConfigured ||
      !camera.encryptedCredentials
    ) {
      return {};
    }

    try {
      return await this.credentialVault.decrypt(
        camera.encryptedCredentials,
      );
    } catch (err: unknown) {
      this.logger.error(
        'Failed to decrypt camera credentials',
        {
          error: getErrorMessage(err),
        },
      );

      throw new BadRequestException(
        'Camera credentials could not be decrypted',
      );
    }
  }

  // ============================================================
  // WORKER CONFIG
  // ============================================================

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
    const processingFps =
      this.normalizeProcessingFps(
        camera.processingFps,
      );

    const rtspTransport =
      camera.rtspTransport === 'udp'
        ? 'udp'
        : 'tcp';

    return {
      cameraId: camera.id,
      organizationId:
        camera.organizationId,
      name: camera.name,
      streamUri,
      processingFps,
      rtspTransport,
      location:
        camera.location?.trim() || null,
      recognitionEnabled:
        camera.recognitionEnabled,
      attendanceEnabled:
        camera.attendanceEnabled,
      similarityThreshold:
        DEFAULT_SIMILARITY_THRESHOLD,
      minAmbiguityMargin: 0.05,
    };
  }

  private normalizeProcessingFps(
    value: unknown,
  ): number {
    const parsed =
      typeof value === 'number'
        ? value
        : Number(value);

    if (
      !Number.isFinite(parsed) ||
      parsed <= 0
    ) {
      return DEFAULT_PROCESSING_FPS;
    }

    /**
     * Protect CPU/GPU from accidental configuration such as:
     *
     * processingFps = 100000
     */
    return Math.min(
      Math.max(parsed, 0.5),
      30,
    );
  }

  // ============================================================
  // STREAM URI
  // ============================================================

  private async buildStreamUri(
    camera: Pick<
      Camera,
      | 'host'
      | 'port'
      | 'protocol'
      | 'streamPath'
      | 'metadata'
    >,
    credentials: VaultCredentials,
  ): Promise<string> {
    const rawHost =
      camera.host?.trim();

    if (!rawHost) {
      throw new BadRequestException(
        'Camera host is missing',
      );
    }

    /**
     * DNS REBINDING (TOCTOU): FFmpeg must never be given a host NAME — it
     * would resolve it again at connect time and could be pointed at an
     * internal address after the check passed. `resolveStreamHost()` always
     * returns the IP literal that passed validation, so the address written
     * into the URI is the address that was validated.
     */
    const host = await this.resolveStreamHost(
      rawHost,
      camera.metadata,
    );

    /**
     * IPv6 literals must be bracketed inside a URI authority, otherwise the
     * port would be parsed as extra hextets (`rtsp://2001:db8::1:554/...`).
     */
    const hostInUri =
      host.includes(':') && !host.startsWith('[')
        ? `[${host}]`
        : host;

    /**
     * The worker currently consumes RTSP.
     *
     * ONVIF is normally used for discovery/control and must not
     * silently be treated as an RTSP protocol.
     */
    if (
      camera.protocol !== 'RTSP' &&
      camera.protocol !== 'ONVIF'
    ) {
      throw new BadRequestException(
        `Unsupported camera protocol: ${camera.protocol}`,
      );
    }

    const port =
      camera.port ??
      (camera.protocol === 'ONVIF'
        ? 80
        : 554);

    if (
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65_535
    ) {
      throw new BadRequestException(
        'Invalid camera port',
      );
    }

    const path =
      this.normalizeStreamPath(
        camera.streamPath,
      );

    const username =
      this.encodeCredential(
        credentials.username,
      );

    const password =
      this.encodeCredential(
        credentials.password,
      );

    const auth =
      username && password
        ? `${username}:${password}@`
        : username
          ? `${username}@`
          : '';

    /**
     * ONVIF cameras may still expose an RTSP stream.
     *
     * The protocol field identifies camera capability;
     * the actual worker transport remains RTSP.
     */
    return `rtsp://${auth}${hostInUri}:${port}${path}`;
  }

  /**
   * Read the SSRF destination pin written by `CameraService`.
   *
   * Returns `null` for legacy rows (no pin) or for a pin whose `validatedIp`
   * is not an IP literal — in both cases the caller must fall back to a fresh
   * resolve-and-validate.
   */
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

    if (!validatedIp) {
      return null;
    }

    return {
      validatedIp,
      validatedHost:
        typeof record.validatedHost === 'string'
          ? record.validatedHost.trim()
          : '',
    };
  }

  /**
   * Resolve the single destination this worker is allowed to connect to.
   *
   * 1. Preferred: the pin (`metadata.validatedIp`) recorded when the camera
   *    host passed SSRF validation. It is re-checked with `validateIp()`,
   *    which performs **no DNS lookup**, so nothing here can be poisoned by a
   *    rebinding DNS record. The pin is only honoured when it was recorded for
   *    the host currently configured on the camera.
   * 2. Fallback (legacy rows, tampered/unusable pin): `validateHost(rawHost)`
   *    resolves the name, validates EVERY returned address and hands back the
   *    first validated IP.
   *
   * Both paths return an IP literal. The FFmpeg URI is built from that literal,
   * so the address that passed validation is exactly the address used at
   * connect time.
   */
  private async resolveStreamHost(
    rawHost: string,
    metadata: unknown,
  ): Promise<string> {
    const pin = this.readAddressPin(metadata);

    if (
      pin &&
      (pin.validatedHost === '' ||
        pin.validatedHost === rawHost)
    ) {
      try {
        return this.networkSecurity.validateIp(
          pin.validatedIp,
        );
      } catch (err: unknown) {
        this.logger.warn(
          'Pinned camera destination failed re-validation; falling back to resolving the host',
          {
            host: rawHost,
            error: getErrorMessage(err),
          },
        );
      }
    }

    // Throws (fail-closed) when the host resolves to a forbidden range.
    return this.networkSecurity.validateHost(
      rawHost,
    );
  }

  private normalizeStreamPath(
    streamPath: string | null,
  ): string {
    if (!streamPath?.trim()) {
      return '/';
    }

    const normalized = streamPath.trim();

    // Reject control characters and newlines in the stream path. A path with
    // embedded newlines or other non-printable characters could be interpreted
    // as multiple arguments by FFmpeg's CLI parser (`-i` followed by a line
    // break and another option), allowing option injection.
    if (/[\r\n\x00-\x1F]/.test(normalized)) {
      throw new Error(
        'Stream path contains invalid control characters.',
      );
    }

    return normalized.startsWith('/')
      ? normalized
      : `/${normalized}`;
  }

  private encodeCredential(
    value: string | undefined,
  ): string {
    if (!value) {
      return '';
    }

    return encodeURIComponent(value);
  }

  // ============================================================
  // WORKER REGISTRY
  // ============================================================

  private addOrgWorker(
    organizationId: string,
    cameraId: string,
  ): void {
    const workers =
      this.orgWorkerCounts.get(
        organizationId,
      ) ?? new Set<string>();

    workers.add(cameraId);

    this.orgWorkerCounts.set(
      organizationId,
      workers,
    );
  }

  private removeOrgWorker(
    organizationId: string,
    cameraId: string,
  ): void {
    const workers =
      this.orgWorkerCounts.get(
        organizationId,
      );

    if (!workers) {
      return;
    }

    workers.delete(cameraId);

    if (workers.size === 0) {
      this.orgWorkerCounts.delete(
        organizationId,
      );
    }
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
          organizationId:
            worker.organizationId,
          error: getErrorMessage(err),
        },
      );
    } finally {
      this.workers.delete(
        cameraId,
      );

      this.removeOrgWorker(
        worker.organizationId,
        cameraId,
      );
    }
  }

  // ============================================================
  // CONFIGURATION HELPERS
  // ============================================================

  private readPositiveIntEnv(
    name: string,
    fallback: number,
  ): number {
    const raw =
      process.env[name]?.trim();

    if (!raw) {
      return fallback;
    }

    const value =
      Number.parseInt(raw, 10);

    if (
      !Number.isInteger(value) ||
      value <= 0
    ) {
      this.logger.warn(
        'Invalid positive integer environment value; using default',
        {
          variable: name,
          fallback,
        },
      );

      return fallback;
    }

    return value;
  }

  private assertNonEmptyIdentifier(
    value: string,
    name: string,
  ): void {
    if (
      typeof value !== 'string' ||
      !value.trim()
    ) {
      throw new BadRequestException(
        `${name} is required`,
      );
    }
  }

  private sleep(
    milliseconds: number,
  ): Promise<void> {
    return new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          milliseconds,
        ),
    );
  }
}



