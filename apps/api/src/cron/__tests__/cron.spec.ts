import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CleanupService } from '../cleanup.service';
import { BackgroundJobsScheduler } from '../background-jobs.scheduler';
import { BackgroundJobsProcessor } from '../background-jobs.processor';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { FinancialCronService } from '../../payments/financial-cron.service';
import { FollowUpAutomationService } from '../../leads/follow-up-automation.service';
import { AutomationService } from '../../automation/automation.service';
import { LessonGeneratorService } from '../../schedule/lesson-generator.service';
import { Queue } from 'bullmq';

vi.mock('ioredis', () => {
  return {
    default: class {
      on = vi.fn();
      set = vi.fn().mockResolvedValue('OK');
      eval = vi.fn().mockResolvedValue(1);
    },
  };
});

describe('Cron Module Suite', () => {
  describe('CleanupService', () => {
    let service: CleanupService;
    let prisma: {
      organization: { findMany: ReturnType<typeof vi.fn> };
      recognitionAttempt: { deleteMany: ReturnType<typeof vi.fn> };
      cameraAttendanceEvent: { deleteMany: ReturnType<typeof vi.fn> };
      auditLog: { deleteMany: ReturnType<typeof vi.fn> };
    };

    beforeEach(() => {
      prisma = {
        organization: {
          findMany: vi.fn().mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]),
        },
        recognitionAttempt: {
          deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
        },
        cameraAttendanceEvent: {
          deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
        },
        auditLog: {
          deleteMany: vi.fn().mockResolvedValue({ count: 20 }),
        },
        faceTemplate: {
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
        notificationDelivery: {
          deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
        },
      };

      service = new CleanupService(prisma as unknown as PrismaService);
    });

    it('cleans up old records scoped strictly per organization', async () => {
      await service.cleanupOldLogs();

      expect(prisma.organization.findMany).toHaveBeenCalled();
      expect(prisma.recognitionAttempt.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        }),
      );
      expect(prisma.cameraAttendanceEvent.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        }),
      );
      expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        }),
      );

      // Verify called for second org as well
      expect(prisma.recognitionAttempt.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-2' }),
        }),
      );
    });

    it('continues to next organization if one organization cleanup throws', async () => {
      prisma.recognitionAttempt.deleteMany
        .mockRejectedValueOnce(new Error('DB glitch'))
        .mockResolvedValue({ count: 5 });

      await expect(service.cleanupOldLogs()).resolves.not.toThrow();
      expect(prisma.recognitionAttempt.deleteMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('BackgroundJobsScheduler', () => {
    let scheduler: BackgroundJobsScheduler;
    let mockQueue: {
      upsertJobScheduler: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      delete process.env.REDIS_ENABLED;
      mockQueue = {
        upsertJobScheduler: vi.fn().mockResolvedValue({}),
      };
      scheduler = new BackgroundJobsScheduler(mockQueue as unknown as Queue);
    });

    it('skips scheduling if REDIS_ENABLED=false', async () => {
      process.env.REDIS_ENABLED = 'false';
      await scheduler.onModuleInit();
      expect(mockQueue.upsertJobScheduler).not.toHaveBeenCalled();
    });

    it('registers all 7 background jobs with deduping schedulers', async () => {
      await scheduler.onModuleInit();
      expect(mockQueue.upsertJobScheduler).toHaveBeenCalledTimes(7);
      expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
        'daily-cleanup-job',
        expect.objectContaining({ pattern: '0 0 * * *' }),
        expect.objectContaining({ name: 'cleanupLogs' }),
      );
      expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
        'reconcile-lessons-job',
        expect.objectContaining({ pattern: '20 2 * * *' }),
        expect.objectContaining({ name: 'reconcileLessons' }),
      );
    });
  });

  describe('BackgroundJobsProcessor', () => {
    let processor: BackgroundJobsProcessor;
    let cleanupService: { cleanupOldLogs: ReturnType<typeof vi.fn> };
    let authService: { cleanupExpiredEntries: ReturnType<typeof vi.fn> };
    let financialCronService: {
      markOverdueInvoices: ReturnType<typeof vi.fn>;
      remindUpcomingPayments: ReturnType<typeof vi.fn>;
    };
    let followUpAutomationService: { evaluateAllTenants: ReturnType<typeof vi.fn> };
    let automationService: { evaluateAllRules: ReturnType<typeof vi.fn> };
    let prisma: { organization: { findMany: ReturnType<typeof vi.fn> } };
    let lessonGenerator: { generate: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      cleanupService = { cleanupOldLogs: vi.fn().mockResolvedValue(undefined) };
      authService = { cleanupExpiredEntries: vi.fn().mockResolvedValue(undefined) };
      financialCronService = {
        markOverdueInvoices: vi.fn().mockResolvedValue(undefined),
        remindUpcomingPayments: vi.fn().mockResolvedValue(undefined),
      };
      followUpAutomationService = { evaluateAllTenants: vi.fn().mockResolvedValue(undefined) };
      automationService = { evaluateAllRules: vi.fn().mockResolvedValue(undefined) };
      prisma = {
        organization: { findMany: vi.fn().mockResolvedValue([]) },
      };
      lessonGenerator = {
        generate: vi.fn().mockResolvedValue({ created: 0, pastPlannedCancelled: 0 }),
      };

      processor = new BackgroundJobsProcessor(
        cleanupService as unknown as CleanupService,
        authService as unknown as AuthService,
        financialCronService as unknown as FinancialCronService,
        followUpAutomationService as unknown as FollowUpAutomationService,
        automationService as unknown as AutomationService,
        prisma as unknown as PrismaService,
        lessonGenerator as unknown as LessonGeneratorService,
      );

      // Mock lockService directly to avoid real timer loops in unit tests
      (processor as unknown as { lockService: { acquireLock: ReturnType<typeof vi.fn>; releaseLock: ReturnType<typeof vi.fn> } }).lockService = {
        acquireLock: vi.fn().mockResolvedValue('test-lock-token'),
        releaseLock: vi.fn().mockResolvedValue(undefined),
      };
    });

    it('processes cleanupLogs job', async () => {
      await processor.process({ name: 'cleanupLogs' } as unknown as Parameters<typeof processor.process>[0]);
      expect(cleanupService.cleanupOldLogs).toHaveBeenCalled();
    });

    it('processes cleanupSessions job', async () => {
      await processor.process({ name: 'cleanupSessions' } as unknown as Parameters<typeof processor.process>[0]);
      expect(authService.cleanupExpiredEntries).toHaveBeenCalled();
    });

    it('processes markOverdueInvoices job', async () => {
      await processor.process({ name: 'markOverdueInvoices' } as unknown as Parameters<typeof processor.process>[0]);
      expect(financialCronService.markOverdueInvoices).toHaveBeenCalled();
    });

    it('processes evaluateFollowUpRules job', async () => {
      await processor.process({ name: 'evaluateFollowUpRules' } as unknown as Parameters<typeof processor.process>[0]);
      expect(followUpAutomationService.evaluateAllTenants).toHaveBeenCalled();
    });

    it('processes evaluateAutomationRules job', async () => {
      await processor.process({ name: 'evaluateAutomationRules' } as unknown as Parameters<typeof processor.process>[0]);
      expect(automationService.evaluateAllRules).toHaveBeenCalled();
    });

    it('processes remindUpcomingPayments job', async () => {
      await processor.process({ name: 'remindUpcomingPayments' } as unknown as Parameters<typeof processor.process>[0]);
      expect(financialCronService.remindUpcomingPayments).toHaveBeenCalled();
    });

    it('processes reconcileLessons job', async () => {
      prisma.organization.findMany.mockResolvedValue([{ id: 'org-1' }]);
      await processor.process({ name: 'reconcileLessons' } as unknown as Parameters<typeof processor.process>[0]);
      expect(lessonGenerator.generate).toHaveBeenCalledWith(
        'org-1',
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('handles unknown job gracefully', async () => {
      const res = await processor.process({ name: 'unknownJob' } as unknown as Parameters<typeof processor.process>[0]);
      expect(res).toBeNull();
    });
  });
});
