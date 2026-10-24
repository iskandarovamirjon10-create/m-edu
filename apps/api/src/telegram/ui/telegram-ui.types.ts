/**
 * Minimal Telegram Bot API UI types for inline keyboards.
 *
 * Intentionally local and narrow: the project does not depend on a Telegram
 * SDK, and only the fields this integration actually sends are modelled.
 */

export interface InlineKeyboardButton {
  text: string;
  /** Callback payload — always an opaque, server-verified envelope. */
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
}

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

/** A rendered bot reply: text plus an optional inline keyboard. */
export interface TelegramReply {
  text: string;
  keyboard?: InlineKeyboardMarkup;
}
