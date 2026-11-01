import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FollowUpAutomationService } from '../follow-up-automation.service';
import { BackgroundJobsScheduler } from '../../cron/background-jobs.scheduler';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationEventService } from '../../notifications/events/notification-event.service';
import { CommunicationHistoryService } from '../../notifications/communication-history.service';
import { AuditService } from '../../audit/audit.service';

function createMockPrisma() {
  return {
    followUpRule: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    followUp: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    lead: {
      findMany: vi.fn(),
    },
    notificationPreference: {
      findUnique: vi.fn(),
    },
    communicationHistory: {
      update: vi.fn().mockResolvedValue({ id: 'ch-1' }),
    },
  };
}

function createMocks() {
  return {
    prisma: createMockPrisma(),
    notificationEvents: { emit: vi.fn().mockResolvedValue(undefined) },
    communicationHistory: { recordCommunication: vi.fn().mockResolvedValue({ id: 'ch-1' }) },
    audit: { record: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
}

const ACTIVE_NO_ACTIVITY_RULE = {
  id: 'r1',
  organizationId: 'org-1',
  name: 'No Activity 7d',
  triggerType: 'NO_ACTIVITY',
  triggerDays: 7,
  targetStage: null,
  actionType: 'CREATE_FOLLOW_UP',
  channel: 'IN_APP',
  message: null,
  isActive: true,
};

describe('FollowUpAutomationService', () => {
  let mocks: ReturnType<typeof createMocks>;
  let prisma: ReturnType<typeof createMockPrisma>;
  let notificationEvents: { emit: ReturnType<typeof vi.fn> };
  let communicationHistory: { recordCommunication: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  let svc: FollowUpAutomationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = createMocks();
    prisma = mocks.prisma;
    notificationEvents = mocks.notificationEvents;
    communicationHistory = mocks.communicationHistory;
    audit = mocks.audit;
    svc = new FollowUpAutomationService(
      prisma as unknown as PrismaService,
      notificationEvents as unknown as NotificationEventService,
      communicationHistory as unknown as CommunicationHistoryService,
      audit as unknown as AuditService,
    );
  });

  describe('getRules', () => {
    it('returns rules for the organization', async () => {
      const rules = [{ id: 'r1', name: 'Test Rule', organizationId: 'org-1' }];
      prisma.followUpRule.findMany.mockResolvedValue(rules);
      const result = await svc.getRules('org-1');
      expect(result).toEqual(rules);
      expect(prisma.followUpRule.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('createRule', () => {
    it('creates a new rule', async () => {
      const data = { name: 'No Activity', triggerType: 'NO_ACTIVITY', triggerDays: 7, actionType: 'CREATE_FOLLOW_UP' };
      prisma.followUpRule.create.mockResolvedValue({ id: 'r1', ...data, organizationId: 'org-1' });
      const result = await svc.createRule('org-1', data);
      expect(result).toBeDefined();
      expect(prisma.followUpRule.create).toHaveBeenCalled();
    });
  });

  describe('updateRule', () => {
    it('updates an existing rule', async () => {
      prisma.followUpRule.findFirst.mockResolvedValue({ id: 'r1', organizationId: 'org-1' });
      prisma.followUpRule.update.mockResolvedValue({ id: 'r1', name: 'Updated' });
      const result = await svc.updateRule('org-1', 'r1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundException if rule not found', async () => {
      prisma.followUpRule.findFirst.mockResolvedValue(null);
      await expect(svc.updateRule('org-1', 'bad', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteRule', () => {
    it('deletes an existing rule', async () => {
      prisma.followUpRule.findFirst.mockResolvedValue({ id: 'r1', organizationId: 'org-1' });
      prisma.followUpRule.deleteMany.mockResolvedValue({ count: 1 });
      await expect(svc.deleteRule('org-1', 'r1')).resolves.toBeDefined();
    });

    it('throws NotFoundException if rule not found', async () => {
      prisma.followUpRule.findFirst.mockResolvedValue(null);
      await expect(svc.deleteRule('org-1', 'bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOverdueFollowUps', () => {
    it('returns overdue follow-ups', async () => {
      prisma.followUp.findMany.mockResolvedValue([{ id: 'fu-1', isCompleted: false }]);
      const result = await svc.getOverdueFollowUps('org-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('markFollowUpComplete', () => {
    it('marks a follow-up complete', async () => {
      prisma.followUp.findFirst.mockResolvedValue({ id: 'fu-1', organizationId: 'org-1' });
      prisma.followUp.update.mockResolvedValue({ id: 'fu-1', isCompleted: true });
      const result = await svc.markFollowUpComplete('org-1', 'fu-1');
      expect(result.isCompleted).toBe(true);
    });

    it('throws NotFoundException if not found', async () => {
      prisma.followUp.findMany.mockResolvedValue([]);
      await expect(svc.markFollowUpComplete('org-1', 'bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFollowUpStats', () => {
    it('returns stats', async () => {
      prisma.followUp.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2);

      const result = await svc.getFollowUpStats('org-1');
      expect(result).toHaveProperty('today');
      expect(result).toHaveProperty('overdue');
      expect(result).toHaveProperty('upcoming');
      expect(result).toHaveProperty('completedToday');
      expect(result).toHaveProperty('completionRate');
    });
  });

  // ── Automated scheduler scenarios (P2 gap-closure test matrix) ──────────

  describe('automated follow-up evaluation', () => {
    it('1. due rule executes and creates a follow-up + notification + history + audit', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([ACTIVE_NO_ACTIVITY_RULE]);
      prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1', firstName: 'L', ownerId: null }]);
      prisma.followUp.findMany.mockResolvedValue([]);
      prisma.followUp.create.mockResolvedValue({ id: 'fu-1' });
      prisma.notificationPreference.findUnique.mockResolvedValue(null); // default opt-in

      const result = await svc.evaluateRules('org-1');
      expect(result).toEqual({ evaluated: 1, created: 1 });
      expect(prisma.followUp.create).toHaveBeenCalledTimes(1);
      expect(notificationEvents.emit).toHaveBeenCalledTimes(1);
      expect(communicationHistory.recordCommunication).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalled();
    });

    it('2. inactive (not-yet-due) rules never execute — filtered at query level', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([]); // isActive:false excluded by where
      const result = await svc.evaluateRules('org-1');
      expect(result).toEqual({ evaluated: 0, created: 0 });
      expect(prisma.followUpRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
      expect(prisma.followUp.create).not.toHaveBeenCalled();
    });

    it('3. overdue (long-stale) STAGE_STALE rule executes with future scheduledAt', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([
        { ...ACTIVE_NO_ACTIVITY_RULE, triggerType: 'STAGE_STALE', targetStage: 'NEW' },
      ]);
      prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1', firstName: 'L', ownerId: null }]);
      prisma.followUp.findMany.mockResolvedValue([]);
      prisma.followUp.create.mockResolvedValue({ id: 'fu-1' });

      const before = Date.now();
      const result = await svc.evaluateRules('org-1');
      expect(result.created).toBe(1);
      const createArg = prisma.followUp.create.mock.calls[0][0].data;
      expect(createArg.scheduledAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('4. duplicate scheduler run is idempotent (no second follow-up)', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([ACTIVE_NO_ACTIVITY_RULE]);
      prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1', firstName: 'L', ownerId: null }]);
      prisma.followUp.create.mockResolvedValue({ id: 'fu-1' });

      // Run 1: nothing exists → create
      prisma.followUp.findMany.mockResolvedValue([]);
      const run1 = await svc.evaluateRules('org-1');
      expect(run1.created).toBe(1);

      // Run 2 (scheduler repeat/restart): dedup now finds it → skip
      prisma.followUp.findMany.mockResolvedValue([{ leadId: 'lead-1' }]);
      const run2 = await svc.evaluateRules('org-1');
      expect(run2.created).toBe(0);
      expect(prisma.followUp.create).toHaveBeenCalledTimes(1);
      expect(notificationEvents.emit).toHaveBeenCalledTimes(1);
    });

    it('5. tenant isolation: each rule is evaluated against its own organization only', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([
        ACTIVE_NO_ACTIVITY_RULE, // org-1
        { ...ACTIVE_NO_ACTIVITY_RULE, id: 'r2', organizationId: 'org-2' },
      ]);
      prisma.lead.findMany.mockResolvedValue([]);
      prisma.followUp.findMany.mockResolvedValue([]);

      await svc.evaluateRules(undefined); // tenant-wide scheduler pass
      const queriedOrgs = prisma.lead.findMany.mock.calls.map((c: Array<{ where: { organizationId: string } }>) => c[0].where.organizationId);
      expect(queriedOrgs).toContain('org-1');
      expect(queriedOrgs).toContain('org-2');
      // And the per-org entrypoint never touches other tenants:
      prisma.lead.findMany.mockClear();
      prisma.followUpRule.findMany.mockResolvedValue([ACTIVE_NO_ACTIVITY_RULE]);
      await svc.evaluateRules('org-1');
      expect(prisma.lead.findMany.mock.calls[0][0].where.organizationId).toBe('org-1');
    });

    it('6. WON leads are excluded from triggering', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([ACTIVE_NO_ACTIVITY_RULE]);
      prisma.lead.findMany.mockResolvedValue([]);
      await svc.evaluateRules('org-1');
      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ stage: { notIn: ['WON', 'LOST'] } }),
        }),
      );
      // STAGE_STALE targeting WON never triggers at all:
      prisma.followUpRule.findMany.mockResolvedValue([
        { ...ACTIVE_NO_ACTIVITY_RULE, triggerType: 'STAGE_STALE', targetStage: 'WON' },
      ]);
      const result = await svc.evaluateRules('org-1');
      expect(result.created).toBe(0);
      expect(prisma.followUp.create).not.toHaveBeenCalled();
    });

    it('7. LOST leads are excluded from triggering', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([
        { ...ACTIVE_NO_ACTIVITY_RULE, triggerType: 'STAGE_STALE', targetStage: 'LOST' },
      ]);
      const result = await svc.evaluateRules('org-1');
      expect(result.created).toBe(0);
      expect(prisma.lead.findMany).not.toHaveBeenCalled();
    });

    it('8. completed follow-ups do not re-trigger (note-based dedup ignores isCompleted)', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([ACTIVE_NO_ACTIVITY_RULE]);
      prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1', firstName: 'L', ownerId: null }]);
      // A COMPLETED auto follow-up for this rule already exists:
      prisma.followUp.findMany.mockResolvedValue([{ leadId: 'lead-1' }]);
      const result = await svc.evaluateRules('org-1');
      expect(result.created).toBe(0);
      const where = prisma.followUp.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('isCompleted');
      expect(where.note).toBe(`[Auto] ${ACTIVE_NO_ACTIVITY_RULE.name}`);
    });

    it('9. notification preferences respected: opted-out owner gets no notification event', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([ACTIVE_NO_ACTIVITY_RULE]);
      prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1', firstName: 'L', ownerId: 'user-1' }]);
      prisma.followUp.findMany.mockResolvedValue([]);
      prisma.followUp.create.mockResolvedValue({ id: 'fu-1' });
      prisma.notificationPreference.findUnique.mockResolvedValue({ inAppEnabled: false });

      await svc.evaluateRules('org-1');
      expect(notificationEvents.emit).not.toHaveBeenCalled();
      expect(communicationHistory.recordCommunication).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ status: 'SKIPPED', failureReason: expect.stringContaining('preferences') }),
      );
    });

    it('10. CommunicationHistory entry is created for the automated follow-up', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([ACTIVE_NO_ACTIVITY_RULE]);
      prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1', firstName: 'L', ownerId: null }]);
      prisma.followUp.findMany.mockResolvedValue([]);
      prisma.followUp.create.mockResolvedValue({ id: 'fu-1' });

      await svc.evaluateRules('org-1');
      expect(communicationHistory.recordCommunication).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          entityType: 'Lead',
          entityId: 'lead-1',
          channel: 'IN_APP',
          direction: 'OUTBOUND',
          status: 'QUEUED',
          relatedEntityType: 'FollowUp',
          relatedEntityId: 'fu-1',
          metadata: expect.objectContaining({ automated: true, ruleId: 'r1' }),
        }),
      );
    });

    it('11. failed notification delivery does not falsely become SENT', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([ACTIVE_NO_ACTIVITY_RULE]);
      prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1', firstName: 'L', ownerId: null }]);
      prisma.followUp.findMany.mockResolvedValue([]);
      prisma.followUp.create.mockResolvedValue({ id: 'fu-1' });
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.communicationHistory.update.mockResolvedValue({ id: 'ch-1', status: 'FAILED' });
      communicationHistory.recordCommunication.mockResolvedValue({ id: 'ch-1', status: 'QUEUED' });
      notificationEvents.emit.mockRejectedValue(new Error('queue down'));

      // Must not throw and must not leave a SENT-ish state:
      const result = await svc.evaluateRules('org-1');
      expect(result.created).toBe(1);
      // Entry was queued, then explicitly marked FAILED after the delivery
      // failure — never SENT:
      expect(communicationHistory.recordCommunication).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ status: 'QUEUED' }),
      );
      expect(prisma.communicationHistory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ch-1' },
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('12. retry-safe: notification engine retries cannot create duplicate follow-ups', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([ACTIVE_NO_ACTIVITY_RULE]);
      prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1', firstName: 'L', ownerId: null }]);
      prisma.followUp.create.mockResolvedValue({ id: 'fu-1' });

      // Attempt 1 fails after follow-up creation (post-create crash simulation):
      prisma.followUp.findMany.mockResolvedValueOnce([]);
      await svc.evaluateRules('org-1');
      // Attempt 2 (BullMQ retry): dedup finds the created follow-up → no duplicate
      prisma.followUp.findMany.mockResolvedValueOnce([{ leadId: 'lead-1' }]);
      await svc.evaluateRules('org-1');
      expect(prisma.followUp.create).toHaveBeenCalledTimes(1);
    });

    it('13. timezone-safe: due-ness is absolute-timestamp based, not wall-clock based', async () => {
      prisma.followUpRule.findMany.mockResolvedValue([ACTIVE_NO_ACTIVITY_RULE]);
      prisma.lead.findMany.mockResolvedValue([]);
      const before = Date.now();
      await svc.evaluateRules('org-1');
      const where = prisma.lead.findMany.mock.calls[0][0].where;
      const cutoff = where.activities.none.createdAt.gte as Date;
      const expectedCutoff = before - ACTIVE_NO_ACTIVITY_RULE.triggerDays * 24 * 60 * 60 * 1000;
      // Cutoff is pure 24h-window arithmetic on absolute instants — identical
      // in every timezone, DST boundary or not.
      expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(5000);
    });
  });

  describe('scheduler wiring', () => {
    beforeEach(() => { vi.stubEnv('REDIS_ENABLED', 'true'); });
    afterEach(() => { vi.unstubAllEnvs(); });
    function fakeQueue() {
      return { 
        add: vi.fn().mockResolvedValue({}),
        upsertJobScheduler: vi.fn().mockResolvedValue({}) 
      };
    }

    it('14. scheduler startup registers the repeatable follow-up job', async () => {
      const queue = fakeQueue();
      const scheduler = new BackgroundJobsScheduler(queue as unknown as ConstructorParameters<typeof BackgroundJobsScheduler>[0]);
      await scheduler.onModuleInit();
      const followUpCall = queue.upsertJobScheduler.mock.calls.find((c: unknown[]) => c[0] === 'evaluate-follow-up-rules-job') as [string, { pattern: string }, { data: Record<string, unknown> }] | undefined;
      expect(followUpCall).toBeDefined();
      const [schedulerId, repeatOpts, jobOpts] = followUpCall!;
      expect(jobOpts.data).toEqual({ action: 'evaluate-follow-up-rules' });
      expect(repeatOpts.pattern).toBe('*/30 * * * *');
      expect(schedulerId).toBe('evaluate-follow-up-rules-job');
    });

    it('15. scheduler restart does not duplicate the repeatable job (deterministic jobId)', async () => {
      const queue = fakeQueue();
      const schedulerA = new BackgroundJobsScheduler(queue as unknown as ConstructorParameters<typeof BackgroundJobsScheduler>[0]);
      const schedulerB = new BackgroundJobsScheduler(queue as unknown as ConstructorParameters<typeof BackgroundJobsScheduler>[0]); // "restart"
      await schedulerA.onModuleInit();
      await schedulerB.onModuleInit();
      const calls = queue.upsertJobScheduler.mock.calls.filter((c: unknown[]) => c[0] === 'evaluate-follow-up-rules-job');
      expect(calls).toHaveLength(2);
      // Identical repeat configuration
      expect(JSON.stringify(calls[0])).toBe(JSON.stringify(calls[1]));
      expect(calls[0][0]).toBe('evaluate-follow-up-rules-job');
    });
  });
});
