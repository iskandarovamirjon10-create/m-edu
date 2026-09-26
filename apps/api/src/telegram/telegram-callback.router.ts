import { Injectable, Logger } from '@nestjs/common';
import { ParentPortalService } from '../parent-portal/parent-portal.service';
import { UsersService } from '../users/users.service';
import {
  TelegramContext,
  TelegramContextError,
  TelegramContextService,
} from './telegram-context.service';
import { TelegramCommandRouter, PAGINATED_COMMANDS } from './telegram-command.router';
import { TelegramCallbackService } from './telegram-callback.service';
import { TelegramAttemptLimiter } from './telegram-attempt-limiter.service';
import { TelegramLinkService } from './telegram-link.service';
import { CallbackCodes } from './ui/keyboards';
import { childActionsKeyboard } from './ui/keyboards';
import {
  NOTIFICATION_CATEGORIES,
  NotificationPreferenceService,
} from '../notifications/notification-preference.service';
import { TelegramNotificationPolicyService } from '../notifications/telegram-notification-policy.service';
import {
  buildRequest,
  childPickerReply,
  errorKeyForContextFailure,
  resolveChildByIndex,
} from './commands/command-helpers';
import { TelegramHandlingResult } from './telegram-command.router';
import { TelegramLanguage, normalizeLanguage, resolveLanguage, t } from './i18n/telegram-i18n';
import { escapeHtml } from './ui/format';
import {
  TELEGRAM_CALLBACK_MAX_PER_WINDOW,
  TELEGRAM_CALLBACK_WINDOW_SECONDS,
} from './telegram.constants';

export interface TelegramCallbackInput {
  chatId: string;
  data: string;
  telegramLanguageCode?: string | null;
}

/** Bound the raw update size before any decode/verification work. */
const MAX_CALLBACK_DATA_LENGTH = 128;

/** Child-action callback -> the parent-portal permission flag it must satisfy. */
const CHILD_DOMAIN_BY_CODE: Record<string, 'payments' | 'attendance' | null> = {
  [CallbackCodes.CHILD_PAYMENTS]: 'payments',
  [CallbackCodes.CHILD_ATTENDANCE]: 'attendance',
  // Schedule is academic data gated by the attendance flag (see parent-portal).
  [CallbackCodes.CHILD_SCHEDULE]: 'attendance',
  [CallbackCodes.CHILD_PROFILE]: null,
};

const MAX_PAGE = 20;

/**
 * Modular inline-keyboard callback router.
 *
 * `callback_data` is fully attacker-controlled, so nothing in it is trusted:
 *   - the envelope is signature- and chat-bound (see TelegramCallbackService),
 *   - the M-EDU context is re-resolved from the chat on every press,
 *   - child selections are re-resolved from the CALLER'S own authorized
 *     children list by index (a substituted index cannot reach another
 *     parent's child),
 *   - every underlying read still goes through the parent-portal / application
 *     services, which re-verify the relationship and the per-domain flags.
 */
@Injectable()
export class TelegramCallbackRouter {
  private readonly logger = new Logger(TelegramCallbackRouter.name);

  constructor(
    private readonly commands: TelegramCommandRouter,
    private readonly contextService: TelegramContextService,
    private readonly callbacks: TelegramCallbackService,
    private readonly limiter: TelegramAttemptLimiter,
    private readonly parentPortal: ParentPortalService,
    private readonly links: TelegramLinkService,
    private readonly users: UsersService,
    private readonly preferences: NotificationPreferenceService,
    private readonly policy: TelegramNotificationPolicyService,
  ) {}

  async handle(input: TelegramCallbackInput): Promise<TelegramHandlingResult> {
    const fallbackLanguage = resolveLanguage(null, null, input.telegramLanguageCode);

    const scope = `cb:${input.chatId}`;
    if (await this.limiter.isBlocked(scope, TELEGRAM_CALLBACK_MAX_PER_WINDOW)) {
      return { reply: null, toast: t(fallbackLanguage, 'error.rateLimited') };
    }
    await this.limiter.hit(scope, TELEGRAM_CALLBACK_WINDOW_SECONDS);

    // Cheap rejection before context resolution: no legitimate envelope is
    // ever this long (the encoder caps at Telegram's 64-byte callback_data).
    if (typeof input.data !== 'string' || input.data.length > MAX_CALLBACK_DATA_LENGTH) {
      return { reply: null, toast: t(fallbackLanguage, 'error.invalidCallback') };
    }

    let ctx: TelegramContext;
    try {
      ctx = await this.contextService.resolve(input.chatId);
    } catch (err: unknown) {
      if (err instanceof TelegramContextError) {
        return {
          reply: null,
          toast: t(fallbackLanguage, errorKeyForContextFailure(err.code)),
        };
      }
      return { reply: null, toast: t(fallbackLanguage, 'error.generic') };
    }

    // Signature + chat binding + expiry. A payload captured from another chat
    // fails here, which is what defeats cross-user callback replay.
    const envelope = this.callbacks.decode(input.data, input.chatId);
    if (!envelope) {
      this.logger.warn(
        JSON.stringify({ event: 'telegram_callback_rejected', chatId: input.chatId }),
      );
      return { reply: null, toast: t(ctx.language, 'error.invalidCallback') };
    }

    try {
      return await this.dispatch(envelope.code, envelope.arg, ctx, input.chatId, input.data);
    } catch (err: unknown) {
      this.logger.error(
        JSON.stringify({
          event: 'telegram_callback_error',
          chatId: input.chatId,
          code: envelope.code,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      return { reply: null, toast: t(ctx.language, 'error.generic') };
    }
  }

  private async dispatch(
    code: string,
    arg: string | null,
    ctx: TelegramContext,
    chatId: string,
    /** Raw verified payload; the input to the one-time replay claim. */
    rawPayload: string,
  ): Promise<TelegramHandlingResult> {
    const language = ctx.language;

    switch (code) {
      case CallbackCodes.MAIN_MENU:
        return this.commands.executeCommand('menu', chatId, { ctx });

      case CallbackCodes.HELP:
        return this.commands.executeCommand('help', chatId, { ctx });

      case CallbackCodes.ADMIN_MENU:
        return this.commands.executeCommand('admin', chatId, { ctx });

      case CallbackCodes.TEACHER_MENU:
        return this.commands.executeCommand('teacher', chatId, { ctx });

      case 'cmd': {
        if (!arg) return { reply: null, toast: t(language, 'error.invalidCallback') };
        // Unknown names are rejected by the router (error.unsupported).
        return this.commands.executeCommand(arg, chatId, { ctx });
      }

      case CallbackCodes.CHILD_SELECT:
        return this.renderChildSelect(ctx, chatId, arg);

      case CallbackCodes.CHILD_ATTENDANCE:
      case CallbackCodes.CHILD_SCHEDULE:
      case CallbackCodes.CHILD_PAYMENTS:
      case CallbackCodes.CHILD_PROFILE:
        return this.renderChildAction(code, ctx, chatId, arg);

      case CallbackCodes.PAGE:
        return this.renderPage(ctx, chatId, arg);

      case CallbackCodes.LANGUAGE:
        return this.changeLanguage(ctx, arg);

      case CallbackCodes.SETTINGS_TELEGRAM:
        return this.setTelegramChannel(ctx, chatId, arg);

      case CallbackCodes.SETTINGS_QUIET_HOURS:
        return this.setQuietHours(ctx, chatId, arg);

      case CallbackCodes.SETTINGS_CATEGORIES:
        return this.renderSettingsCategories(chatId);

      case CallbackCodes.SETTINGS_CATEGORY:
        return this.toggleCategory(ctx, chatId, arg);

      case CallbackCodes.UNLINK_CONFIRM:
        return this.confirmUnlink(ctx, rawPayload);

      case CallbackCodes.UNLINK_CANCEL:
        return { reply: { text: t(language, 'unlink.cancelled') } };

      default:
        return { reply: null, toast: t(language, 'error.invalidCallback') };
    }
  }

  /** Child picker: with no argument, list children; with one, show actions. */
  private async renderChildSelect(
    ctx: TelegramContext,
    chatId: string,
    arg: string | null,
  ): Promise<TelegramHandlingResult> {
    const request = buildRequest({ chatId, ctx, callbacks: this.callbacks });

    if (arg === null) {
      return { reply: await childPickerReply(request, this.parentPortal) };
    }

    const child = await resolveChildByIndex(this.parentPortal, ctx, Number.parseInt(arg, 10));
    if (!child) {
      return { reply: null, toast: t(ctx.language, 'error.not_found') };
    }

    return {
      reply: {
        text: `${escapeHtml(t(ctx.language, 'children.title'))}\n${escapeHtml(child.name)}`,
        keyboard: childActionsKeyboard({ tr: request.tr, cb: request.cb }, child.index),
      },
    };
  }

  private async renderChildAction(
    code: string,
    ctx: TelegramContext,
    chatId: string,
    arg: string | null,
  ): Promise<TelegramHandlingResult> {
    const language = ctx.language;
    const handler = this.commands.childCommand(code);
    if (!handler || typeof handler.renderForChild !== 'function') {
      return { reply: null, toast: t(language, 'error.invalidCallback') };
    }

    const child = await resolveChildByIndex(
      this.parentPortal,
      ctx,
      Number.parseInt(arg ?? '', 10),
    );
    if (!child) {
      // Out-of-range index: either the index was tampered with or the
      // relationship no longer exists. Both are reported as "not found" so the
      // response reveals nothing about other parents' children.
      this.logger.warn(
        JSON.stringify({ event: 'telegram_child_denied', chatId, code }),
      );
      return { reply: null, toast: t(language, 'error.not_found') };
    }

    const domain = CHILD_DOMAIN_BY_CODE[code];
    if (domain && !child.permissions[domain]) {
      this.logger.warn(
        JSON.stringify({ event: 'telegram_child_domain_denied', chatId, code, domain }),
      );
      return { reply: null, toast: t(language, 'error.not_found') };
    }

    const request = buildRequest({ chatId, ctx, callbacks: this.callbacks });
    return { reply: await handler.renderForChild(request, child) };
  }

  /** Pagination: the list name must be a paginatable command, the page bounded. */
  private async renderPage(
    ctx: TelegramContext,
    chatId: string,
    arg: string | null,
  ): Promise<TelegramHandlingResult> {
    const language = ctx.language;
    const [list, rawPage] = (arg ?? '').split(':');
    const page = Number.parseInt(rawPage ?? '', 10);

    if (
      !list ||
      !(PAGINATED_COMMANDS as readonly string[]).includes(list) ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > MAX_PAGE
    ) {
      return { reply: null, toast: t(language, 'error.invalidCallback') };
    }

    // Re-running the command re-applies its own authorization scoping; the
    // cursor only selects a page of data the caller may already see.
    return this.commands.executeCommand(list, chatId, { ctx, page });
  }

  private async changeLanguage(
    ctx: TelegramContext,
    arg: string | null,
  ): Promise<TelegramHandlingResult> {
    const language = ctx.language;
    const target: TelegramLanguage | null = normalizeLanguage(arg);
    if (!target) return { reply: null, toast: t(language, 'error.invalidCallback') };

    if (ctx.kind !== 'USER' || !ctx.userId) {
      return { reply: null, toast: t(language, 'language.unsupported') };
    }

    await this.users.updateSettings(
      ctx.organizationId,
      ctx.userId,
      { language: target },
      ctx.userId,
      ctx.role,
    );

    return { reply: { text: t(target, 'language.changed', { language: target.toUpperCase() }) } };
  }

  /**
   * Toggle the Telegram notification channel.
   *
   * The signed payload carries the TARGET value (on|off), never a flip
   * instruction, so replaying a captured button re-applies the same state
   * instead of inverting it. The write goes through `UsersService` (the
   * application service), and the screen is re-rendered from freshly-resolved
   * state, so what the user sees is what the server stored.
   */
  private async setTelegramChannel(
    ctx: TelegramContext,
    chatId: string,
    arg: string | null,
  ): Promise<TelegramHandlingResult> {
    const language = ctx.language;
    if (ctx.kind !== 'USER' || !ctx.userId) {
      return { reply: null, toast: t(language, 'settings.unavailable') };
    }
    if (arg !== 'on' && arg !== 'off') {
      return { reply: null, toast: t(language, 'error.invalidCallback') };
    }

    await this.users.updateSettings(
      ctx.organizationId,
      ctx.userId,
      { telegramNotifications: arg === 'on' },
      ctx.userId,
      ctx.role,
    );
    return this.rerenderSettings(chatId, language);
  }

  /**
   * Apply a quiet-hours preset (or turn it off).
   *
   * The window is validated before persisting, and the preset form keeps the
   * stored value always well-formed — an inline keyboard cannot collect free
   * text, so presets are the honest UI.
   */
  private async setQuietHours(
    ctx: TelegramContext,
    chatId: string,
    arg: string | null,
  ): Promise<TelegramHandlingResult> {
    const language = ctx.language;
    if (ctx.kind !== 'USER' || !ctx.userId) {
      return { reply: null, toast: t(language, 'settings.unavailable') };
    }

    if (arg === 'off') {
      await this.users.updateSettings(
        ctx.organizationId,
        ctx.userId,
        { quietHoursEnabled: false },
        ctx.userId,
        ctx.role,
      );
      return this.rerenderSettings(chatId, language);
    }

    const [start, end] = (arg ?? '').split('-');
    if (!this.policy.isValidQuietWindow(start, end)) {
      return { reply: null, toast: t(language, 'error.invalidCallback') };
    }

    await this.users.updateSettings(
      ctx.organizationId,
      ctx.userId,
      { quietHoursEnabled: true, quietHoursStart: start, quietHoursEnd: end },
      ctx.userId,
      ctx.role,
    );
    return this.rerenderSettings(chatId, language);
  }

  /** Toggle ONE notification category's Telegram preference. */
  private async toggleCategory(
    ctx: TelegramContext,
    chatId: string,
    arg: string | null,
  ): Promise<TelegramHandlingResult> {
    const language = ctx.language;
    if (ctx.kind !== 'USER' || !ctx.userId) {
      return { reply: null, toast: t(language, 'settings.unavailable') };
    }

    const [category, state] = (arg ?? '').split(':');
    const known = NOTIFICATION_CATEGORIES.some((entry) => entry.key === category);
    if (!known || (state !== 'on' && state !== 'off')) {
      return { reply: null, toast: t(language, 'error.invalidCallback') };
    }

    await this.preferences.updatePreference(ctx.userId, category, {
      telegramEnabled: state === 'on',
    });

    const result = await this.renderSettingsCategories(chatId);
    return { ...result, toast: t(language, 'settings.saved') };
  }

  /**
   * Re-render `/settings` after a change.
   *
   * Called WITHOUT a pre-resolved context, so identity, role, lifecycle and the
   * persisted settings are all re-read from the database — the confirmation
   * always reflects committed server state.
   */
  private async rerenderSettings(
    chatId: string,
    language: TelegramLanguage,
  ): Promise<TelegramHandlingResult> {
    const result = await this.commands.executeCommand('settings', chatId, {});
    return { reply: result.reply, toast: t(language, 'settings.saved') };
  }

  /** Render the category list from a freshly-resolved context. */
  private async renderSettingsCategories(chatId: string): Promise<TelegramHandlingResult> {
    const ctx = await this.contextService.resolve(chatId);
    const handler = this.commands.handler('settings') as
      | { renderCategories?: (request: unknown) => Promise<unknown> }
      | undefined;
    if (!handler?.renderCategories) {
      return { reply: null, toast: t(ctx.language, 'error.generic') };
    }
    const request = buildRequest({ chatId, ctx, callbacks: this.callbacks });
    return { reply: (await handler.renderCategories(request)) as TelegramHandlingResult['reply'] };
  }

  /**
   * Sensitive single-use actions.
   *
   * HMAC + TTL + chat binding prove the payload is authentic, unexpired and
   * addressed to this chat — none of that prevents a second VALID press of the
   * same payload within its lifetime. State-changing actions therefore take a
   * distributed one-time claim (Redis SET NX) keyed by the exact verified
   * payload: the first press consumes it, and any concurrent or replayed press
   * — on any API instance — is refused.
   */
  private async confirmUnlink(
    ctx: TelegramContext,
    rawPayload: string,
  ): Promise<TelegramHandlingResult> {
    const ttl = this.callbacks.ttlFor(CallbackCodes.UNLINK_CONFIRM);
    const claimed = await this.limiter.tryClaimOnce(
      this.callbacks.claimKeyFor(rawPayload),
      ttl,
    );
    if (!claimed) {
      this.logger.warn(
        JSON.stringify({ event: 'telegram_callback_replay_blocked', chatId: ctx.account.id }),
      );
      return { reply: null, toast: t(ctx.language, 'error.staleCallback') };
    }

    await this.links.unlink({
      sub: ctx.principalId,
      organizationId: ctx.organizationId,
      role: ctx.role,
    });
    // Audit + delivery-pointer cleanup happen inside TelegramLinkService.
    return { reply: { text: t(ctx.language, 'unlink.done') } };
  }
}
