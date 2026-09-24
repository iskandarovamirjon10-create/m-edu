import { Module } from '@nestjs/common';
import { BackgroundJobsScheduler, BACKGROUND_JOBS_QUEUE } from './background-jobs.scheduler';
import { BackgroundJobsProcessor } from './background-jobs.processor';
import { CleanupService } from './cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { LeadsModule } from '../leads/leads.module';
import { AutomationModule } from '../automation/automation.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { isRedisEnabled } from '../config/redis.config';

// @ts-ignore – @nestjs/bullmq is ESM-only; resolved at runtime via monorepo hoisting
const { BullModule } = require('@nestjs/bullmq');

const redisEnabled = isRedisEnabled();

/**
 * Scheduled background work: retention cleanup, expired-session cleanup,
 * overdue-invoice marking, follow-up rule evaluation, automation rule
 * evaluation and Schedule → Lesson reconciliation.
 *
 * `BackgroundJobsScheduler` only *registers* the repeatable jobs; the single
 * `BackgroundJobsProcessor` (one worker per instance) executes them under a
 * Redis distributed lock so multi-instance deployments never double-run a
 * job. This module must therefore import the modules owning the work:
 * AuthModule (session cleanup), PaymentsModule (overdue invoices), LeadsModule
 * (follow-up rules), AutomationModule (automation rules) and ScheduleModule
 * (LessonGeneratorService for nightly reconciliation).
 *
 * When Redis is disabled (`REDIS_ENABLED=false`, development only) neither the
 * queue nor the worker is registered: CleanupService stays injectable for
 * tests, and no scheduled work is silently claimed to be running.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PaymentsModule,
    LeadsModule,
    AutomationModule,
    ScheduleModule,
    ...(redisEnabled ? [BullModule.registerQueue({ name: BACKGROUND_JOBS_QUEUE })] : []),
  ],
  providers: [
    CleanupService,
    ...(redisEnabled ? [BackgroundJobsScheduler, BackgroundJobsProcessor] : []),
  ],
  exports: [CleanupService],
})
export class CronModule {}
