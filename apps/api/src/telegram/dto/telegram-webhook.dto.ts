import { Allow, IsOptional } from 'class-validator';

/**
 * Telegram Bot API update envelope.
 *
 * Telegram is an external, untrusted producer: the webhook validates against
 * its documented envelope instead of accepting `any`. Unknown top-level fields
 * are rejected by the global `forbidNonWhitelisted` pipe, and the documented
 * update keys are whitelisted below. Nested payloads are opaque `@Allow()`
 * values — only `message.{text,from,chat.id}` and
 * `callback_query.{id,data,from,message.chat.id}` are ever read.
 *
 * Every field here is UNTRUSTED. `from.id` / `chat.id` identify the Telegram
 * side only and are never used as an authorization input.
 *
 * NOTE: declaration order matters. `emitDecoratorMetadata` emits the property
 * type of decorated fields eagerly, so every class must be declared before it
 * is referenced.
 */

export class TelegramChatDto {
  @Allow()
  id?: string | number;
}

/**
 * Sender profile. `id` is Telegram's int64 user id, kept as `number | string`
 * so it survives whatever JSON numeric precision the proxy delivers.
 */
export class TelegramFromDto {
  @IsOptional() @Allow()
  id?: string | number;

  @IsOptional() @Allow()
  is_bot?: boolean;

  @IsOptional() @Allow()
  username?: string;

  @IsOptional() @Allow()
  first_name?: string;

  @IsOptional() @Allow()
  last_name?: string;

  @IsOptional() @Allow()
  language_code?: string;
}

export class TelegramMessageDto {
  @IsOptional() @Allow()
  chat?: TelegramChatDto;

  @IsOptional() @Allow()
  from?: TelegramFromDto;

  @IsOptional() @Allow()
  text?: string;
}

/** Inline-keyboard press. `data` is fully attacker-controlled. */
export class TelegramCallbackQueryDto {
  @IsOptional() @Allow()
  id?: string;

  @IsOptional() @Allow()
  data?: string;

  @IsOptional() @Allow()
  from?: TelegramFromDto;

  /** The message the button belongs to — used to resolve the chat id. */
  @IsOptional() @Allow()
  message?: TelegramMessageDto;
}

export class TelegramUpdateDto {
  @IsOptional() @Allow()
  update_id?: number;

  @IsOptional() @Allow()
  message?: TelegramMessageDto;

  @IsOptional() @Allow()
  edited_message?: TelegramMessageDto;

  @IsOptional() @Allow()
  channel_post?: TelegramMessageDto;

  @IsOptional() @Allow()
  edited_channel_post?: TelegramMessageDto;

  @IsOptional() @Allow()
  business_connection?: unknown;

  @IsOptional() @Allow()
  business_message?: TelegramMessageDto;

  @IsOptional() @Allow()
  edited_business_message?: TelegramMessageDto;

  @IsOptional() @Allow()
  deleted_business_messages?: unknown;

  @IsOptional() @Allow()
  message_reaction?: unknown;

  @IsOptional() @Allow()
  message_reaction_count?: unknown;

  @IsOptional() @Allow()
  inline_query?: unknown;

  @IsOptional() @Allow()
  chosen_inline_result?: unknown;

  @IsOptional() @Allow()
  callback_query?: TelegramCallbackQueryDto;

  @IsOptional() @Allow()
  shipping_query?: unknown;

  @IsOptional() @Allow()
  pre_checkout_query?: unknown;

  @IsOptional() @Allow()
  purchased_paid_media?: unknown;

  @IsOptional() @Allow()
  poll?: unknown;

  @IsOptional() @Allow()
  poll_answer?: unknown;

  @IsOptional() @Allow()
  my_chat_member?: unknown;

  @IsOptional() @Allow()
  chat_member?: unknown;

  @IsOptional() @Allow()
  chat_join_request?: unknown;

  @IsOptional() @Allow()
  chat_boost?: unknown;

  @IsOptional() @Allow()
  removed_chat_boost?: unknown;
}
