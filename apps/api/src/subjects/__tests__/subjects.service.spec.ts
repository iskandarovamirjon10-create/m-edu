import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubjectsService } from '../subjects.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('SubjectsService', () => {
  let service: SubjectsService;
  let prisma: {
    subject: {
      findMany: any;
      count: any;
      findFirst: any;
      create: any;
      update: any;
    };
  };

  beforeEach(async () => {
    prisma = {
      subject: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SubjectsService>(SubjectsService);
  });

  it('creates a new subject when code is unique', async () => {
    prisma.subject.findFirst.mockResolvedValue(null);
    prisma.subject.create.mockResolvedValue({
      id: 'sub-1',
      name: 'Mathematics',
      code: 'MATH',
      organizationId: 'org-1',
    });

    const res = await service.create('org-1', {
      name: 'Mathematics',
      code: 'MATH',
      credits: 3,
    });

    expect(res.name).toBe('Mathematics');
    expect(prisma.subject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          code: 'MATH',
        }),
      }),
    );
  });

  it('rejects duplicate subject code within same organization', async () => {
    prisma.subject.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create('org-1', { name: 'Math 2', code: 'MATH' }),
    ).rejects.toThrow(BadRequestException);
  });
});
