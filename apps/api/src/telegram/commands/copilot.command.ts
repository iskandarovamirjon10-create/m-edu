import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { isAdminRole } from '../../auth/authorization.policy';
import { TelegramAttemptLimiter } from '../telegram-attempt-limiter.service';
import { TelegramCommandHandler, TelegramRequestContext } from './command.interface';
import { TelegramReply } from '../ui/telegram-ui.types';
import { backKeyboard } from '../ui/keyboards';
import { escapeHtml } from '../ui/format';
import {
  TELEGRAM_COPILOT_MAX_ANSWER_LENGTH,
  TELEGRAM_COPILOT_MAX_PER_WINDOW,
  TELEGRAM_COPILOT_MAX_QUESTION_LENGTH,
  TELEGRAM_COPILOT_WINDOW_SECONDS,
} from '../telegram.constants';

/**
 * `/copilot` — the M-EDU AI Copilot inside Telegram.
 *
 * This is the SAME assistant as the web Copilot: it calls the same
 * `AiService`, so the identity, the "M-EDU topics only" rule, the prompt
 * hardening and the tenant statistics are identical in both channels.
 *
 * Security model:
 *   - the tenant and principal come from the AUTHENTICATED Telegram context
 *     (`ctx`), never from the message text, so a user can only ever ask about
 *     their own organization;
 *   - the question is untrusted input: length-capped, never logged, never
 *     interpolated into anything but the model request;
 *   - the reply is HTML-escaped (the bot sends `parse_mode: HTML`) and capped
 *     below Telegram's 4096-character message limit, with any entity truncated
 *     mid-way repaired so Telegram cannot reject the message;
 *   - a tighter Redis-backed budget than a plain command, because every turn
 *     costs a model invocation;
 *   - any failure collapses to a localized message: no stack trace, no system
 *     prompt, no identifiers, no provider detail.
 */
@Injectable()
export class CopilotCommand implements TelegramCommandHandler {
  readonly name = 'copilot';
  readonly descriptionKey = 'copilot.description';
  readonly roles = 'ALL' as const;

  private readonly logger = new Logger(CopilotCommand.name);

  constructor(
    private readonly ai: AiService,
    private readonly limiter: TelegramAttemptLimiter,
  ) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, tr, chatId } = request;
    const keyboard = backKeyboard({ tr, cb: request.cb });
    const question = request.args.trim();

    // No question: introduce the assistant instead of calling the model.
    if (!question) {
      return {
        text: [
          escapeHtml(tr('copilot.title')),
          '',
          escapeHtml(tr('copilot.intro')),
          escapeHtml(tr('copilot.introHint')),
          '',
          escapeHtml(tr('copilot.usage')),
        ].join('\n'),
        keyboard,
      };
    }

    const scope = `copilot:${chatId}`;
    if (await this.limiter.isBlocked(scope, TELEGRAM_COPILOT_MAX_PER_WINDOW)) {
      return { text: tr('copilot.throttled'), keyboard };
    }
    await this.limiter.hit(scope, TELEGRAM_COPILOT_WINDOW_SECONDS);

    const canIncludeFinancials = Boolean(
      ctx.role && (isAdminRole(ctx.role) || ctx.role.toUpperCase() === 'ACCOUNTANT'),
    );

    try {
      const answer = await this.ai.chat(
        ctx.organizationId,
        ctx.userId ?? ctx.principalId,
        question.slice(0, TELEGRAM_COPILOT_MAX_QUESTION_LENGTH),
        [],
        undefined,
        canIncludeFinancials,
        undefined,
        {
          userRole: ctx.role,
          principalType: ctx.kind,
          studentId: ctx.studentId,
          parentId: ctx.parentId,
        },
      );
      const content = typeof answer?.content === 'string' ? answer.content.trim() : '';
      if (!content) return { text: tr('copilot.error'), keyboard };

      return {
        text: `${escapeHtml(tr('copilot.title'))}\n\n${this.safeBody(content)}`,
        keyboard,
      };
    } catch (error: unknown) {
      // Logged for operators, never echoed to the chat.
      this.logger.error(
        JSON.stringify({
          event: 'telegram_copilot_error',
          chatId,
          organizationId: ctx.organizationId,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return { text: tr('copilot.error'), keyboard };
    }
  }

  /**
   * Escape, cap and repair the model output.
   *
   * Escaping first keeps every `<`/`&` inert; truncating afterwards can split
   * an entity (`&amp;` -> `&am`), which Telegram would reject with a 400, so a
   * dangling partial entity is trimmed before the ellipsis is appended.
   */
  private safeBody(content: string): string {
    const escaped = escapeHtml(content);
    if (escaped.length <= TELEGRAM_COPILOT_MAX_ANSWER_LENGTH) return escaped;
    const head = escaped
      .slice(0, TELEGRAM_COPILOT_MAX_ANSWER_LENGTH - 1)
      .replace(/&[#a-zA-Z0-9]{0,10}$/, '');
    return `${head}…`;
  }
}
