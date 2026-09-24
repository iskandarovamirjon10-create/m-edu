import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LeadsController } from '../leads.controller';
import { LeadsService } from '../leads.service';
import { FollowUpAutomationService } from '../follow-up-automation.service';

describe('LeadsController', () => {
  let controller: LeadsController;
  let leadsService: LeadsService;
  let followUpService: FollowUpAutomationService;

  const mockLead = {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: 'org-1',
    firstName: 'John',
    lastName: 'Doe',
    stage: 'NEW' as const,
  };

  const mockRule = {
    id: '22222222-2222-2222-2222-222222222222',
    organizationId: 'org-1',
    name: 'Rule 1',
    triggerType: 'NO_ACTIVITY',
    triggerDays: 3,
    actionType: 'CREATE_FOLLOW_UP',
    isActive: true,
  };

  beforeEach(() => {
    leadsService = {
      findAll: vi.fn().mockResolvedValue({ items: [mockLead], total: 1 }),
      findOne: vi.fn().mockResolvedValue(mockLead),
      create: vi.fn().mockResolvedValue(mockLead),
      update: vi.fn().mockResolvedValue(mockLead),
      updateStage: vi.fn().mockResolvedValue(mockLead),
      convert: vi.fn().mockResolvedValue({ id: 'student-1' }),
      addActivity: vi.fn().mockResolvedValue({ id: 'act-1' }),
      remove: vi.fn().mockResolvedValue(mockLead),
    } as unknown as LeadsService;

    followUpService = {
      getRules: vi.fn().mockResolvedValue([mockRule]),
      createRule: vi.fn().mockResolvedValue(mockRule),
      updateRule: vi.fn().mockResolvedValue(mockRule),
      deleteRule: vi.fn().mockResolvedValue(mockRule),
      evaluateRules: vi.fn().mockResolvedValue({ evaluated: 1, created: 1 }),
      getOverdueFollowUps: vi.fn().mockResolvedValue([]),
      getFollowUpStats: vi.fn().mockResolvedValue({ today: 1, overdue: 0, upcoming: 2 }),
      markFollowUpComplete: vi.fn().mockResolvedValue({ id: 'fu-1', isCompleted: true }),
    } as unknown as FollowUpAutomationService;

    controller = new LeadsController(leadsService, followUpService);
  });

  describe('Leads endpoints', () => {
    it('should list leads', async () => {
      const res = await controller.findAll('org-1', { page: 1, limit: 10 });
      expect(res.total).toBe(1);
      expect(leadsService.findAll).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
    });

    it('should find one lead', async () => {
      const res = await controller.findOne('org-1', mockLead.id);
      expect(res).toEqual(mockLead);
      expect(leadsService.findOne).toHaveBeenCalledWith('org-1', mockLead.id);
    });

    it('should create a lead', async () => {
      const dto = { firstName: 'John' };
      const res = await controller.create('org-1', dto);
      expect(res).toEqual(mockLead);
      expect(leadsService.create).toHaveBeenCalledWith('org-1', dto);
    });

    it('should update a lead', async () => {
      const dto = { firstName: 'Johnny' };
      const res = await controller.update('org-1', mockLead.id, dto);
      expect(res).toEqual(mockLead);
      expect(leadsService.update).toHaveBeenCalledWith('org-1', mockLead.id, dto);
    });

    it('should update lead stage', async () => {
      const dto = { stage: 'CONTACTED' as const };
      const res = await controller.updateStage('org-1', mockLead.id, dto);
      expect(res).toEqual(mockLead);
      expect(leadsService.updateStage).toHaveBeenCalledWith('org-1', mockLead.id, 'CONTACTED', undefined);
    });

    it('should convert lead', async () => {
      const dto = { email: 'john@example.com' };
      const res = await controller.convert('org-1', mockLead.id, dto);
      expect(res).toEqual({ id: 'student-1' });
      expect(leadsService.convert).toHaveBeenCalledWith('org-1', mockLead.id, dto);
    });

    it('should add activity', async () => {
      const dto = { type: 'CALL' as const, subject: 'Follow up' };
      const res = await controller.addActivity('org-1', mockLead.id, dto);
      expect(res).toEqual({ id: 'act-1' });
      expect(leadsService.addActivity).toHaveBeenCalledWith('org-1', mockLead.id, dto);
    });

    it('should remove lead', async () => {
      const res = await controller.remove('org-1', mockLead.id);
      expect(res).toEqual(mockLead);
      expect(leadsService.remove).toHaveBeenCalledWith('org-1', mockLead.id);
    });
  });

  describe('Follow-up automation endpoints', () => {
    it('should get follow-up rules', async () => {
      const res = await controller.getFollowUpRules('org-1');
      expect(res).toEqual([mockRule]);
      expect(followUpService.getRules).toHaveBeenCalledWith('org-1');
    });

    it('should create follow-up rule', async () => {
      const dto = {
        name: 'Rule 1',
        triggerType: 'NO_ACTIVITY',
        triggerDays: 3,
        actionType: 'CREATE_FOLLOW_UP',
      };
      const res = await controller.createFollowUpRule('org-1', dto);
      expect(res).toEqual(mockRule);
      expect(followUpService.createRule).toHaveBeenCalledWith('org-1', dto);
    });

    it('should update follow-up rule', async () => {
      const dto = { name: 'Rule 1 updated' };
      const res = await controller.updateFollowUpRule('org-1', mockRule.id, dto);
      expect(res).toEqual(mockRule);
      expect(followUpService.updateRule).toHaveBeenCalledWith('org-1', mockRule.id, dto);
    });

    it('should delete follow-up rule', async () => {
      const res = await controller.deleteFollowUpRule('org-1', mockRule.id);
      expect(res).toEqual(mockRule);
      expect(followUpService.deleteRule).toHaveBeenCalledWith('org-1', mockRule.id);
    });

    it('should evaluate follow-up rules', async () => {
      const res = await controller.evaluateFollowUpRules('org-1');
      expect(res).toEqual({ evaluated: 1, created: 1 });
      expect(followUpService.evaluateRules).toHaveBeenCalledWith('org-1');
    });

    it('should get overdue follow-ups', async () => {
      const res = await controller.getFollowUps('org-1');
      expect(res).toEqual([]);
      expect(followUpService.getOverdueFollowUps).toHaveBeenCalledWith('org-1');
    });

    it('should get follow-up stats', async () => {
      const res = await controller.getFollowUpStats('org-1');
      expect(res).toHaveProperty('today', 1);
      expect(followUpService.getFollowUpStats).toHaveBeenCalledWith('org-1');
    });

    it('should complete follow-up', async () => {
      const res = await controller.completeFollowUp('org-1', 'fu-1');
      expect(res).toEqual({ id: 'fu-1', isCompleted: true });
      expect(followUpService.markFollowUpComplete).toHaveBeenCalledWith('org-1', 'fu-1');
    });
  });
});
