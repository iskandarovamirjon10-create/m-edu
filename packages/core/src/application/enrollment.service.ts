/**
 * Enrollment application service — orchestrates the complete face enrollment workflow.
 *
 * This service coordinates between domain logic, ports, and external adapters.
 * It enforces business rules, authorization, and audit logging.
 *
 * The enrollment flow:
 * 1. Validate authorization (face.enroll permission)
 * 2. Validate tenant context
 * 3. Check consent status
 * 4. Check existing enrollment
 * 5. Create enrollment record (PENDING status)
 * 6. [External: camera capture → detection → quality → liveness → embedding]
 * 7. Encrypt template
 * 8. Persist template
 * 9. Activate enrollment
 * 10. Audit event
 */

import type { EnrollmentRepository } from '../ports/enrollment-repository.port';
import type { FaceEngine } from '../ports/face-engine.port';
import type { EncryptionPort } from '../ports/encryption.port';
import type { AuthorizationPort } from '../ports/authorization.port';
import type { AuditRepository } from '../ports/audit-repository.port';
import type { StudentDirectoryPort } from '../ports/student-directory.port';
import type { TenantContext } from '../ports/tenant-context.port';
import {
  EnrollmentNotFoundError,
  EnrollmentAlreadyExistsError,
  EnrollmentNotActiveError,
  FaceNotDetectedError,
  MultipleFacesDetectedError,
  FaceQualityTooLowError,
  LivenessFailedError,
  LivenessUnavailableError,
  EngineUnavailableError,
  BiometricAccessDeniedError,
} from '../domain/errors';
import { FaceEmbedding } from '../domain/value-objects';
import { Permissions } from '@medu/contracts';

export interface EnrollmentServiceConfig {
  maxFacesPerImage: number;
  enrollmentRetryLimit: number;
  /**
   * Whether to accept an UNCERTAIN liveness result during enrollment.
   *
   * Defaults to false (fail-closed): an UNCERTAIN result rejects the
   * enrollment, matching RecognitionDecisionPolicy's default semantics.
   * Set to true ONLY when an operator has explicitly calibrated their
   * liveness model to permit UNCERTAIN outcomes for enrollment.
   *
   * FAIL and UNAVAILABLE are ALWAYS rejected regardless of this flag.
   */
  acceptUncertainLiveness?: boolean;

  /**
   * Minimum similarity between a new enrollment's embedding and an existing
   * DIFFERENT student's active template before a POTENTIAL_DUPLICATE_FACE
   * audit event is emitted. Previously hard-coded at 0.80.
   */
  duplicateFaceThreshold?: number;

  /**
   * Minimum quality score required to accept an enrollment capture.
   * Previously hard-coded at 0.4.
   */
  qualityThreshold?: number;
}

export class EnrollmentService {
  constructor(
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly faceEngine: FaceEngine,
    private readonly encryption: EncryptionPort,
    private readonly authorization: AuthorizationPort,
    private readonly audit: AuditRepository,
    private readonly studentDirectory: StudentDirectoryPort,
    private readonly config: EnrollmentServiceConfig
  ) {}

  /**
   * Start a new enrollment for a student.
   * Creates a PENDING enrollment record.
   */
  async startEnrollment(
    tenant: TenantContext,
    studentId: string
  ): Promise<{ enrollmentId: string; status: 'PENDING' }> {
    // 1. Authorization
    await this.authorization.requirePermission(Permissions.FACE_ENROLL, tenant.role);

    // 2. Validate student exists and is active
    const student = await this.studentDirectory.getStudent(tenant.organizationId, studentId);
    if (!student) {
      throw new BiometricAccessDeniedError('student', studentId);
    }
    if (!student.isActive) {
      throw new BiometricAccessDeniedError('student', studentId);
    }

    // 3. Check existing enrollment
    const existing = await this.enrollmentRepo.findByStudentId(tenant.organizationId, studentId);
    if (existing && existing.status === 'ACTIVE') {
      throw new EnrollmentAlreadyExistsError(studentId);
    }

    // 4. Create enrollment
    const enrollment = await this.enrollmentRepo.create({
      organizationId: tenant.organizationId,
      studentId,
      enrolledBy: tenant.userId,
    });

    // 5. Audit
    await this.audit.log({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      type: 'FACE_ENROLLMENT_CREATED',
      resourceType: 'FaceEnrollment',
      resourceId: enrollment.id,
      description: `Enrollment started for student ${studentId}`,
      metadata: { studentId, enrollmentId: enrollment.id },
    });

    return { enrollmentId: enrollment.id, status: 'PENDING' };
  }

  /**
   * Process a face capture for enrollment.
   * Runs: detect → quality → liveness → embed → encrypt → persist → activate.
   *
   * This method receives raw image data and runs the full pipeline.
   */
  async processEnrollmentCapture(
    tenant: TenantContext,
    enrollmentId: string,
    imageBuffer: Buffer
  ): Promise<{
    enrollmentId: string;
    templateId: string;
    qualityScore: number;
    livenessResult: string;
    status: 'ACTIVE';
  }> {
    // 1. Authorization
    await this.authorization.requirePermission(Permissions.FACE_ENROLL, tenant.role);

    // 2. Validate enrollment exists and is PENDING
    const enrollment = await this.enrollmentRepo.findById(tenant.organizationId, enrollmentId);
    if (!enrollment) {
      throw new EnrollmentNotFoundError(enrollmentId);
    }
    if (enrollment.status !== 'PENDING') {
      throw new EnrollmentNotActiveError(enrollmentId);
    }

    // 3. Check engine availability
    const engineAvailable = await this.faceEngine.isAvailable();
    if (!engineAvailable) {
      throw new EngineUnavailableError();
    }

    const startTime = Date.now();

    // 4. Face Detection
    const detectedFaces = await this.faceEngine.detectFaces({
      imageBuffer,
      format: 'jpeg',
    });

    if (detectedFaces.length === 0) {
      throw new FaceNotDetectedError();
    }
    if (detectedFaces.length > this.config.maxFacesPerImage) {
      throw new MultipleFacesDetectedError(detectedFaces.length);
    }

    const primaryFace = detectedFaces[0];

    // 5. Quality Assessment
    const quality = await this.faceEngine.assessQuality({
      imageBuffer,
      face: primaryFace,
    });

    // SECURITY/QUALITY FIX: `quality.passesThreshold` reflects the engine's
    // *internal* threshold (hardcoded in the quality assessor), not the
    // operator-configured `qualityThreshold`. Previously raising
    // FACE_QUALITY_THRESHOLD only changed the error message text while the
    // actual gate stayed at 0.4. The operator threshold is now enforced
    // explicitly here as well.
    const effectiveQualityThreshold = this.config.qualityThreshold ?? 0.4;
    if (!quality.passesThreshold || quality.overallScore < effectiveQualityThreshold) {
      throw new FaceQualityTooLowError(quality.overallScore, effectiveQualityThreshold);
    }

    // 6. Liveness Check — FAIL-CLOSED.
    // A biometric enrollment MUST NOT create/activate a face template without
    // a successful mandatory liveness check. This mirrors the production
    // RecognitionDecisionPolicy semantics (livenessPolicy.required === true).
    const liveness = await this.faceEngine.checkLiveness({
      imageBuffer,
      face: primaryFace,
    });

    if (liveness.decision === 'FAIL') {
      await this.audit.log({
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        type: 'LIVENESS_FAILED',
        resourceType: 'FaceEnrollment',
        resourceId: enrollmentId,
        description: `Liveness check failed during enrollment for student ${enrollment.studentId}`,
        metadata: { livenessDecision: liveness.decision, livenessConfidence: liveness.confidence },
      });
      throw new LivenessFailedError(liveness.decision);
    }

    if (liveness.decision === 'UNAVAILABLE') {
      await this.audit.log({
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        type: 'LIVENESS_FAILED',
        resourceType: 'FaceEnrollment',
        resourceId: enrollmentId,
        description: `Liveness unavailable during enrollment for student ${enrollment.studentId}`,
        metadata: { livenessDecision: liveness.decision, livenessConfidence: liveness.confidence },
      });
      throw new LivenessUnavailableError();
    }

    if (liveness.decision === 'UNCERTAIN') {
      // Default: reject. Enrollment is gated by a mandatory liveness check;
      // an UNCERTAIN result does not demonstrate a live subject, so it is
      // treated like a fail-closed outcome. Operators with a calibrated
      // UNCERTAIN-accepting model can opt in by setting
      // `config.acceptUncertainLiveness = true`.
      if (!this.config.acceptUncertainLiveness) {
        await this.audit.log({
          organizationId: tenant.organizationId,
          userId: tenant.userId,
          type: 'LIVENESS_FAILED',
          resourceType: 'FaceEnrollment',
          resourceId: enrollmentId,
          description: `Liveness check returned UNCERTAIN during enrollment for student ${enrollment.studentId}`,
          metadata: { livenessDecision: liveness.decision, livenessConfidence: liveness.confidence },
        });
        throw new LivenessFailedError(liveness.decision);
      }
    }

    // 7. Generate Embedding
    const embedding = await this.faceEngine.generateEmbedding({
      imageBuffer,
      face: primaryFace,
    });

    // 7.5 Duplicate Face Detection
    // Compares the new embedding against all existing active templates in the organization.
    // If an extremely high similarity match is found with a DIFFERENT student, log a warning.
    let maxSimilarity = -1;
    let duplicateStudentId: string | null = null;
    for await (const batch of this.enrollmentRepo.streamActiveTemplates(tenant.organizationId, 500)) {
      for (const existingTemplate of batch) {
        if (existingTemplate.studentId === enrollment.studentId) {
          continue; // Expected to match their own previous enrollments
        }
        try {
          const decrypted = await this.encryption.decrypt(existingTemplate.templateData);
          const existingEmbedding = FaceEmbedding.deserialize(decrypted);
          const sim = await this.faceEngine.compareEmbeddings({
            embeddingA: embedding,
            embeddingB: existingEmbedding,
          });
          if (sim > maxSimilarity) {
            maxSimilarity = sim;
            duplicateStudentId = existingTemplate.studentId;
          }
        } catch (e) {
          // Ignore version/dimension mismatch during cross-comparison
        }
      }
    }

    if (maxSimilarity >= (this.config.duplicateFaceThreshold ?? 0.8) && duplicateStudentId) {
      await this.audit.log({
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        type: 'POTENTIAL_DUPLICATE_FACE',
        resourceType: 'FaceEnrollment',
        resourceId: enrollmentId,
        description: `Potential duplicate face detected during enrollment. Extremely similar to another student.`,
        metadata: {
          studentId: enrollment.studentId,
          duplicateStudentId,
          similarityScore: maxSimilarity,
        },
      });
    }

    // 8. Encrypt Template
    const serializedEmbedding = embedding.serialize();
    const encryptedTemplate = await this.encryption.encrypt(serializedEmbedding);
    const templateHash = await this.encryption.hash(serializedEmbedding);

    // 9+10. Persist template AND activate enrollment atomically — two
    // separate writes used to leave an ACTIVE enrollment without a template
    // (or a template on a still-PENDING enrollment) if the process crashed
    // between them.
    const activated = await this.enrollmentRepo.addTemplateAndActivate({
      organizationId: tenant.organizationId,
      enrollmentId,
      studentId: enrollment.studentId,
      templateData: encryptedTemplate,
      templateHash,
      version: 1,
      modelVersion: this.faceEngine.getModelVersion(),
      qualityScore: quality.overallScore,
      activatedAt: new Date(),
    });
    const template = activated.template;

    // 11. Audit
    await this.audit.log({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      type: 'FACE_ENROLLMENT_CREATED',
      resourceType: 'FaceEnrollment',
      resourceId: enrollmentId,
      description: `Enrollment activated for student ${enrollment.studentId}`,
      metadata: {
        studentId: enrollment.studentId,
        templateId: template.id,
        qualityScore: quality.overallScore,
        livenessResult: liveness.decision,
        processingTimeMs: Date.now() - startTime,
      },
    });

    return {
      enrollmentId,
      templateId: template.id,
      qualityScore: quality.overallScore,
      livenessResult: liveness.decision,
      status: 'ACTIVE',
    };
  }

  /**
   * Revoke an enrollment.
   * Soft-deletes the enrollment and all associated templates.
   */
  async revokeEnrollment(
    tenant: TenantContext,
    enrollmentId: string,
    reason: string
  ): Promise<void> {
    await this.authorization.requirePermission(Permissions.FACE_REVOKE, tenant.role);

    const enrollment = await this.enrollmentRepo.findById(tenant.organizationId, enrollmentId);
    if (!enrollment) {
      throw new EnrollmentNotFoundError(enrollmentId);
    }

    // Revoke templates + enrollment atomically — no window where a REVOKED
    // enrollment keeps ACTIVE biometric templates that camera matching hits.
    await this.enrollmentRepo.revokeEnrollmentAndTemplates(
      tenant.organizationId,
      enrollmentId,
      {
        revokedAt: new Date(),
        revokedBy: tenant.userId,
        revocationReason: reason,
      }
    );

    // Audit
    await this.audit.log({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      type: 'FACE_ENROLLMENT_REVOKED',
      resourceType: 'FaceEnrollment',
      resourceId: enrollmentId,
      description: `Enrollment revoked: ${reason}`,
      metadata: { reason, studentId: enrollment.studentId },
    });
  }

  /**
   * Re-enroll a student.
   * Creates a new enrollment, preserving the old one (which gets revoked).
   */
  async reenrollStudent(
    tenant: TenantContext,
    enrollmentId: string,
    reason: string
  ): Promise<{ newEnrollmentId: string }> {
    await this.authorization.requirePermission(Permissions.FACE_REENROLL, tenant.role);

    const oldEnrollment = await this.enrollmentRepo.findById(tenant.organizationId, enrollmentId);
    if (!oldEnrollment) {
      throw new EnrollmentNotFoundError(enrollmentId);
    }

    // Atomically revoke the old enrollment and create its replacement —
    // the student never lingers in a half-REVOKED state with active templates.
    const { enrolled: newEnrollment } = await this.enrollmentRepo.atomicReenroll(
      tenant.organizationId,
      enrollmentId,
      {
        revokedAt: new Date(),
        revokedBy: tenant.userId,
        revocationReason: `Re-enrollment: ${reason}`,
      }
    );

    // Audit
    await this.audit.log({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      type: 'FACE_ENROLLMENT_REENROLLED',
      resourceType: 'FaceEnrollment',
      resourceId: newEnrollment.id,
      description: `Student re-enrolled: ${reason}`,
      metadata: {
        oldEnrollmentId: enrollmentId,
        newEnrollmentId: newEnrollment.id,
        reason,
      },
    });

    return { newEnrollmentId: newEnrollment.id };
  }
}
