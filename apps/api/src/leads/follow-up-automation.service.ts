import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { LeadStage, Prisma } from '@prisma/client';
import { NotificationEventService } from '../notifications/events/notification-event.service';
import { CommunicationHistoryService } from '../notifications/communication-history.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class FollowUpAutomationService {
  private readonly logger = new Logger(FollowUpAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEvents: NotificationEventService,
    private readonly communicationHistory: CommunicationHistoryService,
    private readonly audit: AuditService,
  ) {}

  async getRules(organizationId: string) {
    return this.prisma.followUpRule.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRule(organizationId: string, data: {
    name: string;
    triggerType: string;
    triggerDays: number;
    targetStage?: string;
    actionType: string;
    channel?: string;
    message?: string;
  }) {
    return this.prisma.followUpRule.create({
      data: {
        organizationId,
        name: data.name,
        entityType: 'LEAD',
        triggerType: data.triggerType,
        triggerDays: data.triggerDays,
        targetStage: data.targetStage ?? null,
        actionType: data.actionType,
        channel: data.channel ?? null,
        message: data.message ?? null,
        action: { type: data.actionType } as Prisma.InputJsonValue,
      },
    });
  }

  async updateRule(organizationId: string, ruleId: string, data: {
    name?: string;
    triggerType?: string;
    triggerDays?: number;
    targetStage?: string;
    actionType?: string;
    channel?: string;
    message?: string;
    isActive?: boolean;
  }) {
    const rule = await this.prisma.followUpRule.findFirst({
      where: { id: ruleId, organizationId },
    });
    if (!rule) throw new NotFoundException('Rule not found');

    return this.prisma.followUpRule.update({
      where: { id: ruleId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.triggerType !== undefined && { triggerType: data.triggerType }),
        ...(data.triggerDays !== undefined && { triggerDays: data.triggerDays }),
        ...(data.targetStage !== undefined && { targetStage: data.targetStage }),
        ...(data.actionType !== undefined && { actionType: data.actionType }),
        ...(data.channel !== undefined && { channel: data.channel }),
        ...(data.message !== undefined && { message: data.message }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async deleteRule(organizationId: string, ruleId: string) {
    const rule = await this.prisma.followUpRule.findFirst({
      where: { id: ruleId, organizationId },
    });
    if (!rule) throw new NotFoundException('Rule not found');

    await this.prisma.followUpRule.deleteMany({ where: { id: ruleId, organizationId } });
    return rule;
  }

  async evaluateRules(organizationId?: string) {
    const rules = await this.prisma.followUpRule.findMany({
      where: { isActive: true, ...(organizationId && { organizationId }) },
    });

    const now = new Date();
    let created = 0;

    for (const rule of rules) {
      // Per-rule organization scope: every read/write below is bound to the
      // rule's own tenant, so tenant-wide evaluation stays isolated.
      const ruleOrgId = rule.organizationId;
      try {
        const triggeredLeads = await this.getTriggeredLeads(ruleOrgId, rule, now);

        // P2-B: Fix N+1 queries. Batch the alreadyExists check
        const existingFollowUps = await this.prisma.followUp.findMany({
          where: {
            organizationId: ruleOrgId,
            leadId: { in: (triggeredLeads ?? []).map((l) => l.id) },
            note: rule.message ?? `[Auto] ${rule.name}`,
          },
          select: { leadId: true },
        });
        const existingLeadIds = new Set((existingFollowUps ?? []).map((f) => f.leadId));

        const leadsToProcess = (triggeredLeads ?? []).filter(lead => !existingLeadIds.has(lead.id));

        await Promise.all(
          leadsToProcess.map(async (lead) => {
            const scheduledAt = new Date(now.getTime() + (rule.triggerDays ?? 0) * 24 * 60 * 60 * 1000);

            const followUp = await this.prisma.followUp.create({
              data: {
                organizationId: ruleOrgId,
                leadId: lead.id,
                scheduledAt,
                note: rule.message ?? `[Auto] ${rule.name}`,
              },
            });

            created++;
            await this.notifyFollowUpCreated(ruleOrgId, rule, lead, followUp.id);
          })
        );

        await this.prisma.followUpRule.update({
          where: { id: rule.id },
          data: { lastRunAt: now },
        });
      } catch (error) {
        this.logger.error(`Failed to evaluate rule ${rule.id}: ${error.message}`);
      }
    }

    if (organizationId) {
      await this.audit.record({
        organizationId,
        action: 'FOLLOWUP_RULES_EVALUATED',
        resource: 'follow-up-automation',
        changes: { evaluated: { old: null, new: rules.length }, created: { old: null, new: created } },
      }).catch(err => this.logger.warn(`Failed to audit follow-up evaluation: ${err.message}`));
    }

    return { evaluated: rules.length, created };
  }

  /**
   * Scheduler entrypoint: evaluates due rules for EVERY tenant, so automated
   * follow-ups run without any user invoking the API. Per-rule organization
   * scoping keeps every query tenant-isolated.
   */
  async evaluateAllTenants(): Promise<{ evaluated: number; created: number }> {
    return this.evaluateRules(undefined);
  }

  /**
   * Emit the notification event for a newly created follow-up, honouring the
   * owner's notification preferences, and record the QUEUED entry in
   * CommunicationHistory. Delivery outcomes (SENT/FAILED) are written by the
   * notification engine — a preference-opted-out lead never becomes SENT.
   */
  private async notifyFollowUpCreated(
    organizationId: string,
    rule: { id: string; name: string; triggerType?: string | null; channel: string | null; message: string | null },
    lead: { id: string; firstName: string; ownerId: string | null },
    followUpId: string,
  ): Promise<void> {
    let historyId: string | null = null;
    try {
      let inAppAllowed = true; // default preference: opt-in
      if (lead.ownerId) {
        const pref = await this.prisma.notificationPreference.findUnique({
          where: { userId_category: { userId: lead.ownerId, category: 'CRM' } },
        });
        inAppAllowed = pref?.inAppEnabled ?? true;
      }

      // Record the QUEUED entry BEFORE emitting, so delivery attempts are
      // always traceable. The entry is only ever marked SENT by the
      // notification engine upon real delivery.
      const history = await this.communicationHistory.recordCommunication(organizationId, {
        entityType: 'Lead',
        entityId: lead.id,
        channel: rule.channel ?? 'IN_APP',
        direction: 'OUTBOUND',
        subject: rule.name,
        content: rule.message ?? `[Auto] ${rule.name}`,
        status: inAppAllowed ? 'QUEUED' : 'SKIPPED',
        failureReason: inAppAllowed ? undefined : 'Notification preferences disabled for category CRM',
        relatedEntityId: followUpId,
        relatedEntityType: 'FollowUp',
        metadata: { automated: true, ruleId: rule.id, triggerType: rule.triggerType ?? null },
      });
      historyId = history?.id ?? null;

      if (inAppAllowed) {
        await this.notificationEvents.emit({
          organizationId,
          type: 'FOLLOWUP_DUE',
          occurredAt: new Date().toISOString(),
          entityType: 'FollowUp',
          entityId: followUpId,
          data: {
            userId: lead.ownerId ?? undefined,
            leadId: lead.id,
            leadName: `${lead.firstName}`.trim(),
            ruleName: rule.name,
          },
        });
      }
    } catch (error) {
      // Follow-up creation must not fail because of notification side effects.
      this.logger.error(
        `notifyFollowUpCreated failed for followUp=${followUpId} lead=${lead.id}: ${error.message}`,
      );
      // Never leave an ambiguous state: a queued-but-undeliverable entry
      // becomes FAILED, it is never reported as SENT.
      if (historyId) {
        await this.prisma.communicationHistory
          .update({
            where: { id: historyId },
            data: { status: 'FAILED', failureReason: error.message },
          })
          .catch(() => undefined);
      }
    }
  }

  private async getTriggeredLeads(
    organizationId: string,
    rule: { triggerDays: number | null; triggerType: string | null; targetStage?: string | null },
    now: Date,
  ) {
    const days = rule.triggerDays ?? 0;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // WON/LOST leads never receive automated follow-ups, regardless of rule.
    const stageGuard = { stage: { notIn: ['WON', 'LOST'] as LeadStage[] } };

    if (rule.triggerType === 'NO_ACTIVITY') {
      return this.prisma.lead.findMany({
        where: {
          organizationId,
          ...stageGuard,
          activities: { none: { createdAt: { gte: cutoff } } },
        },
      });
    }

    if (rule.triggerType === 'STAGE_STALE' && rule.targetStage) {
      if (rule.targetStage === 'WON' || rule.targetStage === 'LOST') return [];
      return this.prisma.lead.findMany({
        where: {
          organizationId,
          ...stageGuard,
          stage: rule.targetStage as LeadStage,
          updatedAt: { lte: cutoff },
        },
      });
    }

    return [];
  }

  async getOverdueFollowUps(organizationId: string) {
    const now = new Date();
    return this.prisma.followUp.findMany({
      where: {
        organizationId,
        isCompleted: false,
        scheduledAt: { lt: now },
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, phone: true, stage: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async markFollowUpComplete(organizationId: string, followUpId: string) {
    const followUp = await this.prisma.followUp.findFirst({
      where: { id: followUpId, organizationId },
    });
    if (!followUp) throw new NotFoundException('Follow-up not found');

    return this.prisma.followUp.update({
      where: { id: followUpId },
      data: { isCompleted: true },
    });
  }

  async getFollowUpStats(organizationId: string) {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const [today, overdue, upcoming, completedToday] = await Promise.all([
      this.prisma.followUp.count({
        where: {
          organizationId,
          isCompleted: false,
          scheduledAt: { gte: startOfToday, lte: endOfToday },
        },
      }),
      this.prisma.followUp.count({
        where: {
          organizationId,
          isCompleted: false,
          scheduledAt: { lt: startOfToday },
        },
      }),
      this.prisma.followUp.count({
        where: {
          organizationId,
          isCompleted: false,
          scheduledAt: { gt: endOfToday },
        },
      }),
      this.prisma.followUp.count({
        where: {
          organizationId,
          isCompleted: true,
          createdAt: { gte: startOfToday, lte: endOfToday },
        },
      }),
    ]);

    const total = today + overdue + upcoming + completedToday;
    const completionRate = total > 0 ? Math.round((completedToday / total) * 100) : 0;

    return { today, overdue, upcoming, completedToday, completionRate };
  }
}
