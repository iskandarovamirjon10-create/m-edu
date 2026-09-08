import {
  Injectable,
  Logger,
  NotFoundException,
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
import { decodeValidatedImage } from './image.util';

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
  ) {}

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------

  async onModuleInit(): Promise<void> {
    this.enrollmentRepo =
      new PrismaEnrollmentAdapter(this.prisma);

    this.recognitionRepo =
      new PrismaRecognitionAdapter(this.prisma);

    this.deviceRepo =
      new PrismaDeviceAdapter(this.prisma);

    this.auditRepo =
      new PrismaAuditAdapter(this.prisma);

    const studentDirectory =
      new PrismaStudentAdapter(this.prisma);

    const encryption =
      this.createEncryptionService();

    const faceEngine =
      await this.createFaceEngine();

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
    this.engineProvider =
      process.env.FACE_ENGINE_PROVIDER || 'mock';

    if (
      process.env.NODE_ENV === 'production' &&
      this.engineProvider === 'mock'
    ) {
      throw new Error(
        'FACE_ENGINE_PROVIDER must be configured in production. ' +
          'Mock engines are forbidden in production environments. ' +
          'Set FACE_ENGINE_PROVIDER to "real-local".',
      );
    }

    if (this.engineProvider !== 'real-local') {
      this.nestLogger.log(
        'Using MOCK face recognition engine (development only)',
      );

      return this.createMockEngine();
    }

    return this.createRealEngine();
  }

  private async createRealEngine(): Promise<FaceEngine> {
    const detectorPath =
      process.env.FACE_DETECTOR_MODEL_PATH || '';

    const embedderPath =
      process.env.FACE_EMBEDDER_MODEL_PATH || '';

    const livenessPath =
      process.env.FACE_LIVENESS_MODEL_PATH || '';

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

    return this
      .getRecognitionService()
      .processAttempt(
        tenant,
        sessionId,
        imageBuffer,
      );
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