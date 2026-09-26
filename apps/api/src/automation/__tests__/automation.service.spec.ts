import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AutomationService, DisabledActionException } from '../automation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationEventService } from '../../notifications/events/notification-event.service';
import { TelegramService } from '../../telegram/telegram.service';
import { SmsService } from '../../notifications/sms.service';
import { AuditService } from '../../audit/audit.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  automationRule: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  automationExecution: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  attendance: { groupBy: vi.fn() },
  invoice: { findMany: vi.fn() },
  payment: { findMany: vi.fn() },
  lead: { findMany: vi.fn() },
  document: { findMany: vi.fn() },
  notification: { create: vi.fn() },
  user: { findMany: vi.fn() },
  parentStudent: { findFirst: vi.fn() },
  // Tenant binding for TELEGRAM actions: a chat is only addressable while it
  // is linked to the rule's own organization.
  telegramAccount: { findFirst: vi.fn().mockResolvedValue({ id: 'tg-1' }) },
  followUp: { create: vi.fn() },
  $queryRaw: vi.fn(),
};

const mockAudit = { record: vi.fn() };
const mockNotificationEvents = { emit: vi.fn() };
const mockTelegram = { isConfigured: vi.fn().mockReturnValue(false), sendMessage: vi.fn().mockResolvedValue(true) };
const mockSms = { isConfigured: vi.fn().mockReturnValue(false), sendSms: vi.fn().mockResolvedValue(true) };

describe('AutomationService', () => {
  let service: AutomationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationEventService, useValue: mockNotificationEvents },
        { provide: TelegramService, useValue: mockTelegram },
        { provide: SmsService, useValue: mockSms },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<AutomationService>(AutomationService);
    vi.clearAllMocks();
  });

  const orgId = 'org-1';
  const ruleId = 'rule-1';
  const userId = 'user-1';

  const baseRule = {
    id: ruleId,
    organizationId: orgId,
    name: 'Test Rule',
    description: null,
    eventType: 'STUDENT_ABSENT',
    conditions: [{ field: 'daysBack', operator: 'gte', value: 7 }],
    actions: [{ type: 'IN_APP_NOTIFICATION', template: 'Student absent', target: 'MANAGERS' }],
    cooldownMinutes: 60,
    maxTriggersPerDay: 50,
    triggerCountToday: 0,
    lastTriggeredAt: null,
    isActive: true,
    createdBy: userId,
    lastRunAt: null,
    totalRuns: 0,
    successCount: 0,
    failureCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('CRUD Operations', () => {
    it('createRule', async () => {
      mockPrisma.automationRule.create.mockResolvedValue(baseRule);
      const result = await service.createRule(orgId, {
        name: 'Test Rule',
        eventType: 'STUDENT_ABSENT',
        actions: [{ type: 'IN_APP_NOTIFICATION', template: 'test', target: 'MANAGERS' }],
      }, userId);
      expect(result).toEqual(baseRule);
      expect(mockPrisma.automationRule.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ organizationId: orgId, name: 'Test Rule' }) }),
      );
    });

    it('listRules', async () => {
      mockPrisma.automationRule.findMany.mockResolvedValue([baseRule]);
      const result = await service.listRules(orgId);
      expect(result).toHaveLength(1);
      expect(mockPrisma.automationRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: orgId } }),
      );
    });

    it('getRule throws NotFoundException', async () => {
      mockPrisma.automationRule.findFirst.mockResolvedValue(null);
      await expect(service.getRule(orgId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('updateRule', async () => {
      mockPrisma.automationRule.findFirst.mockResolvedValue(baseRule);
      mockPrisma.automationRule.update.mockResolvedValue({ ...baseRule, name: 'Updated' });
      const result = await service.updateRule(orgId, ruleId, { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('deleteRule', async () => {
      mockPrisma.automationRule.findFirst.mockResolvedValue(baseRule);
      mockPrisma.automationRule.deleteMany.mockResolvedValue({ count: 1 });
      await expect(service.deleteRule(orgId, ruleId)).resolves.toBeDefined();
    });

    it('toggleRule', async () => {
      mockPrisma.automationRule.findFirst.mockResolvedValue(baseRule);
      mockPrisma.automationRule.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.toggleRule(orgId, ruleId, false);
      expect(result.isActive).toBe(false);
    });
  });

  describe('Loop Detection', () => {
    it('detects loop when triggerCount exceeds maxTriggersPerDay', async () => {
      const ruleWithHighCount = { ...baseRule, triggerCountToday: 50, maxTriggersPerDay: 50 };
      mockPrisma.automationRule.findFirst.mockResolvedValue(ruleWithHighCount);
      mockPrisma.attendance.groupBy.mockResolvedValue([{ studentId: 's1', _count: { id: 5 } }]);
      mockPrisma.automationExecution.findMany.mockResolvedValue([]);

      const result = await service.evaluateRule(orgId, ruleId);
      expect(result.triggered).toBe(true);
    });
  });

  describe('Cooldown', () => {
    it('skips entity when within cooldown period', async () => {
      const ruleWithRecentTrigger = {
        ...baseRule,
        lastTriggeredAt: new Date(Date.now() - 30000),
        cooldownMinutes: 60,
        triggerCountToday: 0,
      };
      mockPrisma.automationRule.findFirst.mockResolvedValue(ruleWithRecentTrigger);
      mockPrisma.attendance.groupBy.mockResolvedValue([{ studentId: 's1', _count: { id: 5 } }]);
      mockPrisma.automationExecution.findMany.mockResolvedValue([]);
      mockPrisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
      mockPrisma.automationRule.update.mockResolvedValue({});

      const result = await service.evaluateRule(orgId, ruleId);
      expect(result.actionsExecuted).toBe(0);
    });
  });

  describe('Tenant Isolation', () => {
    it('queries are scoped to organizationId', async () => {
      mockPrisma.automationRule.findMany.mockResolvedValue([]);
      await service.listRules(orgId);
      expect(mockPrisma.automationRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: orgId }) }),
      );
    });

    it('createRule sets organizationId', async () => {
      mockPrisma.automationRule.create.mockResolvedValue(baseRule);
      await service.createRule(orgId, {
        name: 'Test',
        eventType: 'MANUAL',
        actions: [{ type: 'AUDIT_LOG' }],
      });
      expect(mockPrisma.automationRule.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ organizationId: orgId }) }),
      );
    });
  });

  describe('JSON conditions handling', () => {
    it('createRule stores provided conditions as JSON', async () => {
      mockPrisma.automationRule.create.mockResolvedValue(baseRule);
      await service.createRule(
        orgId,
        {
          name: 'Test Rule',
          eventType: 'STUDENT_ABSENT',
          conditions: [{ field: 'daysBack', operator: 'gte', value: 7 }],
          actions: [{ type: 'AUDIT_LOG' }],
        },
        userId,
      );
      const arg = mockPrisma.automationRule.create.mock.calls[0][0];
      expect(arg.data.conditions).toEqual([{ field: 'daysBack', operator: 'gte', value: 7 }]);
    });

    it('createRule uses Prisma.JsonNull when conditions are omitted', async () => {
      mockPrisma.automationRule.create.mockResolvedValue(baseRule);
      await service.createRule(orgId, {
        name: 'Test Rule',
        eventType: 'MANUAL',
        actions: [{ type: 'AUDIT_LOG' }],
      });
      const arg = mockPrisma.automationRule.create.mock.calls[0][0];
      expect(arg.data.conditions).toBe(Prisma.JsonNull);
    });
  });

  describe('Payment status', () => {
    it('PAYMENT_RECEIVED matches the canonical PAID status', async () => {
      mockPrisma.automationRule.findFirst.mockResolvedValue({
        ...baseRule,
        eventType: 'PAYMENT_RECEIVED',
      });
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const result = await service.evaluateRule(orgId, ruleId);

      expect(result.triggered).toBe(false);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'PAID' }) }),
      );
    });
  });

  describe('Parent Resolution', () => {
    const parentRule = {
      ...baseRule,
      name: 'Parent Alert',
      actions: [{ type: 'IN_APP_NOTIFICATION', template: 'Alert', target: 'PARENTS' }],
    };
    const studentEntity = { id: 's1', entityType: 'STUDENT', data: { absenceCount: 3 } };

    it('PARENTS target resolves parents via ParentStudent link and emits event instead of in-app Notification', async () => {
      mockPrisma.parentStudent.findFirst.mockResolvedValue({
        parent: { phone: '+998901234567', email: 'parent@example.com' },
      });

      await service.executeActions(parentRule, studentEntity);

      expect(mockPrisma.parentStudent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentId: 's1',
            parent: { organizationId: orgId, isActive: true },
          }),
        }),
      );
      expect(mockNotificationEvents.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          data: expect.objectContaining({
            studentId: 's1',
            parentPhone: '+998901234567',
            parentEmail: 'parent@example.com',
            ruleName: 'Parent Alert',
          }),
        }),
      );
      // Parents are not User rows — no in-app notification can be created.
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('PARENTS target emits nothing when no active parent is linked', async () => {
      mockPrisma.parentStudent.findFirst.mockResolvedValue(null);

      await service.executeActions(parentRule, studentEntity);

      expect(mockNotificationEvents.emit).not.toHaveBeenCalled();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('PARENTS target uses entity.data.studentId for non-STUDENT entities', async () => {
      mockPrisma.parentStudent.findFirst.mockResolvedValue({
        parent: { phone: null, email: 'parent@example.com' },
      });

      await service.executeActions(parentRule, {
        id: 'pay-1',
        entityType: 'PAYMENT',
        data: { studentId: 's2', amount: 100 },
      });

      expect(mockPrisma.parentStudent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ studentId: 's2' }) }),
      );
      expect(mockNotificationEvents.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studentId: 's2', parentEmail: 'parent@example.com' }),
        }),
      );
    });
  });

  describe('TELEGRAM / SMS actions (real delivery, fail-fast)', () => {
    const telegramRule = {
      ...baseRule,
      name: 'Telegram Rule',
      actions: [{ type: 'TELEGRAM', chatId: '12345', message: 'Alert for {{entityId}}' }],
    };
    const smsRule = {
      ...baseRule,
      name: 'SMS Rule',
      actions: [{ type: 'SMS', phone: '+998901234567', message: 'SMS alert' }],
    };
    const entity = { id: 's1', entityType: 'STUDENT', data: { absenceCount: 3 } };

    it('throws DisabledActionException (not silent success) when Telegram is unconfigured', async () => {
      mockTelegram.isConfigured.mockReturnValue(false);

      await expect(service.executeActions(telegramRule, entity)).rejects.toThrow(DisabledActionException);
      expect(mockTelegram.sendMessage).not.toHaveBeenCalled();
    });

    it('throws DisabledActionException (not silent success) when SMS is unconfigured', async () => {
      mockSms.isConfigured.mockReturnValue(false);

      await expect(service.executeActions(smsRule, entity)).rejects.toThrow(DisabledActionException);
      expect(mockSms.sendSms).not.toHaveBeenCalled();
    });

    it('delivers Telegram message through the real service when configured', async () => {
      mockTelegram.isConfigured.mockReturnValue(true);

      await service.executeActions(telegramRule, entity);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith('12345', 'Alert for s1');
    });

    it('delivers SMS through the real service (org-scoped logging) when configured', async () => {
      mockSms.isConfigured.mockReturnValue(true);

      await service.executeActions(smsRule, entity);

      expect(mockSms.sendSms).toHaveBeenCalledWith('+998901234567', 'SMS alert', orgId);
    });

    it('throws when Telegram is configured but delivery fails (no pretend-success)', async () => {
      mockTelegram.isConfigured.mockReturnValue(true);
      mockTelegram.sendMessage.mockResolvedValue(false);

      await expect(service.executeActions(telegramRule, entity)).rejects.toThrow(/delivery failed/i);
    });

    it('binds the Telegram chat to the rule tenant before sending', async () => {
      mockTelegram.isConfigured.mockReturnValue(true);
      mockTelegram.sendMessage.mockResolvedValue(true);
      mockPrisma.telegramAccount.findFirst.mockResolvedValue({ id: 'tg-1' });

      await service.executeActions(telegramRule, entity);

      expect(mockPrisma.telegramAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: orgId, status: 'ACTIVE' }),
        }),
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith('12345', expect.any(String));
    });

    it('refuses to send to a chat that is not linked to this organization', async () => {
      mockTelegram.isConfigured.mockReturnValue(true);
      mockTelegram.sendMessage.mockResolvedValue(true);
      // chatId 12345 belongs to another tenant (or to nobody).
      mockPrisma.telegramAccount.findFirst.mockResolvedValue(null);

      await expect(service.executeActions(telegramRule, entity)).rejects.toThrow(
        /not linked to this organization/,
      );
      expect(mockTelegram.sendMessage).not.toHaveBeenCalled();
    });

    it('throws when no chat id can be resolved', async () => {
      mockTelegram.isConfigured.mockReturnValue(true);

      await expect(
        service.executeActions({ ...telegramRule, actions: [{ type: 'TELEGRAM' }] }, entity),
      ).rejects.toThrow(/no chat id/i);
    });
  });
});
