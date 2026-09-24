import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { StudentsService } from '../students.service';
import { PrismaService } from '../../prisma/prisma.service';
import { userPublicSelect } from '../../common/selects/user.select';

function createMockPrisma() {
  return {
    student: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('StudentsService update semantics', () => {
  let prisma: MockPrisma;
  let svc: StudentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new StudentsService(prisma as unknown as PrismaService);
  });

  it('throws NotFoundException when student not found', async () => {
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(svc.update('org-1', 's1', { firstName: 'NewName' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns current student without calling update when data is empty', async () => {
    const existing = { id: 's1', organizationId: 'org-1' };
    prisma.student.findFirst.mockResolvedValue(existing);

    const result = await svc.update('org-1', 's1', {});
    expect(result).toEqual(existing);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });

  it('updates student data and linked user data', async () => {
    const existing = { id: 's1', organizationId: 'org-1' };
    prisma.student.findFirst.mockResolvedValue(existing);
    prisma.student.update.mockResolvedValue({ ...existing, address: 'Tashkent' });

    const result = await svc.update('org-1', 's1', {
      address: 'Tashkent',
      firstName: 'Bobur',
    });

    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 's1', organizationId: 'org-1' },
      data: {
        address: 'Tashkent',
        user: {
          update: {
            firstName: 'Bobur',
          },
        },
      },
      include: { user: userPublicSelect },
    });
    expect(result.address).toBe('Tashkent');
  });
});
