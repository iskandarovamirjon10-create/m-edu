import { describe, it, expect, vi } from 'vitest';
import { TelegramCommandRouter } from '../telegram-command.router';
import { TelegramContextService, TelegramContextError } from '../telegram-context.service';
import { TelegramCallbackService } from '../telegram-callback.service';
import { TelegramAttemptLimiter } from '../telegram-attempt-limiter.service';
import { ConfigService } from '@nestjs/config';
import type { TelegramContext } from '../telegram-context.service';
import type { TelegramCommandHandler } from '../commands/command.interface';
import { ADMIN_ROLES, TEACHING_ROLES } from '../../auth/authorization.policy';

/**
 * Command-router routing, RBAC, lifecycle and error-containment behaviour.
 * Handlers are stubbed at the boundary; handler-internal authorization is
 * covered in the command-handler suites.
 */

const LINKED_CONTEXT: Partial<TelegramContext> = {
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
};

function makeRouter(
  handlers: TelegramCommandHandler[],
  options: {
    context?: TelegramContext | null;
    contextError?: TelegramContextError;
    blocked?: boolean;
  } = {},
) {
  const contextService = {
    resolve: vi.fn(async () => {
      if (options.contextError) throw options.contextError;
      if (options.context === null) throw new TelegramContextError('NOT_LINKED');
      return options.context ?? (LINKED_CONTEXT as TelegramContext);
    }),
  };
  const callbacks = new TelegramCallbackService({ get: () => 'test-secret-32-chars-minimum!!' } as unknown as ConfigService);
  const limiter = {
    isBlocked: vi.fn(async () => options.blocked ?? false),
    hit: vi.fn(async () => 1),
  };
  const router = new TelegramCommandRouter(
    handlers,
    contextService as unknown as TelegramContextService,
    callbacks,
    limiter as unknown as TelegramAttemptLimiter,
  );
  return { router, contextService, limiter, callbacks };
}

function handler(over: Partial<TelegramCommandHandler>): TelegramCommandHandler {
  return {
    name: 'stub',
    descriptionKey: 'stub.key',
    roles: 'ALL',
    handle: vi.fn(async () => ({ text: 'stub reply' })),
    ...over,
  };
}

describe('TelegramCommandRouter — command parsing', () => {
  const { router } = makeRouter([handler({ name: 'menu' })]);

  it('routes a plain command', async () => {
    const result = await router.route({ chatId: '9001', text: '/menu' });
    expect(result.reply?.text).toBe('stub reply');
  });

  it('is case-insensitive', async () => {
    const result = await router.route({ chatId: '9001', text: '/MENU' });
    expect(result.reply?.text).toBe('stub reply');
  });

  it('accepts /command@botname addressing', async () => {
    const result = await router.route({ chatId: '9001', text: '/menu@medu_bot' });
    expect(result.reply?.text).toBe('stub reply');
  });

  it('normalizes whitespace and passes the remainder as args', async () => {
    const h = handler({ name: 'search' });
    const { router: r } = makeRouter([h]);
    await r.route({ chatId: '9001', text: '  /search  ali   valiyev  ' });
    expect((h.handle as ReturnType<typeof vi.fn>).mock.calls[0][0].args).toBe('ali valiyev');
  });

  it('returns null for non-command text', async () => {
    const result = await router.route({ chatId: '9001', text: 'just text' });
    expect(result.reply).toBeNull();
  });

  it('rejects malformed command tokens', async () => {
    expect((await router.route({ chatId: '9001', text: '/bad!token' })).reply).toBeNull();
    expect((await router.route({ chatId: '9001', text: '/UPPER_case!' })).reply).toBeNull();
    // A valid token with arguments still routes ("has" with args "space").
    expect((await router.route({ chatId: '9001', text: '/has space' })).reply).not.toBeNull();
  });

  it('rejects oversized command names (long input)', async () => {
    const result = await router.route({ chatId: '9001', text: `/${'a'.repeat(200)}` });
    expect(result.reply).toBeNull();
  });

  it('survives unicode and HTML-like input without executing anything', async () => {
    expect((await router.route({ chatId: '9001', text: '/пример<script>' })).reply).toBeNull();
    expect((await router.route({ chatId: '9001', text: '/click<b>alert</b>' })).reply).toBeNull();
  });
});

describe('TelegramCommandRouter — unknown commands and context failures', () => {
  it('answers an unknown command with a localized unsupported message', async () => {
    const { router } = makeRouter([]);
    const result = await router.route({ chatId: '9001', text: '/doesnotexist' });
    expect(result.reply?.text).not.toBe('/doesnotexist');
    expect(result.reply?.text.length).toBeGreaterThan(0);
  });

  it('tells an unlinked chat how to link, without leaking internals', async () => {
    const { router } = makeRouter([handler({ name: 'menu' })], {
      contextError: new TelegramContextError('NOT_LINKED'),
    });
    const result = await router.route({ chatId: '9001', text: '/menu' });
    expect(result.reply?.text).toContain('M-EDU');
    expect(result.reply?.text.toLowerCase()).not.toContain('prisma');
  });

  for (const [code, role] of [
    ['DISCONNECTED', 'student'],
    ['BLOCKED', 'admin'],
    ['SUSPENDED', 'teacher'],
  ] as const) {
    it(`refuses everything for a ${code} link`, async () => {
      const h = handler({ name: 'menu' });
      const { router } = makeRouter([h], { contextError: new TelegramContextError(code) });
      const result = await router.route({ chatId: '9001', text: '/menu' });
      expect(h.handle).not.toHaveBeenCalled();
      expect(result.reply?.text.length).toBeGreaterThan(0);
      void role;
    });
  }

  it('maps TENANT_MISMATCH and INACTIVE to an access-denied message', async () => {
    for (const code of ['TENANT_MISMATCH', 'INACTIVE'] as const) {
      const { router } = makeRouter([handler({ name: 'menu' })], {
        contextError: new TelegramContextError(code),
      });
      const result = await router.route({ chatId: '9001', text: '/menu' });
      expect(result.reply?.text).not.toBe('');
    }
  });
});

describe('TelegramCommandRouter — RBAC', () => {
  it('runs a role-listed command for the allowed role', async () => {
    const h = handler({ name: 'payments', roles: [...ADMIN_ROLES, 'STUDENT', 'PARENT'] });
    const { router } = makeRouter([h]);
    const result = await router.route({ chatId: '9001', text: '/payments' });
    expect(result.reply?.text).toBe('stub reply');
  });

  it('denies a student a teaching command and never invokes the handler', async () => {
    const h = handler({ name: 'students', roles: [...ADMIN_ROLES, ...TEACHING_ROLES] });
    const { router, contextService } = makeRouter([h]);
    const result = await router.route({ chatId: '9001', text: '/students' });
    expect(h.handle).not.toHaveBeenCalled();
    expect(result.reply?.text.length).toBeGreaterThan(0);
    void contextService;
  });

  it('denies a teacher an admin command', async () => {
    const h = handler({ name: 'teachers', roles: ADMIN_ROLES });
    const teacherCtx = {
      ...LINKED_CONTEXT,
      role: 'TEACHER',
      isStudent: false,
      isTeaching: true,
      isStaff: true,
      studentId: null,
      teacherId: 'teacher-1',
    } as TelegramContext;
    const { router } = makeRouter([h], { context: teacherCtx });
    const result = await router.route({ chatId: '9001', text: '/teachers' });
    expect(h.handle).not.toHaveBeenCalled();
    expect(result.reply?.text.length).toBeGreaterThan(0);
  });

  it('allows an admin an admin command', async () => {
    const h = handler({ name: 'teachers', roles: ADMIN_ROLES });
    const adminCtx = {
      ...LINKED_CONTEXT,
      role: 'ORG_ADMIN',
      isStudent: false,
      isAdmin: true,
      isStaff: true,
      studentId: null,
    } as TelegramContext;
    const { router } = makeRouter([h], { context: adminCtx });
    const result = await router.route({ chatId: '9001', text: '/teachers' });
    expect(result.reply?.text).toBe('stub reply');
  });
});

describe('TelegramCommandRouter — rate limiting', () => {
  it('blocks the 31st command in the configured window', async () => {
    const h = handler({ name: 'menu' });
    let count = 0;
    const limiter = {
      isBlocked: vi.fn(async (_scope: string, max: number) => {
        count += 1;
        return count > max;
      }),
      hit: vi.fn(async () => 1),
    };
    const router = new TelegramCommandRouter(
      [h],
      { resolve: async () => LINKED_CONTEXT } as unknown as TelegramContextService,
      new TelegramCallbackService({ get: () => 'test-secret-32-chars-minimum!!' } as unknown as ConfigService),
      limiter as unknown as TelegramAttemptLimiter,
    );

    for (let i = 0; i < 30; i += 1) {
      const result = await router.route({ chatId: '9001', text: '/menu' });
      expect(result.reply?.text).toBe('stub reply');
    }
    const blocked = await router.route({ chatId: '9001', text: '/menu' });
    expect(h.handle).toHaveBeenCalledTimes(30);
    expect(blocked.reply?.text.length).toBeGreaterThan(0);
    expect(blocked.reply?.text).not.toBe('stub reply');
  });

  it('checks the limiter before resolving the context', async () => {
    const { router, contextService, limiter } = makeRouter([handler({ name: 'menu' })], {
      blocked: true,
    });
    await router.route({ chatId: '9001', text: '/menu' });
    expect(limiter.isBlocked).toHaveBeenCalled();
    expect(contextService.resolve).not.toHaveBeenCalled();
  });

  it('scopes the rate-limit key per chat (one user cannot throttle another)', async () => {
    const { router, limiter } = makeRouter([handler({ name: 'menu' })]);
    await router.route({ chatId: '9001', text: '/menu' });
    await router.route({ chatId: '9002', text: '/menu' });
    const scopes = (limiter.isBlocked as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => (call[0] as string).split(':')[1],
    );
    expect(new Set(scopes).size).toBe(2);
  });
});

describe('TelegramCommandRouter — error containment', () => {
  it('converts a handler crash into a generic localized reply (no stack, no message)', async () => {
    const h = handler({
      name: 'menu',
      handle: async () => {
        throw new Error('secret database DSN postgres://user:pass@host');
      },
    });
    const { router } = makeRouter([h]);
    const result = await router.route({ chatId: '9001', text: '/menu' });
    expect(result.reply?.text).not.toContain('postgres');
    expect(result.reply?.text).not.toContain('secret');
    expect(result.reply?.text.length).toBeGreaterThan(0);
  });
});
