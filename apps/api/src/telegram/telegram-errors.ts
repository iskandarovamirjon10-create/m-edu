/**
 * An error whose message is safe (and expected) to show the Telegram user.
 *
 * Everything that is NOT a `TelegramUserError` is treated as internal: the
 * router logs it structurally and replies with the generic localized error,
 * so Prisma/Redis/BullMQ messages, stack traces and internal ids never reach
 * Telegram.
 */
export class TelegramUserError extends Error {
  constructor(readonly messageKey: string) {
    super(messageKey);
    this.name = 'TelegramUserError';
  }
}
