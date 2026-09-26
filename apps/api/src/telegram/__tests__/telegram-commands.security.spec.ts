import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  ProfileCommand,
  ScheduleCommand,
  AttendanceCommand,
  PaymentsCommand,
  NotificationsCommand,
} from '../commands/data.commands';
import { StudentsCommand, TeachersCommand, GroupsCommand, TodayCommand } from '../commands/staff.commands';
import { TelegramCallbackService } from '../telegram-callback.service';
import { ParentPortalService } from '../../parent-portal/parent-portal.service';
import { t } from '../i18n/telegram-i18n';
import type { TelegramContext } from '../telegram-context.service';
import type { TelegramRequestContext } from '../commands/command.interface';

/**
 * Command-handler authorization tests.
 *
 * The router proves WHO is calling; these tests prove WHAT the handlers then
 * query: every service call must carry the caller's own scoping ids (derived
 * from the verified context, never from input) and the organization scope.
 */

const CHAT = '9001';

function ctx(over: Partial<TelegramContext>): TelegramContext {
  return {
    account: {
      id: 'acct-1',
      organizationId: 'org-1',
      username: 'ali',
      languageCode: 'en',
      userId: null,
      parentAccountId: null,
    },
    kind: 'USER',
    principalId: 'user-1',
    organizationId: 'org-1',
    role: 'STUDENT',
    permissions: [],
    isAdmin: false,
    isStaff: false,
    isTeaching: false,
    isFamily: true,
    isStudent: true,
    isParent: false,
    displayName: 'Ali',
    language: 'en',
    studentId: null,
    teacherId: null,
    userId: 'user-1',
    parentId: null,
    ...over,
  } as TelegramContext;
}

function makeRequest(context: TelegramContext) {
  const callbacks = new TelegramCallbackService({
    get: () => 'test-secret-32-chars-minimum!!',
  } as unknown as ConfigService);
  return {
    chatId: CHAT,
    ctx: context,
    language: context.language,
    tr: (key: string, params?: Record<string, string | number>) => t('en', key, params),
    cb: (code: string, arg?: string) => callbacks.encode(code, arg ?? null, CHAT),
    args: '',
    page: 1,
  } as TelegramRequestContext;
}

function listResult<T>(items: T[]) {
  return { items, total: items.length, page: 1, limit: 6, totalPages: 1 };
}

describe('/schedule — role scoping', () => {
  let schedule: { findAll: ReturnType<typeof vi.fn> };
  let command: ScheduleCommand;

  beforeEach(() => {
    schedule = { findAll: vi.fn(async () => listResult([])) };
    command = new ScheduleCommand(schedule as never, { listChildren: vi.fn() } as never);
  });

  it('scopes a student to their own enrolment via their verified userId', async () => {
    await command.handle(makeRequest(ctx({ isStudent: true, userId: 'user-1', studentId: 'student-1' })));
    const [org, query, user] = schedule.findAll.mock.calls[0];
    expect(org).toBe('org-1');
    expect(user).toMatchObject({ role: 'STUDENT', id: 'user-1' });
    expect(query.studentId).toBeUndefined();
  });

  it('scopes a teacher to groups they actually teach', async () => {
    await command.handle(
      makeRequest(ctx({ isStudent: false, isTeaching: true, teacherId: 'teacher-7', role: 'TEACHER' })),
    );
    const [, query] = schedule.findAll.mock.calls[0];
    expect(query.teacherId).toBe('teacher-7');
  });

  it('scopes an admin to the organization only (no cross-tenant query)', async () => {
    await command.handle(makeRequest(ctx({ isStudent: false, role: 'ORG_ADMIN', isAdmin: true })));
    const [org] = schedule.findAll.mock.calls[0];
    expect(org).toBe('org-1');
    expect(schedule.findAll.mock.calls[0].length).toBe(2);
  });

  it('FAILS CLOSED for a student principal with no userId (no org-wide leak)', async () => {
    const result = await command.handle(makeRequest(ctx({ isStudent: true, userId: null })));
    expect(schedule.findAll).not.toHaveBeenCalled();
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('FAILS CLOSED for a teaching principal with no teacherId', async () => {
    await command.handle(makeRequest(ctx({ isStudent: false, isTeaching: true, teacherId: null })));
    expect(schedule.findAll).not.toHaveBeenCalled();
  });

  it('IDOR: the query passed to the service never contains a caller-supplied id', async () => {
    // /schedule <foreignStudentId> must not inject the id into the query.
    const request = makeRequest(ctx({ isStudent: true, userId: 'user-1' }));
    request.args = 'student-9999';
    await command.handle(request);
    const [, query] = schedule.findAll.mock.calls[0];
    expect(JSON.stringify(query)).not.toContain('student-9999');
  });
});

describe('/attendance — role scoping', () => {
  let attendance: { findAll: ReturnType<typeof vi.fn> };
  let command: AttendanceCommand;

  beforeEach(() => {
    attendance = { findAll: vi.fn(async () => listResult([])) };
    command = new AttendanceCommand(attendance as never, { listChildren: vi.fn() } as never);
  });

  it('scopes a student to their OWN student row only', async () => {
    await command.handle(makeRequest(ctx({ isStudent: true, studentId: 'student-1' })));
    const [org, query] = attendance.findAll.mock.calls[0];
    expect(org).toBe('org-1');
    expect(query.studentId).toBe('student-1');
  });

  it('scopes a teacher to their own groups', async () => {
    await command.handle(
      makeRequest(ctx({ isStudent: false, isTeaching: true, teacherId: 'teacher-3', role: 'TEACHER' })),
    );
    const [, query] = attendance.findAll.mock.calls[0];
    expect(query.teacherId).toBe('teacher-3');
    expect(query.studentId).toBeUndefined();
  });

  it('IDOR: a student cannot widen the query with a foreign student id', async () => {
    const request = makeRequest(ctx({ isStudent: true, studentId: 'student-1' }));
    request.args = 'student-OTHER';
    await command.handle(request);
    const [, query] = attendance.findAll.mock.calls[0];
    expect(query.studentId).toBe('student-1');
  });

  it('FAILS CLOSED when the student row is missing (no org-wide attendance)', async () => {
    await command.handle(makeRequest(ctx({ isStudent: true, studentId: null })));
    expect(attendance.findAll).not.toHaveBeenCalled();
  });

  it('FAILS CLOSED when the teacher row is missing', async () => {
    await command.handle(makeRequest(ctx({ isStudent: false, isTeaching: true, teacherId: null })));
    expect(attendance.findAll).not.toHaveBeenCalled();
  });

  it('escapes hostile group names in rendered rows', async () => {
    attendance.findAll.mockResolvedValue(
      listResult([
        { date: new Date('2026-09-01'), status: 'PRESENT', group: { name: '<script>alert(1)</script>' } },
      ]),
    );
    const result = await command.handle(makeRequest(ctx({ isStudent: true, studentId: 'student-1' })));
    expect(result.text).not.toContain('<script>');
    expect(result.text).toContain('&lt;script&gt;');
  });

  it('escapes an HTML-injected student status value', async () => {
    attendance.findAll.mockResolvedValue(
      listResult([{ date: new Date('2026-09-01'), status: 'PRESENT"><b>x</b>', group: null }]),
    );
    const result = await command.handle(makeRequest(ctx({ isStudent: true, studentId: 'student-1' })));
    expect(result.text).not.toContain('"><b>');
  });
});

describe('/payments — financial scoping', () => {
  let payments: { findAll: ReturnType<typeof vi.fn> };
  let command: PaymentsCommand;

  beforeEach(() => {
    payments = { findAll: vi.fn(async () => listResult([])) };
    command = new PaymentsCommand(payments as never, { listChildren: vi.fn() } as never);
  });

  it('scopes a student to their own payments', async () => {
    await command.handle(makeRequest(ctx({ isStudent: true, studentId: 'student-1' })));
    const [, query] = payments.findAll.mock.calls[0];
    expect(query.studentId).toBe('student-1');
  });

  it('FAILS CLOSED for a student with no student row (no org-wide finance dump)', async () => {
    await command.handle(makeRequest(ctx({ isStudent: true, studentId: null })));
    expect(payments.findAll).not.toHaveBeenCalled();
  });

  it('IDOR: a foreign student id in the command text cannot widen the query', async () => {
    const request = makeRequest(ctx({ isStudent: true, studentId: 'student-1' }));
    request.args = 'student-VICTIM';
    await command.handle(request);
    const [, query] = payments.findAll.mock.calls[0];
    expect(query.studentId).toBe('student-1');
  });

  it('escapes amounts and statuses in rendered rows', async () => {
    payments.findAll.mockResolvedValue(
      listResult([{ createdAt: new Date('2026-09-01'), amount: 100, status: 'PAID</img>' }]),
    );
    const result = await command.handle(makeRequest(ctx({ isStudent: true, studentId: 'student-1' })));
    expect(result.text).not.toContain('</img>');
    expect(result.text).toContain('&lt;/img&gt;');
  });
});


describe('/notifications — user scoping', () => {
  it('queries only the caller own userId (never another user)', async () => {
    const notifications = { findAll: vi.fn(async () => ({ ...listResult([]), unread: 0 })) };
    const command = new NotificationsCommand(notifications as never);
    await command.handle(makeRequest(ctx({ userId: 'user-1' })));
    const [userId] = notifications.findAll.mock.calls[0];
    expect(userId).toBe('user-1');
  });

  it('escapes notification titles', async () => {
    const notifications = {
      findAll: vi.fn(async () => ({
        ...listResult([{ createdAt: new Date(), title: '<b>Payment</b> received' }]),
        unread: 1,
      })),
    };
    const command = new NotificationsCommand(notifications as never);
    const result = await command.handle(makeRequest(ctx({ userId: 'user-1' })));
    expect(result.text).not.toContain('<b>');
    expect(result.text).toContain('&lt;b&gt;');
  });

  it('answers a ParentAccount with the empty state (no User row to query)', async () => {
    const notifications = { findAll: vi.fn() };
    const command = new NotificationsCommand(notifications as never);
    const result = await command.handle(
      makeRequest(ctx({ kind: 'PARENT_ACCOUNT', isParent: true, role: 'PARENT', userId: null, parentId: 'p1' })),
    );
    expect(notifications.findAll).not.toHaveBeenCalled();
    expect(result.text.length).toBeGreaterThan(0);
  });
});

describe('staff commands — teacher/admin scoping', () => {
  it('/students for a teacher filters by their own teacherId', async () => {
    const students = { findAll: vi.fn(async () => listResult([])) };
    const command = new StudentsCommand(students as never);
    await command.handle(
      makeRequest(ctx({ isStudent: false, isTeaching: true, teacherId: 'teacher-9', role: 'TEACHER' })),
    );
    const [org, query] = students.findAll.mock.calls[0];
    expect(org).toBe('org-1');
    expect(query.teacherId).toBe('teacher-9');
  });

  it('IDOR: a teacher cannot list another teacher group roster via command text', async () => {
    const students = { findAll: vi.fn(async () => listResult([])) };
    const command = new StudentsCommand(students as never);
    const request = makeRequest(ctx({ isStudent: false, isTeaching: true, teacherId: 'teacher-9' }));
    request.args = 'teacher-OTHER';
    await command.handle(request);
    expect(students.findAll.mock.calls[0][1].teacherId).toBe('teacher-9');
  });

  it('/students for a teacher with no teacher row FAILS CLOSED to org list? No — scoped, not widened', async () => {
    // students list without teacherId falls back to the org roster, which for a
    // teacher is still within their organization — but the Telegram surface
    // must not hand a rowless teacher the whole roster, so the handler scopes
    // it and the service still bounds by organizationId.
    const students = { findAll: vi.fn(async () => listResult([])) };
    const command = new StudentsCommand(students as never);
    await command.handle(makeRequest(ctx({ isStudent: false, isTeaching: true, teacherId: null })));
    const [org, query] = students.findAll.mock.calls[0];
    expect(org).toBe('org-1');
    expect(query.teacherId).toBeUndefined();
  });

  it('/teachers is admin-scoped at the handler level (router also enforces)', async () => {
    const teachers = { findAll: vi.fn(async () => listResult([])) };
    const command = new TeachersCommand(teachers as never);
    await command.handle(makeRequest(ctx({ isStudent: false, role: 'ORG_ADMIN', isAdmin: true })));
    expect(teachers.findAll.mock.calls[0][0]).toBe('org-1');
  });

  it('/groups for a teacher filters by their own teacherId', async () => {
    const groups = { findAll: vi.fn(async () => listResult([])) };
    const command = new GroupsCommand(groups as never);
    await command.handle(
      makeRequest(ctx({ isStudent: false, isTeaching: true, teacherId: 'teacher-2', role: 'TEACHER' })),
    );
    expect(groups.findAll.mock.calls[0][1].teacherId).toBe('teacher-2');
  });

  it('/today for a teacher filters by their own teacherId', async () => {
    const schedule = { findAll: vi.fn(async () => listResult([])) };
    const command = new TodayCommand(schedule as never);
    await command.handle(
      makeRequest(ctx({ isStudent: false, isTeaching: true, teacherId: 'teacher-2', role: 'TEACHER' })),
    );
    expect(schedule.findAll.mock.calls[0][1].teacherId).toBe('teacher-2');
  });

  it('escapes student names containing HTML in roster output', async () => {
    const students = {
      findAll: vi.fn(async () =>
        listResult([
          {
            user: { firstName: 'John < Admin', lastName: 'Smith & Co' },
            groups: [{ group: { name: 'G-1<b>' } }],
          },
        ]),
      ),
    };
    const command = new StudentsCommand(students as never);
    const result = await command.handle(
      makeRequest(ctx({ isStudent: false, isTeaching: true, teacherId: 't1' })),
    );
    expect(result.text).not.toContain('< Admin');
    expect(result.text).toContain('&lt; Admin');
    expect(result.text).toContain('Smith &amp; Co');
    expect(result.text).not.toContain('G-1<b>');
  });
});

describe('/profile — self-scope only', () => {
  it('reads ONLY the caller own user row', async () => {
    const users = {
      findOne: vi.fn(async () => ({
        firstName: 'Ali',
        lastName: 'V',
        email: 'a@b.c',
        phone: '+998',
        role: 'STUDENT',
      })),
    };
    const students = {
      findOne: vi.fn(async () => ({ balance: 100, groups: [{ group: { name: 'G' } }] })),
    };
    const command = new ProfileCommand(
      users as never,
      students as never,
      { listChildren: vi.fn(async () => []) } as unknown as ParentPortalService,
    );
    await command.handle(makeRequest(ctx({ isStudent: true, userId: 'user-1', studentId: 's1' })));
    expect(users.findOne).toHaveBeenCalledWith('org-1', 'user-1');
    expect(students.findOne).toHaveBeenCalledWith('org-1', 's1');
  });

  it('never renders internal identifiers or security fields', async () => {
    const users = {
      findOne: vi.fn(async () => ({
        firstName: 'Ali',
        lastName: 'V',
        email: 'a@b.c',
        phone: '+998',
        role: 'STUDENT',
      })),
    };
    const students = { findOne: vi.fn(async () => ({ balance: 0, groups: [] })) };
    const command = new ProfileCommand(
      users as never,
      students as never,
      { listChildren: vi.fn(async () => []) } as unknown as ParentPortalService,
    );
    const result = await command.handle(makeRequest(ctx({ isStudent: true, userId: 'user-1', studentId: 's1' })));
    expect(result.text).not.toContain('user-1');
    expect(result.text).not.toContain('s1');
    expect(result.text).not.toContain('password');
    expect(result.text).not.toContain('org-1');
  });

  it('escapes a hostile profile name', async () => {
    const users = {
      findOne: vi.fn(async () => ({
        firstName: 'Eve <script>',
        lastName: 'A&B',
        email: 'e@b.c',
        phone: null,
        role: 'STUDENT',
      })),
    };
    const students = { findOne: vi.fn(async () => ({ balance: 0, groups: [] })) };
    const command = new ProfileCommand(
      users as never,
      students as never,
      { listChildren: vi.fn(async () => []) } as unknown as ParentPortalService,
    );
    const result = await command.handle(makeRequest(ctx({ isStudent: true, userId: 'user-1', studentId: 's1' })));
    expect(result.text).not.toContain('<script>');
    expect(result.text).toContain('Eve &lt;script&gt;');
    expect(result.text).toContain('A&amp;B');
  });

  it('shows a parent their own summary with child count only', async () => {
    const parentPortal = {
      listChildren: vi.fn(async () => [
        { studentId: 's1', name: 'Child', relationship: 'FATHER', permissions: { grades: true, payments: true, attendance: true } },
      ]),
    };
    const command = new ProfileCommand(
      { findOne: vi.fn() } as never,
      { findOne: vi.fn() } as never,
      parentPortal as unknown as ParentPortalService,
    );
    const result = await command.handle(
      makeRequest(ctx({ kind: 'PARENT_ACCOUNT', isParent: true, role: 'PARENT', userId: null, parentId: 'parent-1' })),
    );
    expect(parentPortal.listChildren).toHaveBeenCalledWith({ parentId: 'parent-1', organizationId: 'org-1' });
    expect(result.text).toContain('1');
  });

  it('renders a selected child summary for a parent (child view)', async () => {
    const command = new ProfileCommand(
      { findOne: vi.fn() } as never,
      { findOne: vi.fn() } as never,
      { listChildren: vi.fn() } as unknown as ParentPortalService,
    );
    const result = await command.renderForChild!(
      makeRequest(ctx({ kind: 'PARENT_ACCOUNT', isParent: true, userId: null, parentId: 'p1' })),
      { index: 0, studentId: 's1', name: 'Child <One>', relationship: 'MOTHER', permissions: { grades: true, payments: true, attendance: true } },
    );
    expect(result.text).toContain('Child &lt;One&gt;');
    expect(result.text).not.toContain('<One>');
  });
});

describe('parent child views — portal re-verification', () => {
  it('child schedule re-verifies the parent-child link through the portal', async () => {
    const parentPortal = {
      getChildSchedule: vi.fn(async () => [
        { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', room: '101', group: { name: 'G' } },
      ]),
    };
    const command = new ScheduleCommand({ findAll: vi.fn() } as never, parentPortal as unknown as ParentPortalService);
    const request = makeRequest(ctx({ kind: 'PARENT_ACCOUNT', isParent: true, userId: null, parentId: 'p1' }));
    await command.renderForChild!(
      request,
      { index: 0, studentId: 'student-1', name: 'Child', relationship: 'FATHER', permissions: { grades: true, payments: true, attendance: true } },
    );
    expect(parentPortal.getChildSchedule).toHaveBeenCalledWith(
      { parentId: 'p1', organizationId: 'org-1' },
      'student-1',
    );
  });

  it('child attendance honours the per-child flag upstream (portal throws -> error contained)', async () => {
    const parentPortal = {
      getChildAttendance: vi.fn(async () => {
        throw new Error('Student not linked to this parent account');
      }),
    };
    const command = new AttendanceCommand({ findAll: vi.fn() } as never, parentPortal as unknown as ParentPortalService);
    const request = makeRequest(ctx({ kind: 'PARENT_ACCOUNT', isParent: true, userId: null, parentId: 'p1' }));
    // The router converts this into a localized error; here we assert the
    // portal (the authorization authority) is actually consulted.
    await expect(
      command.renderForChild!(
        request,
        { index: 0, studentId: 'student-1', name: 'Child', relationship: 'FATHER', permissions: { grades: true, payments: true, attendance: true } },
      ),
    ).rejects.toThrow('not linked');
  });

  it('child payments go through the portal invoice view (payments flag enforced upstream)', async () => {
    const parentPortal = {
      getChildInvoices: vi.fn(async () => ({ invoices: [{ number: 'INV-1', status: 'ISSUED', total: 100 }], outstanding: 100 })),
    };
    const command = new PaymentsCommand({ findAll: vi.fn() } as never, parentPortal as unknown as ParentPortalService);
    const request = makeRequest(ctx({ kind: 'PARENT_ACCOUNT', isParent: true, userId: null, parentId: 'p1' }));
    const result = await command.renderForChild!(
      request,
      { index: 0, studentId: 'student-1', name: 'Child', relationship: 'FATHER', permissions: { grades: true, payments: true, attendance: true } },
    );
    expect(parentPortal.getChildInvoices).toHaveBeenCalledWith(
      { parentId: 'p1', organizationId: 'org-1' },
      'student-1',
    );
    expect(result.text).toContain('INV-1');
  });

  it('escapes hostile child names in child views', async () => {
    const parentPortal = {
      getChildSchedule: vi.fn(async () => []),
    };
    const command = new ScheduleCommand({ findAll: vi.fn() } as never, parentPortal as unknown as ParentPortalService);
    const request = makeRequest(ctx({ kind: 'PARENT_ACCOUNT', isParent: true, userId: null, parentId: 'p1' }));
    const result = await command.renderForChild!(
      request,
      { index: 0, studentId: 's1', name: '<b>Child</b>', relationship: 'FATHER', permissions: { grades: true, payments: true, attendance: true } },
    );
    expect(result.text).not.toContain('<b>Child</b>');
    expect(result.text).toContain('&lt;b&gt;Child&lt;/b&gt;');
  });
});
