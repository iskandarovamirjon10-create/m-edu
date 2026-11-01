import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/** Bounded delete batch — prevents table locking and connection timeouts. */
const PURGE_BATCH_SIZE = 1000;

/** Default retention for unlinked transient camera/face frames: 30 days. */
const DEFAULT_RETENTION_DAYS = 30;

/** Statuses of transient attempts that never resulted in an attendance record. */
const TRANSIENT_ATTEMPT_STATUSES = [
  'MATCH_NOT_FOUND',
  'QUALITY_FAILED',
  'LIVENESS_FAILED',
  'UNIDENTIFIED',
  'ERROR',
] as const;

/** Decisions of transient camera events that never linked to an attendance record. */
const TRANSIENT_CAMERA_DECISIONS = [
  'NO_SCHEDULE',
  'NOT_ENROLLED',
  'HOLIDAY',
  'STUDENT_INACTIVE',
] as const;

/**
 * Biometric & Camera Operational Retention Service.
 *
 * Keeps PostgreSQL lean and query latency low by periodically purging raw, un-matched
 * camera frames and transient kiosk attempts older than the retention threshold.
 *
 * Safety Invariants:
 * 1. NEVER deletes any `Attendance` record (authoritative business truth).
 * 2. NEVER deletes any event or attempt that has an `attendanceId` (audit evidence).
 * 3. NEVER touches events with decisions like `RECORDED` or `MANUAL_PRESERVED`.
 * 4. Runs chunked in batches of 1,000 rows to avoid PostgreSQL lock contention.
 */
@Injectable()
export class BiometricRetentionService {
  private readonly logger = new Logger(BiometricRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async sweep(): Promise<{ purgedAttempts: number; purgedEvents: number }> {
    const cutoff = this.getCutoffDate();
    let purgedAttempts = 0;
    let purgedEvents = 0;

    try {
      purgedAttempts = await this.purgeTransientRecognitionAttemptsOlderThan(cutoff);
      purgedEvents = await this.purgeTransientCameraEventsOlderThan(cutoff);

      if (purgedAttempts > 0 || purgedEvents > 0) {
        this.logger.log(
          JSON.stringify({
            event: 'biometric_retention_sweep_completed',
            purgedAttempts,
            purgedEvents,
            cutoff: cutoff.toISOString(),
          }),
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        JSON.stringify({
          event: 'biometric_retention_sweep_failed',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    return { purgedAttempts, purgedEvents };
  }

  /**
   * Purges unlinked transient `RecognitionAttempt` rows older than cutoff in batches.
   */
  async purgeTransientRecognitionAttemptsOlderThan(cutoff: Date): Promise<number> {
    let total = 0;

    for (;;) {
      const batch = await this.prisma.recognitionAttempt.findMany({
        where: {
          attendanceId: null,
          status: { in: [...TRANSIENT_ATTEMPT_STATUSES] },
          createdAt: { lt: cutoff },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: PURGE_BATCH_SIZE,
      });

      if (batch.length === 0) break;

      const result = await this.prisma.recognitionAttempt.deleteMany({
        where: { id: { in: batch.map((row) => row.id) } },
      });

      total += result.count;
      if (batch.length < PURGE_BATCH_SIZE) break;
    }

    return total;
  }

  /**
   * Purges unlinked transient `CameraAttendanceEvent` rows older than cutoff in batches.
   */
  async purgeTransientCameraEventsOlderThan(cutoff: Date): Promise<number> {
    let total = 0;

    for (;;) {
      const batch = await this.prisma.cameraAttendanceEvent.findMany({
        where: {
          attendanceId: null,
          decision: { in: [...TRANSIENT_CAMERA_DECISIONS] },
          createdAt: { lt: cutoff },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: PURGE_BATCH_SIZE,
      });

      if (batch.length === 0) break;

      const result = await this.prisma.cameraAttendanceEvent.deleteMany({
        where: { id: { in: batch.map((row) => row.id) } },
      });

      total += result.count;
      if (batch.length < PURGE_BATCH_SIZE) break;
    }

    return total;
  }

  getCutoffDate(now = new Date()): Date {
    const envDays = Number(process.env.BIOMETRIC_RETENTION_DAYS);
    const days = Number.isFinite(envDays) && envDays >= 7 ? envDays : DEFAULT_RETENTION_DAYS;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
}
