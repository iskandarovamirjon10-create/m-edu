/**
 * Recognition application service — orchestrates the face recognition pipeline.
 *
 * Pipeline: detect → quality → liveness → embed → match → decide → attend
 *
 * This service coordinates all stages and handles failures at each step.
 */

import type { FaceEngine, DetectedFace } from '../ports/face-engine.port';
import type { EncryptionPort } from '../ports/encryption.port';
import type { RecognitionRepository } from '../ports/recognition-repository.port';
import type { EnrollmentRepository } from '../ports/enrollment-repository.port';
import type { AuthorizationPort } from '../ports/authorization.port';
import type { AuditRepository } from '../ports/audit-repository.port';
import type { TenantContext } from '../ports/tenant-context.port';
import { FaceEmbedding } from '../domain/value-objects';
import { RecognitionDecisionPolicy } from './recognition-decision.policy';
import { AttendancePolicy } from './attendance.policy';
import {
  RecognitionAttemptStatus,
  RecognitionSessionStatus,
  AuditEventType,
  Permissions,
} from '@medu/contracts';
import {
  SessionNotFoundError,
  SessionAlreadyFinishedError,
  FaceNotDetectedError,
  FaceQualityTooLowError,
  LivenessFailedError,
  MaxConcurrentSessionsError,
} from '../domain/errors';

// ===========================================================================
// 1. PUBLIC CONTRACTS & TYPES
// ===========================================================================

export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RecognitionStudentSummary {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type LivenessDecisionType = 'PASS' | 'FAIL' | 'UNCERTAIN' | 'UNAVAILABLE';

export interface RecognitionMatchItem {
  faceIndex: number;
  attemptId: string;
  identified: boolean;
  status: RecognitionAttemptStatus;
  student: RecognitionStudentSummary | null;
  confidence: ConfidenceLevel;
  similarityScore: number | null;
  qualityScore: number;
  liveness: string;
  attendanceRecorded: boolean;
  attendanceDecision: string | null;
  attendanceRecordId: string | null;
  message: string;
  boundingBox?: BoundingBox;
}

export interface RecognitionAttemptResult {
  attemptId: string;
  identified: boolean;
  status: RecognitionAttemptStatus;
  student: RecognitionStudentSummary | null;
  confidence: ConfidenceLevel;
  liveness: string;
  qualityScore: number;
  attendanceRecorded: boolean;
  attendanceDecision: string | null;
  attendanceRecordId: string | null;
  message: string;
  faceCount?: number;
  matches?: RecognitionMatchItem[];
}

type ActiveTemplateRecord = Awaited<
  ReturnType<EnrollmentRepository['findAllActiveTemplates']>
>[number];

type SessionRecord = NonNullable<
  Awaited<ReturnType<RecognitionRepository['findSession']>>
>;

interface CachedTemplateEntry {
  readonly hash: string;
  readonly embedding: FaceEmbedding;
}

interface CandidateMatchRank {
  bestSimilarity: number;
  bestMatch: ActiveTemplateRecord | null;
  secondBestSimilarity: number;
}

interface MultiFaceEvaluationContext {
  readonly faceIndex: number;
  readonly face: DetectedFace;
  qualityScore: number;
  qualityPasses: boolean;
  livenessResult: LivenessDecisionType;
  livenessConfidence: number;
  livenessStatus: RecognitionAttemptStatus;
  probeEmbedding: FaceEmbedding | null;
  preprocessingError: string | null;
  /** Ranked per-student best matches so multi-face frames can prevent duplicate student assignment */
  readonly studentScores: Map<
    string,
    { similarity: number; template: ActiveTemplateRecord }
  >;
}

// ===========================================================================
// 2. CONSTANTS
// ===========================================================================

const GALLERY_STREAM_BATCH_SIZE = 500;
const MAX_FACES_PER_FRAME = 5;
const MAX_TEMPLATE_CACHE_ENTRIES = 100_000;

// ===========================================================================
// 3. SERVICE IMPLEMENTATION
// ===========================================================================

export class RecognitionService {
  /**
   * Bounded LRU in-memory cache of decrypted embeddings keyed by `${organizationId}:${templateId}`.
   * Avoids O(N) AES-GCM decryptions per camera frame while keeping memory strictly bounded.
   */
  private static readonly templateCache = new Map<string, CachedTemplateEntry>();

  constructor(
    private readonly faceEngine: FaceEngine,
    private readonly encryption: EncryptionPort,
    private readonly recognitionRepo: RecognitionRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly authorization: AuthorizationPort,
    private readonly audit: AuditRepository,
    private readonly decisionPolicy: RecognitionDecisionPolicy,
    private readonly attendancePolicy: AttendancePolicy,
  ) {}

  // =========================================================================
  // CACHE MANAGEMENT API
  // =========================================================================

  /**
   * Invalidates cached decrypted templates globally, per organization, or for a single template.
   */
  public static invalidateTemplateCache(
    organizationId?: string,
    templateId?: string,
  ): void {
    if (!organizationId) {
      RecognitionService.templateCache.clear();
      return;
    }

    if (templateId) {
      RecognitionService.templateCache.delete(`${organizationId}:${templateId}`);
      return;
    }

    const prefix = `${organizationId}:`;
    for (const key of RecognitionService.templateCache.keys()) {
      if (key.startsWith(prefix)) {
        RecognitionService.templateCache.delete(key);
      }
    }
  }

  private getCachedTemplate(key: string): CachedTemplateEntry | undefined {
    const entry = RecognitionService.templateCache.get(key);
    if (!entry) return undefined;

    // Refresh LRU order
    RecognitionService.templateCache.delete(key);
    RecognitionService.templateCache.set(key, entry);
    return entry;
  }

  private setCachedTemplate(key: string, entry: CachedTemplateEntry): void {
    if (RecognitionService.templateCache.has(key)) {
      RecognitionService.templateCache.delete(key);
    } else if (
      RecognitionService.templateCache.size >= MAX_TEMPLATE_CACHE_ENTRIES
    ) {
      // Evict oldest (least recently used) entry instead of wiping the entire 100k cache
      const oldestKey = RecognitionService.templateCache.keys().next().value;
      if (oldestKey !== undefined) {
        RecognitionService.templateCache.delete(oldestKey);
      }
    }
    RecognitionService.templateCache.set(key, entry);
  }

  // =========================================================================
  // SESSION LIFECYCLE
  // =========================================================================

  /**
   * Start a new recognition session.
   */
  async startSession(
    tenant: TenantContext,
    params: {
      deviceId?: string;
      groupId?: string;
      lessonId?: string;
    },
  ): Promise<{ sessionId: string; status: string }> {
    await this.authorization.requirePermission(
      Permissions.FACE_RECOGNIZE,
      tenant.role,
    );

    const activeSessions = await this.recognitionRepo.countActiveSessions(
      tenant.organizationId,
    );
    const config = this.decisionPolicy.getConfig();
    if (activeSessions >= config.sessions.maxConcurrent) {
      throw new MaxConcurrentSessionsError(config.sessions.maxConcurrent);
    }

    const session = await this.recognitionRepo.createSession({
      organizationId: tenant.organizationId,
      deviceId: params.deviceId,
      actorId: tenant.userId,
      groupId: params.groupId,
      lessonId: params.lessonId,
    });

    await this.audit.log({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      type: 'FACE_RECOGNITION_ATTEMPTED',
      resourceType: 'RecognitionSession',
      resourceId: session.id,
      description: 'Recognition session started',
    });

    return { sessionId: session.id, status: session.status };
  }

  /**
   * Finish a recognition session with full RBAC enforcement, state validation, and audit trail.
   */
  async finishSession(
    tenant: TenantContext,
    sessionId: string,
    reason: 'COMPLETED' | 'TIMEOUT' | 'CANCELLED' | 'ERROR' = 'COMPLETED',
  ): Promise<void> {
    await this.authorization.requirePermission(
      Permissions.FACE_RECOGNIZE,
      tenant.role,
    );

    const session = await this.recognitionRepo.findSession(
      tenant.organizationId,
      sessionId,
    );
    if (!session) throw new SessionNotFoundError(sessionId);

    if (session.status === 'FINISHED' || session.status === 'CANCELLED') {
      throw new SessionAlreadyFinishedError(sessionId);
    }

    const status: RecognitionSessionStatus =
      reason === 'ERROR'
        ? 'ERROR'
        : reason === 'CANCELLED'
          ? 'CANCELLED'
          : 'FINISHED';

    await this.recognitionRepo.updateSessionStatus(
      tenant.organizationId,
      sessionId,
      status,
      new Date(),
    );

    void this.audit
      .log({
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        type: 'FACE_RECOGNITION_ATTEMPTED',
        resourceType: 'RecognitionSession',
        resourceId: sessionId,
        description: `Recognition session finished with reason: ${reason}`,
        metadata: { status, reason },
      })
      .catch(() => {});
  }

  // =========================================================================
  // SINGLE & MULTI-FACE RECOGNITION PIPELINE
  // =========================================================================

  /**
   * Process a single recognition attempt within a session.
   * Runs the full pipeline and returns the result.
   */
  async processAttempt(
    tenant: TenantContext,
    sessionId: string,
    imageBuffer: Buffer,
  ): Promise<RecognitionAttemptResult> {
    await this.authorization.requirePermission(
      Permissions.FACE_RECOGNIZE,
      tenant.role,
    );

    const session = await this.recognitionRepo.findSession(
      tenant.organizationId,
      sessionId,
    );
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.status === 'FINISHED' || session.status === 'CANCELLED') {
      throw new SessionAlreadyFinishedError(sessionId);
    }

    // Enforce session TTL on every attempt to prevent slow-DoS session exhaustion
    const config = this.decisionPolicy.getConfig();
    const ageMs = Date.now() - new Date(session.startedAt).getTime();
    const ttlMs = config.sessions.timeoutMinutes * 60_000;
    if (ageMs > ttlMs) {
      await this.recognitionRepo.updateSessionStatus(
        tenant.organizationId,
        sessionId,
        'CANCELLED',
        new Date(),
      );
      throw new SessionAlreadyFinishedError(sessionId);
    }

    if (session.status === 'STARTED') {
      await this.recognitionRepo.updateSessionStatus(
        tenant.organizationId,
        sessionId,
        'IN_PROGRESS',
      );
    }

    const startTime = Date.now();
    let attemptStatus: RecognitionAttemptStatus =
      RecognitionAttemptStatus.DETECTED;
    let qualityScore = 0;
    let livenessResult: LivenessDecisionType = 'UNAVAILABLE';
    let similarityScore: number | null = null;
    let identifiedStudentId: string | null = null;
    let student: RecognitionStudentSummary | null = null;
    let confidenceDecision: ConfidenceLevel = 'NONE';
    let message = '';
    let persistedAttempt:
      | Awaited<ReturnType<RecognitionRepository['createAttempt']>>
      | null = null;

    try {
      // Stage 1: Face Detection
      const detectedFaces = await this.faceEngine.detectFaces({
        imageBuffer,
        format: 'jpeg',
      });
      if (detectedFaces.length === 0) throw new FaceNotDetectedError();
      if (detectedFaces.length > 1) {
        return await this.processMultipleFacesAttempt(
          tenant,
          session,
          imageBuffer,
          detectedFaces,
          startTime,
        );
      }
      const primaryFace = detectedFaces[0]!;

      // Stage 2: Quality Assessment
      const quality = await this.faceEngine.assessQuality({
        imageBuffer,
        face: primaryFace,
      });
      qualityScore = quality.overallScore;
      if (!quality.passesThreshold || qualityScore < config.qualityThreshold) {
        attemptStatus = RecognitionAttemptStatus.QUALITY_FAILED;
        throw new FaceQualityTooLowError(
          qualityScore,
          config.qualityThreshold,
          quality.rejectionReason,
          quality.issues,
        );
      }
      attemptStatus = RecognitionAttemptStatus.QUALITY_PASSED;

      // Stage 3: Liveness
      const liveness = await this.faceEngine.checkLiveness({
        imageBuffer,
        face: primaryFace,
      });
      livenessResult = liveness.decision as LivenessDecisionType;
      if (liveness.decision === 'FAIL') {
        attemptStatus = RecognitionAttemptStatus.LIVENESS_FAILED;
        throw new LivenessFailedError(liveness.decision);
      }
      if (liveness.decision === 'UNCERTAIN') {
        attemptStatus = RecognitionAttemptStatus.LIVENESS_UNCERTAIN;
      } else if (liveness.decision === 'UNAVAILABLE') {
        attemptStatus = RecognitionAttemptStatus.LIVENESS_UNAVAILABLE;
      } else {
        attemptStatus = RecognitionAttemptStatus.LIVENESS_PASSED;
      }

      // Stage 4: Generate Embedding
      const probeEmbedding = await this.faceEngine.generateEmbedding({
        imageBuffer,
        face: primaryFace,
      });
      attemptStatus = RecognitionAttemptStatus.EMBEDDING_GENERATED;

      // Stage 5: Candidate Retrieval & Matching
      const rank = await this.matchSingleProbeAgainstGallery(
        tenant,
        session.groupId ?? undefined,
        probeEmbedding,
      );

      const ambiguityMargin =
        rank.bestMatch && rank.secondBestSimilarity >= 0
          ? rank.bestSimilarity - rank.secondBestSimilarity
          : null;

      if (rank.bestMatch && rank.bestSimilarity >= 0) {
        similarityScore = rank.bestSimilarity;
        identifiedStudentId = rank.bestMatch.studentId;
        student = rank.bestMatch.student;
        attemptStatus =
          rank.bestSimilarity >= config.matching.similarityThreshold
            ? RecognitionAttemptStatus.MATCH_FOUND
            : RecognitionAttemptStatus.MATCH_NOT_FOUND;
      } else {
        attemptStatus = RecognitionAttemptStatus.MATCH_NOT_FOUND;
      }

      // Stage 6: Decision Policy
      const decision = this.decisionPolicy.decide(
        {
          qualityScore,
          livenessDecision: livenessResult,
          livenessConfidence: liveness.confidence,
          similarityScore,
          bestMatchFound: rank.bestMatch !== null,
          ambiguityMargin,
        },
        identifiedStudentId ?? undefined,
      );

      if (decision.outcome === 'IDENTIFIED') {
        attemptStatus = RecognitionAttemptStatus.IDENTIFIED;
        confidenceDecision = decision.confidence;
        message = decision.message;
      } else if (decision.outcome === 'UNCERTAIN') {
        attemptStatus = RecognitionAttemptStatus.MATCH_UNCERTAIN;
        message = decision.message;
        identifiedStudentId = null;
        student = null;
      } else {
        attemptStatus = RecognitionAttemptStatus.UNIDENTIFIED;
        message = decision.message;
        identifiedStudentId = null;
        student = null;
      }

      // Persist attempt
      const attempt = await this.recognitionRepo.createAttempt({
        organizationId: tenant.organizationId,
        sessionId,
        identifiedStudentId: identifiedStudentId ?? undefined,
        actorId: tenant.userId,
        status: attemptStatus,
        confidence: similarityScore ?? undefined,
        qualityScore,
        livenessResult,
        similarityScore: similarityScore ?? undefined,
        processingTimeMs: Date.now() - startTime,
      });
      persistedAttempt = attempt;

      // Stage 7: Attendance (if identified)
      const {
        attendanceRecorded,
        attendanceDecision,
        attendanceRecordId,
      } = await this.evaluateAndRecordAttendance(
        tenant,
        session,
        attempt.id,
        decision.outcome === 'IDENTIFIED' ? decision.studentId : null,
      );

      // Stage 8: Audit
      await this.audit.log({
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        type:
          decision.outcome === 'IDENTIFIED'
            ? 'FACE_RECOGNITION_CONFIRMED'
            : 'FACE_RECOGNITION_REJECTED',
        resourceType: 'RecognitionAttempt',
        resourceId: attempt.id,
        description: message,
        metadata: {
          sessionId,
          attemptId: attempt.id,
          identifiedStudentId,
          attendanceRecorded,
        },
      });

      const isIdentified = decision.outcome === 'IDENTIFIED';

      if (
        isIdentified &&
        decision.studentId &&
        similarityScore != null &&
        similarityScore >= 0.94 &&
        qualityScore >= 0.85 &&
        livenessResult === 'PASS'
      ) {
        void this.adaptivelyRefineTemplate(
          tenant,
          decision.studentId,
          probeEmbedding,
          qualityScore,
          similarityScore,
        ).catch(() => {});
      }

      return {
        attemptId: attempt.id,
        identified: isIdentified,
        status: attemptStatus,
        student,
        confidence: confidenceDecision,
        liveness: livenessResult,
        qualityScore,
        attendanceRecorded,
        attendanceDecision,
        attendanceRecordId,
        message,
        faceCount: 1,
        matches: [
          {
            faceIndex: 0,
            attemptId: attempt.id,
            identified: isIdentified,
            status: attemptStatus,
            student,
            confidence: confidenceDecision,
            similarityScore,
            qualityScore,
            liveness: livenessResult,
            attendanceRecorded,
            attendanceDecision,
            attendanceRecordId,
            message,
            boundingBox: primaryFace.boundingBox,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Recognition failed';

      // If the attempt was already persisted, preserve its true status & identity
      // rather than creating a duplicate row or lying about the persisted status.
      if (persistedAttempt) {
        const wasIdentified =
          persistedAttempt.status === RecognitionAttemptStatus.IDENTIFIED;
        return {
          attemptId: persistedAttempt.id,
          identified: wasIdentified,
          status: persistedAttempt.status,
          student: wasIdentified ? student : null,
          confidence: wasIdentified ? confidenceDecision : 'NONE',
          liveness: livenessResult,
          qualityScore,
          attendanceRecorded: false,
          attendanceDecision: null,
          attendanceRecordId: null,
          message: errorMessage,
        };
      }

      const failedStatus =
        attemptStatus !== RecognitionAttemptStatus.DETECTED
          ? attemptStatus
          : RecognitionAttemptStatus.ERROR;

      const attempt = await this.recognitionRepo.createAttempt({
        organizationId: tenant.organizationId,
        sessionId,
        actorId: tenant.userId,
        status: failedStatus,
        qualityScore,
        livenessResult,
        processingTimeMs: Date.now() - startTime,
        metadata: { error: errorMessage },
      });

      return {
        attemptId: attempt.id,
        identified: false,
        status: failedStatus,
        student: null,
        confidence: 'NONE',
        liveness: livenessResult,
        qualityScore,
        attendanceRecorded: false,
        attendanceDecision: null,
        attendanceRecordId: null,
        message: errorMessage,
      };
    }
  }

  // =========================================================================
  // MULTI-FACE PIPELINE
  // =========================================================================

  /**
   * Process multiple faces in a single capture frame:
   * - Evaluates quality, liveness (preserving true livenessConfidence), and embeddings.
   * - Streams the gallery once and computes per-student rankings for all valid faces.
   * - Deduplicates student assignments across faces in the same frame so two faces
   *   in a single image can never both claim the same student.
   */
  private async processMultipleFacesAttempt(
    tenant: TenantContext,
    session: SessionRecord,
    imageBuffer: Buffer,
    detectedFaces: DetectedFace[],
    startTime: number,
  ): Promise<RecognitionAttemptResult> {
    const config = this.decisionPolicy.getConfig();

    // Sort faces by bounding-box area descending (largest / closest face first)
    const sortedFaces = [...detectedFaces].sort((a, b) => {
      const areaA = (a.boundingBox?.width ?? 0) * (a.boundingBox?.height ?? 0);
      const areaB = (b.boundingBox?.width ?? 0) * (b.boundingBox?.height ?? 0);
      return areaB - areaA;
    });

    const facesToProcess = sortedFaces.slice(0, MAX_FACES_PER_FRAME);
    const faceDataList: MultiFaceEvaluationContext[] = [];

    for (let i = 0; i < facesToProcess.length; i++) {
      const face = facesToProcess[i]!;
      let qualityScore = 0;
      let qualityPasses = false;
      let livenessResult: LivenessDecisionType = 'UNAVAILABLE';
      let livenessConfidence = 0;
      let livenessStatus: RecognitionAttemptStatus =
        RecognitionAttemptStatus.DETECTED;
      let probeEmbedding: FaceEmbedding | null = null;
      let preprocessingError: string | null = null;

      try {
        const quality = await this.faceEngine.assessQuality({
          imageBuffer,
          face,
        });
        qualityScore = quality.overallScore;
        qualityPasses =
          quality.passesThreshold && qualityScore >= config.qualityThreshold;

        if (!qualityPasses) {
          livenessStatus = RecognitionAttemptStatus.QUALITY_FAILED;
        } else {
          const liveness = await this.faceEngine.checkLiveness({
            imageBuffer,
            face,
          });
          livenessResult = liveness.decision as LivenessDecisionType;
          livenessConfidence = liveness.confidence;

          if (liveness.decision === 'FAIL') {
            livenessStatus = RecognitionAttemptStatus.LIVENESS_FAILED;
          } else {
            if (liveness.decision === 'UNCERTAIN') {
              livenessStatus = RecognitionAttemptStatus.LIVENESS_UNCERTAIN;
            } else if (liveness.decision === 'UNAVAILABLE') {
              livenessStatus = RecognitionAttemptStatus.LIVENESS_UNAVAILABLE;
            } else {
              livenessStatus = RecognitionAttemptStatus.LIVENESS_PASSED;
            }

            // Generate embedding for PASS, UNCERTAIN, and UNAVAILABLE
            // (consistent with single-face pipeline so decisionPolicy makes the final call)
            probeEmbedding = await this.faceEngine.generateEmbedding({
              imageBuffer,
              face,
            });
          }
        }
      } catch (err: unknown) {
        preprocessingError =
          err instanceof Error ? err.message : 'Face preprocessing failed';
      }

      faceDataList.push({
        faceIndex: i,
        face,
        qualityScore,
        qualityPasses,
        livenessResult,
        livenessConfidence,
        livenessStatus,
        probeEmbedding,
        preprocessingError,
        studentScores: new Map(),
      });
    }

    const facesWithEmbeddings = faceDataList.filter(
      (f) => f.probeEmbedding !== null && f.preprocessingError === null,
    );

    if (facesWithEmbeddings.length > 0) {
      await this.matchMultiProbesAgainstGallery(
        tenant,
        session.groupId ?? undefined,
        facesWithEmbeddings,
      );
    }

    // Prevent two faces in the same frame from being assigned to the same studentId.
    // Assign students greedily by highest similarity score first.
    const claimedStudentIds = new Set<string>();
    const assignedRanks = new Map<number, CandidateMatchRank>();

    const facesByBestScore = [...facesWithEmbeddings].sort((a, b) => {
      const maxA = this.extractRankExcluding(a.studentScores, claimedStudentIds)
        .bestSimilarity;
      const maxB = this.extractRankExcluding(b.studentScores, claimedStudentIds)
        .bestSimilarity;
      return maxB - maxA;
    });

    for (const fd of facesByBestScore) {
      const rank = this.extractRankExcluding(
        fd.studentScores,
        claimedStudentIds,
      );
      assignedRanks.set(fd.faceIndex, rank);

      if (
        rank.bestMatch &&
        rank.bestSimilarity >= config.matching.similarityThreshold
      ) {
        claimedStudentIds.add(rank.bestMatch.studentId);
      }
    }

    const matches: RecognitionMatchItem[] = [];

    for (const fd of faceDataList) {
      let attemptStatus: RecognitionAttemptStatus;
      let identifiedStudentId: string | null = null;
      let student: RecognitionStudentSummary | null = null;
      let message = '';
      let similarityScore: number | null = null;
      let confidenceDecision: ConfidenceLevel = 'NONE';

      if (fd.preprocessingError !== null) {
        attemptStatus =
          fd.livenessStatus !== RecognitionAttemptStatus.DETECTED
            ? fd.livenessStatus
            : RecognitionAttemptStatus.ERROR;
        message = fd.preprocessingError;
      } else if (!fd.qualityPasses) {
        attemptStatus = RecognitionAttemptStatus.QUALITY_FAILED;
        message = `Face quality too low: ${fd.qualityScore.toFixed(2)}`;
      } else if (
        fd.livenessStatus === RecognitionAttemptStatus.LIVENESS_FAILED
      ) {
        attemptStatus = RecognitionAttemptStatus.LIVENESS_FAILED;
        message = 'Liveness check failed';
      } else {
        const rank = assignedRanks.get(fd.faceIndex) ?? {
          bestSimilarity: -1,
          bestMatch: null,
          secondBestSimilarity: -1,
        };

        const ambiguityMargin =
          rank.bestMatch && rank.secondBestSimilarity >= 0
            ? rank.bestSimilarity - rank.secondBestSimilarity
            : null;

        if (rank.bestMatch && rank.bestSimilarity >= 0) {
          similarityScore = rank.bestSimilarity;
          identifiedStudentId = rank.bestMatch.studentId;
          student = rank.bestMatch.student;
          attemptStatus =
            rank.bestSimilarity >= config.matching.similarityThreshold
              ? RecognitionAttemptStatus.MATCH_FOUND
              : RecognitionAttemptStatus.MATCH_NOT_FOUND;
        } else {
          attemptStatus = RecognitionAttemptStatus.MATCH_NOT_FOUND;
        }

        const decision = this.decisionPolicy.decide(
          {
            qualityScore: fd.qualityScore,
            livenessDecision: fd.livenessResult,
            livenessConfidence: fd.livenessConfidence,
            similarityScore,
            bestMatchFound: rank.bestMatch !== null,
            ambiguityMargin,
          },
          identifiedStudentId ?? undefined,
        );

        if (decision.outcome === 'IDENTIFIED') {
          attemptStatus = RecognitionAttemptStatus.IDENTIFIED;
          confidenceDecision = decision.confidence;
          message = decision.message;
        } else if (decision.outcome === 'UNCERTAIN') {
          attemptStatus = RecognitionAttemptStatus.MATCH_UNCERTAIN;
          message = decision.message;
          identifiedStudentId = null;
          student = null;
        } else {
          attemptStatus = RecognitionAttemptStatus.UNIDENTIFIED;
          message = decision.message;
          identifiedStudentId = null;
          student = null;
        }
      }

      const attempt = await this.recognitionRepo.createAttempt({
        organizationId: tenant.organizationId,
        sessionId: session.id,
        identifiedStudentId: identifiedStudentId ?? undefined,
        actorId: tenant.userId,
        status: attemptStatus,
        confidence: similarityScore ?? undefined,
        qualityScore: fd.qualityScore,
        livenessResult: fd.livenessResult,
        similarityScore: similarityScore ?? undefined,
        processingTimeMs: Date.now() - startTime,
      });

      const isIdentified =
        attemptStatus === RecognitionAttemptStatus.IDENTIFIED &&
        identifiedStudentId !== null;

      const {
        attendanceRecorded,
        attendanceDecision,
        attendanceRecordId,
      } = await this.evaluateAndRecordAttendance(
        tenant,
        session,
        attempt.id,
        isIdentified ? identifiedStudentId : null,
      );

      void this.audit
        .log({
          organizationId: tenant.organizationId,
          userId: tenant.userId,
          type: isIdentified
            ? 'FACE_RECOGNITION_CONFIRMED'
            : 'FACE_RECOGNITION_REJECTED',
          resourceType: 'RecognitionAttempt',
          resourceId: attempt.id,
          description: message,
          metadata: {
            sessionId: session.id,
            attemptId: attempt.id,
            identifiedStudentId,
            attendanceRecorded,
          },
        })
        .catch(() => {});

      matches.push({
        faceIndex: fd.faceIndex,
        attemptId: attempt.id,
        identified: isIdentified,
        status: attemptStatus,
        student,
        confidence: confidenceDecision,
        similarityScore,
        qualityScore: fd.qualityScore,
        liveness: fd.livenessResult,
        attendanceRecorded,
        attendanceDecision,
        attendanceRecordId,
        message,
        boundingBox: fd.face.boundingBox,
      });
    }

    const primaryMatch = matches.find((m) => m.identified) ?? matches[0]!;
    return {
      attemptId: primaryMatch.attemptId,
      identified: primaryMatch.identified,
      status: primaryMatch.status,
      student: primaryMatch.student,
      confidence: primaryMatch.confidence,
      liveness: primaryMatch.liveness,
      qualityScore: primaryMatch.qualityScore,
      attendanceRecorded: primaryMatch.attendanceRecorded,
      attendanceDecision: primaryMatch.attendanceDecision,
      attendanceRecordId: primaryMatch.attendanceRecordId,
      message: primaryMatch.message,
      faceCount: detectedFaces.length,
      matches,
    };
  }

  // =========================================================================
  // PRIVATE — SHARED GALLERY STREAMING & TEMPLATE RESOLUTION
  // =========================================================================

  /**
   * Decrypts, verifies integrity, and caches a single gallery template.
   * Returns `null` if incompatible or corrupted (logging corruption asynchronously).
   */
  private async resolveGalleryTemplateEmbedding(
    tenant: TenantContext,
    template: ActiveTemplateRecord,
    expectedModelVersion: string,
  ): Promise<FaceEmbedding | null> {
    if (
      !template.modelVersion ||
      template.modelVersion !== expectedModelVersion
    ) {
      return null;
    }

    const cacheKey = `${tenant.organizationId}:${template.id}`;
    const cached = this.getCachedTemplate(cacheKey);
    if (cached && cached.hash === template.templateHash) {
      return cached.embedding;
    }

    try {
      const decryptedData = await this.encryption.decrypt(template.templateData);
      const hashValid = await this.encryption.verifyHash(
        decryptedData,
        template.templateHash,
      );

      if (!hashValid) {
        void this.audit
          .log({
            organizationId: tenant.organizationId,
            userId: tenant.userId,
            type: AuditEventType.TEMPLATE_CORRUPTED,
            resourceType: 'FaceTemplate',
            resourceId: template.id,
            description: `Template integrity check failed: ${template.id}`,
            metadata: {
              studentId: template.studentId,
              templateHash: template.templateHash,
            },
          })
          .catch(() => {});
        return null;
      }

      const embedding = FaceEmbedding.deserialize(decryptedData);
      this.setCachedTemplate(cacheKey, {
        hash: template.templateHash,
        embedding,
      });
      return embedding;
    } catch (err: unknown) {
      void this.audit
        .log({
          organizationId: tenant.organizationId,
          userId: tenant.userId,
          type: AuditEventType.TEMPLATE_CORRUPTED,
          resourceType: 'FaceTemplate',
          resourceId: template.id,
          description: `Face template decryption or deserialization failed: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`,
          metadata: {
            studentId: template.studentId,
            templateHash: template.templateHash,
          },
        })
        .catch(() => {});
      return null;
    }
  }

  private async matchSingleProbeAgainstGallery(
    tenant: TenantContext,
    groupId: string | undefined,
    probeEmbedding: FaceEmbedding,
  ): Promise<CandidateMatchRank> {
    const expectedModelVersion = this.faceEngine.getModelVersion();
    const studentScores = new Map<
      string,
      { similarity: number; template: ActiveTemplateRecord }
    >();

    const stream = this.enrollmentRepo.streamActiveTemplates(
      tenant.organizationId,
      GALLERY_STREAM_BATCH_SIZE,
      groupId,
    );

    for await (const batch of stream) {
      await new Promise((resolve) => setImmediate(resolve));

      for (const template of batch) {
        const storedEmbedding = await this.resolveGalleryTemplateEmbedding(
          tenant,
          template,
          expectedModelVersion,
        );
        if (!storedEmbedding) continue;

        try {
          const similarity = await this.faceEngine.compareEmbeddings({
            embeddingA: probeEmbedding,
            embeddingB: storedEmbedding,
          });

          if (!Number.isFinite(similarity)) continue;

          const currentBestForStudent = studentScores.get(template.studentId);
          if (
            !currentBestForStudent ||
            similarity > currentBestForStudent.similarity
          ) {
            studentScores.set(template.studentId, { similarity, template });
          }
        } catch (err: unknown) {
          void this.audit
            .log({
              organizationId: tenant.organizationId,
              userId: tenant.userId,
              type: AuditEventType.TEMPLATE_CORRUPTED,
              resourceType: 'FaceTemplate',
              resourceId: template.id,
              description: `Face template comparison failed: ${
                err instanceof Error ? err.message : 'Unknown error'
              }`,
              metadata: {
                studentId: template.studentId,
                templateHash: template.templateHash,
              },
            })
            .catch(() => {});
        }
      }
    }

    return this.extractRankExcluding(studentScores);
  }

  private async matchMultiProbesAgainstGallery(
    tenant: TenantContext,
    groupId: string | undefined,
    facesWithEmbeddings: MultiFaceEvaluationContext[],
  ): Promise<void> {
    const expectedModelVersion = this.faceEngine.getModelVersion();
    const stream = this.enrollmentRepo.streamActiveTemplates(
      tenant.organizationId,
      GALLERY_STREAM_BATCH_SIZE,
      groupId,
    );

    for await (const batch of stream) {
      await new Promise((resolve) => setImmediate(resolve));

      for (const template of batch) {
        const storedEmbedding = await this.resolveGalleryTemplateEmbedding(
          tenant,
          template,
          expectedModelVersion,
        );
        if (!storedEmbedding) continue;

        for (const faceData of facesWithEmbeddings) {
          try {
            const similarity = await this.faceEngine.compareEmbeddings({
              embeddingA: faceData.probeEmbedding!,
              embeddingB: storedEmbedding,
            });

            if (!Number.isFinite(similarity)) continue;

            const currentBest = faceData.studentScores.get(template.studentId);
            if (!currentBest || similarity > currentBest.similarity) {
              faceData.studentScores.set(template.studentId, {
                similarity,
                template,
              });
            }
          } catch {
            continue;
          }
        }
      }
    }
  }

  /**
   * Computes `bestMatch`, `bestSimilarity`, and `secondBestSimilarity` across distinct students,
   * optionally excluding students already claimed by a higher-confidence face in the same frame.
   */
  private extractRankExcluding(
    studentScores: Map<
      string,
      { similarity: number; template: ActiveTemplateRecord }
    >,
    excludedStudentIds?: ReadonlySet<string>,
  ): CandidateMatchRank {
    let bestSimilarity = -1;
    let bestMatch: ActiveTemplateRecord | null = null;
    let secondBestSimilarity = -1;

    for (const [studentId, entry] of studentScores.entries()) {
      if (excludedStudentIds?.has(studentId)) continue;

      if (entry.similarity > bestSimilarity) {
        secondBestSimilarity = bestSimilarity;
        bestSimilarity = entry.similarity;
        bestMatch = entry.template;
      } else if (entry.similarity > secondBestSimilarity) {
        secondBestSimilarity = entry.similarity;
      }
    }

    return {
      bestSimilarity,
      bestMatch,
      secondBestSimilarity,
    };
  }

  // =========================================================================
  // PRIVATE — SHARED ATTENDANCE EVALUATION
  // =========================================================================

  private async evaluateAndRecordAttendance(
    tenant: TenantContext,
    session: SessionRecord,
    attemptId: string,
    identifiedStudentId: string | null,
  ): Promise<{
    attendanceRecorded: boolean;
    attendanceDecision: string | null;
    attendanceRecordId: string | null;
  }> {
    if (!identifiedStudentId) {
      return {
        attendanceRecorded: false,
        attendanceDecision: null,
        attendanceRecordId: null,
      };
    }

    if (!session.groupId) {
      return {
        attendanceRecorded: false,
        attendanceDecision: 'NO_GROUP_CONTEXT',
        attendanceRecordId: null,
      };
    }

    const attendanceCheck = await this.attendancePolicy.validate(
      tenant,
      identifiedStudentId,
      session.groupId,
      session.lessonId,
      session.id,
    );

    if (attendanceCheck.decision !== 'RECORDED') {
      return {
        attendanceRecorded: false,
        attendanceDecision: attendanceCheck.decision,
        attendanceRecordId: null,
      };
    }

    const record = await this.recognitionRepo.createAttendance({
      organizationId: tenant.organizationId,
      studentId: identifiedStudentId,
      groupId: session.groupId,
      lessonId: session.lessonId ?? undefined,
      sessionId: session.id,
      recognitionAttemptId: attemptId,
      decision: 'RECORDED',
    });

    const attendanceRecorded = record.decision === 'RECORDED';
    return {
      attendanceRecorded,
      attendanceDecision: record.decision,
      attendanceRecordId: attendanceRecorded ? record.id : null,
    };
  }

  /**
   * Adaptive Template Refinement (Self-Learning Anchor)
   * Asynchronously saves a refreshed template anchor for students recognized
   * with high confidence under optimal conditions if no template has been added
   * in the last 14 days. Retains max 3 templates per student.
   */
  private async adaptivelyRefineTemplate(
    tenant: TenantContext,
    studentId: string,
    probeEmbedding: FaceEmbedding,
    qualityScore: number,
    similarityScore: number,
  ): Promise<void> {
    try {
      const activeTemplates = await this.enrollmentRepo.findActiveTemplatesByStudentId(
        tenant.organizationId,
        studentId,
      );
      if (!activeTemplates || activeTemplates.length === 0) return;

      const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const hasRecentTemplate = activeTemplates.some(
        (t) => now - new Date(t.createdAt).getTime() < FOURTEEN_DAYS_MS,
      );
      if (hasRecentTemplate) return;

      const enrollment = await this.enrollmentRepo.findActiveByStudentId(
        tenant.organizationId,
        studentId,
      );
      if (!enrollment) return;

      if (activeTemplates.length >= 3 && typeof this.enrollmentRepo.revokeTemplate === 'function') {
        const adaptiveTemplates = activeTemplates
          .filter((t) => (t.metadata as Record<string, unknown> | null)?.adaptive === true)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        if (adaptiveTemplates.length > 0) {
          await this.enrollmentRepo.revokeTemplate(
            tenant.organizationId,
            adaptiveTemplates[0].id,
            'REPLACED_BY_NEWER_ADAPTIVE_ANCHOR',
          );
        }
      }

      const serialized = probeEmbedding.serialize();
      const encryptedTemplate = await this.encryption.encrypt(serialized);
      const templateHash = await this.encryption.hash(serialized);
      const nextVersion = Math.max(...activeTemplates.map((t) => t.version || 1), 1) + 1;

      await this.enrollmentRepo.addTemplate({
        organizationId: tenant.organizationId,
        enrollmentId: enrollment.id,
        studentId,
        templateData: encryptedTemplate,
        templateHash,
        version: nextVersion,
        modelVersion: this.faceEngine.getModelVersion(),
        qualityScore,
      });

      RecognitionService.invalidateTemplateCache(tenant.organizationId);

      await this.audit.log({
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        type: AuditEventType.FACE_ENROLLMENT_CREATED,
        resourceType: 'FaceTemplate',
        resourceId: enrollment.id,
        description: `Adaptively registered anchor template (similarity: ${similarityScore.toFixed(3)}, quality: ${qualityScore.toFixed(3)})`,
        metadata: {
          studentId,
          version: nextVersion,
          qualityScore,
          similarityScore,
          adaptive: true,
        },
      });
    } catch {
      // Background adaptive template refinement must never fail recognition
    }
  }
}