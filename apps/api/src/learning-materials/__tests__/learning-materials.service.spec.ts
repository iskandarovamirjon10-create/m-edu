import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LearningMaterialsService } from '../learning-materials.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('LearningMaterialsService (Role Visibility & LMS)', () => {
  let service: LearningMaterialsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      material: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      materialFolder: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      subject: { findFirst: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningMaterialsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LearningMaterialsService>(LearningMaterialsService);
  });

  it('hides TEACHERS_ONLY material from students and parents', async () => {
    prisma.material.findFirst.mockResolvedValue({
      id: 'mat-secret',
      organizationId: 'org-1',
      title: 'Exam Solutions Key',
      visibility: 'TEACHERS_ONLY',
    });

    await expect(
      service.findOne('org-1', 'mat-secret', 'STUDENT'),
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.findOne('org-1', 'mat-secret', 'PARENT'),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows teachers to view TEACHERS_ONLY materials', async () => {
    prisma.material.findFirst.mockResolvedValue({
      id: 'mat-secret',
      organizationId: 'org-1',
      title: 'Exam Solutions Key',
      visibility: 'TEACHERS_ONLY',
    });

    const res = await service.findOne('org-1', 'mat-secret', 'TEACHER');
    expect(res.id).toBe('mat-secret');
  });
});
