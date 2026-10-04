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
      topic: { create: vi.fn(), findUnique: vi.fn() },
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
});
