import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { AuthService } from '../auth/auth.service';
import { FinancialCronService } from '../payments/financial-cron.service';
import { FollowUpAutomationService } from '../leads/follow-up-automation.service';
import { AutomationService } from '../automation/automation.service';
import { DistributedLockService } from '../lib/distributed-lock';
import { redisQueueConnection } from '../config/redis.config';
import { PrismaService } from '../prisma/prisma.service';
import { LessonGeneratorService } from '../schedule/lesson-generator.service';

// @ts-ignore – ioredis ESM/CJS interop
const Redis = require('ioredis');

// @ts-ignore – @nestjs/bullmq is ESM-only; resolved at runtime via monorepo hoisting
const { Processor, WorkerHost } = require('@nestjs/bullmq');

@Processor('background-jobs')
export class BackgroundJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(BackgroundJobsProcessor.name);
  private readonly lockService: DistributedLockService;

  constructor(
    private readonly cleanupService: CleanupService,
    private readonly authService: AuthService,
    private readonly financialCronService: FinancialCronService,
    private readonly followUpAutomationService: FollowUpAutomationService,
    private readonly automationService: AutomationService,
    private readonly prisma: PrismaService,
    private readonly lessonGenerator: LessonGeneratorService,
  ) {
    super();
    const redisOptions = redisQueueConnection();
    const connection = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
      : new Redis({
          host: redisOptions.host || 'localhost',
          port: redisOptions.port || 6379,
          ...(redisOptions.password ? { password: redisOptions.password } : {}),
          ...(redisOptions.tls ? { tls: redisOptions.tls } : {}),
          maxRetriesPerRequest: null,
        });
    // An ioredis client with no 'error' listener reports connection failures as
    // "[ioredis] Unhandled error event" and can take the process down. The lock
    // client is only used for mutual exclusion; a Redis hiccup must degrade to
    // "job skipped" (the processor already treats a missing lock that way), not
    // crash the API. Same rationale as the OAuth session store (auth/oauth-session.ts).
    let lastLockErrorLogAt = 0;
    connection.on('error', (err: NodeJS.ErrnoException | AggregateError) => {
      // ioredis retries continuously, so a down server produces a continuous
      // stream of errors. Log at most once per 30s to keep the boot log usable.
      const now = Date.now();
      if (now - lastLockErrorLogAt < 30_000) return;
      lastLockErrorLogAt = now;
      const detail =
        (err as NodeJS.ErrnoException).code ?? (err.message || String(err)) ?? 'unknown error';
      this.logger.warn(
        `Redis lock connection unavailable (${detail}) — scheduled jobs will be skipped until Redis recovers.`,
      );
    });
    this.lockService = new DistributedLockService(connection);
  }

  async process(job: Job<Record<string, unknown>, unknown, string>): Promise<unknown> {
    this.logger.log(`Processing job: ${job.name}`);

    switch (job.name) {
      case 'cleanupLogs':
        return this.runWithLock(
          'cron:cleanup-logs',
          () => this.cleanupService.cleanupOldLogs(),
        );
      case 'cleanupSessions':
        return this.runWithLock(
          'cron:cleanup-sessions',
          () => this.authService.cleanupExpiredEntries(),
        );
      case 'markOverdueInvoices':
        return this.runWithLock(
          'cron:mark-overdue-invoices',
          () => this.financialCronService.markOverdueInvoices(),
          { ttlMs: 180_000, timeoutMs: 10_000 },
        );
      case 'remindUpcomingPayments':
        return this.runWithLock(
          'cron:remind-upcoming-payments',
          () => this.financialCronService.remindUpcomingPayments(),
          { ttlMs: 180_000, timeoutMs: 10_000 },
        );
      case 'evaluateFollowUpRules':
        return this.runWithLock(
          'cron:evaluate-follow-up-rules',
          () => this.followUpAutomationService.evaluateAllTenants(),
          { ttlMs: 300_000, timeoutMs: 10_000 },
        );
      case 'evaluateAutomationRules':
        return this.runWithLock(
          'cron:evaluate-automation-rules',
          () => this.automationService.evaluateAllRules(),
          { ttlMs: 300_000, timeoutMs: 10_000 },
        );
      case 'reconcileLessons':
        return this.runWithLock(
          'cron:reconcile-lessons',
          () => this.reconcileLessonsForAllTenants(),
          { ttlMs: 600_000, timeoutMs: 60_000 },
        );
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        return null;
    }
  }

  private async runWithLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    opts: { ttlMs?: number; timeoutMs?: number } = {},
  ): Promise<T | { skipped: true; reason: string }> {
    const lockValue = await this.lockService.acquireLock(lockKey, {
      ttlMs: opts.ttlMs ?? 60_000,
      timeoutMs: opts.timeoutMs ?? 10_000,
    });

    if (!lockValue) {
      this.logger.warn(`Skipped execution — lock contention: ${lockKey}`);
      return { skipped: true, reason: 'LOCK_CONTENDED' };
    }

    try {
      const result = await fn();
      return result;
    } catch (err: unknown) {
      this.logger.error(`Job failed under lock ${lockKey}`, err instanceof Error ? err.stack : String(err));
      throw err;
    } finally {
      await this.lockService.releaseLock(lockKey, lockValue);
    }
  }

  /**
   * Schedule → Lesson reconciliation across every tenant.
   *
   * Materializes Lesson rows for a rolling 14-day window (yesterday … +13)
   * from active Schedule templates, then auto-closes any PLANNED lesson whose
   * end time has already passed. Attendance and payroll depend on these rows
   * existing — without this job a schedule created mid-week silently leaves
   * holes that look like unrecorded attendance.
   */
  private async reconcileLessonsForAllTenants() {
    const orgs = await this.prisma.organization.findMany({
      select: { id: true },
    });
    const from = new Date();
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCDate(from.getUTCDate() - 1);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 14);

    let totalCreated = 0;
    let totalClosed = 0;
    for (const org of orgs) {
      try {
        const result = await this.lessonGenerator.generate(org.id, from, to);
        totalCreated += result.created;
        totalClosed += result.pastPlannedCancelled;
      } catch (err: unknown) {
        this.logger.error(
          `Lesson reconciliation failed for org=${org.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
    this.logger.log(
      `Lesson reconciliation complete: orgs=${orgs.length} created=${totalCreated} autoClosed=${totalClosed}`,
    );
    return { orgs: orgs.length, created: totalCreated, autoClosed: totalClosed };
  }

  onFailed(job: Job | undefined, error: Error) {
    if (!job) return;
    this.logger.error(
      `[BackgroundJobsWorker] job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
  }

  onStalled(jobId: string) {
    this.logger.warn(`[BackgroundJobsWorker] Job ${jobId} has stalled.`);
  }
}

