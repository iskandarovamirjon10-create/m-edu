import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

// @ts-ignore – @nestjs/bullmq is ESM-only; resolved at runtime via monorepo hoisting
const { InjectQueue } = require('@nestjs/bullmq');

export const BACKGROUND_JOBS_QUEUE = 'background-jobs';

/**
 * How long a single job-scheduler registration may take before it is treated
 * as "Redis is not reachable". Without this bound, an unreachable Redis makes
 * ioredis buffer the command and the awaited promise never settles — which
 * would stop the whole HTTP API from starting.
 */
const REGISTRATION_TIMEOUT_MS = 5_000;

interface ScheduledJob {
  /** Deterministic scheduler id — replaces the old per-job `jobId` dedupe. */
  schedulerId: string;
  /** MUST match a `case` in BackgroundJobsProcessor.process(). */
  name: string;
  pattern: string;
  data: Record<string, unknown>;
}

/**
 * Registers the recurring background jobs on the single `background-jobs`
 * queue.
 *
 * All consumption is handled exclusively by `BackgroundJobsProcessor`
 * (cron/background-jobs.processor.ts) — the former duplicate
 * `BackgroundJobsWorker` (a second processor on the same queue that only
 * logged and did nothing) was removed: two workers on one queue caused
 * duplicate executions and confusing empty-handling log noise.
 *
 * Scheduling uses BullMQ's Job Schedulers (`upsertJobScheduler`) because the
 * `repeat` option was removed from `queue.add()` in BullMQ 6 — the previous
 * `{ repeat: { pattern } }` payload was silently ignored by v6, which turned
 * every scheduled maintenance task into a single one-off job at boot. The
 * deterministic scheduler id is what makes this idempotent across restarts
 * and multi-instance deployments (`override: true` updates in place).
 *
 * Registration is best-effort: a Redis outage is logged loudly but must never
 * prevent the API from serving traffic.
 */
@Injectable()
export class BackgroundJobsScheduler implements OnModuleInit {
  private readonly logger = new Logger(BackgroundJobsScheduler.name);

  private static readonly JOBS: ScheduledJob[] = [
    {
      // Nightly maintenance: tenant-scoped log/event cleanup.
      schedulerId: 'daily-cleanup-job',
      name: 'cleanupLogs',
      pattern: '0 0 * * *', // every day at midnight
      data: { action: 'cleanup' },
    },
    {
      schedulerId: 'hourly-cleanup-sessions-job',
      name: 'cleanupSessions',
      pattern: '0 * * * *', // hourly
      data: { action: 'cleanup-sessions' },
    },
    {
      // Hourly financial sweep, offset from session cleanup.
      schedulerId: 'mark-overdue-invoices-job',
      name: 'markOverdueInvoices',
      pattern: '10 * * * *',
      data: { action: 'mark-overdue-invoices' },
    },
    {
      // Remind upcoming payments daily at 10 AM.
      schedulerId: 'remind-upcoming-payments-job',
      name: 'remindUpcomingPayments',
      pattern: '0 10 * * *',
      data: { action: 'remind-upcoming-payments' },
    },
    {
      // Automated follow-up evaluation. Minute-of-hour cadence is
      // timezone-invariant; per-rule due logic is timestamp-based, so no TZ
      // ambiguity is possible.
      schedulerId: 'evaluate-follow-up-rules-job',
      name: 'evaluateFollowUpRules',
      pattern: '*/30 * * * *',
      data: { action: 'evaluate-follow-up-rules' },
    },
    {
      schedulerId: 'evaluate-automation-rules-job',
      name: 'evaluateAutomationRules',
      pattern: '*/15 * * * *',
      data: { action: 'evaluate-automation-rules' },
    },
    {
      // Schedule → Lesson reconciliation: materialize missing Lesson rows
      // for the rolling window and auto-close expired PLANNED lessons so
      // attendance/payroll never see phantom sessions.
      schedulerId: 'reconcile-lessons-job',
      name: 'reconcileLessons',
      pattern: '20 2 * * *', // nightly at 02:20
      data: { action: 'reconcile-lessons' },
    },
  ];

  constructor(@InjectQueue(BACKGROUND_JOBS_QUEUE) private readonly jobsQueue: Queue) {}

  async onModuleInit(): Promise<void> {
    if (process.env.REDIS_ENABLED === 'false') {
      this.logger.warn('Redis is disabled; background job scheduling is skipped');
      return;
    }

    this.logger.log(
      `Registering background jobs (job schedulers, dedup enabled): ${BackgroundJobsScheduler.JOBS.length} job(s)`,
    );

    let registered = 0;
    for (const job of BackgroundJobsScheduler.JOBS) {
      try {
        await this.withTimeout(
          this.jobsQueue.upsertJobScheduler(
            job.schedulerId,
            { pattern: job.pattern, tz: 'Asia/Tashkent' },
            {
              name: job.name,
              data: job.data,
              opts: { removeOnComplete: true, removeOnFail: 10 },
            },
          ),
          REGISTRATION_TIMEOUT_MS,
        );
        registered++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to register background job "${job.schedulerId}" (${job.pattern}): ${message}`,
        );
        // A timeout means Redis itself is unreachable: the remaining jobs would
        // each burn another full timeout, delaying application startup for no
        // benefit. Any other error only affects this one job, so keep going.
        if (message.includes('is Redis reachable?')) {
          this.logger.error(
            'Aborting background job registration: Redis is not reachable. Scheduled maintenance will NOT run.',
          );
          break;
        }
      }
    }

    if (registered === BackgroundJobsScheduler.JOBS.length) {
      this.logger.log(`Background jobs registered: ${registered}/${BackgroundJobsScheduler.JOBS.length}`);
    } else {
      this.logger.error(
        `Only ${registered}/${BackgroundJobsScheduler.JOBS.length} background jobs were registered. ` +
          'Scheduled maintenance will NOT run until Redis is reachable and the process restarts.',
      );
    }
  }

  /**
   * Rejects after `ms` without cancelling the underlying command: if Redis
   * recovers, the registration still completes (the rejection is swallowed).
   */
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    promise.catch(() => undefined); // never surface as an unhandled rejection
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`timed out after ${ms}ms — is Redis reachable?`)),
            ms,
          );
          timer.unref?.();
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

