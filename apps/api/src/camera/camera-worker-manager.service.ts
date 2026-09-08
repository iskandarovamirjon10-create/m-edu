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
import type {
  CredentialVault,
  VaultCredentials,
} from '@medu/camera-engine';

import { getErrorMessage } from '../lib/error';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceDecisionEngine } from './attendance-decision.engine';
import { CameraWorkerSession } from './camera-worker-session';
import { CameraAlertingService } from './camera-alerting.service';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerting: CameraAlertingService,
  ) {}

  // ============================================================
  // LIFECYCLE
  // ============================================================

  async onModuleInit(): Promise<void> {
    this.initializeCredentialVault();

    await this.initializeFaceEngine();

    this.attendanceEngine =
      new AttendanceDecisionEngine(this.prisma);

    await this.startEnabledCameras();
  }

  async onModuleDestroy(): Promise<void> {
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

    // Dynamic import is intentionally performed during lifecycle
    // initialization elsewhere in this project.
    //
    // This method is synchronous because the constructor is not async.
    //
    // The actual vault instance is created in initializeCredentialVaultAsync.
  }

  private async initializeFaceEngine(): Promise<void> {
    const {
      CredentialVault,
    } = await import('@medu/camera-engine');

    const encryptionKey =
      process.env.BIOMETRIC_ENCRYPTION_KEY ||
      process.env.CAMERA_ENCRYPTION_KEY ||
      'dev-camera-encryption-key-min-32-chars-long!';

    this.credentialVault =
      new CredentialVault(encryptionKey);

    const {
      RealFaceEngine,
    } = await import('@medu/face-engine');

    const detectorModelPath =
      this.requireProductionModelPath(
        'FACE_DETECTOR_MODEL_PATH',
      );

    const embedderModelPath =
      this.requireProductionModelPath(
        'FACE_EMBEDDER_MODEL_PATH',
      );

    const livenessModelPath =
      this.requireProductionModelPath(
        'FACE_LIVENESS_MODEL_PATH',
      );

    this.faceEngine = new RealFaceEngine({
      detectorModelPath,
      embedderModelPath,
      livenessModelPath,
      embeddingDimension: 128,
    });

    try {
      await this.faceEngine.initialize();

      this.logger.info(
        'Real face engine initialized for camera workers',
      );
    } catch (err: unknown) {
      const message = getErrorMessage(err);

      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'Face engine initialization failed in production. ' +
            `Camera recognition cannot start safely: ${message}`,
        );
      }

      this.logger.warn(
        'Face engine initialization failed in development',
        {
          error: message,
        },
      );
    }
  }

  private requireProductionModelPath(
    envName: string,
  ): string {
    const value = process.env[envName]?.trim();

    if (
      process.env.NODE_ENV === 'production' &&
      !value
    ) {
      throw new Error(
        `${envName} must be configured in production`,
      );
    }

    return value || '';
  }

  // ============================================================
  // START ENABLED CAMERAS
  // ============================================================

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

    if (this.workers.has(cameraId)) {
      this.logger.warn(
        'Camera worker already running',
        {
          cameraId,
          organizationId,
        },
      );

      return;
    }

    this.assertWorkerCapacity(organizationId);

    this.lifecycleLocks.add(cameraId);

    try {
      const camera =
        await this.findOwnedCamera(
          organizationId,
          cameraId,
        );

      this.validateCameraCanStart(camera);

      const credentials =
        await this.decryptCredentials(camera);

      const streamUri =
        this.buildStreamUri(
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
    }
  }

  // ============================================================
  // STOP WORKER
  // ============================================================

  async stopWorker(
    organizationId: string,
    cameraId: string,
  ): Promise<void> {
    await this.assertCameraOwnership(
      organizationId,
      cameraId,
    );

    await this.stopWorkerInternal(
      cameraId,
    );
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

  async restartWorker(
    organizationId: string,
    cameraId: string,
  ): Promise<void> {
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

    await this.stopWorkerInternal(
      cameraId,
    );

    await this.sleep(1_000);

    await this.startWorker(
      organizationId,
      cameraId,
    );
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

  private buildStreamUri(
    camera: Pick<
      Camera,
      'host' |
      'port' |
      'protocol' |
      'streamPath'
    >,
    credentials: VaultCredentials,
  ): string {
    const host =
      camera.host?.trim();

    if (!host) {
      throw new BadRequestException(
        'Camera host is missing',
      );
    }

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
    return `rtsp://${auth}${host}:${port}${path}`;
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