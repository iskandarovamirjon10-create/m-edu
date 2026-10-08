import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CurriculumService } from '../curriculum.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('CurriculumService', () => {
  let service: CurriculumService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      subject: { findFirst: vi.fn() },
      course: { findFirst: vi.fn() },
      curriculum: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      curriculumModule: { create: vi.fn() },
      topic: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
      learningObjective: { create: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurriculumService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CurriculumService>(CurriculumService);
  });

  it('creates curriculum under valid subject and organization', async () => {
    prisma.subject.findFirst.mockResolvedValue({ id: 'sub-1', organizationId: 'org-1' });
    prisma.curriculum.create.mockResolvedValue({
      id: 'cur-1',
      name: 'Primary Math',
      organizationId: 'org-1',
      subjectId: 'sub-1',
    });

    const res = await service.create('org-1', {
      name: 'Primary Math',
      subjectId: 'sub-1',
    });

    expect(res.id).toBe('cur-1');
    expect(prisma.curriculum.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-1', subjectId: 'sub-1' }),
      }),
    );
  });

  it('throws NotFoundException when associated subject does not exist in org', async () => {
    prisma.subject.findFirst.mockResolvedValue(null);

    await expect(
      service.create('org-1', { name: 'Invalid Math', subjectId: 'sub-none' }),
    ).rejects.toThrow(NotFoundException);
  });

  describe('addObjective tenant isolation', () => {
    beforeEach(() => {
      // The curriculum belongs to org-1 (findOne verifies this).
      prisma.curriculum.findFirst.mockResolvedValue({
        id: 'cur-1',
        organizationId: 'org-1',
        CurriculumModule: [{ id: 'mod-1', Topic: [{ id: 'top-1' }] }],
      });
    });

    it('scopes the topic lookup to the curriculum + organization', async () => {
      prisma.topic.findFirst.mockResolvedValue({ id: 'top-1' });
      prisma.learningObjective.create.mockResolvedValue({ id: 'obj-1', topicId: 'top-1' });

      await service.addObjective('org-1', 'cur-1', 'top-1', {
        code: 'obj-1',
        description: 'Count to ten',
      } as never);

      // The query must constrain the topic to THIS curriculum and org, not
      // merely match on id.
      expect(prisma.topic.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'top-1',
          CurriculumModule: { curriculumId: 'cur-1', Curriculum: { organizationId: 'org-1' } },
        },
      });
    });

    it('rejects a topic that does not belong to this curriculum/organization', async () => {
      // A foreign topic (or one in another curriculum) resolves to null under
      // the tenant-scoped filter and must NOT be written to.
      prisma.topic.findFirst.mockResolvedValue(null);

      await expect(
        service.addObjective('org-1', 'cur-1', 'foreign-topic', {
          code: 'obj-x',
          description: 'Injected objective',
        } as never),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.learningObjective.create).not.toHaveBeenCalled();
    });
  });
});
