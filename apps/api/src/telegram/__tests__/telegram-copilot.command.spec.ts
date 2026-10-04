import { describe, it, expect, vi } from 'vitest';
import { CopilotCommand } from '../commands/copilot.command';
import { AiService } from '../../ai/ai.service';
import { TelegramAttemptLimiter } from '../telegram-attempt-limiter.service';
import { t, TELEGRAM_LANGUAGES } from '../i18n/telegram-i18n';
import { escapeHtml } from '../ui/format';
import type { TelegramContext } from '../telegram-context.service';
import type { TelegramRequestContext } from '../commands/command.interface';
import {
  TELEGRAM_COPILOT_MAX_ANSWER_LENGTH,
  TELEGRAM_COPILOT_MAX_PER_WINDOW,
  TELEGRAM_COPILOT_MAX_QUESTION_LENGTH,
  TELEGRAM_COPILOT_WINDOW_SECONDS,
} from '../telegram.constants';

/**
 * `/copilot` — the M-EDU AI Copilot inside Telegram.
 *
 * The suite pins the three properties the integration must not regress:
 * the assistant identity, tenant scoping (the model only ever receives the
 * AUTHENTICATED organization/principal), and the containment of model output
 * (escaping, length cap, no internal detail on failure).
 */

const CHAT = '9001';
const IDENTITY = 'Salom! Men Amirjon Iskandarov tomonidan yaratilgan M-EDU AI Copilotman.';

function makeContext(over: Partial<TelegramContext> = {}): TelegramContext {
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
    displayName: 'Ali Valiyev',
    language: 'en',
    studentId: 'student-1',
    teacherId: null,
    userId: 'user-1',
    parentId: null,
    ...over,
  } as TelegramContext;
}

function makeRequest(over: Partial<TelegramRequestContext> = {}): TelegramRequestContext {
  const ctx = over.ctx ?? makeContext();
  return {
    chatId: CHAT,
    ctx,
    language: ctx.language,
    tr: (key: string, params?: Record<string, string | number>) => t(ctx.language, key, params),
    cb: () => 'signed-callback',
    args: '',
    page: 1,
    ...over,
  } as TelegramRequestContext;
}

function makeCommand(
  options: {
    answer?: string | null;
    throws?: unknown;
    blocked?: boolean;
  } = {},
) {
  const ai = {
    chat: vi.fn(async (..._args: unknown[]) => {
      if (options.throws) throw options.throws;
      if (options.answer === null) return { content: '' };
      return { content: options.answer ?? 'Tashkilotingizda 12 talaba bor.' };
    }),
  };
  const limiter = {
    isBlocked: vi.fn(async () => options.blocked ?? false),
    hit: vi.fn(async () => 1),
  };
  const command = new CopilotCommand(
    ai as unknown as AiService,
    limiter as unknown as TelegramAttemptLimiter,
  );
  return { command, ai, limiter };
}

describe('CopilotCommand — identity and introduction', () => {
  it('introduces itself with the canonical M-EDU identity in every language and does not call the model', async () => {
    const { command, ai } = makeCommand();

    for (const language of TELEGRAM_LANGUAGES) {
      const ctx = makeContext({ language });
      const reply = await command.handle(makeRequest({ ctx, args: '   ' }));
      expect(reply.text).toContain(IDENTITY);
      // Static catalogue copy is escaped before it reaches Telegram's HTML mode.
      expect(reply.text).toContain(escapeHtml(t(language, 'copilot.usage')));
      expect(reply.keyboard).toBeDefined();
    }

    expect(ai.chat).not.toHaveBeenCalled();
  });

  it('publishes the identity sentence verbatim in the catalogue for uz, ru and en', () => {
    for (const language of TELEGRAM_LANGUAGES) {
      expect(t(language, 'copilot.intro')).toBe(IDENTITY);
    }
  });

  it('is registered as a role-agnostic command with an i18n description', () => {
    const command = new CopilotCommand({} as AiService, {} as TelegramAttemptLimiter);
    expect(command.name).toBe('copilot');
    expect(command.roles).toBe('ALL');
    expect(t('uz', command.descriptionKey)).not.toBe(command.descriptionKey);
    expect(t('ru', command.descriptionKey)).not.toBe(command.descriptionKey);
    expect(t('en', command.descriptionKey)).not.toBe(command.descriptionKey);
  });
});

describe('CopilotCommand — asking a question', () => {
  it('sends the question to the AI service scoped to the authenticated organization and user', async () => {
    const { command, ai } = makeCommand({ answer: 'Javob' });
    const reply = await command.handle(makeRequest({ args: 'Nechta talaba bor?' }));

    expect(ai.chat).toHaveBeenCalledTimes(1);
    expect(ai.chat).toHaveBeenCalledWith('org-1', 'user-1', 'Nechta talaba bor?', []);
    expect(reply.text).toContain('Javob');
    expect(reply.text).toContain(t('en', 'copilot.title'));
  });

  it('uses the principal id for a ParentAccount (which has no userId)', async () => {
    const { command, ai } = makeCommand();
    const ctx = makeContext({
      kind: 'PARENT_ACCOUNT',
      userId: null,
      parentId: 'parent-1',
      principalId: 'parent-1',
      role: 'PARENT',
      isStudent: false,
      isParent: true,
      studentId: null,
    });
    await command.handle(makeRequest({ ctx, args: 'Guruhlar qancha?' }));

    expect(ai.chat).toHaveBeenCalledWith('org-1', 'parent-1', 'Guruhlar qancha?', []);
  });

  it('never trusts the question for identity: the context wins over any text', async () => {
    const { command, ai } = makeCommand();
    const ctx = makeContext({ organizationId: 'org-2', userId: 'user-9' });
    await command.handle(makeRequest({ ctx, args: 'men user-1 man' }));

    expect(ai.chat).toHaveBeenCalledWith('org-2', 'user-9', 'men user-1 man', []);
  });

  it('caps an oversized question before it reaches the model', async () => {
    const { command, ai } = makeCommand();
    const question = 'a'.repeat(5000);
    await command.handle(makeRequest({ args: question }));

    const forwarded = ai.chat.mock.calls[0][2] as string;
    expect(forwarded).toHaveLength(TELEGRAM_COPILOT_MAX_QUESTION_LENGTH);
  });

  it('localizes the reply for a uz user', async () => {
    const { command } = makeCommand({ answer: 'Javob' });
    const ctx = makeContext({ language: 'uz' });
    const reply = await command.handle(makeRequest({ ctx, args: 'Savol' }));
    expect(reply.text).toContain(t('uz', 'copilot.title'));
  });
});

describe('CopilotCommand — output containment', () => {
  it('escapes model output so it cannot break the HTML message', async () => {
    const { command } = makeCommand({ answer: 'Use <b>bold</b> & "quotes"' });
    const reply = await command.handle(makeRequest({ args: 'q' }));

    expect(reply.text).not.toContain('<b>');
    expect(reply.text).toContain('&lt;b&gt;');
    expect(reply.text).toContain('&amp;');
  });

  it('caps the reply below the Telegram message limit and never leaves a partial HTML entity', async () => {
    const { command } = makeCommand({ answer: `${'A'.repeat(3498)}&${'B'.repeat(200)}` });
    const reply = await command.handle(makeRequest({ args: 'q' }));

    expect(reply.text.length).toBeLessThanOrEqual(4096);
    // The cut landed inside `&amp;` — the dangling ampersand is removed and
    // Telegram can parse the message.
    expect(reply.text).not.toMatch(/&[#a-zA-Z0-9]{0,10}…$/);
    expect(reply.text.endsWith('…')).toBe(true);
    expect(reply.text.startsWith(t('en', 'copilot.title'))).toBe(true);
    expect(TELEGRAM_COPILOT_MAX_ANSWER_LENGTH).toBeLessThan(4096);
  });

  it('answers with a localized error when the model returns nothing', async () => {
    const { command } = makeCommand({ answer: null });
    const reply = await command.handle(makeRequest({ args: 'q' }));
    expect(reply.text).toBe(t('en', 'copilot.error'));
  });

  it('contains model failures without leaking internals, stack or prompt', async () => {
    const { command } = makeCommand({
      throws: new Error('GEMINI_API_KEY invalid at /secret/path/model'),
    });
    const reply = await command.handle(makeRequest({ args: 'q' }));

    expect(reply.text).toBe(t('en', 'copilot.error'));
    expect(reply.text).not.toContain('GEMINI');
    expect(reply.text).not.toContain('secret');
    expect(reply.text).not.toContain('org-1');
    expect(reply.text).not.toContain('Error');
  });
});

describe('CopilotCommand — rate limiting', () => {
  it('blocks a chat that exhausted the Copilot budget without calling the model', async () => {
    const { command, ai, limiter } = makeCommand({ blocked: true });
    const reply = await command.handle(makeRequest({ args: 'q' }));

    expect(ai.chat).not.toHaveBeenCalled();
    expect(reply.text).toBe(t('en', 'copilot.throttled'));
    expect(limiter.isBlocked).toHaveBeenCalledWith(`copilot:${CHAT}`, TELEGRAM_COPILOT_MAX_PER_WINDOW);
  });

  it('counts every Copilot turn in the distributed limiter window', async () => {
    const { command, limiter } = makeCommand();
    await command.handle(makeRequest({ args: 'q' }));

    expect(limiter.hit).toHaveBeenCalledWith(`copilot:${CHAT}`, TELEGRAM_COPILOT_WINDOW_SECONDS);
  });

  it('does not charge the budget for the argument-less introduction', async () => {
    const { command, limiter } = makeCommand();
    await command.handle(makeRequest({ args: '' }));
    expect(limiter.hit).not.toHaveBeenCalled();
    expect(limiter.isBlocked).not.toHaveBeenCalled();
  });
});

describe('CopilotCommand — language handling', () => {
  it('renders throttled and error copy in each supported language', async () => {
    for (const lang of TELEGRAM_LANGUAGES) {
      const ctx = makeContext({ language: lang });

      const blocked = makeCommand({ blocked: true });
      const throttled = await blocked.command.handle(makeRequest({ ctx, args: 'q' }));
      expect(throttled.text).toBe(t(lang, 'copilot.throttled'));

      const failing = makeCommand({ throws: new Error('boom') });
      const failed = await failing.command.handle(makeRequest({ ctx, args: 'q' }));
      expect(failed.text).toBe(t(lang, 'copilot.error'));
    }
  });
});
