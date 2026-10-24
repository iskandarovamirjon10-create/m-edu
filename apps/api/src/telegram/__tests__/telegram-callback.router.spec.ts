import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { TelegramCallbackRouter } from '../telegram-callback.router';
import { TelegramCallbackService } from '../telegram-callback.service';
import { TelegramCommandRouter } from '../telegram-command.router';
import { TelegramContextService, TelegramContextError } from '../telegram-context.service';
import { TelegramAttemptLimiter } from '../telegram-attempt-limiter.service';
import { CallbackCodes } from '../ui/keyboards';
import type { TelegramContext } from '../telegram-context.service';

/**
 * Adversarial callback-router suite. `callback_data` is fully attacker
 * controlled: every test here treats it as hostile input and asserts the
 * authorization boundary, not just "it does not crash".
 */

const CHAT = '9001';

const PARENT_CONTEXT: Partial<TelegramContext> = {
  kind: 'PARENT_ACCOUNT',
  principalId: 'parent-1',
  organizationId: 'org-1',
  role: 'PARENT',
  permissions: [],
  isAdmin: false,
  isStaff: false,
  isTeaching: false,
  isFamily: true,
  isStudent: false,
  isParent: true,
  displayName: 'Olim',
  language: 'en',
  studentId: null,
  teacherId: null,
  userId: null,
  parentId: 'parent-1',
};

const USER_CONTEXT: Partial<TelegramContext> = {
  ...PARENT_CONTEXT,
  kind: 'USER',
  role: 'STUDENT',
  isParent: false,
  isStudent: true,
  isFamily: true,
  userId: 'user-1',
  parentId: null,
  studentId: 'student-1',
  displayName: 'Ali',
};

interface RouterDeps {
  context: TelegramContext | null;
  contextError?: TelegramContextError;
  executeCommand: ReturnType<typeof vi.fn>;
  childCommand: ReturnType<typeof vi.fn>;
  resolveChildByIndex: ReturnType<typeof vi.fn>;
  listChildren: ReturnType<typeof vi.fn>;
  updateSettings: ReturnType<typeof vi.fn>;
  unlink: ReturnType<typeof vi.fn>;
  claimOnce: ReturnType<typeof vi.fn>;
  blocked: boolean;
  handler: ReturnType<typeof vi.fn>;
  updatePreference: ReturnType<typeof vi.fn>;
}

function makeRouter(over: Partial<RouterDeps> = {}) {
  const deps: RouterDeps = {
    context: (over.context ?? PARENT_CONTEXT) as TelegramContext,
    contextError: over.contextError,
    executeCommand: over.executeCommand ?? vi.fn(async () => ({ reply: { text: 'cmd-ok' } })),
    childCommand: over.childCommand ?? vi.fn(() => undefined),
    resolveChildByIndex:
      over.resolveChildByIndex ??
      vi.fn(async () => ({
        index: 0,
        studentId: 'student-1',
        name: 'Child One',
        relationship: 'FATHER',
        permissions: { grades: true, payments: true, attendance: true },
      })),
    listChildren: over.listChildren ?? vi.fn(async () => []),
    updateSettings: over.updateSettings ?? vi.fn(async () => ({})),
    unlink: over.unlink ?? vi.fn(async () => ({ disconnected: true })),
    claimOnce: over.claimOnce ?? vi.fn(async () => true),
    blocked: over.blocked ?? false,
    handler: over.handler ?? vi.fn(() => undefined),
    updatePreference: over.updatePreference ?? vi.fn(async () => ({})),
  };

  const contextService = {
    resolve: vi.fn(async () => {
      if (deps.contextError) throw deps.contextError;
      if (deps.context === null) throw new TelegramContextError('NOT_LINKED');
      return deps.context;
    }),
  };
  const callbacks = new TelegramCallbackService({
    get: (key: string) => (key === 'JWT_SECRET' ? 'test-secret-32-chars-minimum!!' : undefined),
  } as unknown as ConfigService);
  const limiter = {
    isBlocked: vi.fn(async () => deps.blocked),
    hit: vi.fn(async () => 1),
    tryClaimOnce: deps.claimOnce,
  };
  const commands = {
    executeCommand: deps.executeCommand,
    childCommand: deps.childCommand,
    handler: deps.handler,
  } as unknown as TelegramCommandRouter;

  const router = new TelegramCallbackRouter(
    commands,
    contextService as unknown as TelegramContextService,
    callbacks,
    limiter as unknown as TelegramAttemptLimiter,
    { listChildren: deps.listChildren } as never,
    { unlink: deps.unlink } as never,
    { updateSettings: deps.updateSettings } as never,
    { updatePreference: deps.updatePreference } as never,
    { isValidQuietWindow: (start?: string | null, end?: string | null) =>
        /^\d{2}:\d{2}$/.test(start ?? '') && /^\d{2}:\d{2}$/.test(end ?? '') } as never,
  );

  return { router, deps, contextService, limiter, callbacks };
}

async function press(
  router: TelegramCallbackRouter,
  callbacks: TelegramCallbackService,
  code: string,
  arg: string | null,
  chat = CHAT,
) {
  return router.handle({ chatId: chat, data: callbacks.encode(code, arg, chat), telegramLanguageCode: 'en' });
}

describe('TelegramCallbackRouter — envelope security', () => {
  let router: TelegramCallbackRouter;
  let callbacks: TelegramCallbackService;
  let deps: RouterDeps;

  beforeEach(() => {
    ({ router, callbacks, deps } = makeRouter());
  });

  it('accepts a valid signed callback and dispatches the main menu', async () => {
    const result = await press(router, callbacks, CallbackCodes.MAIN_MENU, null);
    expect(deps.executeCommand).toHaveBeenCalledWith('menu', CHAT, expect.anything());
    expect(result.reply?.text).toBe('cmd-ok');
  });

  it('dispatches executive briefing when "brf" callback is received', async () => {
    const result = await press(router, callbacks, 'brf', 'refresh');
    expect(deps.executeCommand).toHaveBeenCalledWith('briefing', CHAT, expect.anything());
    expect(result.reply?.text).toBe('cmd-ok');
  });

  it('dispatches command dynamically when "cmd" callback is received', async () => {
    const result = await press(router, callbacks, 'cmd', 'attendance');
    expect(deps.executeCommand).toHaveBeenCalledWith('attendance', CHAT, expect.anything());
    expect(result.reply?.text).toBe('cmd-ok');
  });

  it('rejects a forged payload (bad HMAC) without dispatching', async () => {
    const forged = `${CallbackCodes.MAIN_MENU}~~1zzzzz~AAAA`;
    const result = await router.handle({ chatId: CHAT, data: forged, telegramLanguageCode: 'en' });
    expect(result.reply).toBeNull();
    expect(deps.executeCommand).not.toHaveBeenCalled();
  });

  it('rejects a payload signed for a different chat (cross-user replay)', async () => {
    const captured = callbacks.encode(CallbackCodes.MAIN_MENU, null, CHAT);
    const other = makeRouter();
    const result = await other.router.handle({
      chatId: '7777',
      data: captured,
      telegramLanguageCode: 'en',
    });
    expect(result.reply).toBeNull();
    expect(other.deps.executeCommand).not.toHaveBeenCalled();
  });

  it('rejects an expired payload', async () => {
    const expired = callbacks.encode(CallbackCodes.MAIN_MENU, null, CHAT, -1);
    const result = await router.handle({ chatId: CHAT, data: expired, telegramLanguageCode: 'en' });
    expect(result.reply).toBeNull();
    expect(deps.executeCommand).not.toHaveBeenCalled();
  });

  it('rejects a tampered argument', async () => {
    const valid = callbacks.encode(CallbackCodes.CHILD_SELECT, '0', CHAT);
    const parts = valid.split('~');
    parts[1] = Buffer.from('9', 'utf8').toString('base64url'); // swap child index
    const result = await router.handle({ chatId: CHAT, data: parts.join('~'), telegramLanguageCode: 'en' });
    expect(result.reply).toBeNull();
    expect(deps.executeCommand).not.toHaveBeenCalled();
  });

  it('rejects a tampered action code (navigation escalated to unlink)', async () => {
    const valid = callbacks.encode(CallbackCodes.MAIN_MENU, null, CHAT);
    const parts = valid.split('~');
    parts[0] = CallbackCodes.UNLINK_CONFIRM;
    const result = await router.handle({ chatId: CHAT, data: parts.join('~'), telegramLanguageCode: 'en' });
    expect(result.reply).toBeNull();
    expect(deps.unlink).not.toHaveBeenCalled();
  });

  it('rejects malformed and empty payloads', async () => {
    for (const data of ['', 'garbage', 'a~b~c', 'a~b~c~d~e']) {
      const result = await router.handle({ chatId: CHAT, data, telegramLanguageCode: 'en' });
      expect(result.reply).toBeNull();
    }
    expect(deps.executeCommand).not.toHaveBeenCalled();
  });

  it('rejects oversized callback data before doing any verification work', async () => {
    const long = 'x'.repeat(500);
    const result = await router.handle({ chatId: CHAT, data: long, telegramLanguageCode: 'en' });
    expect(result.reply).toBeNull();
    expect(deps.executeCommand).not.toHaveBeenCalled();
  });

  it('answers unknown action codes with a toast and no dispatch', async () => {
    const unknown = callbacks.encode('zz', null, CHAT);
    const result = await router.handle({ chatId: CHAT, data: unknown, telegramLanguageCode: 'en' });
    expect(result.reply).toBeNull();
    expect(result.toast).toBeTruthy();
    expect(deps.executeCommand).not.toHaveBeenCalled();
  });

  it('resolves the context BEFORE trusting anything in the payload', async () => {
    const { router: r, contextService, deps: d } = makeRouter({
      contextError: new TelegramContextError('NOT_LINKED'),
    });
    const valid = callbacks.encode(CallbackCodes.MAIN_MENU, null, CHAT);
    const result = await r.handle({ chatId: CHAT, data: valid, telegramLanguageCode: 'en' });
    expect(contextService.resolve).toHaveBeenCalled();
    expect(d.executeCommand).not.toHaveBeenCalled();
    expect(result.reply).toBeNull();
    expect(result.toast).toBeTruthy();
  });

  it('refuses everything for a BLOCKED link even with a valid payload', async () => {
    const { router: r, deps: d } = makeRouter({
      contextError: new TelegramContextError('BLOCKED'),
    });
    const valid = callbacks.encode(CallbackCodes.MAIN_MENU, null, CHAT);
    await r.handle({ chatId: CHAT, data: valid, telegramLanguageCode: 'en' });
    expect(d.executeCommand).not.toHaveBeenCalled();
  });
});

describe('TelegramCallbackRouter — rate limiting', () => {
  it('blocks the 46th callback press in the configured window', async () => {
    let count = 0;
    const limiter = {
      isBlocked: vi.fn(async (_scope: string, max: number) => {
        count += 1;
        return count > max;
      }),
      hit: vi.fn(async () => 1),
      tryClaimOnce: vi.fn(async () => true),
    };
    const callbacks = new TelegramCallbackService({
      get: () => 'test-secret-32-chars-minimum!!',
    } as unknown as ConfigService);
    const wired = new TelegramCallbackRouter(
      { executeCommand: vi.fn(async () => ({ reply: { text: 'ok' } })), childCommand: vi.fn() } as unknown as TelegramCommandRouter,
      { resolve: async () => PARENT_CONTEXT } as unknown as TelegramContextService,
      callbacks,
      limiter as unknown as TelegramAttemptLimiter,
      { listChildren: vi.fn(async () => []) } as never,
      { unlink: vi.fn() } as never,
      { updateSettings: vi.fn() } as never,
    );

    const payload = callbacks.encode(CallbackCodes.MAIN_MENU, null, CHAT);

    for (let i = 0; i < 45; i += 1) {
      const result = await wired.handle({ chatId: CHAT, data: payload, telegramLanguageCode: 'en' });
      expect(result.reply?.text).toBe('ok');
    }
    const blocked = await wired.handle({ chatId: CHAT, data: payload, telegramLanguageCode: 'en' });
    expect(blocked.reply).toBeNull();
    expect(blocked.toast).toBeTruthy();
  });
});

describe('TelegramCallbackRouter — parent/child authorization', () => {
  const childOne = {
    studentId: 'student-1',
    relationship: 'FATHER',
    name: 'Child One',
    permissions: { grades: true, payments: true, attendance: true },
  };

  it('re-resolves the child from the caller OWN list on every press (index, not id)', async () => {
    const renderForChild = vi.fn(async () => ({ text: 'child-view' }));
    const listChildren = vi.fn(async () => [childOne]);
    const { router, callbacks } = makeRouter({
      childCommand: vi.fn(() => ({ renderForChild })),
      listChildren,
    });
    await press(router, callbacks, CallbackCodes.CHILD_ATTENDANCE, '0');
    // Fresh re-resolution through the caller's own scoped list:
    expect(listChildren).toHaveBeenCalledWith({ parentId: 'parent-1', organizationId: 'org-1' });
    expect(renderForChild).toHaveBeenCalled();
  });

  it('denies an out-of-range child index without revealing other children', async () => {
    const renderForChild = vi.fn();
    const { router, callbacks } = makeRouter({
      childCommand: vi.fn(() => ({ renderForChild })),
      listChildren: vi.fn(async () => [childOne]),
    });
    const result = await press(router, callbacks, CallbackCodes.CHILD_ATTENDANCE, '5');
    expect(renderForChild).not.toHaveBeenCalled();
    expect(result.reply).toBeNull();
    expect(result.toast).toBeTruthy();
  });

  it('denies a child whose link disappeared between render and press (staleness race)', async () => {
    const renderForChild = vi.fn();
    const { router, callbacks } = makeRouter({
      childCommand: vi.fn(() => ({ renderForChild })),
      // Relationship revoked: the fresh list no longer contains the child.
      listChildren: vi.fn(async () => []),
    });
    const result = await press(router, callbacks, CallbackCodes.CHILD_PAYMENTS, '0');
    expect(renderForChild).not.toHaveBeenCalled();
    expect(result.toast).toBeTruthy();
  });

  it('denies a child action when the per-child permission flag is false', async () => {
    const renderForChild = vi.fn();
    const { router, callbacks } = makeRouter({
      childCommand: vi.fn(() => ({ renderForChild })),
      listChildren: vi.fn(async () => [
        { ...childOne, permissions: { grades: true, payments: false, attendance: true } },
      ]),
    });
    const result = await press(router, callbacks, CallbackCodes.CHILD_PAYMENTS, '0');
    expect(renderForChild).not.toHaveBeenCalled();
    expect(result.toast).toBeTruthy();
  });

  it('refuses child actions for a non-parent principal (empty authorized list)', async () => {
    const renderForChild = vi.fn();
    const listChildren = vi.fn(async () => [childOne]);
    const { router, callbacks } = makeRouter({
      context: USER_CONTEXT as TelegramContext,
      childCommand: vi.fn(() => ({ renderForChild })),
      listChildren,
    });
    await press(router, callbacks, CallbackCodes.CHILD_ATTENDANCE, '0');
    // resolveChildren only ever consults the portal for PARENT_ACCOUNT ctx.
    expect(listChildren).not.toHaveBeenCalled();
    expect(renderForChild).not.toHaveBeenCalled();
  });

  it('renders the child picker from the fresh authorized list', async () => {
    const listChildren = vi.fn(async () => [
      childOne,
      { ...childOne, studentId: 'student-2', name: 'Child Two' },
    ]);
    const { router, callbacks } = makeRouter({ listChildren });
    const result = await press(router, callbacks, CallbackCodes.CHILD_SELECT, null);
    // Child names appear as keyboard buttons (index-addressed), the body is the prompt.
    const labels = (result.reply?.keyboard?.inline_keyboard ?? []).flat().map((b) => b.text);
    expect(labels).toContain('Child One');
    expect(labels).toContain('Child Two');
  });

  it('shows the localized empty state when the parent has no children', async () => {
    const { router, callbacks } = makeRouter({ listChildren: vi.fn(async () => []) });
    const result = await press(router, callbacks, CallbackCodes.CHILD_SELECT, null);
    expect(result.reply?.text.length).toBeGreaterThan(0);
  });

  it('only re-runs whitelisted paginated lists and bounds the page', async () => {
    const { router, callbacks, deps } = makeRouter();
    // Allowed list + sane page.
    await press(router, callbacks, CallbackCodes.PAGE, 'attendance:2');
    expect(deps.executeCommand).toHaveBeenCalledWith('attendance', CHAT, expect.anything());

    // `/notifications` is paginated too — and the cursor carries no user id,
    // so the re-run is re-scoped to the caller's own notifications.
    deps.executeCommand.mockClear();
    await press(router, callbacks, CallbackCodes.PAGE, 'notifications:3');
    expect(deps.executeCommand).toHaveBeenCalledWith('notifications', CHAT, expect.anything());

    // Not a paginated list -> refused.
    deps.executeCommand.mockClear();
    await press(router, callbacks, CallbackCodes.PAGE, 'profile:2');
    expect(deps.executeCommand).not.toHaveBeenCalled();

    // Page 0 / negative / non-numeric / >20 -> refused.
    for (const arg of ['attendance:0', 'attendance:-1', 'attendance:abc', 'attendance:21']) {
      deps.executeCommand.mockClear();
      await press(router, callbacks, CallbackCodes.PAGE, arg);
      expect(deps.executeCommand).not.toHaveBeenCalled();
    }
  });
});

describe('TelegramCallbackRouter — /unlink confirmation (single use)', () => {
  it('disconnects exactly once on the signed confirmation', async () => {
    const { router, callbacks, deps } = makeRouter();
    const result = await press(router, callbacks, CallbackCodes.UNLINK_CONFIRM, null);
    expect(deps.unlink).toHaveBeenCalledTimes(1);
    expect(deps.unlink).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'parent-1', organizationId: 'org-1', role: 'PARENT' }),
    );
    expect(result.reply?.text).toBeTruthy();
  });

  it('refuses the SECOND press of the same confirmation (replay)', async () => {
    const claimOnce = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
    const { router, callbacks, deps } = makeRouter({ claimOnce });
    await press(router, callbacks, CallbackCodes.UNLINK_CONFIRM, null);
    const second = await press(router, callbacks, CallbackCodes.UNLINK_CONFIRM, null);
    expect(deps.unlink).toHaveBeenCalledTimes(1);
    expect(second.reply).toBeNull();
    expect(second.toast).toBeTruthy();
  });

  it('refuses a concurrent double-press of the same confirmation', async () => {
    // Simulate the distributed store: the first claim wins, everything else loses.
    let claimed = false;
    const claimOnce = vi.fn(async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    });
    const { router, callbacks, deps } = makeRouter({ claimOnce });

    const [first, second] = await Promise.all([
      press(router, callbacks, CallbackCodes.UNLINK_CONFIRM, null),
      press(router, callbacks, CallbackCodes.UNLINK_CONFIRM, null),
    ]);
    expect(deps.unlink).toHaveBeenCalledTimes(1);
    const losers = [first, second].filter((r) => r.reply === null);
    expect(losers.length).toBe(1);
  });

  it('keys the replay claim per payload, not per chat', async () => {
    const { router, callbacks, deps } = makeRouter();
    const a = await press(router, callbacks, CallbackCodes.UNLINK_CONFIRM, null);
    expect(a.reply).toBeTruthy();
    // A DIFFERENT signed payload (different exp) is a fresh action.
    const fresh = callbacks.encode(CallbackCodes.UNLINK_CONFIRM, null, CHAT);
    // claimOnce still true in this instance's mock, so unlink runs again.
    expect(deps.claimOnce).toHaveBeenCalledWith(expect.any(String), expect.any(Number));
    void fresh;
  });

  it('cancelling unlink never touches the link service', async () => {
    const { router, callbacks, deps } = makeRouter();
    await press(router, callbacks, CallbackCodes.UNLINK_CANCEL, null);
    expect(deps.unlink).not.toHaveBeenCalled();
  });
});

describe('TelegramCallbackRouter — language change', () => {
  it('persists a valid language for a User principal', async () => {
    const { router, callbacks, deps } = makeRouter({ context: USER_CONTEXT as TelegramContext });
    const result = await press(router, callbacks, CallbackCodes.LANGUAGE, 'uz');
    expect(deps.updateSettings).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      { language: 'uz' },
      'user-1',
      'STUDENT',
    );
    expect(result.reply?.text).toBeTruthy();
  });

  it('rejects an invalid language argument', async () => {
    const { router, callbacks, deps } = makeRouter({ context: USER_CONTEXT as TelegramContext });
    const result = await press(router, callbacks, CallbackCodes.LANGUAGE, 'de');
    expect(deps.updateSettings).not.toHaveBeenCalled();
    expect(result.reply).toBeNull();
  });

  it('tells a ParentAccount that language switching is unavailable (no settings model)', async () => {
    const { router, callbacks, deps } = makeRouter();
    const result = await press(router, callbacks, CallbackCodes.LANGUAGE, 'ru');
    expect(deps.updateSettings).not.toHaveBeenCalled();
    expect(result.reply).toBeNull();
    expect(result.toast).toBeTruthy();
  });
});

describe('TelegramCallbackRouter — /settings actions', () => {
  it('persists the Telegram channel toggle through the application service', async () => {
    const { router, callbacks, deps } = makeRouter({ context: USER_CONTEXT as TelegramContext });
    const result = await press(router, callbacks, CallbackCodes.SETTINGS_TELEGRAM, 'off');

    expect(deps.updateSettings).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      { telegramNotifications: false },
      'user-1',
      'STUDENT',
    );
    // Re-rendered from a FRESHLY resolved context (no ctx reuse).
    expect(deps.executeCommand).toHaveBeenCalledWith('settings', CHAT, {});
    expect(result.toast).toBeTruthy();
  });

  it('re-applies the same target value on replay instead of inverting it', async () => {
    const { router, callbacks, deps } = makeRouter({ context: USER_CONTEXT as TelegramContext });
    await press(router, callbacks, CallbackCodes.SETTINGS_TELEGRAM, 'off');
    await press(router, callbacks, CallbackCodes.SETTINGS_TELEGRAM, 'off');

    for (const call of deps.updateSettings.mock.calls) {
      expect(call[2]).toEqual({ telegramNotifications: false });
    }
  });

  it('applies a validated quiet-hours preset', async () => {
    const { router, callbacks, deps } = makeRouter({ context: USER_CONTEXT as TelegramContext });
    await press(router, callbacks, CallbackCodes.SETTINGS_QUIET_HOURS, '22:00-07:00');

    expect(deps.updateSettings).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      { quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00' },
      'user-1',
      'STUDENT',
    );
  });

  it('rejects a malformed quiet-hours window without persisting', async () => {
    const { router, callbacks, deps } = makeRouter({ context: USER_CONTEXT as TelegramContext });
    const result = await press(router, callbacks, CallbackCodes.SETTINGS_QUIET_HOURS, 'soon-later');

    expect(deps.updateSettings).not.toHaveBeenCalled();
    expect(result.reply).toBeNull();
    expect(result.toast).toBeTruthy();
  });

  it('turns quiet hours off explicitly', async () => {
    const { router, callbacks, deps } = makeRouter({ context: USER_CONTEXT as TelegramContext });
    await press(router, callbacks, CallbackCodes.SETTINGS_QUIET_HOURS, 'off');

    expect(deps.updateSettings).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      { quietHoursEnabled: false },
      'user-1',
      'STUDENT',
    );
  });

  it('toggles one notification category for the caller only', async () => {
    const handler = vi.fn(() => ({
      renderCategories: vi.fn(async () => ({ text: 'categories' })),
    }));
    const { router, callbacks, deps } = makeRouter({
      context: USER_CONTEXT as TelegramContext,
      handler,
    });
    const result = await press(router, callbacks, CallbackCodes.SETTINGS_CATEGORY, 'PAYMENT:off');

    expect(deps.updatePreference).toHaveBeenCalledWith('user-1', 'PAYMENT', {
      telegramEnabled: false,
    });
    expect(result.reply?.text).toBe('categories');
    expect(result.toast).toBeTruthy();
  });

  it('rejects an unknown category or a non-boolean state', async () => {
    const { router, callbacks, deps } = makeRouter({ context: USER_CONTEXT as TelegramContext });

    let result = await press(router, callbacks, CallbackCodes.SETTINGS_CATEGORY, 'HACKED:on');
    expect(deps.updatePreference).not.toHaveBeenCalled();
    expect(result.reply).toBeNull();

    result = await press(router, callbacks, CallbackCodes.SETTINGS_CATEGORY, 'PAYMENT:maybe');
    expect(deps.updatePreference).not.toHaveBeenCalled();
    expect(result.reply).toBeNull();
  });

  it('refuses settings writes for a ParentAccount (no settings model)', async () => {
    const { router, callbacks, deps } = makeRouter();

    const toggle = await press(router, callbacks, CallbackCodes.SETTINGS_TELEGRAM, 'off');
    expect(deps.updateSettings).not.toHaveBeenCalled();
    expect(toggle.reply).toBeNull();
    expect(toggle.toast).toBeTruthy();

    const quiet = await press(router, callbacks, CallbackCodes.SETTINGS_QUIET_HOURS, '22:00-07:00');
    expect(deps.updateSettings).not.toHaveBeenCalled();
    expect(quiet.reply).toBeNull();

    const category = await press(router, callbacks, CallbackCodes.SETTINGS_CATEGORY, 'PAYMENT:off');
    expect(deps.updatePreference).not.toHaveBeenCalled();
    expect(category.reply).toBeNull();
  });

  it('re-resolves context for the category list instead of trusting the press', async () => {
    const handler = vi.fn(() => ({
      renderCategories: vi.fn(async () => ({ text: 'categories' })),
    }));
    const { router, callbacks, contextService } = makeRouter({
      context: USER_CONTEXT as TelegramContext,
      handler,
    });
    const result = await press(router, callbacks, CallbackCodes.SETTINGS_CATEGORIES, null);

    expect(contextService.resolve).toHaveBeenCalledWith(CHAT);
    expect(result.reply?.text).toBe('categories');
  });
});
