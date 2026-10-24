import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeacherCockpitCommand } from '../commands/teacher-cockpit.command';
import { PrismaService } from '../../prisma/prisma.service';
import type { TelegramRequestContext } from '../commands/command.interface';
import type { TelegramContext } from '../telegram-context.service';

describe('TeacherCockpitCommand', () => {
  let prisma: {
    teacher: { findFirst: ReturnType<typeof vi.fn> };
    schedule: { findMany: ReturnType<typeof vi.fn> };
  };
  let command: TeacherCockpitCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      teacher: { findFirst: vi.fn() },
      schedule: { findMany: vi.fn() },
    };
    command = new TeacherCockpitCommand(prisma as unknown as PrismaService);
  });

  function makeRequest(overrides?: Partial<TelegramContext>): TelegramRequestContext {
    const ctx: TelegramContext = {
      account: {
        id: 'acct-1',
        organizationId: 'org-1',
        username: 'teacher1',
        languageCode: 'uz',
        userId: 'user-teacher-1',
        parentAccountId: null,
      },
      kind: 'USER',
      principalId: 'user-teacher-1',
      organizationId: 'org-1',
      role: 'TEACHER',
      permissions: [],
      isAdmin: false,
      isStaff: true,
      isTeaching: true,
      isFamily: false,
      isStudent: false,
      isParent: false,
      displayName: 'Aziz Oqituvchi',
      language: 'uz',
      timezone: 'Asia/Tashkent',
      studentId: null,
      teacherId: 'teacher-uuid-1',
      userId: 'user-teacher-1',
      parentId: null,
      ...overrides,
    };

    return {
      chatId: '9001',
      ctx,
      language: 'uz',
      tr: (key: string) => key,
      cb: (code: string, arg?: string) => (arg ? `${code}:${arg}` : code),
      args: '',
      page: 1,
    };
  }

  it('rejects principals that are not USER kind', async () => {
    const req = makeRequest({ kind: 'PARENT_ACCOUNT' as any });
    const reply = await command.handle(req);
    expect(reply.text).toContain('o\'qituvchi sifatida kirilgan bo\'lishi shart');
  });

  it('rejects user without registered teacher profile', async () => {
    prisma.teacher.findFirst.mockResolvedValue(null);
    const req = makeRequest();
    const reply = await command.handle(req);
    expect(reply.text).toContain('o\'qituvchi sifatida ro\'yxatdan o\'tmagan');
  });

  it('renders empty schedule with valid router callbacks (cmd:schedule, cmd:groups, mm)', async () => {
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-uuid-1' });
    prisma.schedule.findMany.mockResolvedValue([]);

    const req = makeRequest();
    const reply = await command.handle(req);

    expect(reply.text).toContain('rejalashtirilgan darslar yo\'q');
    expect(reply.keyboard).toBeDefined();

    const inlineKeys = reply.keyboard?.inline_keyboard?.flat() || [];
    const callbackDataList = inlineKeys.map((btn) => btn.callback_data);

    // Verify all callbacks are valid router codes (cmd:schedule, cmd:groups, mm)
    expect(callbackDataList).toContain('cmd:schedule');
    expect(callbackDataList).toContain('cmd:groups');
    expect(callbackDataList).toContain('mm');
    // Ensure broken legacy codes csc/cat are NOT present
    expect(callbackDataList).not.toContain('csc');
    expect(callbackDataList).not.toContain('cat');
  });

  it('renders today schedules with valid group attendance and schedule callback buttons', async () => {
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-uuid-1' });
    prisma.schedule.findMany.mockResolvedValue([
      {
        id: 'sch-1',
        startTime: '09:00',
        endTime: '10:30',
        room: 'Xona-101',
        group: {
          id: 'grp-uuid-1',
          name: 'Frontend React 101',
          course: { name: 'Frontend Web' },
          _count: { enrollments: 16 },
        },
      },
    ]);

    const req = makeRequest();
    const reply = await command.handle(req);

    expect(reply.text).toContain('<b>1. Frontend Web</b> (Frontend React 101)');
    expect(reply.text).toContain('09:00 — 10:30');
    expect(reply.text).toContain('16 nafar');

    const inlineKeys = reply.keyboard?.inline_keyboard?.flat() || [];
    const callbackDataList = inlineKeys.map((btn) => btn.callback_data);

    expect(callbackDataList).toContain('cmd:attendance');
    expect(callbackDataList).toContain('cmd:groups');
    expect(callbackDataList).toContain('cmd:cockpit');
    expect(callbackDataList).toContain('cmd:schedule');
    expect(callbackDataList).toContain('mm');

    // Ensure broken callback codes are NOT present
    expect(callbackDataList).not.toContain('cat:grp-uuid-1');
    expect(callbackDataList).not.toContain('tc:grp-uuid-1');
  });
});
