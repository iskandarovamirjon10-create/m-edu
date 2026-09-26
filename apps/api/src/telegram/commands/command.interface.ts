import { TelegramContext } from '../telegram-context.service';
import { TelegramLanguage } from '../i18n/telegram-i18n';
import { TelegramReply } from '../ui/telegram-ui.types';
import { ParentChild } from './command-helpers';

/** DI token for the registered command handlers. */
export const TELEGRAM_COMMANDS = 'TELEGRAM_COMMANDS';

/** Everything a handler needs for one request. Nothing else is available. */
export interface TelegramRequestContext {
  chatId: string;
  /** Fully resolved, freshly authorized M-EDU context. */
  ctx: TelegramContext;
  language: TelegramLanguage;
  /** Translator bound to `language`. */
  tr: (key: string, params?: Record<string, string | number>) => string;
  /** Encoder for signed, chat-bound callback payloads. */
  cb: (code: string, arg?: string) => string;
  /** Raw text after the command word (untrusted, length-capped). */
  args: string;
  /** Page requested by a pagination callback (1-based). */
  page: number;
}

/**
 * A single Telegram command.
 *
 * Handlers are independently instantiable and testable: they receive only the
 * resolved context and return a rendered reply. They must:
 *   - never read identity from Telegram input (use `ctx`),
 *   - never issue raw Prisma queries for business data (call an existing
 *     M-EDU application service),
 *   - never surface internal errors (throw, and the router localizes them).
 */
export interface TelegramCommandHandler {
  /** Command word without the leading slash, e.g. `profile`. */
  readonly name: string;
  /** i18n key used by /help for this command. */
  readonly descriptionKey: string;
  /** Roles allowed to run it, or `'ALL'` for any linked principal. */
  readonly roles: readonly string[] | 'ALL';
  handle(request: TelegramRequestContext): Promise<TelegramReply>;

  /**
   * Callback action code that renders this command for a selected CHILD.
   * Declared by commands that produce parent-facing per-child content, so the
   * callback router can dispatch without importing concrete command classes.
   */
  readonly childActionCode?: string;

  /**
   * Render for a parent's selected child. `child` was resolved from the
   * caller's own authorized children list; implementations MUST still
   * re-verify through the parent-portal service (defense in depth) and honour
   * the per-child permission flags.
   */
  renderForChild?(request: TelegramRequestContext, child: ParentChild): Promise<TelegramReply>;
}

/** True when `role` may run `handler`. */
export function canRun(handler: TelegramCommandHandler, role: string): boolean {
  if (handler.roles === 'ALL') return true;
  return handler.roles.includes(role);
}
