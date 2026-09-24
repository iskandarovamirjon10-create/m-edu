import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataQualityController } from '../data-quality.controller';
import { DataQualityService } from '../data-quality.service';
import { DataQualityQueryDto, ResolveIssueDto } from '../dto/data-quality.dto';

describe('DataQualityController', () => {
  let controller: DataQualityController;
  let service: {
    getSummary: ReturnType<typeof vi.fn>;
    getIssues: ReturnType<typeof vi.fn>;
    runAllChecks: ReturnType<typeof vi.fn>;
    resolveIssue: ReturnType<typeof vi.fn>;
  };

  const orgId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const issueId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    service = {
      getSummary: vi.fn(),
      getIssues: vi.fn(),
      runAllChecks: vi.fn(),
      resolveIssue: vi.fn(),
    };

    controller = new DataQualityController(service as unknown as DataQualityService);
  });

  it('delegates getSummary to service with current user orgId', async () => {
    service.getSummary.mockResolvedValue({ total: 5 });

    const res = await controller.getSummary(orgId);

    expect(service.getSummary).toHaveBeenCalledWith(orgId);
    expect(res).toEqual({ total: 5 });
  });

  it('delegates getIssues to service with current user orgId and query', async () => {
    const query: DataQualityQueryDto = { severity: 'HIGH', limit: 20 };
    service.getIssues.mockResolvedValue([]);

    const res = await controller.getIssues(orgId, query);

    expect(service.getIssues).toHaveBeenCalledWith(orgId, query);
    expect(res).toEqual([]);
  });

  it('delegates runChecks to service with current user orgId', async () => {
    service.runAllChecks.mockResolvedValue({ total: 0, issues: [] });

    const res = await controller.runChecks(orgId);

    expect(service.runAllChecks).toHaveBeenCalledWith(orgId);
    expect(res).toEqual({ total: 0, issues: [] });
  });

  it('delegates resolve to service with current user orgId and userId', async () => {
    const body: ResolveIssueDto = { note: 'Resolved manually' };
    service.resolveIssue.mockResolvedValue({ count: 1 });

    const res = await controller.resolve(orgId, userId, issueId, body);

    expect(service.resolveIssue).toHaveBeenCalledWith(orgId, issueId, userId, 'Resolved manually');
    expect(res).toEqual({ count: 1 });
  });
});
