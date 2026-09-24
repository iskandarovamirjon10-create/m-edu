import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowController } from '../workflow.controller';
import { WorkflowService } from '../workflow.service';
import { PaginationQuery } from '../../common/dto/query';

describe('WorkflowController', () => {
  let controller: WorkflowController;
  let service: {
    listRules: ReturnType<typeof vi.fn>;
    getRule: ReturnType<typeof vi.fn>;
    listInstances: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-uuid-1';

  beforeEach(() => {
    service = {
      listRules: vi.fn(),
      getRule: vi.fn(),
      listInstances: vi.fn(),
    };
    controller = new WorkflowController(service as unknown as WorkflowService);
  });

  it('list calls service.listRules', async () => {
    const query: PaginationQuery = { page: '1', limit: '10' };
    const expected = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    service.listRules.mockResolvedValue(expected);

    const result = await controller.list(orgId, query);
    expect(result).toBe(expected);
    expect(service.listRules).toHaveBeenCalledWith(orgId, query);
  });

  it('getRule calls service.getRule', async () => {
    const expected = { id: 'rule-uuid-1', name: 'Rule 1' };
    service.getRule.mockResolvedValue(expected);

    const result = await controller.getRule(orgId, 'rule-uuid-1');
    expect(result).toBe(expected);
    expect(service.getRule).toHaveBeenCalledWith(orgId, 'rule-uuid-1');
  });

  it('instances calls service.listInstances', async () => {
    const query: PaginationQuery = { page: '1', limit: '10' };
    const expected = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    service.listInstances.mockResolvedValue(expected);

    const result = await controller.instances(orgId, query);
    expect(result).toBe(expected);
    expect(service.listInstances).toHaveBeenCalledWith(orgId, query);
  });
});
