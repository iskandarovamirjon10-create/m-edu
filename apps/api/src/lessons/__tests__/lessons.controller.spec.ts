import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LessonsController } from '../lessons.controller';
import { LessonsService } from '../lessons.service';
import { LessonStatus } from '@prisma/client';

describe('LessonsController', () => {
  let controller: LessonsController;
  let service: any;

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      updateStatus: vi.fn(),
      updateContent: vi.fn(),
      linkMaterial: vi.fn(),
      unlinkMaterial: vi.fn(),
      getLessonCopilotAnalysis: vi.fn(),
    };

    controller = new LessonsController(service as LessonsService);
  });

  it('delegates findAll to service', async () => {
    service.findAll.mockResolvedValue({ items: [], total: 0 });
    const res = await controller.findAll('org-1', { date: '2026-10-26' });

    expect(res).toEqual({ items: [], total: 0 });
    expect(service.findAll).toHaveBeenCalledWith('org-1', { date: '2026-10-26' });
  });

  it('delegates findOne to service', async () => {
    service.findOne.mockResolvedValue({ id: 'les-1' });
    const res = await controller.findOne('org-1', 'les-1');

    expect(res).toEqual({ id: 'les-1' });
    expect(service.findOne).toHaveBeenCalledWith('org-1', 'les-1');
  });

  it('delegates getCopilotAnalysis to service.getLessonCopilotAnalysis', async () => {
    const mockAnalysis = {
      lessonId: 'les-1',
      topic: 'Kvadrat tenglamalar',
      groupMetrics: { totalStudents: 15 },
    };
    service.getLessonCopilotAnalysis.mockResolvedValue(mockAnalysis);

    const res = await controller.getCopilotAnalysis('org-1', 'les-1');

    expect(res).toEqual(mockAnalysis);
    expect(service.getLessonCopilotAnalysis).toHaveBeenCalledWith('org-1', 'les-1');
  });

  it('delegates updateStatus to service', async () => {
    service.updateStatus.mockResolvedValue({ id: 'les-1', status: LessonStatus.CONDUCTED });
    const res = await controller.updateStatus('org-1', 'les-1', { status: LessonStatus.CONDUCTED });

    expect(res.status).toBe(LessonStatus.CONDUCTED);
    expect(service.updateStatus).toHaveBeenCalledWith('org-1', 'les-1', { status: LessonStatus.CONDUCTED });
  });

  it('delegates linkMaterial and unlinkMaterial to service', async () => {
    service.linkMaterial.mockResolvedValue({ id: 'link-1' });
    service.unlinkMaterial.mockResolvedValue({ count: 1 });

    const linkRes = await controller.linkMaterial('org-1', 'les-1', { materialId: 'mat-1' });
    expect(linkRes).toEqual({ id: 'link-1' });
    expect(service.linkMaterial).toHaveBeenCalledWith('org-1', 'les-1', 'mat-1');

    const unlinkRes = await controller.unlinkMaterial('org-1', 'les-1', 'mat-1');
    expect(unlinkRes).toEqual({ count: 1 });
    expect(service.unlinkMaterial).toHaveBeenCalledWith('org-1', 'les-1', 'mat-1');
  });
});
