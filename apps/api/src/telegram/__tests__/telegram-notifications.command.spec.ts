import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { NotificationsCommand } from '../commands/data.commands';
import { TelegramCallbackService } from '../telegram-callback.service';
import { t } from '../i18n/telegram-i18n';
import { CallbackCodes } from '../ui/keyboards';
import type { TelegramContext } from '../telegram-context.service';
import type { TelegramRequestContext } from '../commands/command.interface';

const CHAT = '9001';

function callbacks() {
  return new TelegramCallbackService({
    get: () => 'test-secret-32-chars-minimum!!',
  } as unknown as ConfigService);
}

function context(over: Partial<TelegramContext> = {}): TelegramContext {
  return {
    account: {
      id: 'acct-1',
      organizationId: 'org-1',
      username: 'ali',
      languageCode: 'en',
      userId: 'user-1',
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
    studentId: 'student-1',
    teacherId: null,
    userId: 'user-1',
    parentId: null,
    ...over,
  };
}

function requestFor(ctx: TelegramContext, page = 1): TelegramRequestContext {
  const cb = callbacks();
  return {
    chatId: CHAT,
    ctx,
    language: ctx.language,
    tr: (key: string, params?: Record<string, string | number>) => t('en', key, params),
    cb: (code: string, arg?: string) => cb.encode(code, arg ?? null, CHAT),
    args: '',
    page,
  } as TelegramRequestContext;
}

function makeService(result: unknown) {
  return { findAll: vi.fn().mockResolvedValue(result) } as never;
}

describe('NotificationsCommand — scoping, pagination and escaping', () => {
  it('queries ONLY the caller\u2019s own user id and never a callback-supplied id', async () => {
    const notifications = makeService({
      items: [{ createdAt: '2026-06-01T10:00:00Z', title: 'Hello', isRead: false }],
      total: 1,
      page: 1,
      totalPages: 1,
      unread: 1,
    });
    const command = new NotificationsCommand(notifications);

    await command.handle(requestFor(context()));

    expect((notifications as { findAll: ReturnType<typeof vi.fn> }).findAll).toHaveBeenCalledWith(
      'user-1',
      { limit: '6', page: '1' },
    );
  });

  it('shows the unread count and a read/unread marker per item', async () => {
    const command = new NotificationsCommand(
      makeService({
        items: [
          { createdAt: '2026-06-01T10:00:00Z', title: 'Unread one', isRead: false },
          { createdAt: '2026-06-01T09:00:00Z', title: 'Read one', isRead: true },
        ],
        total: 2,
        page: 1,
        totalPages: 1,
        unread: 1,
      }),
    );

    const reply = await command.handle(requestFor(context()));

    expect(reply.text).toContain('Unread: 1');
    expect(reply.text).toContain('🔔');
    expect(reply.text).toContain('✅');
  });

  it('paginates through a signed, chat-bound PAGE callback (no ids in the payload)', async () => {
    const command = new NotificationsCommand(
      makeService({
        items: [{ createdAt: '2026-06-01T10:00:00Z', title: 'X', isRead: true }],
        total: 20,
        page: 2,
        totalPages: 4,
        unread: 3,
      }),
    );

    const reply = await command.handle(requestFor(context(), 2));
    const data = reply.keyboard?.inline_keyboard.flat().map((b) => b.callback_data) ?? [];

    const decoded = data
      .map((value) => callbacks().decode(value, CHAT))
      .filter((entry): entry is { code: string; arg: string | null } => entry !== null);

    const pageCursors = decoded.filter((entry) => entry.code === CallbackCodes.PAGE);
    expect(pageCursors.map((entry) => entry.arg)).toEqual(
      expect.arrayContaining(['notifications:1', 'notifications:3']),
    );
    // The payload is a list name + page number; no notification/user id.
    for (const cursor of pageCursors) {
      expect(cursor.arg).toMatch(/^notifications:\d+$/);
    }
    expect(reply.text).toContain('Page 2 of 4');
  });

  it('escapes notification titles so they cannot forge message layout', async () => {
    const command = new NotificationsCommand(
      makeService({
        items: [
          { createdAt: '2026-06-01T10:00:00Z', title: '<b>bold</b> & <i>x</i>', isRead: false },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
        unread: 1,
      }),
    );

    const reply = await command.handle(requestFor(context()));

    expect(reply.text).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(reply.text).not.toContain('<b>bold</b>');
  });

  it('shows an empty state for a ParentAccount (no User row \u2192 no notification list)', async () => {
    const notifications = makeService({ items: [], total: 0, page: 1, totalPages: 1, unread: 0 });
    const command = new NotificationsCommand(notifications);

    const reply = await command.handle(
      requestFor(context({ kind: 'PARENT_ACCOUNT', userId: null, parentId: 'pa-1', isParent: true })),
    );

    expect(
      (notifications as { findAll: ReturnType<typeof vi.fn> }).findAll,
    ).not.toHaveBeenCalled();
    expect(reply.text).toContain('no notifications');
    expect(reply.keyboard).toBeUndefined();
  });

  it('never leaks ids or payloads in the rendered message', async () => {
    const command = new NotificationsCommand(
      makeService({
        items: [
          {
            id: 'notif-internal-id',
            createdAt: '2026-06-01T10:00:00Z',
            title: 'Fine',
            isRead: true,
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
        unread: 0,
      }),
    );

    const reply = await command.handle(requestFor(context()));
    expect(reply.text).not.toContain('notif-internal-id');
    expect(reply.text).not.toContain('user-1');
    expect(reply.text).not.toContain('org-1');
  });
});
