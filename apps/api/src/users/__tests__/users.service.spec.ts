import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from '../users.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

type MockTx = {
  user: { update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  session: { updateMany: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  userSettings: { deleteMany: ReturnType<typeof vi.fn> };
  notification: { deleteMany: ReturnType<typeof vi.fn> };
};

function createMockPrisma() {
  const tx: MockTx = {
    user: { update: vi.fn(), delete: vi.fn() },
    session: { updateMany: vi.fn(), deleteMany: vi.fn() },
    userSettings: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
  };

  const obj = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    session: {
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    userSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    notification: {
      deleteMany: vi.fn(),
    },
    student: {
      findUnique: vi.fn(),
    },
    teacher: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((fn: (innerTx: MockTx) => Promise<unknown>) => fn(tx)),
  };
  return obj;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('UsersService.changePassword', () => {
  let prisma: MockPrisma;
  let svc: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new UsersService(prisma as unknown as PrismaService);
  });

  it('revokes all other sessions after a successful password change', async () => {
    const passwordHash = await bcrypt.hash('old-password-123', 4);
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      organizationId: 'org-1',
      email: 'a@b.com',
      passwordHash,
      isActive: true,
    });
    const txUserUpdate = vi.fn().mockResolvedValue({});
    const txSessionUpdate = vi.fn().mockResolvedValue({ count: 3 });
    prisma.$transaction.mockImplementation(async (fn: (innerTx: MockTx) => Promise<unknown>) =>
      fn({
        user: { updateMany: txUserUpdate, delete: vi.fn() },
        session: { updateMany: txSessionUpdate, deleteMany: vi.fn() },
        userSettings: { deleteMany: vi.fn() },
        notification: { deleteMany: vi.fn() },
      }),
    );

    await svc.changePassword('org-1', 'u1', 'old-password-123', 'new-password-456', 'session-current');

    expect(txSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'u1',
          revokedAt: null,
          id: { not: 'session-current' },
        },
        data: expect.objectContaining({ revokedReason: 'password_changed' }),
      }),
    );
  });

  it('revokes ALL sessions when no current session id is provided', async () => {
    const passwordHash = await bcrypt.hash('old-password-123', 4);
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      organizationId: 'org-1',
      email: 'a@b.com',
      passwordHash,
      isActive: true,
    });
    const txSessionUpdate = vi.fn().mockResolvedValue({ count: 5 });
    prisma.$transaction.mockImplementation(async (fn: (innerTx: MockTx) => Promise<unknown>) =>
      fn({
        user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), delete: vi.fn() },
        session: { updateMany: txSessionUpdate, deleteMany: vi.fn() },
        userSettings: { deleteMany: vi.fn() },
        notification: { deleteMany: vi.fn() },
      }),
    );

    await svc.changePassword('org-1', 'u1', 'old-password-123', 'new-password-456', null);

    expect(txSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', revokedAt: null },
      }),
    );
  });

  it('rejects an incorrect current password without touching sessions', async () => {
    const passwordHash = await bcrypt.hash('old-password-123', 4);
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      organizationId: 'org-1',
      email: 'a@b.com',
      passwordHash,
      isActive: true,
    });

    await expect(svc.changePassword('org-1', 'u1', 'wrong-password', 'new-password-456')).rejects.toThrow(
      /Current password is incorrect/,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('UsersService privilege-escalation guards (P1)', () => {
  let prisma: MockPrisma;
  let svc: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new UsersService(prisma as unknown as PrismaService);
  });

  it('rejects ORG_ADMIN creating a SUPER_ADMIN account', async () => {
    await expect(
      svc.create('org1', { email: 'x@y.com', password: 'password123', firstName: 'X', lastName: 'Y', role: 'SUPER_ADMIN' }, 'ORG_ADMIN'),
    ).rejects.toThrow('Only a SUPER_ADMIN can assign the SUPER_ADMIN role');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects ORG_ADMIN creating an ORG_ADMIN account', async () => {
    await expect(
      svc.create('org1', { email: 'x@y.com', password: 'password123', firstName: 'X', lastName: 'Y', role: 'ORG_ADMIN' }, 'ORG_ADMIN'),
    ).rejects.toThrow('Only a SUPER_ADMIN can grant the ORG_ADMIN role');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('allows ORG_ADMIN to create a TEACHER account with custom username', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u3', role: 'TEACHER', username: 'teacher_bek' });
    const result = await svc.create(
      'org1',
      { email: 'teacher@edu.local', username: 'teacher_bek', password: 'password123', firstName: 'Bek', lastName: 'Aliyev', role: 'TEACHER' },
      'ORG_ADMIN',
    );
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'TEACHER', username: 'teacher_bek' }) }),
    );
    expect(result).toBeDefined();
  });

  it('rejects creating a user if username is already taken', async () => {
    prisma.user.findFirst.mockImplementation(({ where }) => {
      if (where.email) return Promise.resolve(null);
      if (where.username === 'taken_user') return Promise.resolve({ id: 'existing-id' });
      return Promise.resolve(null);
    });

    await expect(
      svc.create('org1', { email: 'new@edu.local', username: 'taken_user', password: 'password123', firstName: 'A', lastName: 'B', role: 'TEACHER' }, 'ORG_ADMIN'),
    ).rejects.toThrow('Username is already taken');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('allows PLATFORM_OWNER to create a SUPER_ADMIN account', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u2', role: 'SUPER_ADMIN' });
    const result = await svc.create(
      'org1',
      { email: 'x@y.com', password: 'password123', firstName: 'X', lastName: 'Y', role: 'SUPER_ADMIN' },
      'PLATFORM_OWNER',
    );
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'SUPER_ADMIN' }) }),
    );
    expect(result).toBeDefined();
  });

  it('rejects ORG_ADMIN promoting a user to SUPER_ADMIN via update', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', organizationId: 'org1', role: 'MANAGER' });
    await expect(
      svc.update('org1', 'u2', { role: 'SUPER_ADMIN' }, 'ORG_ADMIN'),
    ).rejects.toThrow('Only a SUPER_ADMIN can assign the SUPER_ADMIN role');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects ORG_ADMIN promoting a user to ORG_ADMIN via update', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', organizationId: 'org1', role: 'MANAGER' });
    await expect(
      svc.update('org1', 'u2', { role: 'ORG_ADMIN' }, 'ORG_ADMIN'),
    ).rejects.toThrow('Only a SUPER_ADMIN can grant the ORG_ADMIN role');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects ORG_ADMIN demoting/deactivating another ORG_ADMIN', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', organizationId: 'org1', role: 'ORG_ADMIN' });
    await expect(
      svc.update('org1', 'u2', { isActive: false }, 'ORG_ADMIN'),
    ).rejects.toThrow('ORG_ADMIN cannot change the role or status of an admin account');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows ORG_ADMIN to update a MANAGER profile (no role change)', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', organizationId: 'org1', role: 'MANAGER' });
    prisma.user.update.mockResolvedValue({ id: 'u2' });
    await svc.update('org1', 'u2', { firstName: 'New' }, 'ORG_ADMIN');
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('rejects a STUDENT updating another user settings (IDOR)', async () => {
    await expect(
      svc.updateSettings('org1', 'u2', { theme: 'dark' }, 'u1', 'STUDENT'),
    ).rejects.toThrow('You can only update your own settings');
  });

  it('allows a user to update their own settings', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1' });
    prisma.userSettings.findUnique.mockResolvedValue(null);
    prisma.userSettings.create.mockResolvedValue({ userId: 'u1' });
    const result = await svc.updateSettings('org1', 'u1', { theme: 'dark' }, 'u1', 'STUDENT');
    expect(prisma.userSettings.create).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

describe('UsersService admin lifecycle guards (P1/P3)', () => {
  let prisma: MockPrisma;
  let svc: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new UsersService(prisma as unknown as PrismaService);
  });

  it('rejects a SUPER_ADMIN changing their own role (self-demotion lockout)', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1', role: 'SUPER_ADMIN', isActive: true });
    await expect(
      svc.update('org1', 'u1', { role: 'ORG_ADMIN' }, 'SUPER_ADMIN', 'u1'),
    ).rejects.toThrow('You cannot change your own role or account status');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a SUPER_ADMIN deactivating their own account', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1', role: 'SUPER_ADMIN', isActive: true });
    await expect(
      svc.update('org1', 'u1', { isActive: false }, 'SUPER_ADMIN', 'u1'),
    ).rejects.toThrow('You cannot change your own role or account status');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects demoting the LAST active SUPER_ADMIN', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1', role: 'SUPER_ADMIN', isActive: true });
    prisma.user.count.mockResolvedValue(1);
    await expect(
      svc.update('org1', 'u1', { role: 'ORG_ADMIN' }, 'SUPER_ADMIN', 'u99'),
    ).rejects.toThrow('Cannot demote or deactivate the last active SUPER_ADMIN');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects deactivating the LAST active SUPER_ADMIN', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1', role: 'SUPER_ADMIN', isActive: true });
    prisma.user.count.mockResolvedValue(1);
    await expect(
      svc.update('org1', 'u1', { isActive: false }, 'SUPER_ADMIN', 'u99'),
    ).rejects.toThrow('Cannot demote or deactivate the last active SUPER_ADMIN');
  });

  it('allows demoting a SUPER_ADMIN when another active SUPER_ADMIN exists', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1', role: 'SUPER_ADMIN', isActive: true });
    prisma.user.count.mockResolvedValue(2);
    prisma.user.update.mockResolvedValue({ id: 'u1', role: 'ORG_ADMIN' });
    const result = await svc.update('org1', 'u1', { role: 'ORG_ADMIN' }, 'SUPER_ADMIN', 'u99');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1', organizationId: 'org1' }, data: expect.objectContaining({ role: 'ORG_ADMIN' }) }),
    );
    expect(result).toBeDefined();
  });
});

describe('UsersService.remove (DELETE /users/:id)', () => {
  let prisma: MockPrisma;
  let svc: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new UsersService(prisma as unknown as PrismaService);
  });

  it('rejects deleting your own account', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1', role: 'MANAGER', isActive: true });
    await expect(
      svc.remove('org1', 'u1', 'u1', 'SUPER_ADMIN'),
    ).rejects.toThrow('You cannot delete your own account');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects ORG_ADMIN deleting an admin account', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', organizationId: 'org1', role: 'ORG_ADMIN', isActive: true });
    await expect(
      svc.remove('org1', 'u2', 'u1', 'ORG_ADMIN'),
    ).rejects.toThrow('ORG_ADMIN cannot delete an admin account');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects deleting the LAST active SUPER_ADMIN', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', organizationId: 'org1', role: 'SUPER_ADMIN', isActive: true });
    prisma.user.count.mockResolvedValue(1);
    await expect(
      svc.remove('org1', 'u2', 'u1', 'SUPER_ADMIN'),
    ).rejects.toThrow('Cannot delete the last active SUPER_ADMIN');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects deleting a user with a Student profile (FK integrity)', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', organizationId: 'org1', role: 'STUDENT', isActive: true });
    prisma.student.findUnique.mockResolvedValue({ id: 's1', userId: 'u2' });
    prisma.teacher.findUnique.mockResolvedValue(null);
    await expect(
      svc.remove('org1', 'u2', 'u1', 'SUPER_ADMIN'),
    ).rejects.toThrow(/deactivate the account instead/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects deleting a user with a Teacher profile', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', organizationId: 'org1', role: 'TEACHER', isActive: true });
    prisma.student.findUnique.mockResolvedValue(null);
    prisma.teacher.findUnique.mockResolvedValue({ id: 't1', userId: 'u2' });
    await expect(
      svc.remove('org1', 'u2', 'u1', 'SUPER_ADMIN'),
    ).rejects.toThrow(/deactivate the account instead/);
  });

  it('deletes an eligible account transactionally (notifications, sessions, settings, user)', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', organizationId: 'org1', role: 'MANAGER', isActive: true });
    prisma.student.findUnique.mockResolvedValue(null);
    prisma.teacher.findUnique.mockResolvedValue(null);
    const txNotification = vi.fn().mockResolvedValue({ count: 2 });
    const txSession = vi.fn().mockResolvedValue({ count: 3 });
    const txSettings = vi.fn().mockResolvedValue({ count: 1 });
    const txUserDelete = vi.fn().mockResolvedValue({ id: 'u2' });
    prisma.$transaction.mockImplementation(async (fn: (innerTx: MockTx) => Promise<unknown>) =>
      fn({
        notification: { deleteMany: txNotification },
        session: { deleteMany: txSession },
        userSettings: { deleteMany: txSettings },
        user: { delete: txUserDelete, update: vi.fn() },
      }),
    );

    const result = await svc.remove('org1', 'u2', 'u1', 'SUPER_ADMIN');

    expect(txNotification).toHaveBeenCalledWith({ where: { userId: 'u2' } });
    expect(txSession).toHaveBeenCalledWith({ where: { userId: 'u2' } });
    expect(txSettings).toHaveBeenCalledWith({ where: { userId: 'u2' } });
    expect(txUserDelete).toHaveBeenCalledWith({ where: { id: 'u2', organizationId: 'org1' } });
    expect(result).toEqual({ message: 'User deleted successfully' });
  });
});
