import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Retention cleanup for high-churn operational tables.
 *
 * SAFETY INVARIANT: every deleteMany in this service MUST be scoped to a
 * single organization (`where: { organizationId, ... }`). Deletion is only
 * ever performed per-tenant, iterating the tenant list — a global,
 * cross-tenant delete (one unscoped deleteMany wiping every organization's
 * rows) is structurally impossible here.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  private static readonly RECOGNITION_ATTEMPT_RETENTION_DAYS = 30;
  private static readonly CAMERA_EVENT_RETENTION_DAYS = 30;
  private static readonly AUDIT_LOG_RETENTION_DAYS = 90;

  constructor(private readonly prisma: PrismaService) {}

  async cleanupOldLogs(): Promise<void> {
    this.logger.log('Starting tenant-scoped cleanup of old records...');

    const organizations = await this.prisma.organization.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    for (const { id: organizationId } of organizations) {
      try {
        await this.cleanupLogsForOrganization(organizationId);
      } catch (error) {
        // One tenant's failure must not abort or skip the others.
        this.logger.error(
          `Cleanup failed for organization ${organizationId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(`Tenant-scoped cleanup completed for ${organizations.length} organization(s).`);
  }

  /**
   * Cleanup for a SINGLE tenant. All deletes below are scoped by
   * organizationId by construction — do not loosen this.
   */
  async cleanupLogsForOrganization(organizationId: string): Promise<void> {
    const thirtyDaysAgo = this.daysAgo(CleanupService.RECOGNITION_ATTEMPT_RETENTION_DAYS);
    const ninetyDaysAgo = this.daysAgo(CleanupService.AUDIT_LOG_RETENTION_DAYS);

    // 1. Recognition Attempts older than 30 days
    const deletedAttempts = await this.prisma.recognitionAttempt.deleteMany({
      where: {
        organizationId,
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    // 2. Camera Attendance Events older than 30 days
    const deletedCameraEvents = await this.prisma.cameraAttendanceEvent.deleteMany({
      where: {
        organizationId,
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    // 3. Audit logs older than 90 days
    const deletedAudit = await this.prisma.auditLog.deleteMany({
      where: {
        organizationId,
        timestamp: { lt: ninetyDaysAgo },
      },
    });

    // 4. Expire FaceEnrollments that are older than their templates' expiresAt
    const deletedStaleTemplates = this.prisma.faceTemplate?.deleteMany
      ? await this.prisma.faceTemplate.deleteMany({
          where: {
            organizationId,
            expiresAt: { lt: new Date() },
          },
        })
      : { count: 0 };

    // 5. Purge FaceTemplates belonging to REVOKED enrollments
    const deletedRevokedTemplates = this.prisma.faceTemplate?.deleteMany
      ? await this.prisma.faceTemplate.deleteMany({
          where: {
            organizationId,
            enrollment: {
              status: 'REVOKED',
            },
          },
        })
      : { count: 0 };

    // 6. Purge old NotificationDelivery records older than 30 days
    const deletedDeliveries = this.prisma.notificationDelivery?.deleteMany
      ? await this.prisma.notificationDelivery.deleteMany({
          where: {
            organizationId,
            createdAt: { lt: thirtyDaysAgo },
          },
        })
      : { count: 0 };

    this.logger.log(
      `Cleanup for organization ${organizationId}: ` +
        `deleted ${deletedAttempts.count} RecognitionAttempt, ` +
        `${deletedCameraEvents.count} CameraAttendanceEvent, ` +
        `${deletedAudit.count} AuditLog, ` +
        `${deletedStaleTemplates.count} Stale FaceTemplate, ` +
        `${deletedRevokedTemplates.count} Revoked FaceTemplate, ` +
        `${deletedDeliveries.count} NotificationDelivery record(s).`,
    );
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}
