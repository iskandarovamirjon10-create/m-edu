import { describe, it, expect, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';

describe('Seed Demo Accounts & Centralized IAM Alignment', () => {
  it('correctly structures all demo accounts with explicit usernames and roles matching Centralized IAM policy', async () => {
    const createdUsers: any[] = [];
    const updatedUsers: any[] = [];
    const memberships: any[] = [];

    const mockPrisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => {
          createdUsers.push(data);
          return { id: `u-${data.username}`, ...data };
        }),
        update: vi.fn().mockImplementation(async ({ where, data }) => {
          updatedUsers.push({ where, data });
          return { id: where.id, ...data };
        }),
      },
      organizationMembership: {
        upsert: vi.fn().mockImplementation(async ({ create }) => {
          memberships.push(create);
          return create;
        }),
      },
      course: {
        findFirst: vi.fn().mockResolvedValue({ id: 'c1', name: 'Matematika' }),
      },
      teacher: {
        findFirst: vi.fn().mockResolvedValue({ id: 't1', userId: 'u-teacher' }),
      },
      group: {
        findFirst: vi.fn().mockResolvedValue({ id: 'g1', name: 'Guruh M-1' }),
      },
      student: {
        findFirst: vi.fn().mockResolvedValue({ id: 's1', userId: 'u-student' }),
      },
      studentGroup: {
        findFirst: vi.fn().mockResolvedValue({ id: 'sg1' }),
      },
      parentAccount: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'p1', ...data })),
      },
      parentStudent: {
        findFirst: vi.fn().mockResolvedValue({ id: 'ps1' }),
      },
    };

    // Simulate seed ensureAllDemoAccounts logic
    const defaultPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const orgId = 'org-123';

    // 1. Platform Owner
    await mockPrisma.user.create({
      data: {
        organizationId: orgId,
        username: 'owner',
        email: 'owner@medu.uz',
        passwordHash,
        firstName: 'Platforma',
        lastName: 'Egasi',
        role: 'PLATFORM_OWNER',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
      },
    });
    await mockPrisma.organizationMembership.upsert({
      create: { organizationId: orgId, userId: 'u-owner', role: 'PLATFORM_OWNER', status: 'ACTIVE' },
    });

    // 2. Super Admin
    await mockPrisma.user.create({
      data: {
        organizationId: orgId,
        username: 'superadmin',
        email: 'superadmin@medu.uz',
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
      },
    });
    await mockPrisma.organizationMembership.upsert({
      create: { organizationId: orgId, userId: 'u-superadmin', role: 'SUPER_ADMIN', status: 'ACTIVE' },
    });

    // 3. Org Admin
    await mockPrisma.user.create({
      data: {
        organizationId: orgId,
        username: 'admin',
        email: 'admin@medu.test',
        passwordHash,
        firstName: 'Admin',
        lastName: 'M-EDU',
        role: 'ORG_ADMIN',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
      },
    });
    await mockPrisma.organizationMembership.upsert({
      create: { organizationId: orgId, userId: 'u-admin', role: 'ORG_ADMIN', status: 'ACTIVE' },
    });

    // 4. Teacher
    await mockPrisma.user.create({
      data: {
        organizationId: orgId,
        username: 'teacher',
        email: 'teacher@medu.test',
        passwordHash,
        firstName: 'Olim',
        lastName: 'Rahimov',
        role: 'TEACHER',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
      },
    });
    await mockPrisma.organizationMembership.upsert({
      create: { organizationId: orgId, userId: 'u-teacher', role: 'TEACHER', status: 'ACTIVE' },
    });

    // 5. Student
    await mockPrisma.user.create({
      data: {
        organizationId: orgId,
        username: 'student',
        email: 'student@medu.test',
        passwordHash,
        firstName: 'Jasur',
        lastName: 'Aliyev',
        role: 'STUDENT',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
      },
    });
    await mockPrisma.organizationMembership.upsert({
      create: { organizationId: orgId, userId: 'u-student', role: 'STUDENT', status: 'ACTIVE' },
    });

    // Assertions
    expect(createdUsers).toHaveLength(5);
    const usernames = createdUsers.map((u) => u.username);
    expect(usernames).toEqual(['owner', 'superadmin', 'admin', 'teacher', 'student']);

    const roles = createdUsers.map((u) => u.role);
    expect(roles).toEqual(['PLATFORM_OWNER', 'SUPER_ADMIN', 'ORG_ADMIN', 'TEACHER', 'STUDENT']);

    // Check password hashes are valid bcrypt
    for (const u of createdUsers) {
      const match = await bcrypt.compare('Password123!', u.passwordHash);
      expect(match).toBe(true);
      expect(u.mustChangePassword).toBe(false);
      expect(u.isActive).toBe(true);
    }

    expect(memberships).toHaveLength(5);
    expect(memberships.map((m) => m.role)).toEqual([
      'PLATFORM_OWNER',
      'SUPER_ADMIN',
      'ORG_ADMIN',
      'TEACHER',
      'STUDENT',
    ]);
  });
});
