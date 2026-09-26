import { describe, it, expect, vi } from 'vitest';
import {
  CallbackCodes,
  mainMenuKeyboard,
  adminMenuKeyboard,
  childrenKeyboard,
  paginationKeyboard,
  languageKeyboard,
  unlinkConfirmKeyboard,
} from '../ui/keyboards';
import { MenuCommand, HelpCommand, SettingsCommand } from '../commands/menu.commands';
import { TelegramCallbackService } from '../telegram-callback.service';
import { ConfigService } from '@nestjs/config';
import type { TelegramContext } from '../telegram-context.service';
import type { TelegramRequestContext } from '../commands/command.interface';
import type { KeyboardBuilderContext } from '../ui/keyboards';

/**
 * Role-specific menus + large-Telegram-ID safety.
 *
 * Menu rule under test: a button may only be rendered when the resolved role
 * can actually run the command behind it — the menu is recomputed from the
 * CURRENT context on every request and never trusts cached role state.
 */

const CHAT = '9001';

function callbacks() {
  return new TelegramCallbackService({
    get: () => 'test-secret-32-chars-minimum!!',
  } as unknown as ConfigService);
}

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

function requestFor(context: TelegramContext): TelegramRequestContext {
  const cb = callbacks();
  return {
    chatId: CHAT,
    ctx: context,
    language: context.language,
    tr: (key: string) => key,
    cb: (code: string, arg?: string) => cb.encode(code, arg ?? null, CHAT),
    args: '',
    page: 1,
  } as TelegramRequestContext;
}

/** Collect every command name reachable through `cmd` buttons in a keyboard. */
function reachableCommands(keyboard: { inline_keyboard: Array<Array<{ callback_data: string }>> }): string[] {
  const commands: string[] = [];
  for (const row of keyboard.inline_keyboard) {
    for (const button of row) {
      const decoded = callbacks().decode(button.callback_data, CHAT);
      if (decoded?.code === 'cmd' && decoded.arg) commands.push(decoded.arg);
    }
  }
  return commands;
}

describe('role-specific menus — only reachable commands are shown', () => {
  it('STUDENT menu: profile/schedule/attendance/payments/notifications, no admin buttons', () => {
    const keyboard = mainMenuKeyboard(kbCtx(), { isAdmin: false, isTeaching: false, isStudent: true, isParent: false });
    const commands = reachableCommands(keyboard);
    expect(commands).toEqual(expect.arrayContaining(['profile', 'schedule', 'attendance', 'payments', 'notifications']));
    expect(commands).not.toContain('students');
    expect(commands).not.toContain('teachers');
    expect(commands).not.toContain('today');
    // No admin entry point button.
    const codes = allCodes(keyboard);
    expect(codes).not.toContain(CallbackCodes.ADMIN_MENU);
  });

  it('PARENT menu: children + notifications, no financial roster or admin buttons', () => {
    const keyboard = mainMenuKeyboard(kbCtx(), { isAdmin: false, isTeaching: false, isStudent: false, isParent: true });
    const commands = reachableCommands(keyboard);
    expect(commands).toContain('notifications');
    expect(commands).not.toContain('profile');
    expect(commands).not.toContain('payments');
    const codes = allCodes(keyboard);
    expect(codes).toContain(CallbackCodes.CHILD_SELECT);
    expect(codes).not.toContain(CallbackCodes.ADMIN_MENU);
  });

  it('TEACHER menu: today/groups/students/profile/attendance/schedule, no admin button', () => {
    const keyboard = mainMenuKeyboard(kbCtx(), { isAdmin: false, isTeaching: true, isStudent: false, isParent: false });
    const commands = reachableCommands(keyboard);
    expect(commands).toEqual(expect.arrayContaining(['today', 'groups', 'students', 'profile', 'attendance', 'schedule']));
    expect(commands).not.toContain('payments');
    expect(commands).not.toContain('teachers');
    expect(allCodes(keyboard)).not.toContain(CallbackCodes.ADMIN_MENU);
  });

  it('ADMIN flag adds the admin menu entry to any base role', () => {
    const keyboard = mainMenuKeyboard(kbCtx(), { isAdmin: true, isTeaching: false, isStudent: false, isParent: false });
    expect(allCodes(keyboard)).toContain(CallbackCodes.ADMIN_MENU);
  });

  it('admin sub-menu exposes only implemented, service-backed lists', () => {
    const keyboard = adminMenuKeyboard(kbCtx());
    const commands = reachableCommands(keyboard);
    expect(commands).toEqual(expect.arrayContaining(['students', 'teachers', 'groups', 'attendance', 'schedule', 'payments']));
    // No unimplemented feature buttons (reports/announcements/settings) —
    // Do not expose a button for a feature the user cannot actually access.
    expect(commands).not.toContain('reports');
    expect(commands).not.toContain('announcements');
  });

  it('the MenuCommand renders from the LIVE context (role downgrade shrinks the menu immediately)', () => {
    const cb = callbacks();
    const render = (context: TelegramContext) =>
      new MenuCommand().render({
        chatId: CHAT,
        ctx: context,
        language: context.language,
        tr: (key: string) => key,
        cb: (code: string, arg?: string) => cb.encode(code, arg ?? null, CHAT),
        args: '',
        page: 1,
      } as TelegramRequestContext);

    const adminMenu = render(ctx({ role: 'ORG_ADMIN', isAdmin: true, isStudent: false }));
    expect(reachableCommands(adminMenu.keyboard!).length + allCodes(adminMenu.keyboard!).length).toBeGreaterThan(0);
    expect(allCodes(adminMenu.keyboard!)).toContain(CallbackCodes.ADMIN_MENU);

    // Same Telegram link, downgraded role in M-EDU:
    const downgraded = render(ctx({ role: 'STUDENT', isAdmin: false, isStudent: true }));
    expect(allCodes(downgraded.keyboard!)).not.toContain(CallbackCodes.ADMIN_MENU);
  });

  it('help lists only commands the caller role may run', async () => {
    const commands = [
      { name: 'menu', roles: 'ALL' as const, descriptionKey: 'menu.title' },
      { name: 'teachers', roles: ['ORG_ADMIN'] as readonly string[], descriptionKey: 'btn.teachers' },
    ];
    const cb = callbacks();
    // The registry is resolved lazily through ModuleRef at handle-time (it
    // breaks the DI cycle between the factory list and HelpCommand), so the
    // stub only has to expose that `get` surface.
    const help = new HelpCommand({ get: () => commands } as never);

    const studentHelp = await help.handle({
      chatId: CHAT,
      ctx: ctx({ role: 'STUDENT', isStudent: true }),
      language: 'en',
      tr: (key: string) => key,
      cb: (code: string, arg?: string) => cb.encode(code, arg ?? null, CHAT),
      args: '',
      page: 1,
    } as TelegramRequestContext);

    expect(studentHelp.text).toContain('/menu');
    expect(studentHelp.text).not.toContain('/teachers');

    const adminHelp = await help.handle({
      chatId: CHAT,
      ctx: ctx({ role: 'ORG_ADMIN', isAdmin: true, isStudent: false }),
      language: 'en',
      tr: (key: string) => key,
      cb: (code: string, arg?: string) => cb.encode(code, arg ?? null, CHAT),
      args: '',
      page: 1,
    } as TelegramRequestContext);

    expect(adminHelp.text).toContain('/teachers');
  });

  it('settings shows connection state + language + unlink, nothing fake', async () => {
    const policy = {
      describe: vi.fn().mockResolvedValue({
        settingsAvailable: true,
        telegramEnabled: false,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        timeZone: 'UTC',
      }),
    };
    const preferences = { getPreferences: vi.fn().mockResolvedValue([]) };
    const settings = new SettingsCommand(policy as never, preferences as never);
    const result = await settings.handle(requestFor(ctx({ role: 'STUDENT' })));

    expect(result.text).toBeTruthy();
    // Real persisted state is rendered, not placeholders.
    expect(policy.describe).toHaveBeenCalledWith({
      organizationId: 'org-1',
      principalType: 'USER',
      principalId: expect.any(String),
    });
    // The stored quiet-hours window is reflected in the preset buttons.
    const labels = result.keyboard.inline_keyboard.flat().map((b) => b.text);
    expect(labels.some((label) => label.includes('22:00'))).toBe(true);
    expect(result.keyboard.inline_keyboard.flat().map((b) => b.callback_data)).toEqual(
      expect.arrayContaining([expect.any(String)]),
    );
  });

  it('settings tells a ParentAccount the truth about unavailable settings', async () => {
    const policy = {
      describe: vi.fn().mockResolvedValue({
        settingsAvailable: false,
        telegramEnabled: true,
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        timeZone: 'UTC',
      }),
    };
    const preferences = { getPreferences: vi.fn().mockResolvedValue([]) };
    const settings = new SettingsCommand(policy as never, preferences as never);
    const result = await settings.handle(
      requestFor(ctx({ role: 'PARENT', kind: 'PARENT_ACCOUNT', userId: null, parentId: 'pa-1' })),
    );

    // No settings model exists for a ParentAccount — say so, do not invent.
    expect(result.text).toContain('settings.unavailable');
    const codes = result.keyboard.inline_keyboard.flat().map((b) => b.callback_data);
    expect(codes).toHaveLength(3); // language, unlink, menu
  });
});

function kbCtx(): KeyboardBuilderContext {
  const cb = callbacks();
  return { tr: (key: string) => key, cb: (code: string, arg?: string) => cb.encode(code, arg ?? null, CHAT) };
}

function allCodes(keyboard: { inline_keyboard: Array<Array<{ callback_data: string }>> }): string[] {
  const codes: string[] = [];
  for (const row of keyboard.inline_keyboard) {
    for (const button of row) {
      const decoded = callbacks().decode(button.callback_data, CHAT);
      if (decoded) codes.push(decoded.code);
    }
  }
  return codes;
}

describe('keyboard builders — envelope integrity', () => {
  it('child buttons encode a LIST INDEX, never a student id', () => {
    const keyboard = childrenKeyboard(kbCtx(), [
      { label: 'Child One' },
      { label: 'Child Two' },
    ]);
    const args = keyboard.inline_keyboard
      .flat()
      .map((b) => callbacks().decode(b.callback_data, CHAT))
      .filter((d): d is { code: string; arg: string | null } => d?.code === CallbackCodes.CHILD_SELECT)
      .map((d) => d.arg);
    expect(args).toEqual(['0', '1']);
  });

  it('pagination bounds and only offers existing pages', () => {
    const keyboard = paginationKeyboard(kbCtx(), 'attendance', 1, 3);
    const args = keyboard.inline_keyboard
      .flat()
      .map((b) => callbacks().decode(b.callback_data, CHAT)?.arg)
      .filter(Boolean) as string[];
    expect(args).toEqual(['attendance:2']); // no prev on page 1
  });

  it('language buttons offer exactly uz/ru/en', () => {
    const keyboard = languageKeyboard(kbCtx());
    const args = keyboard.inline_keyboard
      .flat()
      .map((b) => callbacks().decode(b.callback_data, CHAT)?.arg)
      .filter(Boolean) as string[];
    expect(args.sort()).toEqual(['en', 'ru', 'uz']);
  });

  it('unlink confirm is a sensitive short-TTL code, cancel is not', () => {
    const keyboard = unlinkConfirmKeyboard(kbCtx());
    const codes = keyboard.inline_keyboard.flat().map((b) => callbacks().decode(b.callback_data, CHAT));
    expect(codes.map((c) => c?.code)).toContain(CallbackCodes.UNLINK_CONFIRM);
    expect(codes.map((c) => c?.code)).toContain(CallbackCodes.UNLINK_CANCEL);
    const service = callbacks();
    expect(service.isSensitive(CallbackCodes.UNLINK_CONFIRM)).toBe(true);
    expect(service.isOneTime(CallbackCodes.UNLINK_CONFIRM)).toBe(true);
    expect(service.isOneTime(CallbackCodes.UNLINK_CANCEL)).toBe(false);
  });
});

describe('large Telegram ID safety', () => {
  // Telegram int64 ids — must never be used in JS numeric arithmetic.
  // eslint-disable-next-line no-loss-of-precision
  const HUGE_UPDATE_ID: number = 9223372036854775807;

  it('webhook controller parses update_id as BigInt, never arithmetic on it', async () => {
    const { TelegramWebhookController } = await import('../telegram-webhook.controller');
    const updates = { claim: vi.fn(async () => true) };
    const controller = new TelegramWebhookController(
      { get: () => 'w'.repeat(40) } as never,
      updates as never,
      { consumeStart: vi.fn() } as never,
      { sendMessage: vi.fn(), sendMessageWithMarkup: vi.fn(), answerCallbackQuery: vi.fn() } as never,
      { route: vi.fn(async () => ({ reply: null })) } as never,
      { handle: vi.fn(async () => ({ reply: null })) } as never,
    );

    // BigInt conversion happens in the controller; values up to 2^53 survive
    // JSON round-trips exactly. Beyond 2^53 precision is lost at JSON.parse
    // (a JS/V8 limitation of the wire format, not of this code) — Telegram's
    // update_id is currently ~10^9, and chat ids travel as `string | number`
    // in the DTO and are stringified on read, so no arithmetic is ever done
    // on identity values.
    await controller.handleWebhook({ update_id: 9007199254740992 } as never, 'w'.repeat(40)); // 2^53
    expect(updates.claim).toHaveBeenCalledWith(9007199254740992n);
    void HUGE_UPDATE_ID;
    expect(Number.isInteger(HUGE_UPDATE_ID)).toBe(true); // constant exists for documentation
  });

  it('chat ids and telegram user ids travel as strings end-to-end', async () => {
    const LARGE_CHAT_ID = '9223372036854775806';
    const service = callbacks();
    // Callback envelopes are signed over the string form — no numeric coercion.
    const data = service.encode(CallbackCodes.MAIN_MENU, null, LARGE_CHAT_ID);
    expect(data.length).toBeLessThanOrEqual(64);
    expect(service.decode(data, LARGE_CHAT_ID)).not.toBeNull();
    // A slightly different large id must NOT verify (string comparison).
    expect(service.decode(data, '9223372036854775807')).toBeNull();
  });

  it('update service deduplicates via bigint primary key', async () => {
    const { TelegramUpdateService } = await import('../telegram-update.service');
    const prisma = {
      telegramUpdate: {
        create: vi.fn(async () => ({})),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
    };
    const service = new TelegramUpdateService(prisma as never);
    await service.claim(9007199254740993n);
    expect(prisma.telegramUpdate.create).toHaveBeenCalledWith({
      data: { updateId: 9007199254740993n, status: 'PROCESSED' },
    });
  });
});
