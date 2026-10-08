import { describe, expect, it, vi } from 'vitest';

import {
  canonicalMembershipWhere,
  organizationDayStart,
} from '../student-membership';
import { PrismaStudentAdapter } from '../../face/adapters/prisma-student.adapter';
import { PrismaEnrollmentAdapter } from '../../face/adapters/prisma-enrollment.adapter';

/**
 * Root-cause regression for:
 *   "Student X is not enrolled in group Y"
 *
 * The membership rule was written out inline in four places and the copies
 * had drifted: the face-session gate omitted the org-local `joinedAt`/`leftAt`
 * window, and face candidate retrieval omitted group/student state entirely.
 * The pipeline could therefore identify a student and then deny them — or
 * record attendance on one path while another path refused it.
 */
describe('canonical membership rule', () => {
  const base = {
    organizationId: 'org-1',
    studentId: 'stu-1',
    groupId: 'grp-1',
    dayStart: new Date('2026-10-06T00:00:00.000Z'),
  };

  it('encodes tenant, membership, group and student eligibility', () => {
    const where = canonicalMembershipWhere(base);

    expect(where.organizationId).toBe('org-1');
    expect(where.studentId).toBe('stu-1');
    expect(where.groupId).toBe('grp-1');
    expect(where.isActive).toBe(true);
    expect(where.group).toEqual({ isActive: true });
    expect(where.student).toEqual({
      status: { notIn: ['PAUSED', 'DROPPED'] },
    });
  });

  it('applies the org-local membership window (assigned today counts, removed yesterday does not)', () => {
    const where = canonicalMembershipWhere(base);

    expect(where.joinedAt).toEqual({
      lt: new Date('2026-10-07T00:00:00.000Z'),
    });
    expect(where.OR).toEqual([
      { leftAt: null },
      { leftAt: { gte: new Date('2026-10-06T00:00:00.000Z') } },
    ]);
  });

  it('omits ONLY the time window when dayStart is not supplied', () => {
    const where = canonicalMembershipWhere({
      organizationId: 'org-1',
      groupId: 'grp-1',
    });

    expect(where.joinedAt).toBeUndefined();
    expect(where.OR).toBeUndefined();
    // Everything else must still hold — candidate retrieval stays a superset
    // of the gate without ever becoming a different rule.
    expect(where.isActive).toBe(true);
    expect(where.group).toEqual({ isActive: true });
    expect(where.student).toEqual({
      status: { notIn: ['PAUSED', 'DROPPED'] },
    });
  });

  it('resolves the attendance day in the organization timezone', () => {
    // 2026-10-06 22:00 UTC is already 2026-10-07 in Asia/Tashkent (+05:00).
    const at = new Date('2026-10-06T22:00:00.000Z');
    expect(organizationDayStart(at, 'Asia/Tashkent')).toEqual(
      new Date('2026-10-07T00:00:00.000Z'),
    );
    expect(organizationDayStart(at, null)).toEqual(
      new Date('2026-10-06T00:00:00.000Z'),
    );
  });
});

describe('PrismaStudentAdapter.isStudentInGroup (face attendance gate)', () => {
  it('applies the FULL canonical rule including the membership window', async () => {
    const prisma: any = {
      organization: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ timezone: 'Asia/Tashkent' }),
      },
      studentGroup: { count: vi.fn().mockResolvedValue(1) },
    };

    const adapter = new PrismaStudentAdapter(prisma);
    const inGroup = await adapter.isStudentInGroup(
      'org-1',
      'stu-1',
      'grp-1',
    );

    expect(inGroup).toBe(true);
    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      select: { timezone: true },
    });

    const where = prisma.studentGroup.count.mock.calls[0][0].where;
    expect(where.organizationId).toBe('org-1');
    expect(where.studentId).toBe('stu-1');
    expect(where.groupId).toBe('grp-1');
    expect(where.isActive).toBe(true);
    expect(where.group).toEqual({ isActive: true });
    expect(where.student).toEqual({
      status: { notIn: ['PAUSED', 'DROPPED'] },
    });
    // The regression: the window used to be missing here.
    expect(where.joinedAt).toBeDefined();
    expect(where.OR).toBeDefined();
  });
});

describe('PrismaEnrollmentAdapter.streamActiveTemplates (face candidate retrieval)', () => {
  it('uses the SAME membership predicate when a group is supplied', async () => {
    const prisma: any = {
      faceTemplate: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const adapter = new PrismaEnrollmentAdapter(prisma);
    for await (const _ of adapter.streamActiveTemplates('org-1', 100, 'grp-1')) {
      // drain
    }

    const where = prisma.faceTemplate.findMany.mock.calls[0][0].where;
    const some = where.student.groups.some;

    expect(some.organizationId).toBe('org-1');
    expect(some.groupId).toBe('grp-1');
    expect(some.isActive).toBe(true);
    expect(some.group).toEqual({ isActive: true });
    expect(some.student).toEqual({
      status: { notIn: ['PAUSED', 'DROPPED'] },
    });
  });
});
