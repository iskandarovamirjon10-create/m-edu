import { Injectable, NotFoundException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationEventService } from '../notifications/events/notification-event.service';
import { TelegramService } from '../notifications/telegram.service';
import { SmsService } from '../notifications/sms.service';
import { AuditService } from '../audit/audit.service';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto } from './dto/automation.dto';

/**
 * Thrown when an automation action targets a channel (TELEGRAM/SMS) whose
 * delivery provider is not configured in this deployment. Failing fast with
 * an explicit error (recorded on the AutomationExecution) replaces the old
 * misleading "log-only, pretend-success" stubs.
 */
export class DisabledActionException extends Error {
  constructor(actionType: string) {
    super(`Automation action "${actionType}" is disabled: the delivery provider for this channel is not configured.`);
    this.name = 'DisabledActionException';
  }
}

/** One structured condition stored in AutomationRule.conditions (Json). */
export interface AutomationCondition {
  field: string;
  operator?: string;
  value: unknown;
}

/** One action stored in AutomationRule.actions (Json). */
export interface AutomationAction {
  type: 'IN_APP_NOTIFICATION' | 'TELEGRAM' | 'SMS' | 'AUDIT_LOG' | 'CRM_TASK';
  template?: string;
  message?: string;
  target?: string;
  channel?: string;
  chatId?: string;
  phone?: string;
}

/** The entity an automation rule matched and wants to act upon. */
export interface AutomationEntity {
  id: string;
  entityType: 'STUDENT' | 'INVOICE' | 'PAYMENT' | 'LEAD' | 'DOCUMENT';
  data: {
    absenceCount?: number;
    lateCount?: number;
    invoiceNumber?: string;
    total?: number;
    dueDate?: Date;
    amount?: number;
    studentId?: string;
    firstName?: string;
    stage?: string;
    title?: string;
    expiresAt?: Date;
    telegramChatId?: string;
    phone?: string;
    parentPhone?: string;
  } & Record<string, unknown>;
}

/** Minimal structural view of an AutomationRule row used by the engine. */
interface AutomationRuleRow {
  id: string;
  organizationId: string;
  name: string;
  eventType: string | null;
  isActive: boolean;
  conditions: Prisma.JsonValue | null;
  actions: Prisma.JsonValue;
  cooldownMinutes: number;
  maxTriggersPerDay: number;
  triggerCountToday: number;
  lastTriggeredAt: Date | null;
}

/** Minimal structural view of an ActionDto at runtime. */
interface ActionRow {
  type: string;
  template?: string;
  message?: string;
  target?: string;
  channel?: string;
  chatId?: string;
  phone?: string;
}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEvents: NotificationEventService,
    private readonly telegram: TelegramService,
    private readonly sms: SmsService,
    private readonly audit: AuditService,
  ) {}

  async createRule(organizationId: string, dto: CreateAutomationRuleDto, userId?: string) {
    return this.prisma.automationRule.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description ?? null,
        trigger: dto.eventType ?? 'MANUAL',
        entityType: dto.eventType ?? 'CUSTOM',
        eventType: dto.eventType,
        conditions: dto.conditions
          ? (JSON.parse(JSON.stringify(dto.conditions)) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        actions: JSON.parse(JSON.stringify(dto.actions)) as Prisma.InputJsonValue,
        cooldownMinutes: dto.cooldownMinutes ?? 60,
        maxTriggersPerDay: dto.maxTriggersPerDay ?? 50,
        createdBy: userId ?? null,
      },
    });
  }

  async listRules(organizationId: string) {
    return this.prisma.automationRule.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRule(organizationId: string, ruleId: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id: ruleId, organizationId },
    });
    if (!rule) throw new NotFoundException('Automation rule not found');
    return rule;
  }

  async updateRule(organizationId: string, ruleId: string, dto: UpdateAutomationRuleDto) {
    await this.getRule(organizationId, ruleId);
    return this.prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.eventType !== undefined && { eventType: dto.eventType }),
        ...(dto.conditions !== undefined && {
          conditions: dto.conditions
            ? (JSON.parse(JSON.stringify(dto.conditions)) as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        }),
        ...(dto.actions !== undefined && { actions: JSON.parse(JSON.stringify(dto.actions)) as Prisma.InputJsonValue }),
        ...(dto.cooldownMinutes !== undefined && { cooldownMinutes: dto.cooldownMinutes }),
        ...(dto.maxTriggersPerDay !== undefined && { maxTriggersPerDay: dto.maxTriggersPerDay }),
      },
    });
  }

  async deleteRule(organizationId: string, ruleId: string) {
    await this.getRule(organizationId, ruleId);
    await this.prisma.automationRule.deleteMany({ where: { id: ruleId, organizationId } });
    return { id: ruleId, deleted: true };
  }

  async toggleRule(organizationId: string, ruleId: string, isActive: boolean) {
    const rule = await this.getRule(organizationId, ruleId);
    await this.prisma.automationRule.updateMany({
      where: { id: ruleId, organizationId },
      data: { isActive },
    });
    return { ...rule, isActive };
  }

  async evaluateRule(organizationId: string, ruleId: string) {
    const rule = await this.getRule(organizationId, ruleId);
    if (!rule.isActive) return { triggered: false, reason: 'Rule is inactive' };
    return this.evaluateSingleRule(rule);
  }

  async evaluateAllRules(organizationId?: string) {
    const where: Prisma.AutomationRuleWhereInput = { isActive: true };
    if (organizationId) where.organizationId = organizationId;

    let totalTriggered = 0;
    let totalExecuted = 0;
    let totalEvaluated = 0;
    let cursor: string | undefined;

    // Sweep all active rules in batches, ordered by lastRunAt (fairness)
    // so every rule gets a chance even when the table grows large.
    do {
      const rules = await this.prisma.automationRule.findMany({
        where,
        take: 100,
        orderBy: { lastRunAt: { sort: 'asc', nulls: 'first' } },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (rules.length === 0) break;
      cursor = rules[rules.length - 1].id;
      totalEvaluated += rules.length;

      for (const rule of rules) {
        try {
          await this.resetDailyCountIfNeeded(rule);
          const result = await this.evaluateSingleRule(rule);
          if (result.triggered) totalTriggered++;
          totalExecuted += result.actionsExecuted ?? 0;
        } catch (error) {
          this.logger.error(`Failed to evaluate rule ${rule.id}: ${(error as Error).message}`);
        }
      }
    } while (cursor);

    return { evaluated: totalEvaluated, triggered: totalTriggered, actionsExecuted: totalExecuted };
  }

  private async evaluateSingleRule(rule: AutomationRuleRow) {
    const entities = await this.getMatchingEntities(rule);
    if (entities.length === 0) return { triggered: false, actionsExecuted: 0 };

    // Batch rate-limit check: find all recent executions for these entities in one query
    const entityIds = entities.map(e => e.id);
    const cooldownMs = rule.cooldownMinutes * 60000;
    const cooldownCutoff = new Date(Date.now() - cooldownMs);

    const recentExecutions = await this.prisma.automationExecution.findMany({
      where: {
        ruleId: rule.id,
        entityId: { in: entityIds },
        triggeredAt: { gte: cooldownCutoff },
        status: { notIn: ['FAILED', 'LOOP_DETECTED'] },
      },
      select: { entityId: true },
    });
    const rateLimitedIds = new Set(recentExecutions.map(e => e.entityId));

    // Filter out rate-limited entities
    const eligibleEntities = entities.filter(e => !rateLimitedIds.has(e.id));
    let actionsExecuted = 0;

    // Check daily trigger limit
    if (rule.triggerCountToday >= rule.maxTriggersPerDay) {
      return { triggered: entities.length > 0, actionsExecuted: 0 };
    }

    const remainingQuota = rule.maxTriggersPerDay - rule.triggerCountToday;
    const batch = eligibleEntities.slice(0, remainingQuota);

    for (const entity of batch) {
      if (await this.isLoopDetected(rule)) {
        await this.createExecution(rule, null, null, 'LOOP_DETECTED');
        break;
      }

      const execution = await this.createExecution(rule, entity.entityType, entity.id, 'EXECUTING');
      try {
        await this.executeActions(rule, entity, execution.id);
        await this.updateExecution(execution.id, 'SUCCESS');
        actionsExecuted++;
      } catch (error) {
        await this.updateExecution(execution.id, 'FAILED', (error as Error).message);
        await this.prisma.automationRule.update({
          where: { id: rule.id },
          data: { failureCount: { increment: 1 } },
        });
      }
    }

    if (actionsExecuted > 0) {
      await this.prisma.automationRule.update({
        where: { id: rule.id },
        data: {
          lastRunAt: new Date(),
          totalRuns: { increment: 1 },
          triggerCountToday: { increment: actionsExecuted },
        },
      });
    }

    return { triggered: entities.length > 0, actionsExecuted };
  }

  private async getMatchingEntities(rule: AutomationRuleRow): Promise<AutomationEntity[]> {
    const orgId = rule.organizationId;
    const conditions = this.parseConditions(rule.conditions);

    switch (rule.eventType) {
      case 'STUDENT_ABSENT':
        return this.findAbsentStudents(orgId, conditions);
      case 'REPEATED_LATENESS':
        return this.findRepeatedLateness(orgId, conditions);
      case 'INVOICE_OVERDUE':
        return this.findOverdueInvoices(orgId, conditions);
      case 'PAYMENT_RECEIVED':
        return this.findRecentPayments(orgId, conditions);
      case 'LEAD_INACTIVE':
        return this.findInactiveLeads(orgId, conditions);
      case 'DOCUMENT_EXPIRED':
        return this.findExpiredDocuments(orgId, conditions);
      case 'MANUAL':
        return [];
      default:
        return [];
    }
  }

  private parseConditions(value: Prisma.JsonValue | null): AutomationCondition[] {
    if (!Array.isArray(value)) return [];
    const candidates = value as unknown[];
    return candidates.filter(
      (c): c is AutomationCondition =>
        typeof c === 'object' && c !== null && typeof (c as { field?: unknown }).field === 'string',
    );
  }

  private parseActions(value: Prisma.JsonValue): AutomationAction[] {
    if (!Array.isArray(value)) return [];
    const candidates = value as unknown[];
    return candidates.filter(
      (a): a is AutomationAction =>
        typeof a === 'object' && a !== null && typeof (a as { type?: unknown }).type === 'string',
    );
  }

  private async findAbsentStudents(orgId: string, conditions: AutomationCondition[]) {
    const daysBack = this.getConditionValue(conditions, 'daysBack', 1);
    const minAbsences = this.getConditionValue(conditions, 'minAbsences', 3);
    const cutoff = new Date(Date.now() - daysBack * 86400000);

    const absences = await this.prisma.attendance.groupBy({
      by: ['studentId'],
      where: {
        organizationId: orgId,
        status: 'ABSENT',
        date: { gte: cutoff },
      },
      _count: { id: true },
      having: { id: { _count: { gte: minAbsences } } },
    });

    return absences.map((a): AutomationEntity => ({ id: a.studentId, entityType: 'STUDENT', data: { absenceCount: a._count.id } }));
  }

  private async findRepeatedLateness(orgId: string, conditions: AutomationCondition[]) {
    const daysBack = this.getConditionValue(conditions, 'daysBack', 7);
    const minLate = this.getConditionValue(conditions, 'minLate', 3);
    const cutoff = new Date(Date.now() - daysBack * 86400000);

    const lates = await this.prisma.attendance.groupBy({
      by: ['studentId'],
      where: {
        organizationId: orgId,
        status: 'LATE',
        date: { gte: cutoff },
      },
      _count: { id: true },
      having: { id: { _count: { gte: minLate } } },
    });

    return lates.map((l): AutomationEntity => ({ id: l.studentId, entityType: 'STUDENT', data: { lateCount: l._count.id } }));
  }

  /**
   * Explicit allow-list of Invoice columns the automation engine consumes.
   * Replaces the previous `SELECT *` which pulled sensitive financial detail
   * (student balance links, penalty history, notes) into automation payloads
   * that get interpolated into messages and logs.
   */
  private static readonly OVERDUE_INVOICE_COLUMNS = `
    "id", "organizationId", "studentId", "number", "status",
    "total", "paidAmount", "dueDate"
  ` as const;

  private async findOverdueInvoices(orgId: string, _conditions: AutomationCondition[]) {
    const invoices = await this.prisma.$queryRaw<
      Array<{
        id: string;
        organizationId: string;
        studentId: string;
        number: string;
        status: string;
        total: Prisma.Decimal;
        paidAmount: Prisma.Decimal;
        dueDate: Date;
      }>
    >`
      SELECT ${Prisma.raw(AutomationService.OVERDUE_INVOICE_COLUMNS)} FROM "Invoice"
      WHERE "organizationId" = ${orgId}::uuid
        AND "status" IN ('ISSUED', 'OVERDUE')
        AND "dueDate" < NOW()
        AND "paidAmount" < "total"
    `;

    return invoices.map((inv): AutomationEntity => ({
      id: inv.id,
      entityType: 'INVOICE',
      data: {
        invoiceNumber: inv.number,
        total: Number(inv.total),
        dueDate: inv.dueDate,
      },
    }));
  }

  private async findRecentPayments(orgId: string, conditions: AutomationCondition[]) {
    const daysBack = this.getConditionValue(conditions, 'daysBack', 1);
    const cutoff = new Date(Date.now() - daysBack * 86400000);

    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: orgId,
        status: 'PAID' satisfies PaymentStatus,
        createdAt: { gte: cutoff },
      },
    });

    return payments.map((p): AutomationEntity => ({ id: p.id, entityType: 'PAYMENT', data: { amount: Number(p.amount), studentId: p.studentId } }));
  }

  private async findInactiveLeads(orgId: string, conditions: AutomationCondition[]) {
    const daysBack = this.getConditionValue(conditions, 'daysBack', 14);
    const cutoff = new Date(Date.now() - daysBack * 86400000);

    const leads = await this.prisma.lead.findMany({
      where: {
        organizationId: orgId,
        stage: { notIn: ['WON', 'LOST'] },
        updatedAt: { lt: cutoff },
      },
    });

    return leads.map((l): AutomationEntity => ({ id: l.id, entityType: 'LEAD', data: { firstName: l.firstName, stage: l.stage } }));
  }

  private async findExpiredDocuments(orgId: string, _conditions: AutomationCondition[]) {
    const documents = await this.prisma.document.findMany({
      where: {
        organizationId: orgId,
        expiresAt: { lt: new Date() },
      },
    });

    return documents.map((d): AutomationEntity => ({ id: d.id, entityType: 'DOCUMENT', data: { title: d.title, expiresAt: d.expiresAt ?? undefined } }));
  }

  private async isRateLimited(rule: AutomationRuleRow, entityId: string): Promise<boolean> {
    if (!rule.lastTriggeredAt) return false;
    const cooldownMs = rule.cooldownMinutes * 60000;
    const timeSinceLastTrigger = Date.now() - new Date(rule.lastTriggeredAt).getTime();
    if (timeSinceLastTrigger < cooldownMs) return true;

    const recentExecution = await this.prisma.automationExecution.findFirst({
      where: {
        ruleId: rule.id,
        entityId,
        triggeredAt: { gte: new Date(Date.now() - cooldownMs) },
        status: { notIn: ['FAILED', 'LOOP_DETECTED'] },
      },
    });
    return !!recentExecution;
  }

  private async isLoopDetected(rule: AutomationRuleRow): Promise<boolean> {
    return rule.triggerCountToday >= rule.maxTriggersPerDay;
  }

  private async resetDailyCountIfNeeded(rule: AutomationRuleRow) {
    const now = new Date();
    const lastTriggered = rule.lastTriggeredAt;
    if (!lastTriggered || lastTriggered.toDateString() !== now.toDateString()) {
      await this.prisma.automationRule.update({
        where: { id: rule.id },
        data: { triggerCountToday: 0 },
      });
      rule.triggerCountToday = 0;
    }
  }

  private async incrementTriggerCount(rule: AutomationRuleRow) {
    await this.prisma.automationRule.update({
      where: { id: rule.id },
      data: {
        triggerCountToday: { increment: 1 },
        lastTriggeredAt: new Date(),
        successCount: { increment: 1 },
      },
    });
  }

  async executeActions(rule: AutomationRuleRow, entityContext: AutomationEntity, _executionId?: string) {
    const actions: ActionRow[] = this.parseActions(rule.actions);

    for (const action of actions) {
      switch (action.type) {
        case 'IN_APP_NOTIFICATION':
          await this.executeInAppNotification(rule, entityContext, action);
          break;
        case 'TELEGRAM':
          await this.executeTelegram(rule, entityContext, action);
          break;
        case 'SMS':
          await this.executeSms(rule, entityContext, action);
          break;
        case 'AUDIT_LOG':
          await this.executeAuditLog(rule, entityContext, action);
          break;
        case 'CRM_TASK':
          await this.executeCrmTask(rule, entityContext, action);
          break;
      }
    }
  }

  private async executeInAppNotification(rule: AutomationRuleRow, entity: AutomationEntity, action: ActionRow) {
    const title = this.interpolate(action.template ?? rule.name, entity);
    const message = this.interpolate(action.message ?? `Automation: ${rule.name}`, entity);

    const targetUsers = await this.resolveTargetUsers(rule.organizationId, action.target, entity, rule.name);

    if (targetUsers.length === 0) return;

    // Single batched insert instead of one round-trip per recipient.
    await this.prisma.notification.createMany({
      data: targetUsers.map(userId => ({
        organizationId: rule.organizationId,
        userId,
        title,
        message,
        type: 'automation',
      })),
    });
  }

  private async executeTelegram(rule: AutomationRuleRow, entity: AutomationEntity, action: ActionRow) {
    if (!this.telegram.isConfigured()) {
      throw new DisabledActionException('TELEGRAM');
    }

    const chatId = action.chatId ?? (entity.data?.telegramChatId as string | undefined);
    if (!chatId) {
      throw new ServiceUnavailableException(
        `TELEGRAM action for rule ${rule.id}: no chat id resolved for entity ${entity.entityType}/${entity.id}`,
      );
    }

    const message = this.interpolate(action.message ?? `Automation: ${rule.name}`, entity);
    const ok = await this.telegram.sendMessage(chatId, message);
    if (!ok) {
      throw new ServiceUnavailableException(`Telegram delivery failed for rule ${rule.id}, entity ${entity.id}`);
    }
  }

  private async executeSms(rule: AutomationRuleRow, entity: AutomationEntity, action: ActionRow) {
    if (!this.sms.isConfigured()) {
      throw new DisabledActionException('SMS');
    }

    const phone = action.phone ?? (entity.data?.phone as string | undefined) ?? (entity.data?.parentPhone as string | undefined);
    if (!phone) {
      throw new ServiceUnavailableException(
        `SMS action for rule ${rule.id}: no phone number resolved for entity ${entity.entityType}/${entity.id}`,
      );
    }

    const message = this.interpolate(action.message ?? `Automation: ${rule.name}`, entity);
    const ok = await this.sms.sendSms(phone, message, rule.organizationId);
    if (!ok) {
      throw new ServiceUnavailableException(`SMS delivery failed for rule ${rule.id}, entity ${entity.id}`);
    }
  }

  private async executeAuditLog(rule: AutomationRuleRow, entity: AutomationEntity, _action: ActionRow) {
    await this.audit.record({
      organizationId: rule.organizationId,
      action: 'AUTOMATION_TRIGGERED',
      resource: rule.eventType ?? 'AUTOMATION',
      resourceId: entity.id,
      changes: {
        ruleId: { old: null, new: rule.id },
        ruleName: { old: null, new: rule.name },
        entityType: { old: null, new: entity.entityType },
      },
    });
  }

  private async executeCrmTask(rule: AutomationRuleRow, entity: AutomationEntity, action: ActionRow) {
    if (entity.entityType === 'LEAD') {
      await this.prisma.followUp.create({
        data: {
          organizationId: rule.organizationId,
          leadId: entity.id,
          scheduledAt: new Date(),
          note: this.interpolate(action.message ?? `[Auto] ${rule.name}`, entity),
        },
      });
    }
  }

  private async resolveTargetUsers(
    organizationId: string,
    target: string | undefined,
    entity: AutomationEntity,
    ruleName?: string,
  ): Promise<string[]> {
    if (!target || target === 'ALL') {
      const users = await this.prisma.user.findMany({
        where: { organizationId, isActive: true },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    if (target === 'ADMINS') {
      const users = await this.prisma.user.findMany({
        where: { organizationId, isActive: true, role: { in: ['SUPER_ADMIN', 'ORG_ADMIN'] } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    if (target === 'MANAGERS') {
      const users = await this.prisma.user.findMany({
        where: { organizationId, isActive: true, role: 'MANAGER' },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    // ParentAccount is a standalone auth identity (own passwordHash) — parents
    // are NOT User rows and cannot receive in-app notifications (Notification
    // requires a User FK). Parent delivery goes through the notification event
    // pipeline, which resolves parents via the ParentStudent link and delivers
    // via Telegram with SMS fallback (see notification-event.processor.ts).
    // The pipeline handles queueing and all channel fallback internally.
    const studentId = entity.entityType === 'STUDENT' ? entity.id : entity.data?.studentId;
    if (target === 'PARENTS' && studentId) {
      const parent = await this.prisma.parentStudent.findFirst({
        where: {
          studentId,
          parent: { organizationId, isActive: true },
        },
        select: { parent: { select: { phone: true, email: true } } },
      });
      if (!parent) return [];
      // Delivery is fully handled by the event pipeline (Telegram → SMS with
      // the resolved parent contact); no user IDs can be returned for parents.
      await this.notificationEvents.emit({
        organizationId,
        type: 'FOLLOWUP_DUE',
        occurredAt: new Date().toISOString(),
        entityType: entity.entityType,
        entityId: entity.id,
        data: {
          studentId,
          parentPhone: parent.parent.phone ?? undefined,
          parentEmail: parent.parent.email ?? undefined,
          ruleName,
        },
      });
      return [];
    }
    return [];
  }

  private interpolate(template: string, entity: AutomationEntity): string {
    return template
      .replace(/\{\{entityType\}\}/g, entity.entityType ?? '')
      .replace(/\{\{entityId\}\}/g, entity.id ?? '')
      .replace(/\{\{entityName\}\}/g, entity.data?.firstName ?? entity.data?.title ?? entity.data?.invoiceNumber ?? entity.id ?? '')
      .replace(/\{\{count\}\}/g, String(entity.data?.absenceCount ?? entity.data?.lateCount ?? ''));
  }

  private getConditionValue<T>(conditions: AutomationCondition[], field: string, defaultValue: T): T {
    const cond = conditions.find((c) => c.field === field);
    return (cond?.value as T | undefined) ?? defaultValue;
  }

  private async createExecution(rule: AutomationRuleRow, entityType: string | null, entityId: string | null, status: string) {
    return this.prisma.automationExecution.create({
      data: {
        organizationId: rule.organizationId,
        ruleId: rule.id,
        entityType,
        entityId,
        status,
        triggeredAt: new Date(),
      },
    });
  }

  private async updateExecution(executionId: string, status: string, error?: string) {
    return this.prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        status,
        completedAt: new Date(),
        ...(error && { error }),
      },
    });
  }

  async getExecutions(organizationId: string, ruleId?: string, limit = 50) {
    return this.prisma.automationExecution.findMany({
      where: {
        organizationId,
        ...(ruleId && { ruleId }),
      },
      include: { rule: { select: { id: true, name: true, eventType: true } } },
      orderBy: { triggeredAt: 'desc' },
      take: limit,
    });
  }

  async getRuleStats(organizationId: string, ruleId: string) {
    const rule = await this.getRule(organizationId, ruleId);

    const [totalExecutions, successCount, failureCount, recentExecutions] = await Promise.all([
      this.prisma.automationExecution.count({ where: { ruleId } }),
      this.prisma.automationExecution.count({ where: { ruleId, status: 'SUCCESS' } }),
      this.prisma.automationExecution.count({ where: { ruleId, status: 'FAILED' } }),
      this.prisma.automationExecution.findMany({
        where: { ruleId },
        orderBy: { triggeredAt: 'desc' },
        take: 10,
        select: { id: true, status: true, triggeredAt: true, completedAt: true, entityType: true, entityId: true, error: true },
      }),
    ]);

    return {
      rule: { id: rule.id, name: rule.name, eventType: rule.eventType, isActive: rule.isActive, totalRuns: rule.totalRuns },
      totalExecutions,
      successCount,
      failureCount,
      successRate: totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 0,
      recentExecutions,
    };
  }

  async getOverallStats(organizationId: string) {
    const [totalRules, activeRules, totalExecutions, successfulExecutions, failedExecutions, loopDetected] = await Promise.all([
      this.prisma.automationRule.count({ where: { organizationId } }),
      this.prisma.automationRule.count({ where: { organizationId, isActive: true } }),
      this.prisma.automationExecution.count({ where: { organizationId } }),
      this.prisma.automationExecution.count({ where: { organizationId, status: 'SUCCESS' } }),
      this.prisma.automationExecution.count({ where: { organizationId, status: 'FAILED' } }),
      this.prisma.automationExecution.count({ where: { organizationId, status: 'LOOP_DETECTED' } }),
    ]);

    const topRules = await this.prisma.automationRule.findMany({
      where: { organizationId },
      orderBy: { totalRuns: 'desc' },
      take: 5,
      select: { id: true, name: true, eventType: true, totalRuns: true, successCount: true, failureCount: true },
    });

    return {
      totalRules,
      activeRules,
      totalExecutions,
      successRate: totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0,
      failedExecutions,
      loopDetected,
      topRules,
    };
  }
}
