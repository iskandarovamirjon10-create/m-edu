import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommunicationService } from '../communication.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

describe('CommunicationService (Parent-Teacher & Announcements)', () => {
  let service: CommunicationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      student: { findFirst: vi.fn() },
      parentStudent: { findUnique: vi.fn() },
      parentTeacherMessage: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      announcement: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunicationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CommunicationService>(CommunicationService);
  });

  it('forbids parent from viewing messages of a student not linked to them', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'stu-other', organizationId: 'org-1' });
    prisma.parentStudent.findUnique.mockResolvedValue(null);

    await expect(
      service.getMessagesForStudent('org-1', 'stu-other', { id: 'parent-1', role: 'PARENT' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows linked parent to retrieve messages', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'stu-1', organizationId: 'org-1' });
    prisma.parentStudent.findUnique.mockResolvedValue({ parentId: 'parent-1', studentId: 'stu-1' });
    prisma.parentTeacherMessage.findMany.mockResolvedValue([
      { id: 'msg-1', body: 'Hello teacher' },
    ]);

    const msgs = await service.getMessagesForStudent('org-1', 'stu-1', { id: 'parent-1', role: 'PARENT' });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body).toBe('Hello teacher');
  });
});
