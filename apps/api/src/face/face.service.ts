import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
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
  type TenantContext,
} from '@medu/core';

import {
  MockDetector,
  MockEmbedder,
  MockLivenessChecker,
  MockMatcher,
} from '@medu/face-engine/mock';
import {
  RealFaceEngine,
} from '@medu/face-engine';

import {
  AesEncryptionService,
  SecureLogger,
} from '@medu/face-security';

import { PrismaService } from '../prisma/prisma.service';
import { AttendanceDecisionEngine } from '../camera/attendance-decision.engine';
import { decodeValidatedImage } from './image.util';
import {
  computeInvoiceOutstanding,
  NON_BILLABLE_INVOICE_STATUSES,
} from '../payments/invoice-outstanding';

import {
  PrismaAuditAdapter,
} from './adapters/prisma-audit.adapter';

import {
  PrismaDeviceAdapter,
} from './adapters/prisma-device.adapter';

import {
  PrismaEnrollmentAdapter,
} from './adapters/prisma-enrollment.adapter';

import {
  PrismaRecognitionAdapter,
} from './adapters/prisma-recognition.adapter';

import {
  PrismaStudentAdapter,
} from './adapters/prisma-student.adapter';

import {
  SimpleAuthorizationAdapter,
} from './adapters/authorization.adapter';

import {
  SimpleFaceEngine,
} from './adapters/engine-adapter';

import type {
  RecognitionHistoryQueryDto,
} from './dto/recognition.dto';

import type {
  FaceAuditQueryDto,
} from './dto/audit.dto';

@Injectable()
export class FaceService {
  private readonly logger = new SecureLogger('info');
  private readonly nestLogger = new Logger(FaceService.name);

  private readonly authAdapter =
    new SimpleAuthorizationAdapter();

  private enrollmentService: EnrollmentService | null = null;
  private recognitionService: RecognitionService | null = null;
  private deviceService: DeviceService | null = null;

  private engineProvider = 'mock';

  private enrollmentRepo!: PrismaEnrollmentAdapter;
  private recognitionRepo!: PrismaRecognitionAdapter;
  private deviceRepo!: PrismaDeviceAdapter;
  private auditRepo!: PrismaAuditAdapter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceDecisionEngine: AttendanceDecisionEngine,
  ) {}

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------

  async onModuleInit(): Promise<void> {
    this.enrollmentRepo =
      new PrismaEnrollmentAdapter(this.prisma);

    this.recognitionRepo =
      new PrismaRecognitionAdapter(
        this.prisma,
        this.attendanceDecisionEngine,
      );

    this.deviceRepo =
      new PrismaDeviceAdapter(this.prisma);

    this.auditRepo =
      new PrismaAuditAdapter(this.prisma);

    const studentDirectory =
      new PrismaStudentAdapter(this.prisma);

    const encryption =
      this.createEncryptionService();

    let faceEngine: FaceEngine;

    try {
      faceEngine = await this.createFaceEngine();
    } catch (error) {
      /*
       * The face engine is optional outside production. Production
       * configuration is validated at boot (validateConfig) and fails fast on a
       * misconfigured provider, but a developer machine without the ONNX models
       * must still be able to boot the API. Leaving the domain services null
       * makes every face endpoint answer "FaceService is not initialized"
       * through the accessors above instead of killing the whole process with an
       * unhandled rejection (main.ts exits on unhandledRejection).
       */
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }

      this.nestLogger.error(
        `Face engine unavailable, face endpoints disabled: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return;
    }

    const decisionPolicy =
      new RecognitionDecisionPolicy(
        DEFAULT_FACE_RECOGNITION_CONFIG,
      );

    const attendancePolicy =
      new AttendancePolicy(
        studentDirectory,
        this.recognitionRepo,
        DEFAULT_FACE_RECOGNITION_CONFIG
          .duplicatePrevention
          .windowMinutes,
      );

    this.enrollmentService =
      new EnrollmentService(
        this.enrollmentRepo,
        faceEngine,
        encryption,
        this.authAdapter,
        this.auditRepo,
        studentDirectory,
        {
          maxFacesPerImage: 1,
          enrollmentRetryLimit: 3,
        },
      );

    this.recognitionService =
      new RecognitionService(
        faceEngine,
        encryption,
        this.recognitionRepo,
        this.enrollmentRepo,
        this.authAdapter,
        this.auditRepo,
        decisionPolicy,
        attendancePolicy,
      );

    this.deviceService =
      new DeviceService(
        this.deviceRepo,
        this.authAdapter,
        this.auditRepo,
        encryption,
      );

    this.nestLogger.log(
      `FaceService initialized with provider: ${this.engineProvider}`,
    );
  }

  // ---------------------------------------------------------------------------
  // DEPENDENCY ACCESS
  // ---------------------------------------------------------------------------

  private getEnrollmentService(): EnrollmentService {
    if (!this.enrollmentService) {
      throw new Error(
        'FaceService is not initialized',
      );
    }

    return this.enrollmentService;
  }

  private getRecognitionService(): RecognitionService {
    if (!this.recognitionService) {
      throw new Error(
        'FaceService is not initialized',
      );
    }

    return this.recognitionService;
  }

  private getDeviceService(): DeviceService {
    if (!this.deviceService) {
      throw new Error(
        'FaceService is not initialized',
      );
    }

    return this.deviceService;
  }

  // ---------------------------------------------------------------------------
  // ENCRYPTION
  // ---------------------------------------------------------------------------

  private createEncryptionService(): AesEncryptionService {
    const configuredKey =
      process.env.BIOMETRIC_ENCRYPTION_KEY;

    if (configuredKey) {
      if (configuredKey.length !== 32) {
        throw new Error('BIOMETRIC_ENCRYPTION_KEY must be exactly 32 bytes long for AES-256');
      }
      return new AesEncryptionService(configuredKey);
    }

    // Fail-closed: never fall back to a hardcoded key regardless of NODE_ENV.
    // The previous guard allowed any non-'production' NODE_ENV value to
    // silently encrypt biometric templates with the known development key.
    throw new Error(
      'BIOMETRIC_ENCRYPTION_KEY must be configured',
    );
  }

  // ---------------------------------------------------------------------------
  // FACE ENGINE
  // ---------------------------------------------------------------------------

  private async createFaceEngine(): Promise<FaceEngine> {
    const { getSharedFaceEngine } = await import('./face-engine.factory.js');
    return getSharedFaceEngine();
  }
  private async createRealEngine(): Promise<FaceEngine> {
    const { resolveModelPath } = await import('./face-engine.factory.js');
    const detectorPath = resolveModelPath(process.env.FACE_DETECTOR_MODEL_PATH || '');
    const embedderPath = resolveModelPath(process.env.FACE_EMBEDDER_MODEL_PATH || '');
    const livenessPath = resolveModelPath(process.env.FACE_LIVENESS_MODEL_PATH || '');

    const missingModels: string[] = [];

    if (!detectorPath) {
      missingModels.push(
        'FACE_DETECTOR_MODEL_PATH',
      );
    }

    if (!embedderPath) {
      missingModels.push(
        'FACE_EMBEDDER_MODEL_PATH',
      );
    }

    /*
     * Liveness is part of the production recognition
     * security boundary. Therefore it must also be configured
     * in production.
     */
    if (
      process.env.NODE_ENV === 'production' &&
      !livenessPath
    ) {
      missingModels.push(
        'FACE_LIVENESS_MODEL_PATH',
      );
    }

    if (missingModels.length > 0) {
      const missing =
        missingModels.join(', ');

      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `Production real-local engine requires model paths: ${missing}`,
        );
      }

      this.nestLogger.warn(
        `Missing real-local model paths: ${missing}`,
      );
    }

    this.nestLogger.log(
      'Initializing real face recognition engine...',
    );

    this.nestLogger.log(
      `Detector: ${detectorPath || '(not configured)'}`,
    );

    this.nestLogger.log(
      `Embedder: ${embedderPath || '(not configured)'}`,
    );

    this.nestLogger.log(
      `Liveness: ${livenessPath || '(not configured)'}`,
    );

    const engine =
      new RealFaceEngine({
        detectorModelPath: detectorPath,
        embedderModelPath: embedderPath,
        livenessModelPath: livenessPath,
        embeddingDimension: 128,
      });

    try {
      await engine.initialize();

      const status =
        engine.getStatus();

      this.nestLogger.log(
        'Real face recognition engine initialized successfully',
      );

      this.nestLogger.log(
        `Status: detector=${status.detector}, ` +
          `embedder=${status.embedder}, ` +
          `liveness=${status.liveness}`,
      );

      this.nestLogger.log(
        `Model version: ${engine.getModelVersion()}`,
      );

      return engine;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'Real face recognition engine failed to initialize in production: ' +
            `${message}. Application cannot start without a working biometric engine.`,
        );
      }

      this.nestLogger.error(
        `Real engine initialization failed: ${message}`,
      );

      this.nestLogger.warn(
        'Falling back to mock engine for development.',
      );

      return this.createMockEngine();
    }
  }

  /**
   * Development-only mock engine.
   *
   * Never selected in production because createFaceEngine()
   * explicitly rejects the mock provider there.
   */
  private createMockEngine(): FaceEngine {
    const detector =
      new MockDetector();

    const embedder =
      new MockEmbedder();

    const liveness =
      new MockLivenessChecker();

    const matcher =
      new MockMatcher();

    return new SimpleFaceEngine(
      detector,
      embedder,
      liveness,
      matcher,
    );
  }

  // ---------------------------------------------------------------------------
  // ENGINE STATUS
  // ---------------------------------------------------------------------------

  getEngineStatus() {
    return {
      provider: this.engineProvider,
      isReal:
        this.engineProvider === 'real-local',
    };
  }

  // ---------------------------------------------------------------------------
  // ENROLLMENT
  // ---------------------------------------------------------------------------

  async startEnrollment(
    tenant: TenantContext,
    studentId: string,
  ) {
    return this
      .getEnrollmentService()
      .startEnrollment(
        tenant,
        studentId,
      );
  }

  async processEnrollmentCapture(
    tenant: TenantContext,
    enrollmentId: string,
    imageBase64: string,
  ) {
    const imageBuffer =
      decodeValidatedImage(
        imageBase64,
      );

    return this
      .getEnrollmentService()
      .processEnrollmentCapture(
        tenant,
        enrollmentId,
        imageBuffer,
      );
  }

  async cancelPendingEnrollment(tenant: TenantContext, enrollmentId: string) {
    // Atomic guard: status is part of the WHERE clause so a concurrent
    // activation between read and delete cannot be cancelled after the fact.
    const deleted = await this.prisma.faceEnrollment.deleteMany({
      where: {
        id: enrollmentId,
        organizationId: tenant.organizationId,
        status: 'PENDING',
      },
    });
    if (deleted.count === 0) {
      const existing = await this.prisma.faceEnrollment.findFirst({
        where: { id: enrollmentId, organizationId: tenant.organizationId },
        select: { status: true },
      });
      if (!existing) throw new NotFoundException('Enrollment not found');
      throw new BadRequestException('Only PENDING enrollments can be cancelled');
    }
    return { success: true };
  }

  async revokeEnrollment(
    tenant: TenantContext,
    enrollmentId: string,
    reason: string,
  ) {
    return this
      .getEnrollmentService()
      .revokeEnrollment(
        tenant,
        enrollmentId,
        reason,
      );
  }

  async reenrollStudent(
    tenant: TenantContext,
    enrollmentId: string,
    reason: string,
  ) {
    return this
      .getEnrollmentService()
      .reenrollStudent(
        tenant,
        enrollmentId,
        reason,
      );
  }

  async listEnrollments(
    tenant: TenantContext,
    filters: Parameters<
      EnrollmentRepository['list']
    >[1],
  ) {
    const { items, total } =
      await this.enrollmentRepo.list(
        tenant.organizationId,
        filters,
      );

    return this.paginated(
      items,
      total,
      filters,
    );
  }

  async getEnrollment(
    tenant: TenantContext,
    id: string,
  ) {
    const enrollment =
      await this.enrollmentRepo.findById(
        tenant.organizationId,
        id,
      );

    if (!enrollment) {
      throw new NotFoundException(
        'Enrollment not found',
      );
    }

    return enrollment;
  }

  // ---------------------------------------------------------------------------
  // RECOGNITION
  // ---------------------------------------------------------------------------

  async startSession(
    tenant: TenantContext,
    params: Parameters<
      RecognitionService['startSession']
    >[1],
  ) {
    return this
      .getRecognitionService()
      .startSession(
        tenant,
        params,
      );
  }

  async processAttempt(
    tenant: TenantContext,
    sessionId: string,
    imageBase64: string,
  ) {
    const imageBuffer =
      decodeValidatedImage(
        imageBase64,
      );

    const result = await this
      .getRecognitionService()
      .processAttempt(
        tenant,
        sessionId,
        imageBuffer,
      );

    // Entry gate: an identified student with an OVERDUE invoice is refused
    // entry, and the attendance that the recognition pipeline just created is
    // rolled back.
    //
    // F-009: `Student.balance` is a prepayment credit ledger (incremented on
    // PAID payments, decremented on refunds) — it is NOT the outstanding debt.
    // A student who never paid can still have balance 0, so the old
    // `balance < 0` test both denied the wrong students and let debtors in.
    // The obligation is derived from open invoices with the canonical formula
    // in PaymentsService/InvoicesService (computeInvoiceOutstanding).
    if (result.status === 'IDENTIFIED' && result.student?.id) {
      const studentId = result.student.id;

      // Tenant-scoped read — never resolve a student outside the caller's org.
            const student = await this.prisma.student.findFirst({
        where: { id: studentId, organizationId: tenant.organizationId },
        select: { balance: true },
      });

      // Schedule gate (audit P0-1).
      //
      // The gate now runs INSIDE AttendancePolicy — BEFORE the attendance
      // row is created — so an out-of-schedule recognition can never become
      // authoritative. The previous implementation validated AFTER commit
      // with a hardcoded 'Asia/Tashkent' timezone and deleted the row
      // afterwards, making post-commit deletion the business/security gate.
      // There is nothing to roll back: no attendance row was written.
      if (result.attendanceDecision === 'OUT_OF_SCHEDULE') {
        return {
          ...result,
          attendanceRecorded: false,
          attendanceRecordId: null,
          accessDenied: true,
          accessReason: 'OUT_OF_SCHEDULE',
        };
      }

      if (student) {
        const openInvoices = await this.prisma.invoice.findMany({
          where: {
            organizationId: tenant.organizationId,
            studentId,
            status: { notIn: [...NON_BILLABLE_INVOICE_STATUSES] },
          },
          select: { status: true, total: true, paidAmount: true, refundedAmount: true, dueDate: true },
        });
        const { overdue, outstanding } = computeInvoiceOutstanding(openInvoices);

        if (overdue > 0) {
          // Roll back ONLY the rows this attempt created. The previous
          // implementation deleted every attendance/event row for the student
          // within a 5-second window, which wiped a teacher's manual entry (or
          // a second, legitimate recognition) that happened to land in that
          // window.
          await this.rollbackAttemptAttendance(
            tenant.organizationId,
            studentId,
            result.attemptId,
            result.attendanceRecordId,
          );

          return {
            ...result,
            attendanceRecorded: false,
            accessDenied: true,
            accessReason: 'INSUFFICIENT_FUNDS',
            balance: Number(student.balance),
            outstanding,
            overdue,
          };
        }
      }
    }

    return {
      ...result,
      accessDenied: false,
    };
  }

  /**
   * Undo the attendance produced by one recognition attempt.
   *
   * Deletes by exact id / attempt id inside a transaction so it can never
   * touch an unrelated row:
   *  - the `CameraAttendanceEvent` rows linked to that attendance row
   *  - the `Attendance` row itself, re-checked against org + student + attempt
   *
   * When the pipeline did not create an attendance row for this attempt
   * (`attendanceRecordId === null`, e.g. the decision was DUPLICATE_PREVENTED)
   * nothing is deleted — the pre-existing row belongs to someone else.
   */
  private async rollbackAttemptAttendance(
    organizationId: string,
    studentId: string,
    attemptId: string,
    attendanceRecordId: string | null,
  ): Promise<void> {
    if (!attendanceRecordId) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.cameraAttendanceEvent.deleteMany({
        where: { organizationId, studentId, attendanceId: attendanceRecordId },
      });

      await tx.attendance.deleteMany({
        where: {
          id: attendanceRecordId,
          organizationId,
          studentId,
          recognitionAttemptId: attemptId,
        },
      });
    });
  }

  async finishSession(
    tenant: TenantContext,
    sessionId: string,
    reason: Parameters<
      RecognitionService['finishSession']
    >[2],
  ) {
    return this
      .getRecognitionService()
      .finishSession(
        tenant,
        sessionId,
        reason,
      );
  }

  async getRecognitionHistory(
    tenant: TenantContext,
    filters: RecognitionHistoryQueryDto,
  ) {
    const {
      items,
      total,
    } = await this.recognitionRepo.listAttempts(
      tenant.organizationId,
      {
        sessionId:
          filters.sessionId,

        studentId:
          filters.studentId,

        status:
          filters.status,

        dateFrom:
          filters.dateFrom
            ? new Date(filters.dateFrom)
            : undefined,

        dateTo:
          filters.dateTo
            ? new Date(filters.dateTo)
            : undefined,

        page:
          filters.page,

        limit:
          filters.limit,
      },
    );

    return this.paginated(
      items,
      total,
      filters,
    );
  }

  async getSessionAttempts(
    tenant: TenantContext,
    sessionId: string,
  ) {
    return this.recognitionRepo.getSessionAttempts(
      tenant.organizationId,
      sessionId,
    );
  }

  // ---------------------------------------------------------------------------
  // DEVICES
  // ---------------------------------------------------------------------------

  async registerDevice(
    tenant: TenantContext,
    data: Parameters<
      DeviceService['register']
    >[1],
  ) {
    return this
      .getDeviceService()
      .register(
        tenant,
        data,
      );
  }

  async listDevices(
    tenant: TenantContext,
    filters: Parameters<
      DeviceService['list']
    >[1],
  ) {
    const {
      items,
      total,
    } = await this
      .getDeviceService()
      .list(
        tenant,
        filters,
      );

    return this.paginated(
      items,
      total,
      filters,
    );
  }

  async getDevice(
    tenant: TenantContext,
    id: string,
  ) {
    return this
      .getDeviceService()
      .getDevice(
        tenant,
        id,
      );
  }

  async revokeDevice(
    tenant: TenantContext,
    id: string,
  ) {
    return this
      .getDeviceService()
      .revoke(
        tenant,
        id,
      );
  }

  // ---------------------------------------------------------------------------
  // AUDIT
  // ---------------------------------------------------------------------------

  async getAuditLog(
    tenant: TenantContext,
    filters: FaceAuditQueryDto,
  ) {
    const {
      items,
      total,
    } = await this.auditRepo.query(
      tenant.organizationId,
      {
        type:
          filters.type,

        resourceType:
          filters.resourceType,

        resourceId:
          filters.resourceId,

        userId:
          filters.userId,

        search:
          filters.search,

        dateFrom:
          filters.dateFrom
            ? new Date(filters.dateFrom)
            : undefined,

        dateTo:
          filters.dateTo
            ? new Date(filters.dateTo)
            : undefined,

        page:
          filters.page,

        limit:
          filters.limit,
      },
    );

    return this.paginated(
      items,
      total,
      filters,
    );
  }

  // ---------------------------------------------------------------------------
  // ANALYTICS
  // ---------------------------------------------------------------------------

  async getAnalytics(
    tenant: TenantContext,
  ) {
    const now =
      new Date();

    const thirtyDaysAgo =
      new Date(
        now.getTime() -
          30 * 24 * 60 * 60 * 1000,
      );

    /*
     * These dates currently use server-local midnight.
     *
     * If organizations have configurable timezones,
     * replace this with an organization-timezone-aware
     * date boundary utility.
     */
    const todayStart =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

    const todayEnd =
      new Date(
        todayStart.getTime() +
          24 * 60 * 60 * 1000,
      );

    const [
      totalEnrolled,
      activeEnrollments,
      totalSessions,
      recognitionStats,
      activeDevices,
      todayAttendance,
    ] = await Promise.all([
      this.enrollmentRepo.countTotal(
        tenant.organizationId,
      ),

      this.enrollmentRepo.countActive(
        tenant.organizationId,
      ),

      this.prisma.recognitionSession.count({
        where: {
          organizationId:
            tenant.organizationId,
        },
      }),

      this.recognitionRepo.getRecognitionStats(
        tenant.organizationId,
        thirtyDaysAgo,
        now,
      ),

      this.deviceRepo.countActive(
        tenant.organizationId,
      ),

      this.prisma.cameraAttendanceEvent.count({
        where: {
          organizationId:
            tenant.organizationId,

          recognizedAt: {
            gte: todayStart,
            lt: todayEnd,
          },
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
            ? Math.round(
                (successful /
                  totalAttempts) *
                  100,
              )
            : 0,

        livenessPassRate:
          totalAttempts > 0
            ? Math.round(
                (
                  (totalAttempts -
                    livenessFailures) /
                  totalAttempts
                ) * 100,
              )
            : 0,

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
    filters: {
      page?: number | string;
      limit?: number | string;
    },
  ) {
    const page =
      Math.max(
        1,
        Number(filters.page) || 1,
      );

    const limit =
      Math.min(
        Math.max(
          1,
          Number(filters.limit) || 20,
        ),
        100,
      );

    return {
      items,
      total,
      page,
      limit,
      totalPages:
        Math.ceil(
          total / limit,
        ),
    };
  }
}


