import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeacherWorkloadController } from '../teacher-workload.controller';
import { TeacherWorkloadService, WorkloadSummary } from '../teacher-workload.service';
import { TeacherWorkloadQueryDto } from '../dto/teacher-workload-query.dto';

describe('TeacherWorkloadController', () => {
  let controller: TeacherWorkloadController;
  let service: {
    getSummary: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-uuid-1';

  beforeEach(() => {
    service = {
      getSummary: vi.fn(),
      findAll: vi.fn(),
    };
    controller = new TeacherWorkloadController(service as unknown as TeacherWorkloadService);
  });

  it('getSummary returns summary from service', async () => {
    const summary: WorkloadSummary = {
      total: 10,
      overloaded: 2,
      balanced: 5,
      underutilized: 3,
      avgUtilization: 0.75,
    };
    service.getSummary.mockResolvedValue(summary);

    const result = await controller.getSummary(orgId);
    expect(result).toBe(summary);
    expect(service.getSummary).toHaveBeenCalledWith(orgId);
  });

  it('findAll returns paginated items from service', async () => {
    const query: TeacherWorkloadQueryDto = { page: 1, limit: 10, status: 'BALANCED' };
    const expected = { items: [], total: 0 };
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(orgId, query);
    expect(result).toBe(expected);
    expect(service.findAll).toHaveBeenCalledWith(orgId, query);
  });
});
