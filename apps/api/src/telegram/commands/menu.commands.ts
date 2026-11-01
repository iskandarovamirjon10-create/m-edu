import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import {
  TelegramCommandHandler,
  TelegramRequestContext,
  TELEGRAM_COMMANDS,
  canRun,
} from './command.interface';
import { TelegramReply } from '../ui/telegram-ui.types';
import {
  CallbackCodes,
  backKeyboard,
  categoriesKeyboard,
  languageKeyboard,
  mainMenuKeyboard,
  settingsKeyboard,
  unlinkConfirmKeyboard,
  webAppKeyboard,
} from '../ui/keyboards';
import { escapeHtml } from '../ui/format';
import { TelegramNotificationPolicyService } from '../../notifications/telegram-notification-policy.service';
import { NotificationPreferenceService } from '../../notifications/notification-preference.service';

/**
 * `/menu` — the server-resolved main menu.
 *
 * The menu is recomputed from the CURRENT role on every request (no caching),
 * so a role change or permission loss in the web app is reflected immediately
 * without reconnecting Telegram.
 */
@Injectable()
export class MenuCommand implements TelegramCommandHandler {
  readonly name = 'menu';
  readonly descriptionKey = 'menu.title';
  readonly roles = 'ALL' as const;

  constructor(@Optional() private readonly config?: ConfigService) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    return this.render(request);
  }

  render(request: TelegramRequestContext): TelegramReply {
    const { ctx, tr } = request;
    const title = ctx.isAdmin
      ? tr('menu.admin.title')
      : ctx.isTeaching
        ? tr('menu.teacher.title')
        : ctx.isStudent
          ? tr('menu.student.title')
          : ctx.isParent
            ? tr('menu.parent.title')
            : tr('menu.title');

    const text = `${escapeHtml(title)}\n\n${tr('menu.subtitle', {
      name: escapeHtml(ctx.displayName),
    })}`;

    const configuredWebApp = this.config?.get<string>('TELEGRAM_WEBAPP_URL');
    const configuredFrontend = this.config?.get<string>('FRONTEND_URL');
    const rawUrl = configuredWebApp || (configuredFrontend ? `${configuredFrontend.replace(/\/+$/, '')}/tg-app` : undefined);
    const webAppUrl = rawUrl && /^https:\/\//i.test(rawUrl) ? rawUrl : undefined;

    return {
      text,
      keyboard: mainMenuKeyboard(
        { tr, cb: request.cb },
        {
          isAdmin: ctx.isAdmin,
          isTeaching: ctx.isTeaching,
          isStudent: ctx.isStudent,
          isParent: ctx.isParent,
          webAppUrl,
        },
      ),
    };
  }
}

/** `/start` — welcome + the role-appropriate menu. */
@Injectable()
export class StartCommand implements TelegramCommandHandler {
  readonly name = 'start';
  readonly descriptionKey = 'menu.title';
  readonly roles = 'ALL' as const;

  constructor(private readonly menu: MenuCommand) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    return this.menu.render(request);
  }
}

/** `/webapp` — directly launch the M-EDU WebApp. */
@Injectable()
export class WebappCommand implements TelegramCommandHandler {
  readonly name = 'webapp';
  readonly descriptionKey = 'webapp.title';
  readonly roles = 'ALL' as const;

  constructor(@Optional() private readonly config?: ConfigService) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { tr } = request;
    const configuredWebApp = this.config?.get<string>('TELEGRAM_WEBAPP_URL');
    const configuredFrontend = this.config?.get<string>('FRONTEND_URL');
    const rawUrl = configuredWebApp || (configuredFrontend ? `${configuredFrontend.replace(/\/+$/, '')}/tg-app` : undefined);
    const webAppUrl = rawUrl && /^https:\/\//i.test(rawUrl) ? rawUrl : undefined;

    if (!webAppUrl) {
      return {
        text: `<b>${escapeHtml(tr('webapp.title'))}</b>\n\n${escapeHtml(tr('webapp.notConfigured'))}`,
        keyboard: backKeyboard({ tr, cb: request.cb }),
      };
    }

    return {
      text: `<b>${escapeHtml(tr('webapp.title'))}</b>\n\n${escapeHtml(tr('webapp.description'))}`,
      keyboard: webAppKeyboard({ tr, cb: request.cb }, webAppUrl),
    };
  }
}

/**
 * `/help` — lists only the commands the caller's role may actually run.
 *
 * The list is derived from the live registry and the same role predicate the
 * router enforces, so help can never advertise a command that would be denied.
 *
 * NOTE: the registry is resolved LAZILY via ModuleRef. HelpCommand is itself
 * a member of the `TELEGRAM_COMMANDS` factory list; a constructor injection of
 * that token would create a DI cycle (factory → HelpCommand → factory) which
 * only explodes when the full AppModule is compiled. Resolving at handle-time
 * breaks the cycle without forwardRef scatter.
 */
@Injectable()
export class HelpCommand implements TelegramCommandHandler {
  readonly name = 'help';
  readonly descriptionKey = 'help.title';
  readonly roles = 'ALL' as const;

  constructor(private readonly moduleRef: ModuleRef) {}

  private registry(): TelegramCommandHandler[] {
    return this.moduleRef.get(TELEGRAM_COMMANDS, { strict: false });
  }

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, tr } = request;
    const lines = this.registry()
      .filter((command) => canRun(command, ctx.role))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((command) => `/${command.name} — ${tr(command.descriptionKey)}`);

    return {
      text: `${escapeHtml(tr('help.title'))}\n\n${lines.join('\n')}\n\n${escapeHtml(
        tr('help.hint'),
      )}`,
      keyboard: {
        inline_keyboard: [
          [{ text: tr('btn.menu'), callback_data: request.cb(CallbackCodes.MAIN_MENU) }],
        ],
      },
    };
  }
}

/**
 * `/settings` — the self-service Telegram configuration screen.
 *
 * Shows the connection, language, the Telegram channel toggle, quiet hours and
 * the per-category preferences. Every value comes from the application
 * services (never from Prisma directly, never from Telegram input), and the
 * context was already re-resolved by the router — so a role change,
 * deactivation or re-link is reflected on the very next render.
 *
 * `ParentAccount` has no settings model, so the screen tells the truth about
 * that instead of inventing storage.
 */
@Injectable()
export class SettingsCommand implements TelegramCommandHandler {
  readonly name = 'settings';
  readonly descriptionKey = 'settings.title';
  readonly roles = 'ALL' as const;

  constructor(
    private readonly policy: TelegramNotificationPolicyService,
    private readonly preferences: NotificationPreferenceService,
  ) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, tr } = request;
    const username = ctx.account.username ? ` (@${escapeHtml(ctx.account.username)})` : '';

    const state = await this.policy.describe({
      organizationId: ctx.organizationId,
      principalType: ctx.kind,
      principalId: ctx.principalId,
    });

    const lines = [
      escapeHtml(tr('settings.title')),
      '',
      tr('settings.linked', { username }),
      tr('settings.language', { language: request.language.toUpperCase() }),
    ];

    if (state.settingsAvailable) {
      lines.push(
        tr('settings.notifications', {
          state: tr(state.telegramEnabled ? 'settings.state.on' : 'settings.state.off'),
        }),
      );
      const window =
        state.quietHoursEnabled && state.quietHoursStart && state.quietHoursEnd
          ? `${state.quietHoursStart}–${state.quietHoursEnd}`
          : tr('settings.quietHoursOff');
      lines.push(tr('settings.quietHours', { window: escapeHtml(window) }));
    } else {
      lines.push('', escapeHtml(tr('settings.unavailable')));
    }

    lines.push('', escapeHtml(tr('settings.hint')));

    return {
      text: lines.join('\n'),
      keyboard: settingsKeyboard({ tr, cb: request.cb }, state),
    };
  }

  /** The per-category Telegram preference list (rendered by the callback router). */
  async renderCategories(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, tr } = request;
    if (ctx.kind !== 'USER' || !ctx.userId) {
      return { text: tr('settings.unavailable') };
    }

    const categories = await this.preferences.getPreferences(ctx.userId);
    return {
      text: `${escapeHtml(tr('settings.categoriesTitle'))}\n\n${escapeHtml(
        tr('settings.categoriesHint'),
      )}`,
      keyboard: categoriesKeyboard(
        { tr, cb: request.cb },
        // The LABEL is translated here, not taken from the API DTO: the bot's
        // copy must come from the i18n catalogue so uz/ru users never see an
        // English category name.
        categories.map((category) => ({
          key: category.category,
          label: tr(`category.${category.category}`),
          telegramEnabled: category.telegramEnabled,
        })),
      ),
    };
  }
}

/** `/language` — picker. ParentAccounts have no settings row, so they are told. */
@Injectable()
export class LanguageCommand implements TelegramCommandHandler {
  readonly name = 'language';
  readonly descriptionKey = 'language.title';
  readonly roles = 'ALL' as const;

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, tr } = request;
    if (ctx.kind === 'PARENT_ACCOUNT') {
      return { text: tr('language.unsupported') };
    }
    return {
      text: tr('language.title'),
      keyboard: languageKeyboard({ tr, cb: request.cb }),
    };
  }
}

/**
 * `/unlink` — shows a confirmation prompt only.
 *
 * The disconnect itself happens on the signed, short-lived confirm callback;
 * `/unlink` on its own never disconnects anything.
 */
@Injectable()
export class UnlinkCommand implements TelegramCommandHandler {
  readonly name = 'unlink';
  readonly descriptionKey = 'unlink.title';
  readonly roles = 'ALL' as const;

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { tr } = request;
    return {
      text: `${escapeHtml(tr('unlink.title'))}\n\n${escapeHtml(tr('unlink.warning'))}`,
      keyboard: unlinkConfirmKeyboard({ tr, cb: request.cb }),
    };
  }
}
