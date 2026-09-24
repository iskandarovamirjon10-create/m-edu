/**
 * Retention Service — manages biometric data lifecycle.
 *
 * Supports: revoke, delete, retention policy, expired enrollment.
 * Deletion must be carefully designed so biometric data is not
 * accidentally retained indefinitely.
 */

import type { EnrollmentRepository, TemplateEntity } from '@medu/core';
import type { AuditRepository } from '@medu/core';

export interface RetentionResult {
  processed: number;
  deleted: number;
  revoked: number;
  errors: string[];
}

export class RetentionService {
  constructor(
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly audit: AuditRepository
  ) {}

  /**
   * Expire enrollments that have passed their template expiration date.
   * Should be run as a scheduled job (e.g., daily via BullMQ).
   */
  async expireStaleEnrollments(organizationId: string): Promise<RetentionResult> {
    const result: RetentionResult = { processed: 0, deleted: 0, revoked: 0, errors: [] };

    try {
      // Find active enrollments
      const { items } = await this.enrollmentRepo.list(organizationId, {
        status: 'ACTIVE',
        limit: 1000,
      });

      for (const enrollment of items) {
        result.processed++;

        // Check if any templates have expired
        const expiredTemplates = enrollment.templates.filter(
          (t: TemplateEntity) => t.expiresAt && t.expiresAt < new Date()
        );

        if (expiredTemplates.length > 0 && expiredTemplates.length === enrollment.templates.length) {
          // All templates expired — revoke enrollment
          try {
            await this.enrollmentRepo.revokeTemplates(organizationId, enrollment.id);
            await this.enrollmentRepo.updateStatus(organizationId, enrollment.id, 'EXPIRED', {
              revokedAt: new Date(),
              revocationReason: 'Templates expired by retention policy',
            });

            await this.audit.log({
              organizationId,
              type: 'RETENTION_POLICY_APPLIED',
              resourceType: 'FaceEnrollment',
              resourceId: enrollment.id,
              description: `Enrollment expired by retention policy`,
              metadata: { studentId: enrollment.studentId, expiredTemplateCount: expiredTemplates.length },
            });

            result.revoked++;
          } catch (error) {
            result.errors.push(`Failed to expire enrollment ${enrollment.id}: ${error}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Retention job failed: ${error}`);
    }

    return result;
  }

  /**
   * Delete all biometric data for a student.
   * Used when a student account is deleted or consent is revoked.
   */
  async deleteStudentBiometrics(
    organizationId: string,
    studentId: string,
    reason: string
  ): Promise<RetentionResult> {
    const result: RetentionResult = { processed: 0, deleted: 0, revoked: 0, errors: [] };

    try {
      const enrollment = await this.enrollmentRepo.findByStudentId(organizationId, studentId);
      if (!enrollment) return result;

      result.processed = 1;

      // Revoke all templates
      await this.enrollmentRepo.revokeTemplates(organizationId, enrollment.id);

      // Revoke enrollment
      await this.enrollmentRepo.updateStatus(organizationId, enrollment.id, 'REVOKED', {
        revokedAt: new Date(),
        revocationReason: reason,
      });

      await this.audit.log({
        organizationId,
        type: 'TEMPLATE_DELETED',
        resourceType: 'FaceEnrollment',
        resourceId: enrollment.id,
        description: `Biometric data deleted: ${reason}`,
        metadata: { studentId, reason },
      });

      result.deleted = 1;
    } catch (error) {
      result.errors.push(`Failed to delete biometrics for student ${studentId}: ${error}`);
    }

    return result;
  }
}
