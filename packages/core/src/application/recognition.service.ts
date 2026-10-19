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
import { RecognitionAttemptStatus, RecognitionSessionStatus, AuditEventType } from '@medu/contracts';
import {
  SessionNotFoundError,
  SessionAlreadyFinishedError,
  FaceNotDetectedError,
  MultipleFacesDetectedError,
  FaceQualityTooLowError,
  LivenessFailedError,
  MaxConcurrentSessionsError,
} from '../domain/errors';
import { Permissions } from '@medu/contracts';

export interface RecognitionMatchItem {
  faceIndex: number;
  attemptId: string;
  identified: boolean;
  status: RecognitionAttemptStatus;
  student: { id: string; firstName: string; lastName: string } | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  similarityScore: number | null;
  qualityScore: number;
  liveness: string;
  attendanceRecorded: boolean;
  attendanceDecision: string | null;
  attendanceRecordId: string | null;
  message: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface RecognitionAttemptResult {
  attemptId: string;
  identified: boolean;
  status: RecognitionAttemptStatus;
  student: { id: string; firstName: string; lastName: string } | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  liveness: string;
  qualityScore: number;
  attendanceRecorded: boolean;
  attendanceDecision: string | null;
  attendanceRecordId: string | null;
  message: string;
  faceCount?: number;
  matches?: RecognitionMatchItem[];
}
export class RecognitionService {
  private static templateCache = new Map<string, { hash: string, embedding: FaceEmbedding }>();

  constructor(
    private readonly faceEngine: FaceEngine,
    private readonly encryption: EncryptionPort,
    private readonly recognitionRepo: RecognitionRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly authorization: AuthorizationPort,
    private readonly audit: AuditRepository,
    private readonly decisionPolicy: RecognitionDecisionPolicy,
    private readonly attendancePolicy: AttendancePolicy
  ) {}

  /**
   * Start a new recognition session.
   */
  async startSession(
    tenant: TenantContext,
    params: {
      deviceId?: string;
      groupId?: string;
      lessonId?: string;
    }
  ): Promise<{ sessionId: string; status: string }> {
    await this.authorization.requirePermission(Permissions.FACE_RECOGNIZE, tenant.role);

    // Check concurrent session limit
    const activeSessions = await this.recognitionRepo.countActiveSessions(tenant.organizationId);
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
   * Process a single recognition attempt within a session.
   * Runs the full pipeline and returns the result.
   */
  async processAttempt(
    tenant: TenantContext,
    sessionId: string,
    imageBuffer: Buffer
  ): Promise<RecognitionAttemptResult> {
    await this.authorization.requirePermission(Permissions.FACE_RECOGNIZE, tenant.role);

    const session = await this.recognitionRepo.findSession(tenant.organizationId, sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.status === 'FINISHED' || session.status === 'CANCELLED') {
      throw new SessionAlreadyFinishedError(sessionId);
    }

    // Enforce session TTL on every attempt: any session that has been
    // alive longer than the configured timeout is rejected. Without this,
    // an attacker with FACE_RECOGNIZE permission could keep a session in
    // STARTED/IN_PROGRESS indefinitely and exhaust the concurrent-session
    // budget for the organization (slow DoS).
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

    // Update session to IN_PROGRESS
    if (session.status === 'STARTED') {
      await this.recognitionRepo.updateSessionStatus(tenant.organizationId, sessionId, 'IN_PROGRESS');
    }

    const startTime = Date.now();
    // config was already obtained above for TTL check — reuse it here.
    let attemptStatus: RecognitionAttemptStatus = RecognitionAttemptStatus.DETECTED;
    let qualityScore = 0;
    let livenessResult = 'UNAVAILABLE';
    let similarityScore: number | null = null;
    let identifiedStudentId: string | null = null;
    let student: { id: string; firstName: string; lastName: string } | null = null;
    let message = '';
    let persistedAttempt:
      | Awaited<ReturnType<RecognitionRepository['createAttempt']>>
      | null = null;

    try {
      // Stage 1: Face Detection
      const detectedFaces = await this.faceEngine.detectFaces({ imageBuffer, format: 'jpeg' });
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
      const primaryFace = detectedFaces[0];

      // Stage 2: Quality Assessment
      const quality = await this.faceEngine.assessQuality({ imageBuffer, face: primaryFace });
      qualityScore = quality.overallScore;
      if (!quality.passesThreshold || qualityScore < config.qualityThreshold) {
        attemptStatus = RecognitionAttemptStatus.QUALITY_FAILED;
        throw new FaceQualityTooLowError(qualityScore, config.qualityThreshold);
      }
      attemptStatus = RecognitionAttemptStatus.QUALITY_PASSED;

      // Stage 3: Liveness
      const liveness = await this.faceEngine.checkLiveness({ imageBuffer, face: primaryFace });
      livenessResult = liveness.decision;
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
      const probeEmbedding = await this.faceEngine.generateEmbedding({ imageBuffer, face: primaryFace });
      attemptStatus = RecognitionAttemptStatus.EMBEDDING_GENERATED;

      // Stage 5: Candidate Retrieval & Matching
      // Memory-safe: stream the active template gallery in bounded batches
      // via cursor pagination. Each batch is held in memory only for the
      // duration of the comparison loop; total memory is O(BATCH_SIZE) rather
      // than O(total templates). Cosine similarity on 128-dim embeddings is
      // trivial (µs each), so iterating all templates remains the correct
      // correctness behaviour — we just stop materialising the whole gallery
      // at once.
      const BATCH_SIZE = 500;

      let bestSimilarity = -1;
      let bestMatch:
        | Awaited<ReturnType<EnrollmentRepository['findAllActiveTemplates']>>[number]
        | null = null;
      let secondBestSimilarity = -1;

      const stream = this.enrollmentRepo.streamActiveTemplates(
        tenant.organizationId,
        BATCH_SIZE,
        session.groupId ?? undefined,
      );

      for await (const batch of stream) {
        // Yield to event loop between batches to prevent starvation during massive streaming
        await new Promise((resolve) => setImmediate(resolve));

        for (const template of batch) {
          // Model-version compatibility guard: a template extracted with a
          // DIFFERENT embedding model yields meaningless similarity scores
          // (both false accepts and false rejects). Skip it — fail closed.
          //
          // A MISSING modelVersion cannot be verified against the running
          // engine, so it is also treated as incompatible. The previous
          // `template.modelVersion && ...` form compared unversioned
          // (legacy / mock-enrolled) templates against real embeddings, which
          // could fabricate a match or a rejection from a meaningless score.
          if (
            !template.modelVersion ||
            template.modelVersion !== this.faceEngine.getModelVersion()
          ) {
            continue;
          }

          try {
            // Memory Cache: Avoid O(N) AES decryptions per frame.
            // Templates are encrypted at rest, but we can cache them in-memory (in use).
            const cacheKey = `${tenant.organizationId}:${template.id}`;
            let storedEmbedding = RecognitionService.templateCache.get(cacheKey);
            
            // Cache invalidation: if hash changed (re-enrollment), re-decrypt.
            if (!storedEmbedding || storedEmbedding.hash !== template.templateHash) {
              const decryptedData = await this.encryption.decrypt(template.templateData);
              
              // Verify integrity
              const hashValid = await this.encryption.verifyHash(decryptedData, template.templateHash);
              if (!hashValid) {
                await this.audit.log({
                  organizationId: tenant.organizationId,
                  type: 'TEMPLATE_CORRUPTED',
                  resourceType: 'FaceTemplate',
                  resourceId: template.id,
                  description: `Template integrity check failed: ${template.id}`,
                });
                continue;
              }
              
              storedEmbedding = {
                hash: template.templateHash,
                embedding: FaceEmbedding.deserialize(decryptedData),
              };
              
              // Enforce bounds to prevent memory leaks (max 100,000 templates = ~50MB)
              if (RecognitionService.templateCache.size > 100000) {
                RecognitionService.templateCache.clear();
              }
              RecognitionService.templateCache.set(cacheKey, storedEmbedding);
            }

            const similarity = await this.faceEngine.compareEmbeddings({
              embeddingA: probeEmbedding,
              embeddingB: storedEmbedding.embedding,
            });

            // Fail closed on a non-finite score (NaN/Infinity): every
            // threshold comparison below (score < threshold) would be false
            // for NaN, so an invalid score must never enter the ranking.
            if (!Number.isFinite(similarity)) {
              continue;
            }

            if (!bestMatch) {
              bestSimilarity = similarity;
              bestMatch = template;
            } else if (template.studentId === bestMatch.studentId) {
              if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = template;
              }
            } else {
              // Different student from current bestMatch
              if (similarity > bestSimilarity) {
                if (bestSimilarity > secondBestSimilarity) {
                  secondBestSimilarity = bestSimilarity;
                }
                bestSimilarity = similarity;
                bestMatch = template;
              } else if (similarity > secondBestSimilarity) {
                secondBestSimilarity = similarity;
              }
            }
          } catch (err: unknown) {
            void this.audit.log({
              organizationId: tenant.organizationId,
              userId: tenant.userId,
              type: AuditEventType.TEMPLATE_CORRUPTED,
              resourceType: 'FaceTemplate',
              resourceId: template.id,
              description: `Face template decryption or comparison failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
              metadata: {
                studentId: template.studentId,
                templateHash: template.templateHash,
              },
            }).catch(() => {
              // Audit logging failure must not crash the recognition pipeline
            });
            // Fail closed for this template, continue searching remaining valid templates
            continue;
          }
        }
      }

      const ambiguityMargin =
        bestMatch && secondBestSimilarity >= 0
          ? bestSimilarity - secondBestSimilarity
          : null;

      if (bestMatch && bestSimilarity >= 0) {
        similarityScore = bestSimilarity;
        identifiedStudentId = bestMatch.studentId;
        student = bestMatch.student;
        attemptStatus = bestSimilarity >= config.matching.similarityThreshold
          ? RecognitionAttemptStatus.MATCH_FOUND
          : RecognitionAttemptStatus.MATCH_NOT_FOUND;
      } else {
        attemptStatus = RecognitionAttemptStatus.MATCH_NOT_FOUND;
      }

      // Stage 6: Decision Policy
      const decision = this.decisionPolicy.decide({
        qualityScore,
        livenessDecision: liveness.decision as 'PASS' | 'FAIL' | 'UNCERTAIN' | 'UNAVAILABLE',
        livenessConfidence: liveness.confidence,
        similarityScore,
        bestMatchFound: bestMatch !== null,
        ambiguityMargin,
      }, identifiedStudentId ?? undefined);

      // Final attempt status
      if (decision.outcome === 'IDENTIFIED') {
        attemptStatus = RecognitionAttemptStatus.IDENTIFIED;
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
      let attendanceRecorded = false;
      let attendanceDecision: string | null = null;
      let attendanceRecordId: string | null = null;

      if (decision.outcome === 'IDENTIFIED' && session.groupId) {
        const attendanceCheck = await this.attendancePolicy.validate(
          tenant,
          decision.studentId,
          session.groupId,
          session.lessonId,
          sessionId
        );

        if (attendanceCheck.decision === 'RECORDED') {
          const record = await this.recognitionRepo.createAttendance({
            organizationId: tenant.organizationId,
            studentId: decision.studentId,
            groupId: session.groupId!,
            lessonId: session.lessonId ?? undefined,
            sessionId,
            recognitionAttemptId: attempt.id,
            decision: 'RECORDED',
          });
          // createAttendance can resolve to an existing row on a P2002 race
          // (decision 'DUPLICATE_PREVENTED') — reflect the true outcome.
          attendanceRecorded = record.decision === 'RECORDED';
          attendanceDecision = record.decision;
          // Only expose the id when this attempt is what created the row, so a
          // caller can never delete a pre-existing attendance record.
          attendanceRecordId = attendanceRecorded ? record.id : null;
        } else {
          attendanceDecision = attendanceCheck.decision;
        }
      } else if (decision.outcome === 'IDENTIFIED') {
        // Identified, but the session carries no group -> attendance cannot be
        // attributed. Return an EXPLICIT decision instead of silently
        // skipping (a silent skip is indistinguishable from 'recorded' in
        // logs/metrics and hides misconfigured kiosk sessions).
        attendanceDecision = 'NO_GROUP_CONTEXT';
      }

      // Audit
      await this.audit.log({
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        type: decision.outcome === 'IDENTIFIED' ? 'FACE_RECOGNITION_CONFIRMED' : 'FACE_RECOGNITION_REJECTED',
        resourceType: 'RecognitionAttempt',
        resourceId: attempt.id,
        description: message,
        metadata: { sessionId, attemptId: attempt.id, identifiedStudentId, attendanceRecorded },
      });

      return {
        attemptId: attempt.id,
        identified: decision.outcome === 'IDENTIFIED',
        status: attemptStatus,
        student,
        confidence: decision.outcome === 'IDENTIFIED' ? decision.confidence : 'NONE',
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
            identified: decision.outcome === 'IDENTIFIED',
            status: attemptStatus,
            student,
            confidence: decision.outcome === 'IDENTIFIED' ? decision.confidence : 'NONE',
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
      const errorMessage = error instanceof Error ? error.message : 'Recognition failed';

      // A failure AFTER the attempt row was persisted must not create a
      // second attempt row — previously the catch-all created a duplicate
      // ERROR attempt alongside the real one (regression: CO-3).
      if (persistedAttempt) {
        return {
          attemptId: persistedAttempt.id,
          identified: false,
          status: persistedAttempt.status,
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

      // Pre-persistence failure: keep the REAL failure reason (QUALITY_FAILED,
      // LIVENESS_FAILED, LIVENESS_UNCERTAIN, LIVENESS_UNAVAILABLE, ...)
      // instead of collapsing every failure into ERROR (regression: CO-3).
      const failedStatus =
        attemptStatus !== RecognitionAttemptStatus.DETECTED
          ? attemptStatus
          : RecognitionAttemptStatus.ERROR;

      const attempt = await this.recognitionRepo.createAttempt({
        organizationId: tenant.organizationId,
        sessionId,
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

  /**
   * Finish a recognition session.
   */
  async finishSession(
    tenant: TenantContext,
    sessionId: string,
    reason: 'COMPLETED' | 'TIMEOUT' | 'CANCELLED' | 'ERROR' = 'COMPLETED'
  ): Promise<void> {
    const session = await this.recognitionRepo.findSession(tenant.organizationId, sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);

    const status: RecognitionSessionStatus =
      reason === 'ERROR' ? 'ERROR' : reason === 'CANCELLED' ? 'CANCELLED' : 'FINISHED';
    await this.recognitionRepo.updateSessionStatus(
      tenant.organizationId,
      sessionId,
      status,
      new Date()
    );
  }
  /**
   * Process multiple faces in a single capture frame.
   * Evaluates each detected face, matches against the gallery in a single streaming pass,
   * and records attendance for all identified students.
   */
  private async processMultipleFacesAttempt(
    tenant: TenantContext,
    session: NonNullable<Awaited<ReturnType<RecognitionRepository['findSession']>>>,
    imageBuffer: Buffer,
    detectedFaces: DetectedFace[],
    startTime: number,
  ): Promise<RecognitionAttemptResult> {
    const config = this.decisionPolicy.getConfig();

    // Sort faces by area descending (largest / most prominent face first)
    const sortedFaces = [...detectedFaces].sort((a, b) => {
      const areaA = (a.boundingBox?.width ?? 0) * (a.boundingBox?.height ?? 0);
      const areaB = (b.boundingBox?.width ?? 0) * (b.boundingBox?.height ?? 0);
      return areaB - areaA;
    });

    const MAX_FACES_PER_FRAME = 5;
    const facesToProcess = sortedFaces.slice(0, MAX_FACES_PER_FRAME);

    const faceDataList: Array<{
      faceIndex: number;
      face: DetectedFace;
      qualityScore: number;
      qualityPasses: boolean;
      livenessResult: string;
      livenessStatus: RecognitionAttemptStatus;
      probeEmbedding: FaceEmbedding | null;
      bestSimilarity: number;
      bestMatch: Awaited<ReturnType<EnrollmentRepository['findAllActiveTemplates']>>[number] | null;
      secondBestSimilarity: number;
    }> = [];

    for (let i = 0; i < facesToProcess.length; i++) {
      const face = facesToProcess[i];
      let qualityScore = 0;
      let qualityPasses = false;
      let livenessResult = 'UNAVAILABLE';
      let livenessStatus: RecognitionAttemptStatus = RecognitionAttemptStatus.LIVENESS_PASSED;
      let probeEmbedding: FaceEmbedding | null = null;

      try {
        const quality = await this.faceEngine.assessQuality({ imageBuffer, face });
        qualityScore = quality.overallScore;
        qualityPasses = quality.passesThreshold && qualityScore >= config.qualityThreshold;

        if (qualityPasses) {
          const liveness = await this.faceEngine.checkLiveness({ imageBuffer, face });
          livenessResult = liveness.decision;
          if (liveness.decision === 'FAIL') {
            livenessStatus = RecognitionAttemptStatus.LIVENESS_FAILED;
          } else if (liveness.decision === 'UNCERTAIN') {
            livenessStatus = RecognitionAttemptStatus.LIVENESS_UNCERTAIN;
          } else if (liveness.decision === 'UNAVAILABLE') {
            livenessStatus = RecognitionAttemptStatus.LIVENESS_UNAVAILABLE;
          } else {
            livenessStatus = RecognitionAttemptStatus.LIVENESS_PASSED;
            probeEmbedding = await this.faceEngine.generateEmbedding({ imageBuffer, face });
          }
        }
      } catch {
        // Continue processing other faces if one face fails preprocessing
      }

      faceDataList.push({
        faceIndex: i,
        face,
        qualityScore,
        qualityPasses,
        livenessResult,
        livenessStatus,
        probeEmbedding,
        bestSimilarity: -1,
        bestMatch: null,
        secondBestSimilarity: -1,
      });
    }

    const facesWithEmbeddings = faceDataList.filter((f) => f.probeEmbedding !== null);
    if (facesWithEmbeddings.length > 0) {
      const BATCH_SIZE = 500;
      const stream = this.enrollmentRepo.streamActiveTemplates(
        tenant.organizationId,
        BATCH_SIZE,
        session.groupId ?? undefined,
      );

      for await (const batch of stream) {
        await new Promise((resolve) => setImmediate(resolve));
        for (const template of batch) {
          if (!template.modelVersion || template.modelVersion !== this.faceEngine.getModelVersion()) {
            continue;
          }

          try {
            const cacheKey = `${tenant.organizationId}:${template.id}`;
            let storedEmbedding = RecognitionService.templateCache.get(cacheKey);

            if (!storedEmbedding || storedEmbedding.hash !== template.templateHash) {
              const decryptedData = await this.encryption.decrypt(template.templateData);
              const hashValid = await this.encryption.verifyHash(decryptedData, template.templateHash);
              if (!hashValid) continue;

              storedEmbedding = {
                hash: template.templateHash,
                embedding: FaceEmbedding.deserialize(decryptedData),
              };
              if (RecognitionService.templateCache.size > 100000) {
                RecognitionService.templateCache.clear();
              }
              RecognitionService.templateCache.set(cacheKey, storedEmbedding);
            }

            for (const faceData of facesWithEmbeddings) {
              const similarity = await this.faceEngine.compareEmbeddings({
                embeddingA: faceData.probeEmbedding!,
                embeddingB: storedEmbedding.embedding,
              });

              if (!Number.isFinite(similarity)) continue;

              if (!faceData.bestMatch) {
                faceData.bestSimilarity = similarity;
                faceData.bestMatch = template;
              } else if (template.studentId === faceData.bestMatch.studentId) {
                if (similarity > faceData.bestSimilarity) {
                  faceData.bestSimilarity = similarity;
                  faceData.bestMatch = template;
                }
              } else {
                if (similarity > faceData.bestSimilarity) {
                  if (faceData.bestSimilarity > faceData.secondBestSimilarity) {
                    faceData.secondBestSimilarity = faceData.bestSimilarity;
                  }
                  faceData.bestSimilarity = similarity;
                  faceData.bestMatch = template;
                } else if (similarity > faceData.secondBestSimilarity) {
                  faceData.secondBestSimilarity = similarity;
                }
              }
            }
          } catch {
            continue;
          }
        }
      }
    }

    const matches: RecognitionMatchItem[] = [];

    for (const fd of faceDataList) {
      let attemptStatus: RecognitionAttemptStatus;
      let identifiedStudentId: string | null = null;
      let student: { id: string; firstName: string; lastName: string } | null = null;
      let message = '';
      let similarityScore: number | null = null;
      let confidenceDecision: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' = 'NONE';

      if (!fd.qualityPasses) {
        attemptStatus = RecognitionAttemptStatus.QUALITY_FAILED;
        message = `Face quality too low: ${fd.qualityScore.toFixed(2)}`;
      } else if (fd.livenessStatus === RecognitionAttemptStatus.LIVENESS_FAILED) {
        attemptStatus = RecognitionAttemptStatus.LIVENESS_FAILED;
        message = 'Liveness check failed';
      } else {
        const ambiguityMargin =
          fd.bestMatch && fd.secondBestSimilarity >= 0 ? fd.bestSimilarity - fd.secondBestSimilarity : null;

        if (fd.bestMatch && fd.bestSimilarity >= 0) {
          similarityScore = fd.bestSimilarity;
          identifiedStudentId = fd.bestMatch.studentId;
          student = fd.bestMatch.student;
          attemptStatus =
            fd.bestSimilarity >= config.matching.similarityThreshold
              ? RecognitionAttemptStatus.MATCH_FOUND
              : RecognitionAttemptStatus.MATCH_NOT_FOUND;
        } else {
          attemptStatus = RecognitionAttemptStatus.MATCH_NOT_FOUND;
        }

        const decision = this.decisionPolicy.decide(
          {
            qualityScore: fd.qualityScore,
            livenessDecision: fd.livenessResult as any,
            livenessConfidence: 0.9,
            similarityScore,
            bestMatchFound: fd.bestMatch !== null,
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

      let attendanceRecorded = false;
      let attendanceDecision: string | null = null;
      let attendanceRecordId: string | null = null;

      if (attemptStatus === RecognitionAttemptStatus.IDENTIFIED && identifiedStudentId && session.groupId) {
        const attendanceCheck = await this.attendancePolicy.validate(
          tenant,
          identifiedStudentId,
          session.groupId,
          session.lessonId,
          session.id,
        );

        if (attendanceCheck.decision === 'RECORDED') {
          const record = await this.recognitionRepo.createAttendance({
            organizationId: tenant.organizationId,
            studentId: identifiedStudentId,
            groupId: session.groupId,
            lessonId: session.lessonId ?? undefined,
            sessionId: session.id,
            recognitionAttemptId: attempt.id,
            decision: 'RECORDED',
          });
          attendanceRecorded = record.decision === 'RECORDED';
          attendanceDecision = record.decision;
          attendanceRecordId = attendanceRecorded ? record.id : null;
        } else {
          attendanceDecision = attendanceCheck.decision;
        }
      } else if (attemptStatus === RecognitionAttemptStatus.IDENTIFIED && identifiedStudentId) {
        attendanceDecision = 'NO_GROUP_CONTEXT';
      }

      void this.audit.log({
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        type: attemptStatus === RecognitionAttemptStatus.IDENTIFIED ? 'FACE_RECOGNITION_CONFIRMED' : 'FACE_RECOGNITION_REJECTED',
        resourceType: 'RecognitionAttempt',
        resourceId: attempt.id,
        description: message,
        metadata: { sessionId: session.id, attemptId: attempt.id, identifiedStudentId, attendanceRecorded },
      }).catch(() => {});

      matches.push({
        faceIndex: fd.faceIndex,
        attemptId: attempt.id,
        identified: attemptStatus === RecognitionAttemptStatus.IDENTIFIED,
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

    const primaryMatch = matches.find((m) => m.identified) || matches[0];
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
}
