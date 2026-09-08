import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeachersService } from '../teachers.service';

function createMockPrisma() {
  return {
    teacher: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    user: { findFirst: vi.fn(), delete: vi.fn() },
    group: { findFirst: vi.fn(), count: vi.fn() },
    notification: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    userSettings: { deleteMany: vi.fn() },
    $transaction: vi.fn((fn: any) => fn(createMockPrisma())),
  };
}

describe('TeachersService delete semantics', () => {
  let prisma: any;
  let svc: TeachersService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
    svc = new TeachersService(prisma);
  });

  it('rejects deleting a teacher assigned to groups', async () => {
    prisma.teacher.findFirst.mockResolvedValue({ id: 't1', organizationId: 'org-1', userId: 'u1' });
    prisma.group.count.mockResolvedValue(2);

    await expect(svc.remove('org-1', 't1')).rejects.toThrow(
      'deactivate the teacher instead of deleting them',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deletes an unassigned teacher and their linked user in one transaction', async () => {
    prisma.teacher.findFirst.mockResolvedValue({ id: 't1', organizationId: 'org-1', userId: 'u1' });
    prisma.group.count.mockResolvedValue(0);

    const result = await svc.remove('org-1', 't1');

    expect(prisma.teacher.delete).toHaveBeenCalledWith({ where: { id: 't1', organizationId: 'org-1' } });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.userSettings.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(result.message).toContain('deleted');
  });
});
