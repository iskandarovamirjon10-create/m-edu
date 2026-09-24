import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutomationController } from '../automation.controller';
import type { AutomationService } from '../automation.service';
import type { CreateAutomationRuleDto, UpdateAutomationRuleDto } from '../dto/automation.dto';

describe('AutomationController', () => {
  let controller: AutomationController;
  let service: {
    listRules: ReturnType<typeof vi.fn>;
    createRule: ReturnType<typeof vi.fn>;
    getRule: ReturnType<typeof vi.fn>;
    updateRule: ReturnType<typeof vi.fn>;
    deleteRule: ReturnType<typeof vi.fn>;
    toggleRule: ReturnType<typeof vi.fn>;
    evaluateRule: ReturnType<typeof vi.fn>;
    evaluateAllRules: ReturnType<typeof vi.fn>;
    getExecutions: ReturnType<typeof vi.fn>;
    getRuleStats: ReturnType<typeof vi.fn>;
    getOverallStats: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      listRules: vi.fn(),
      createRule: vi.fn(),
      getRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      toggleRule: vi.fn(),
      evaluateRule: vi.fn(),
      evaluateAllRules: vi.fn(),
      getExecutions: vi.fn(),
      getRuleStats: vi.fn(),
      getOverallStats: vi.fn(),
    };
    controller = new AutomationController(service as unknown as AutomationService);
  });

  const orgId = 'org-123';
  const userId = 'user-456';
  const ruleId = 'rule-789';

  it('listRules delegates to service.listRules', async () => {
    service.listRules.mockResolvedValue([]);
    const res = await controller.listRules(orgId);
    expect(service.listRules).toHaveBeenCalledWith(orgId);
    expect(res).toEqual([]);
  });

  it('createRule delegates to service.createRule with orgId, dto, and userId', async () => {
    const dto: CreateAutomationRuleDto = {
      name: 'Test Rule',
      eventType: 'STUDENT_ABSENT',
      actions: [{ type: 'IN_APP_NOTIFICATION' }],
    };
    service.createRule.mockResolvedValue({ id: ruleId, ...dto });

    const res = await controller.createRule(orgId, userId, dto);
    expect(service.createRule).toHaveBeenCalledWith(orgId, dto, userId);
    expect(res).toEqual(expect.objectContaining({ id: ruleId }));
  });

  it('getRule delegates to service.getRule', async () => {
    service.getRule.mockResolvedValue({ id: ruleId });
    const res = await controller.getRule(orgId, ruleId);
    expect(service.getRule).toHaveBeenCalledWith(orgId, ruleId);
    expect(res).toEqual({ id: ruleId });
  });

  it('updateRule delegates to service.updateRule', async () => {
    const dto: UpdateAutomationRuleDto = { name: 'New Name' };
    service.updateRule.mockResolvedValue({ id: ruleId, ...dto });
    const res = await controller.updateRule(orgId, ruleId, dto);
    expect(service.updateRule).toHaveBeenCalledWith(orgId, ruleId, dto);
    expect(res).toEqual(expect.objectContaining({ name: 'New Name' }));
  });

  it('deleteRule delegates to service.deleteRule', async () => {
    service.deleteRule.mockResolvedValue({ success: true });
    const res = await controller.deleteRule(orgId, ruleId);
    expect(service.deleteRule).toHaveBeenCalledWith(orgId, ruleId);
    expect(res).toEqual({ success: true });
  });

  it('toggleRule delegates to service.toggleRule', async () => {
    service.toggleRule.mockResolvedValue({ id: ruleId, isActive: false });
    const res = await controller.toggleRule(orgId, ruleId, { isActive: false });
    expect(service.toggleRule).toHaveBeenCalledWith(orgId, ruleId, false);
    expect(res).toEqual(expect.objectContaining({ isActive: false }));
  });

  it('evaluateRule delegates to service.evaluateRule', async () => {
    service.evaluateRule.mockResolvedValue({ triggered: true });
    const res = await controller.evaluateRule(orgId, ruleId);
    expect(service.evaluateRule).toHaveBeenCalledWith(orgId, ruleId);
    expect(res).toEqual({ triggered: true });
  });

  it('evaluateAllRules delegates to service.evaluateAllRules', async () => {
    service.evaluateAllRules.mockResolvedValue([{ ruleId, triggered: true }]);
    const res = await controller.evaluateAllRules(orgId);
    expect(service.evaluateAllRules).toHaveBeenCalledWith(orgId);
    expect(res).toHaveLength(1);
  });

  it('getExecutions delegates to service.getExecutions with parsed limit', async () => {
    service.getExecutions.mockResolvedValue([]);
    const res = await controller.getExecutions(orgId, ruleId, '25');
    expect(service.getExecutions).toHaveBeenCalledWith(orgId, ruleId, 25);
    expect(res).toEqual([]);
  });

  it('getRuleStats delegates to service.getRuleStats', async () => {
    service.getRuleStats.mockResolvedValue({ totalRuns: 10 });
    const res = await controller.getRuleStats(orgId, ruleId);
    expect(service.getRuleStats).toHaveBeenCalledWith(orgId, ruleId);
    expect(res).toEqual({ totalRuns: 10 });
  });

  it('getOverallStats delegates to service.getOverallStats', async () => {
    service.getOverallStats.mockResolvedValue({ activeRules: 5 });
    const res = await controller.getOverallStats(orgId);
    expect(service.getOverallStats).toHaveBeenCalledWith(orgId);
    expect(res).toEqual({ activeRules: 5 });
  });
});
