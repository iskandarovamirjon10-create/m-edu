import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import {
  AttendancePolicy,
  DEFAULT_FACE_RECOGNITION_CONFIG,
  DeviceService,
  EnrollmentService,
  RecognitionDecisionPolicy,
  RecognitionService,
  type EnrollmentRepository,
  type FaceEngine,
  type FaceRecognitionConfig,
  type TenantContext,
} from '@medu/core';

import { AesEncryptionService } from '@medu/face-security';

import { PrismaService } from '../prisma/prisma.service';
import { AttendanceDecisionEngine } from '../camera/attendance-decision.engine';
import { NotificationEventService } from '../notifications/events/notification-event.service';
import { RedisPubSubService } from '../common/redis/redis-pubsub.service';
import { ATTENDANCE_CREATED_EVENT } from '../attendance/attendance.gateway';
import { decodeValidatedImage } from './image.util';
import { FACE_TEMPLATES_CHANGED_CHANNEL } from './face-events';
import { getOrganizationDate } from '../common/date-range';
import {
  computeInvoiceOutstanding,
  NON_BILLABLE_INVOICE_STATUSES,
} from '../payments/invoice-outstanding';

import { PrismaAuditAdapter } from './adapters/prisma-audit.adapter';
import { PrismaDeviceAdapter } from './adapters/prisma-device.adapter';
import { PrismaEnrollmentAdapter } from './adapters/prisma-enrollment.adapter';
import { PrismaRecognitionAdapter } from './adapters/prisma-recognition.adapter';
import { PrismaStudentAdapter } from './adapters/prisma-student.adapter';
import { SimpleAuthorizationAdapter } from './adapters/authorization.adapter';
import { InferenceConcurrencyLimiter } from './inference-limiter';

import type { RecognitionHistoryQueryDto } from './dto/recognition.dto';
import type { FaceAuditQueryDto } from './dto/audit.dto';
import type { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const ENV = {
  NODE_ENV: 'NODE_ENV',
  BIOMETRIC_ENCRYPTION_KEY: 'BIOMETRIC_ENCRYPTION_KEY',
  FACE_QUALITY_THRESHOLD: 'FACE_QUALITY_THRESHOLD',
  FACE_SIMILARITY_THRESHOLD: 'FACE_SIMILARITY_THRESHOLD',
  FACE_AMBIGUITY_MARGIN: 'FACE_AMBIGUITY_MARGIN',
  FACE_UNCERTAIN_MARGIN: 'FACE_UNCERTAIN_MARGIN',
  FACE_DUPLICATE_WINDOW_MINUTES: 'FACE_DUPLICATE_WINDOW_MINUTES',
  FACE_LIVENESS_ACCEPT_UNCERTAIN: 'FACE_LIVENESS_ACCEPT_UNCERTAIN',
  FACE_LIVENESS_PASS_THRESHOLD: 'FACE_LIVENESS_PASS_THRESHOLD',
  FACE_LIVENESS_THRESHOLD: 'FACE_LIVENESS_THRESHOLD',
} as const;

const AES_256_KEY_BYTES = 32;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ANALYTICS_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DUPLICATE_WINDOW_MAX_MINUTES = 1440;
const STUDENT_NAME_FALLBACK = "O'quvchi";
const UNINITIALIZED_ERROR = 'FaceService is not initialized';

/** Audit event names emitted by this service. */
const AUDIT = {
  ENROLLMENT_CANCELLED: 'FACE_ENROLLMENT_CANCELLED',
  ATTENDANCE_ROLLED_BACK: 'FACE_ATTENDANCE_ROLLED_BACK',
  ATTENDANCE_DENIED_NO_STUDENT: 'FACE_ATTENDANCE_DENIED_STUDENT_NOT_FOUND',
} as const;

type EngineProvider = 'uninitialized' | 'mock' | 'real-local';

type PaginationFilters = {
  page?: number | string;
  limit?: number | string;
};

type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type StudentFinancialSnapshot = {
  balance: number;
  outstanding: number;
  overdue: number;
};

type SessionScopeParams = {
  groupId?: string;
  lessonId?: string;
  deviceId?: string;
};

type AuditActor = {
  organizationId: string;
  userId?: string;
};

// ---------------------------------------------------------------------------
// SERVICE
// ---------------------------------------------------------------------------

@Injectable()
export class FaceService implements OnModuleInit, OnModuleDestroy {
  private readonly nestLogger = new Logger(FaceService.name);
  private readonly authAdapter = new SimpleAuthorizationAdapter();
  private readonly inferenceLimiter = new InferenceConcurrencyLimiter({
    maxConcurrency: Number(process.env.FACE_INFERENCE_CONCURRENCY || 2),
    maxQueueSize: Number(process.env.FACE_INFERENCE_QUEUE_LIMIT || 12),
    queueTimeoutMs: 5000,
  });

  private enrollmentService: EnrollmentService | null = null;
  private recognitionService: RecognitionService | null = null;
  private deviceService: DeviceService | null = null;

  private engine: FaceEngine | null = null;
  private engineProvider: EngineProvider = 'uninitialized';

  private enrollmentRepo!: PrismaEnrollmentAdapter;
  private recognitionRepo!: PrismaRecognitionAdapter;
  private deviceRepo!: PrismaDeviceAdapter;
  private auditRepo!: PrismaAuditAdapter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceDecisionEngine: AttendanceDecisionEngine,
    @Optional() private readonly notificationEvents?: NotificationEventService,
    @Optional() private readonly redisPubSub?: RedisPubSubService,
  ) {}

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  async onModuleInit(): Promise<void> {
    this.initRepositories();

    const studentDirectory = new PrismaStudentAdapter(this.prisma);
    const encryption = this.createEncryptionService();

    const faceEngine = await this.createFaceEngineSafely();
    if (!faceEngine) return;

    this.engine = faceEngine;

    const recognitionConfig = this.buildRecognitionConfig();
    const decisionPolicy = new RecognitionDecisionPolicy(recognitionConfig);
    const attendancePolicy = new AttendancePolicy(
      studentDirectory,
      this.recognitionRepo,
      recognitionConfig.duplicatePrevention.windowMinutes,
    );

    this.enrollmentService = new EnrollmentService(
      this.enrollmentRepo,
      faceEngine,
      encryption,
      this.authAdapter,
      this.auditRepo,
      studentDirectory,
      {
        maxFacesPerImage: 1,
        enrollmentRetryLimit: 3,
        // Wire FACE_QUALITY_THRESHOLD into enrollment too: the enrollment
        // gate rejects `quality.overallScore < config.qualityThreshold`, and
        // without this the operator threshold never reaches enrollment
        // (re-audit finding #2 — it previously only fed the decision policy).
        qualityThreshold: this.readNumberEnv(
          ENV.FACE_QUALITY_THRESHOLD,
          0.4,
          0,
          1,
        ),
      },
    );

    this.recognitionService = new RecognitionService(
      faceEngine,
      encryption,
      this.recognitionRepo,
      this.enrollmentRepo,
      this.authAdapter,
      this.auditRepo,
      decisionPolicy,
      attendancePolicy,
    );

    this.deviceService = new DeviceService(
      this.deviceRepo,
      this.authAdapter,
      this.auditRepo,
      encryption,
    );

    this.nestLogger.log(
      `FaceService initialized with provider: ${this.engineProvider}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    // Best-effort dispose so tests / HMR do not leak the ONNX session.
    const engine = this.engine as
      | (FaceEngine & { dispose?: () => Promise<void> | void })
      | null;

    if (engine && typeof engine.dispose === 'function') {
      try {
        await engine.dispose();
      } catch (error) {
        this.nestLogger.warn(
          `Face engine dispose failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private initRepositories(): void {
    this.enrollmentRepo = new PrismaEnrollmentAdapter(this.prisma);
    this.recognitionRepo = new PrismaRecognitionAdapter(
      this.prisma,
      this.attendanceDecisionEngine,
    );
    this.deviceRepo = new PrismaDeviceAdapter(this.prisma);
    this.auditRepo = new PrismaAuditAdapter(this.prisma);
  }

  /**
   * Best-effort engine creation. In production any failure is fatal; in dev a
   * missing engine disables face endpoints but lets the API boot (otherwise
   * main.ts exits on an unhandledRejection).
   */
  private async createFaceEngineSafely(): Promise<FaceEngine | null> {
    try {
      const { getSharedFaceEngine, resolveFaceEngineProvider } = await import(
        './face-engine.factory.js'
      );

      const engine = await getSharedFaceEngine();

      // Derive the provider from the ENGINE ITSELF, not from env, so
      // getEngineStatus() can never report `real-local` for a mock fallback.
      this.engineProvider = this.detectProvider(engine, resolveFaceEngineProvider);

      return engine;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (process.env[ENV.NODE_ENV] === 'production') {
        throw error;
      }

      this.nestLogger.error(
        `Face engine unavailable, face endpoints disabled: ${message}`,
      );
      return null;
    }
  }

  /**
   * The factory's env-resolved provider is a HINT. If the engine reports a
   * mock model version, trust the engine — otherwise a dev fallback could
   * advertise itself as production-real on the status endpoint.
   */
  private detectProvider(
    engine: FaceEngine,
    resolveDeclared: () => string,
  ): EngineProvider {
    let declared: EngineProvider = 'mock';
    try {
      const value = resolveDeclared();
      declared =
        value === 'mock' ||
        value === 'real-local' ||
        value === 'uninitialized'
          ? value
          : 'mock';
    } catch {
      declared = 'mock';
    }

    try {
      const engineAny = engine as unknown as {
        getModelVersion?: () => string | undefined;
      };
      const version = engineAny.getModelVersion?.();
      if (typeof version === 'string' && version.toLowerCase().includes('mock')) {
        return 'mock';
      }
    } catch {
      // If the engine cannot report a version we fall back to the declared one.
    }

    return declared;
  }

  // ---------------------------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------------------------

  /**
   * Read a bounded numeric setting from the environment with a safe fallback.
   * Shared vocabulary with the camera worker so both pipelines are tuned with
   * the SAME knobs.
   */
  private readBooleanEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    return raw === 'true' || raw === '1';
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
    if (!Number.isFinite(value) || value < min || value > max) return fallback;
    return value;
  }

  /**
   * Thresholds are operational calibration values (model-, hardware- and
   * room-dependent) — env overrides make them tunable without a redeploy.
   */
  private buildRecognitionConfig(): FaceRecognitionConfig {
    const base = DEFAULT_FACE_RECOGNITION_CONFIG;
    const acceptUncertain = this.readBooleanEnv(
      ENV.FACE_LIVENESS_ACCEPT_UNCERTAIN,
      process.env[ENV.NODE_ENV] !== 'production',
    );
    const livenessThreshold = this.readNumberEnv(
      ENV.FACE_LIVENESS_PASS_THRESHOLD,
      this.readNumberEnv(
        ENV.FACE_LIVENESS_THRESHOLD,
        base.livenessPolicy.threshold,
        0,
        1,
      ),
      0,
      1,
    );

    return {
      ...base,
      livenessPolicy: {
        ...base.livenessPolicy,
        threshold: livenessThreshold,
        acceptUncertain,
      },
      qualityThreshold: this.readNumberEnv(
        ENV.FACE_QUALITY_THRESHOLD,
        base.qualityThreshold,
        0,
        1,
      ),
      matching: {
        ...base.matching,
        similarityThreshold: this.readNumberEnv(
          ENV.FACE_SIMILARITY_THRESHOLD,
          base.matching.similarityThreshold,
          0,
          1,
        ),
        minAmbiguityMargin: this.readNumberEnv(
          ENV.FACE_AMBIGUITY_MARGIN,
          base.matching.minAmbiguityMargin,
          0,
          1,
        ),
        uncertainMargin: this.readNumberEnv(
          ENV.FACE_UNCERTAIN_MARGIN,
          base.matching.uncertainMargin,
          0,
          1,
        ),
      },
      duplicatePrevention: {
        ...base.duplicatePrevention,
        windowMinutes: this.readNumberEnv(
          ENV.FACE_DUPLICATE_WINDOW_MINUTES,
          base.duplicatePrevention.windowMinutes,
          0,
          DUPLICATE_WINDOW_MAX_MINUTES,
        ),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // ENCRYPTION
  // ---------------------------------------------------------------------------

  /**
   * AES-256 requires exactly 32 BYTES (UTF-8) — the previous check used
   * `String.length`, which is the number of UTF-16 code units and would let a
   * 32-character multi-byte string through, only to fail at cipher-time.
   *
   * Fail-closed: never fall back to a hardcoded key regardless of NODE_ENV.
   */
  private createEncryptionService(): AesEncryptionService {
    const configuredKey = process.env[ENV.BIOMETRIC_ENCRYPTION_KEY];

    if (!configuredKey) {
      throw new Error(`${ENV.BIOMETRIC_ENCRYPTION_KEY} must be configured`);
    }

    const byteLength = Buffer.byteLength(configuredKey, 'utf8');
    if (byteLength !== AES_256_KEY_BYTES) {
      throw new Error(
        `${ENV.BIOMETRIC_ENCRYPTION_KEY} must be exactly ` +
          `${AES_256_KEY_BYTES} bytes (UTF-8) for AES-256; got ${byteLength}`,
      );
    }

    return new AesEncryptionService(configuredKey);
  }

  // ---------------------------------------------------------------------------
  // EVENTS
  // ---------------------------------------------------------------------------

  /**
   * Tell every camera worker that this organization's template gallery changed
   * so their per-worker caches are invalidated now instead of after
   * TEMPLATE_CACHE_TTL_MS. Best-effort: a failed publish only delays
   * invalidation until the TTL expires, never breaks the enrollment call.
   *
   * NOTE: `RedisPubSubService.publish` is the SINGLE source of truth for
   * serialization — always pass a raw payload. Mixing raw objects and
   * pre-stringified JSON caused double-serialization downstream.
   */
  private notifyTemplatesChanged(organizationId: string): void {
    if (!this.redisPubSub) return;

    this.redisPubSub
      .publish(FACE_TEMPLATES_CHANGED_CHANNEL, { organizationId })
      .catch((error: unknown) => {
        this.nestLogger.warn(
          `Failed to publish ${FACE_TEMPLATES_CHANGED_CHANNEL} for org ` +
            `${organizationId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
        );
      });
  }

  // ---------------------------------------------------------------------------
  // DEPENDENCY ACCESS
  // ---------------------------------------------------------------------------

  private getEnrollmentService(): EnrollmentService {
    if (!this.enrollmentService) throw new Error(UNINITIALIZED_ERROR);
    return this.enrollmentService;
  }

  private getRecognitionService(): RecognitionService {
    if (!this.recognitionService) throw new Error(UNINITIALIZED_ERROR);
    return this.recognitionService;
  }

  private getDeviceService(): DeviceService {
    if (!this.deviceService) throw new Error(UNINITIALIZED_ERROR);
    return this.deviceService;
  }

  // ---------------------------------------------------------------------------
  // AUDIT HELPER
  // ---------------------------------------------------------------------------

  /**
   * Best-effort audit. We never let an audit failure break the user-facing
   * request — a failed audit is logged loudly and, if a queue is added later,
   * can be retried there.
   */
  private async writeAudit(
    actor: AuditActor,
    type: string,
    resourceType: string,
    resourceId: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditRepo.record({
        organizationId: actor.organizationId,
        userId: actor.userId,
        type,
        resourceType,
        resourceId,
        data,
      });
    } catch (error) {
      this.nestLogger.error(
        `Audit write failed (type=${type}, resource=${resourceType}:${resourceId}): ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // ENGINE STATUS
  // ---------------------------------------------------------------------------

  getEngineStatus(): {
    provider: EngineProvider;
    isReal: boolean;
    initialized: boolean;
    limiter: { active: number; queued: number; maxConcurrency: number; maxQueueSize: number };
  } {
    return {
      provider: this.engineProvider,
      isReal: this.engineProvider === 'real-local',
      initialized: this.enrollmentService !== null,
      limiter: this.inferenceLimiter.stats,
    };
  }

  // ---------------------------------------------------------------------------
  // ENROLLMENT
  // ---------------------------------------------------------------------------

  async startEnrollment(tenant: TenantContext, studentId: string) {
    return this.getEnrollmentService().startEnrollment(tenant, studentId);
  }

  async processEnrollmentCapture(
    tenant: TenantContext,
    enrollmentId: string,
    imageBase64: string,
  ) {
    const imageBuffer = decodeValidatedImage(imageBase64);

    const result = await this.getEnrollmentService().processEnrollmentCapture(
      tenant,
      enrollmentId,
      imageBuffer,
    );

    // A successful capture activates the enrollment (or replaces a previous
    // template) — camera workers cache templates and must see the change now.
    this.notifyTemplatesChanged(tenant.organizationId);

    return result;
  }

  /**
   * Cancel a PENDING enrollment.
   *
   * FIXED:
   *  - Wrapped in a transaction so the existence-check and delete are atomic
   *    (previously a concurrent activation between the two queries could
   *    yield an incorrect `NotFound`).
   *  - Emits an audit event — this is the ONLY mutating face endpoint that
   *    bypassed the EnrollmentService and therefore previously left no
   *    biometric-data audit trail.
   */
  async cancelPendingEnrollment(tenant: TenantContext, enrollmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.faceEnrollment.deleteMany({
        where: {
          id: enrollmentId,
          organizationId: tenant.organizationId,
          status: 'PENDING',
        },
      });

      if (deleted.count === 0) {
        const existing = await tx.faceEnrollment.findFirst({
          where: { id: enrollmentId, organizationId: tenant.organizationId },
          select: { status: true },
        });

        if (!existing) throw new NotFoundException('Enrollment not found');
        throw new BadRequestException(
          'Only PENDING enrollments can be cancelled',
        );
      }

      await this.writeAudit(
        {
          organizationId: tenant.organizationId,
          userId: tenant.userId,
        },
        AUDIT.ENROLLMENT_CANCELLED,
        'FaceEnrollment',
        enrollmentId,
      );

      return { success: true };
    });
  }

  async revokeEnrollment(
    tenant: TenantContext,
    enrollmentId: string,
    reason: string,
  ) {
    const result = await this.getEnrollmentService().revokeEnrollment(
      tenant,
      enrollmentId,
      reason,
    );

    // Revoked templates must disappear from camera matching IMMEDIATELY — a
    // revoked student must never keep matching for up to 30s.
    this.notifyTemplatesChanged(tenant.organizationId);

    return result;
  }

  async reenrollStudent(
    tenant: TenantContext,
    enrollmentId: string,
    reason: string,
  ) {
    const result = await this.getEnrollmentService().reenrollStudent(
      tenant,
      enrollmentId,
      reason,
    );

    this.notifyTemplatesChanged(tenant.organizationId);
    return result;
  }

  /**
   * Sanitizes an enrollment entity for client consumption.
   * Strips raw encrypted template ciphertext and vector hash (M-EDU-BIO-002).
   */
  private sanitizeEnrollment<T extends { templates?: any[] }>(enrollment: T): T {
    if (!enrollment) return enrollment;
    const sanitized = { ...enrollment };
    if (Array.isArray(sanitized.templates)) {
      sanitized.templates = sanitized.templates.map((template: any) => {
        const { templateData, templateHash, ...safeTemplate } = template;
        return safeTemplate;
      });
    }
    return sanitized;
  }

  async listEnrollments(
    tenant: TenantContext,
    filters: Parameters<EnrollmentRepository['list']>[1],
  ) {
    // Uses the repo directly (not the domain service) so listing still works
    // when the engine is disabled in dev.
    const { items, total } = await this.enrollmentRepo.list(
      tenant.organizationId,
      filters,
    );
    const sanitizedItems = items.map((item) => this.sanitizeEnrollment(item));
    return this.paginated(sanitizedItems, total, filters);
  }

  async getEnrollment(tenant: TenantContext, id: string) {
    const enrollment = await this.enrollmentRepo.findById(
      tenant.organizationId,
      id,
    );
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return this.sanitizeEnrollment(enrollment);
  }

  // ---------------------------------------------------------------------------
  // RECOGNITION
  // ---------------------------------------------------------------------------

  /**
   * Start a recognition session after validating every client-supplied scope
   * id against the caller's organization.
   *
   * NOTE: The three scope checks are consistent with each other inside a
   * single transaction. Full protection against a concurrent
   * `group.isActive = false` between this validation and the session INSERT
   * would require RecognitionService.startSession to accept the same `tx`
   * client — that is a next-step refactor on the core package.
   */
  async startSession(
    tenant: TenantContext,
    params: Parameters<RecognitionService['startSession']>[1],
  ) {
    await this.prisma.$transaction((tx) =>
      this.validateSessionScope(tx, tenant.organizationId, params),
    );

    return this.getRecognitionService().startSession(tenant, params);
  }

  /**
   * P0: reject ids that are missing, foreign, or inconsistent before a
   * RecognitionSession row is created.
   *
   * Uses NotFoundException for unknown/foreign ids so existence of another
   * tenant's rows is never leaked.
   */
  private async validateSessionScope(
    tx: Prisma.TransactionClient,
    organizationId: string,
    params: SessionScopeParams,
  ): Promise<void> {
    let group: { id: string; isActive: boolean } | null = null;

    if (params.groupId) {
      group = await tx.group.findFirst({
        where: { id: params.groupId, organizationId },
        select: { id: true, isActive: true },
      });

      if (!group) throw new NotFoundException('Group not found');
      if (!group.isActive) {
        throw new BadRequestException(
          'Group is inactive and cannot receive attendance',
        );
      }
    }

    if (params.lessonId) {
      const lesson = await tx.lesson.findFirst({
        where: { id: params.lessonId, organizationId },
        select: { id: true, groupId: true, status: true },
      });

      if (!lesson) throw new NotFoundException('Lesson not found');
      if (lesson.status === 'CANCELLED') {
        throw new BadRequestException('Lesson is cancelled');
      }
      if (group && lesson.groupId !== group.id) {
        throw new BadRequestException(
          'Lesson does not belong to the specified group',
        );
      }
    }

    if (params.deviceId) {
      const device = await tx.faceDevice.findFirst({
        where: { id: params.deviceId, organizationId },
        select: { id: true },
      });
      if (!device) throw new NotFoundException('Device not found');
    }
  }

  /**
   * Process a single recognition attempt.
   *
   * FIXED:
   *  - `clientAttemptId` (idempotency key): replay-safe when the camera
   *    retries a frame after a network blip. Requires
   *    `RecognitionAttempt.clientAttemptId String? @unique` in the schema.
   *  - Financial gate is FAIL-CLOSED: a missing student denies entry instead
   *    of silently producing an orphan attendance row.
   *  - OUT_OF_SCHEDULE defensively rolls back any attendance row the policy
   *    may have produced (belt-and-braces in case the policy ever changes).
   *  - DUPLICATE_PREVENTED no longer claims `attendanceRecorded: true` for a
   *    row it did not create.
   *  - Rollbacks emit an audit event.
   */
  async processAttempt(
    tenant: TenantContext,
    sessionId: string,
    imageBase64: string,
    clientAttemptId?: string,
  ) {
    // ---- Idempotency replay --------------------------------------------
    if (clientAttemptId) {
      const replay = await this.findIdempotentReplay(
        tenant.organizationId,
        sessionId,
        clientAttemptId,
      );
      if (replay) return replay;
    }

    const imageBuffer = decodeValidatedImage(imageBase64);

    const releaseInference = await this.inferenceLimiter.acquire();
    let result: any;
    try {
      result = await this.getRecognitionService().processAttempt(
        tenant,
        sessionId,
        imageBuffer,
      );
    } finally {
      releaseInference();
    }

    // ---- Non-identified attempts: nothing to gate ----------------------
    if (result.status !== 'IDENTIFIED' || !result.student?.id) {
      const response = { ...result, accessDenied: false };
      await this.attachIdempotencyRecord(clientAttemptId, result.attemptId, response);
      return response;
    }

    const studentId = result.student.id;

    // ---- Schedule gate --------------------------------------------------
    // The gate runs INSIDE AttendancePolicy — BEFORE the attendance row is
    // created. If it ever produces a row anyway, roll it back so the API
    // response and DB stay consistent.
    if (result.attendanceDecision === 'OUT_OF_SCHEDULE') {
      if (result.attendanceRecordId) {
        this.nestLogger.warn(
          `OUT_OF_SCHEDULE attempt ${result.attemptId} unexpectedly produced ` +
            `attendance ${result.attendanceRecordId}; rolling back.`,
        );
        await this.rollbackAttemptAttendance(
          { organizationId: tenant.organizationId, userId: tenant.userId },
          studentId,
          result.attemptId,
          result.attendanceRecordId,
        );
      }

      const response = {
        ...result,
        attendanceRecorded: false,
        attendanceRecordId: null,
        accessDenied: true,
        accessReason: 'OUT_OF_SCHEDULE',
      };
      await this.attachIdempotencyRecord(clientAttemptId, result.attemptId, response);
      return response;
    }

    // ---- Financial gate (F-009) ----------------------------------------
    // `Student.balance` is a prepayment credit ledger, NOT outstanding debt.
    // The obligation is derived from open invoices with the canonical
    // `computeInvoiceOutstanding` formula.
    const financial = await this.loadStudentFinancial(
      tenant.organizationId,
      studentId,
    );

    // FAIL-CLOSED: recognition claims a student that the org does not know.
    // Never write attendance for a phantom identity.
    if (!financial) {
      this.nestLogger.error(
        `IDENTIFIED student ${studentId} not found in org ` +
          `${tenant.organizationId}; attempt ${result.attemptId} denied.`,
      );

      await this.rollbackAttemptAttendance(
        { organizationId: tenant.organizationId, userId: tenant.userId },
        studentId,
        result.attemptId,
        result.attendanceRecordId,
      );

      await this.writeAudit(
        { organizationId: tenant.organizationId, userId: tenant.userId },
        AUDIT.ATTENDANCE_DENIED_NO_STUDENT,
        'RecognitionAttempt',
        result.attemptId,
        { studentId, sessionId },
      );

      const response = {
        ...result,
        attendanceRecorded: false,
        accessDenied: true,
        accessReason: 'STUDENT_NOT_FOUND',
      };
      await this.attachIdempotencyRecord(clientAttemptId, result.attemptId, response);
      return response;
    }

    if (financial.overdue > 0) {
      const financialGatePolicy = process.env.FACE_FINANCIAL_GATE_POLICY || 'STRICT_BLOCK';
      if (financialGatePolicy === 'WARN_AND_ALLOW') {
        this.nestLogger.warn(
          `Student ${studentId} has overdue debt ${financial.overdue}, but policy is WARN_AND_ALLOW. Attendance allowed with warning.`,
        );
        const response = {
          ...result,
          accessDenied: false,
          financialWarning: true,
          accessReason: 'INSUFFICIENT_FUNDS_WARNED',
          balance: financial.balance,
          outstanding: financial.outstanding,
          overdue: financial.overdue,
        };
        await this.attachIdempotencyRecord(clientAttemptId, result.attemptId, response);
        if (result.attendanceRecorded && result.attendanceRecordId) {
          void this.emitAttendanceNotification(
            tenant.organizationId,
            result.attendanceRecordId,
            studentId,
          );
        }
        return response;
      }

      await this.rollbackAttemptAttendance(
        { organizationId: tenant.organizationId, userId: tenant.userId },
        studentId,
        result.attemptId,
        result.attendanceRecordId,
      );

      const response = {
        ...result,
        attendanceRecorded: false,
        accessDenied: true,
        accessReason: 'INSUFFICIENT_FUNDS',
        balance: financial.balance,
        outstanding: financial.outstanding,
        overdue: financial.overdue,
      };
      await this.attachIdempotencyRecord(clientAttemptId, result.attemptId, response);
      return response;
    }

    // ---- Duplicate-prevention is NOT a new attendance ------------------
    // Runs AFTER the entry gates: a duplicate recognition of a student who
    // is refused entry must still be denied — no new row ≠ door open.
    if (result.attendanceDecision === 'DUPLICATE_PREVENTED') {
      const response = {
        ...result,
        attendanceRecorded: false,
        attendanceRecordId: null,
        duplicateOfAttendanceId: result.attendanceRecordId ?? null,
        accessDenied: false,
      };
      await this.attachIdempotencyRecord(clientAttemptId, result.attemptId, response);
      return response;
    }

    // ---- Success path: emit downstream notification --------------------
    if (result.attendanceRecorded && result.attendanceRecordId) {
      void this.emitAttendanceNotification(
        tenant.organizationId,
        result.attendanceRecordId,
        studentId,
      );
    }

    // Emit notifications for any additional students identified in multi-face capture
    if ((result as any).matches && Array.isArray((result as any).matches)) {
      for (const m of (result as any).matches) {
        if (m.student?.id && m.student.id !== studentId && m.attendanceRecorded && m.attendanceRecordId) {
          void this.emitAttendanceNotification(
            tenant.organizationId,
            m.attendanceRecordId,
            m.student.id,
          );
        }
      }
    }

    const response = { ...result, accessDenied: false };
    await this.attachIdempotencyRecord(clientAttemptId, result.attemptId, response);
    return response;
  }

  /**
   * Replay-safe lookup by clientAttemptId. Returns a cached response when
   * the same attempt key was already processed in this session.
   *
   * Requires the schema field `RecognitionAttempt.clientAttemptId @unique`.
   */
  private async findIdempotentReplay(
    organizationId: string,
    sessionId: string,
    clientAttemptId: string,
  ): Promise<Record<string, unknown> | null> {
    const existing = await this.prisma.recognitionAttempt.findFirst({
      where: {
        organizationId,
        sessionId,
        clientAttemptId,
      },
      include: {
        // Attach whatever the response mapper needs — placeholder shape.
        student: { select: { id: true } },
      },
    });

    if (!existing) return null;

    // The original response snapshot (including accessDenied / accessReason)
    // is stored in metadata by attachIdempotencyRecord. Reconstruct it.
    const metadata = (existing.metadata ?? {}) as Record<string, unknown>;
    const snapshot = metadata.idempotencySnapshot as
      | Record<string, unknown>
      | undefined;

    if (snapshot && typeof snapshot === 'object') {
      return { ...snapshot, idempotentReplay: true };
    }

    // Fallback for legacy rows without a snapshot: reconstruct the minimal
    // shape from the columns, preserving accessDenied when attendance was
    // rolled back (attendanceId present but attendanceDecision indicates a
    // denial path).
    const attendanceDecision = existing.attendanceDecision ?? null;
    const isDenied =
      attendanceDecision === 'OUT_OF_SCHEDULE' ||
      attendanceDecision === 'STUDENT_INACTIVE' ||
      attendanceDecision === 'STUDENT_NOT_IN_GROUP' ||
      attendanceDecision === 'NO_SCHEDULED_GROUP' ||
      attendanceDecision === 'AMBIGUOUS_SCHEDULE';

    return {
      attemptId: existing.id,
      status: existing.status,
      attendanceDecision,
      attendanceRecorded: false,
      attendanceRecordId: existing.attendanceId ?? null,
      student: existing.student ?? undefined,
      idempotentReplay: true,
      accessDenied: isDenied,
      ...(isDenied ? { accessReason: attendanceDecision } : {}),
    };
  }

  /**
   * Convert one response field into a value Prisma accepts for a JSON column.
   *
   * Everything that is NOT a JSON literal is dropped (the key is omitted) so a
   * replay can never disagree with the original response because a NaN slipped
   * into `metadata` as `null`.
   *
   * PRISMA TYPING GAP: `Prisma.InputJsonValue` does not include `null` even
   * though `null` is legal JSON — and this contract REQUIRES it
   * (`attendanceRecordId: null` must round-trip on replay). The single
   * widening therefore happens here, against a value already proven to be a
   * JSON literal, instead of a blanket `as any` at the call site.
   */
  private toSnapshotValue(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === null) {
      return null as unknown as Prisma.InputJsonValue;
    }
    if (value === undefined) return undefined;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      // JSON has no NaN/Infinity: JSON.stringify silently rewrites them to
      // `null`, which would make the replayed response differ from the first one.
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
      } catch {
        // Circular / non-serializable — drop the key rather than persist a
        // corrupt snapshot.
        return undefined;
      }
    }
    // Functions and symbols have no JSON representation.
    return undefined;
  }

  /**
   * Attach the clientAttemptId AND a snapshot of the final response to the
   * attempt row so an idempotent replay returns the EXACT same result —
   * including accessDenied and accessReason.
   *
   * Best-effort: a failure to persist the snapshot only degrades replay to
   * the column-based fallback; it never breaks the original request.
   */
  private async attachIdempotencyRecord(
    clientAttemptId: string | undefined,
    attemptId: string | undefined,
    response: Record<string, unknown>,
  ): Promise<void> {
    if (!clientAttemptId || !attemptId) return;

    // Build a JSON-safe snapshot: strip non-serializable values.
    const snapshot: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, value] of Object.entries(response)) {
      const serialized = this.toSnapshotValue(value);
      if (serialized !== undefined) snapshot[key] = serialized;
    }

    await this.prisma.recognitionAttempt
      .update({
        where: { id: attemptId },
        data: {
          clientAttemptId,
          metadata: { idempotencySnapshot: snapshot },
        },
      })
      .catch((err: Error) => {
        this.nestLogger.warn(
          `Failed to attach idempotency record to attempt ${attemptId}: ${err.message}`,
        );
      });
  }

  /**
   * Load the student's balance (in org scope) plus the overdue / outstanding
   * amounts computed from open invoices. Returns null when the student does
   * not belong to this organization.
   */
  private async loadStudentFinancial(
    organizationId: string,
    studentId: string,
  ): Promise<StudentFinancialSnapshot | null> {
    // Tenant-scoped read — never resolve a student outside the caller's org.
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
      select: { balance: true },
    });
    if (!student) return null;

    const openInvoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        studentId,
        status: { notIn: [...NON_BILLABLE_INVOICE_STATUSES] },
      },
      select: {
        status: true,
        total: true,
        paidAmount: true,
        refundedAmount: true,
        dueDate: true,
      },
      take: 100,
    });

    const { overdue, outstanding } = computeInvoiceOutstanding(openInvoices);

    return {
      balance: Number(student.balance),
      outstanding,
      overdue,
    };
  }

  private async emitAttendanceNotification(
    organizationId: string,
    attendanceId: string,
    studentId: string,
  ): Promise<void> {
    try {
      const student = await this.prisma.student.findFirst({
        where: { id: studentId, organizationId },
        select: {
          user: { select: { firstName: true, lastName: true } },
          groups: {
            where: { isActive: true },
            include: { group: { select: { name: true } } },
            take: 1,
          },
        },
      });

      const studentName =
        [student?.user?.firstName, student?.user?.lastName]
          .filter((part): part is string => Boolean(part))
          .join(' ')
          .trim() || STUDENT_NAME_FALLBACK;
      const groupName = student?.groups?.[0]?.group?.name || '';

      if (this.redisPubSub) {
        // Raw payload — the pub/sub service owns serialization.
        await this.redisPubSub.publish(ATTENDANCE_CREATED_EVENT, {
          organizationId,
          attendanceId,
          studentId,
          studentName,
          groupName,
          recognizedAt: new Date().toISOString(),
        });
      }

      if (!this.notificationEvents) return;

      await this.notificationEvents.emit({
        organizationId,
        type: 'ATTENDANCE_MARKED_PRESENT',
        occurredAt: new Date().toISOString(),
        entityType: 'Attendance',
        entityId: attendanceId,
        data: { studentId, studentName },
      });
    } catch (error) {
      // NestJS Logger signature is (message, stack?) — passing an object as
      // the second argument produces "[object Object]" noise.
      this.nestLogger.error(
        `Failed to emit attendance recognition notification ` +
          `(org=${organizationId}, attendance=${attendanceId}, student=${studentId}): ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Undo the attendance produced by ONE recognition attempt.
   *
   * Scoped by exact attendance id + student + attempt id inside a
   * transaction so it can never delete an unrelated row. Every rollback is
   * audit-logged — biometric attendance deletion is a security event.
   *
   * When the pipeline did not create an attendance row for this attempt
   * (`attendanceRecordId === null`, e.g. DUPLICATE_PREVENTED) nothing is
   * deleted — the pre-existing row belongs to someone else.
   */
  private async rollbackAttemptAttendance(
    actor: AuditActor,
    studentId: string,
    attemptId: string,
    attendanceRecordId: string | null,
  ): Promise<void> {
    if (!attendanceRecordId) return;

    const { organizationId } = actor;

    const deletedCount = await this.prisma.$transaction(async (tx) => {
      await tx.cameraAttendanceEvent.deleteMany({
        where: {
          organizationId,
          studentId,
          attendanceId: attendanceRecordId,
        },
      });

      const deleted = await tx.attendance.deleteMany({
        where: {
          id: attendanceRecordId,
          organizationId,
          studentId,
          recognitionAttemptId: attemptId,
        },
      });

      return deleted.count;
    });

    if (deletedCount > 0) {
      await this.writeAudit(
        actor,
        AUDIT.ATTENDANCE_ROLLED_BACK,
        'Attendance',
        attendanceRecordId,
        { studentId, attemptId },
      );
    }
  }

  async finishSession(
    tenant: TenantContext,
    sessionId: string,
    reason: Parameters<RecognitionService['finishSession']>[2],
  ) {
    return this.getRecognitionService().finishSession(
      tenant,
      sessionId,
      reason,
    );
  }

  async getRecognitionHistory(
    tenant: TenantContext,
    filters: RecognitionHistoryQueryDto,
  ) {
    const { items, total } = await this.recognitionRepo.listAttempts(
      tenant.organizationId,
      {
        sessionId: filters.sessionId,
        studentId: filters.studentId,
        status: filters.status,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
        dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
        page: filters.page,
        limit: filters.limit,
      },
    );

    return this.paginated(items, total, filters);
  }

  /**
   * Session attempts. Optional pagination so long-running sessions cannot
   * return unbounded rows. Existing callers without `page`/`limit` get the
   * default page size — same shape as before plus pagination metadata.
   */
  async getSessionAttempts(
    tenant: TenantContext,
    sessionId: string,
    pagination?: PaginationFilters,
  ) {
    const { items, total } = await this.recognitionRepo.getSessionAttempts(
      tenant.organizationId,
      sessionId,
      pagination,
    );

    return this.paginated(items, total, pagination ?? {});
  }

  // ---------------------------------------------------------------------------
  // DEVICES
  // ---------------------------------------------------------------------------

  async registerDevice(
    tenant: TenantContext,
    data: Parameters<DeviceService['register']>[1],
  ) {
    return this.getDeviceService().register(tenant, data);
  }

  async listDevices(
    tenant: TenantContext,
    filters: Parameters<DeviceService['list']>[1],
  ) {
    const { items, total } = await this.getDeviceService().list(
      tenant,
      filters,
    );
    return this.paginated(items, total, filters);
  }

  async getDevice(tenant: TenantContext, id: string) {
    return this.getDeviceService().getDevice(tenant, id);
  }

  async revokeDevice(tenant: TenantContext, id: string) {
    return this.getDeviceService().revoke(tenant, id);
  }

  // ---------------------------------------------------------------------------
  // AUDIT
  // ---------------------------------------------------------------------------

  async getAuditLog(tenant: TenantContext, filters: FaceAuditQueryDto) {
    const { items, total } = await this.auditRepo.query(tenant.organizationId, {
      type: filters.type,
      resourceType: filters.resourceType,
      resourceId: filters.resourceId,
      userId: filters.userId,
      search: filters.search,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
      page: filters.page,
      limit: filters.limit,
    });

    return this.paginated(items, total, filters);
  }

  // ---------------------------------------------------------------------------
  // ANALYTICS
  // ---------------------------------------------------------------------------

  async getAnalytics(tenant: TenantContext) {
    const now = new Date();
    const thirtyDaysAgo = new Date(
      now.getTime() - ANALYTICS_WINDOW_DAYS * MS_PER_DAY,
    );

    // Organization-local day boundary — never server-local midnight. For an
    // org in Asia/Tashkent, "today" starts at 19:00 UTC the previous day;
    // using the server's local midnight would misattribute the first/last
    // hours of the org's day (P2 timezone bug).
    const org = await this.prisma.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { timezone: true },
    });
    const todayStart = getOrganizationDate(
      now,
      org?.timezone ?? null,
    );
    const todayEnd = new Date(todayStart.getTime() + MS_PER_DAY);

    const [
      totalEnrolled,
      activeEnrollments,
      totalSessions,
      recognitionStats,
      activeDevices,
      todayAttendance,
    ] = await Promise.all([
      this.enrollmentRepo.countTotal(tenant.organizationId),
      this.enrollmentRepo.countActive(tenant.organizationId),
      this.prisma.recognitionSession.count({
        where: { organizationId: tenant.organizationId },
      }),
      this.recognitionRepo.getRecognitionStats(
        tenant.organizationId,
        thirtyDaysAgo,
        now,
      ),
      this.deviceRepo.countActive(tenant.organizationId),
      // Count AUTHORITATIVE attendance rows, not camera events — camera
      // events survive a manual "absent" edit and would inflate the number.
      this.prisma.attendance.count({
        where: {
          organizationId: tenant.organizationId,
          markedAt: { gte: todayStart, lt: todayEnd },
          status: 'PRESENT',
        },
      }),
    ]);

    const {
      totalAttempts,
      successful,
      livenessFailures,
      averageLatencyMs,
    } = recognitionStats;

    return {
      overview: {
        totalEnrolled,
        activeEnrollments,
        totalSessions,
        totalAttempts,
        recognitionSuccessRate:
          totalAttempts > 0
            ? Math.round((successful / totalAttempts) * 100)
            : null,
        // null on 0 attempts — 0% would wrongly imply total liveness failure.
        livenessPassRate:
          totalAttempts > 0
            ? Math.round(
                ((totalAttempts - livenessFailures) / totalAttempts) * 100,
              )
            : null,
        averageLatencyMs,
        activeDevices,
        todayAttendance,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // PAGINATION
  // ---------------------------------------------------------------------------

  private paginated<T>(
    items: T[],
    total: number,
    filters: PaginationFilters,
  ): PaginatedResult<T> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(
      Math.max(1, Number(filters.limit) || DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
