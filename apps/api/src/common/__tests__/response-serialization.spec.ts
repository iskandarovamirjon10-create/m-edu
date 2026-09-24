import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  USER_PUBLIC_SELECT,
  FORBIDDEN_RESPONSE_KEYS,
  userPublicSelect,
} from '../selects/user.select';
import { StudentsService } from '../../students/students.service';
import { TeachersService } from '../../teachers/teachers.service';
import { LeadsService } from '../../leads/leads.service';
import { HremployeeService } from '../../hr/hr.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * F-008 regression: no API response may embed authentication material.
 *
 * Two layers are asserted:
 *  1. Static — the shared public projection never contains a forbidden key.
 *  2. Behavioural — every service that embeds a user row requests that
 *     projection instead of `include: { user: true }` (which returns
 *     `passwordHash` and the rest of the auth material).
 */

/** Recursively collect every unsafe `user: true` projection in a query. */
function findUnsafeUserIncludes(value: unknown, path = '$'): string[] {
  const found: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => found.push(...findUnsafeUserIncludes(entry, `${path}[${index}]`)));
    return found;
  }
  if (typeof value !== 'object' || value === null) return found;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'user' && child === true) {
      found.push(`${path}.user`);
      continue;
    }
    found.push(...findUnsafeUserIncludes(child, `${path}.${key}`));
  }
  return found;
}

/** Recursively collect any forbidden key present in a serialized payload. */
function findForbiddenKeys(value: unknown, path = '$'): string[] {
  const found: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => found.push(...findForbiddenKeys(entry, `${path}[${index}]`)));
    return found;
  }
  if (typeof value !== 'object' || value === null) return found;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_RESPONSE_KEYS.includes(key)) found.push(`${path}.${key}`);
    found.push(...findForbiddenKeys(child, `${path}.${key}`));
  }
  return found;
}

const FULL_USER_ROW = {
  id: 'u1',
  email: 'user@example.com',
  firstName: 'Ali',
  lastName: 'Valiyev',
  phone: null,
  avatar: null,
  role: 'STUDENT',
  isActive: true,
  createdAt: new Date(),
  passwordHash: '$2a$10$supersecret',
  googleSubject: 'google-123',
  telegramChatId: '999',
  telegramLinkToken: 'tok',
};

describe('Response serialization — never leak auth material (F-008)', () => {
  describe('shared public user projection', () => {
    it('excludes every forbidden key', () => {
      const selected = Object.keys(USER_PUBLIC_SELECT);
      for (const forbidden of FORBIDDEN_RESPONSE_KEYS) {
        expect(selected).not.toContain(forbidden);
      }
    });

    it('is the projection used by the relation fragment helper', () => {
      expect(userPublicSelect).toEqual({ select: USER_PUBLIC_SELECT });
    });

    it('detects a leak when a raw user row is serialized', () => {
      // Guards the detector itself: if this ever stops reporting, the
      // detection logic — not the app — is broken.
      const leaks = findForbiddenKeys({ student: { user: FULL_USER_ROW } });
      expect(leaks).toContain('$.student.user.passwordHash');
      expect(leaks).toContain('$.student.user.telegramLinkToken');
    });

    it('accepts a response built from the public projection', () => {
      const publicRow = Object.fromEntries(
        Object.keys(USER_PUBLIC_SELECT).map((key) => [
          key,
          (FULL_USER_ROW as Record<string, unknown>)[key],
        ]),
      );
      expect(findForbiddenKeys({ student: { user: publicRow } })).toEqual([]);
    });
  });

  describe('services that embed a user row', () => {
    let prisma: {
      student: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
      teacher: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
      user: { findFirst: ReturnType<typeof vi.fn> };
      employee: { findFirst: ReturnType<typeof vi.fn> };
      lead: { findFirst: ReturnType<typeof vi.fn> };
      $transaction: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      vi.clearAllMocks();
      prisma = {
        student: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({}),
        },
        teacher: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({}),
        },
        user: { findFirst: vi.fn().mockResolvedValue(null) },
        employee: { findFirst: vi.fn().mockResolvedValue({ id: 'e1' }) },
        lead: { findFirst: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn(),
      };
    });

    it('students.create/update never request a raw user row', async () => {
      const svc = new StudentsService(prisma as unknown as PrismaService);

      await svc.create('org-1', { firstName: 'Ali', lastName: 'Valiyev' });
      expect(findUnsafeUserIncludes(prisma.student.create.mock.calls)).toEqual([]);

      prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1' });
      await svc.update('org-1', 's1', { firstName: 'Ali' });
      expect(findUnsafeUserIncludes(prisma.student.update.mock.calls)).toEqual([]);
    });

    it('teachers.create/update never request a raw user row', async () => {
      const svc = new TeachersService(prisma as unknown as PrismaService);

      await svc.create('org-1', { firstName: 'Vali', lastName: 'Karimov', password: 'secret123' });
      expect(findUnsafeUserIncludes(prisma.teacher.create.mock.calls)).toEqual([]);

      prisma.teacher.findFirst.mockResolvedValue({ id: 't1', organizationId: 'org-1' });
      await svc.update('org-1', 't1', { firstName: 'Vali' });
      expect(findUnsafeUserIncludes(prisma.teacher.update.mock.calls)).toEqual([]);
    });

    it('leads.convert never requests a raw user row', async () => {
      prisma.lead.findFirst.mockResolvedValue({
        id: 'l1',
        stage: 'NEW',
        firstName: 'Ali',
        lastName: 'Valiyev',
        email: 'lead@example.com',
        phone: null,
      });
      const created = { id: 's1', user: {} };
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          student: { create: vi.fn().mockResolvedValue(created) },
          lead: { update: vi.fn().mockResolvedValue({}) },
        }),
      );

      const svc = new LeadsService(prisma as unknown as PrismaService);
      await svc.convert('org-1', 'l1', {});

      const txArg = prisma.$transaction.mock.calls[0][0];
      expect(typeof txArg).toBe('function');
      // The real assertion: the transaction body must not ask for `user: true`.
      // We re-run it against a recording stub and inspect the query.
      const studentCreate = vi.fn().mockResolvedValue(created);
      await txArg({
        student: { create: studentCreate },
        lead: { update: vi.fn().mockResolvedValue({}) },
      });
      expect(findUnsafeUserIncludes(studentCreate.mock.calls)).toEqual([]);
    });

    it('hr.findEmployeeById never requests a raw user row', async () => {
      const svc = new HremployeeService(prisma as unknown as PrismaService);
      await svc.findEmployeeById('org-1', 'e1');
      expect(findUnsafeUserIncludes(prisma.employee.findFirst.mock.calls)).toEqual([]);
    });
  });
});
