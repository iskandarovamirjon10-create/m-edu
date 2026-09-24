import { Allow, IsOptional } from 'class-validator';

/**
 * Telegram Bot API update envelope (SF-4).
 *
 * The webhook previously accepted `@Body() body: any`. Telegram is an external
 * producer, so we validate against its documented envelope instead of trusting
 * the payload. Unknown top-level fields are rejected by the global
 * `forbidNonWhitelisted` pipe; the documented update keys are whitelisted
 * below. Nested payloads are intentionally left as opaque `@Allow()` values —
 * we only read `message.text` and `message.chat.id`.
 */

export class TelegramChatDto {
  @Allow()
  id?: string | number;
}

export class TelegramMessageDto {
  @IsOptional() @Allow()
  chat?: TelegramChatDto;

  @IsOptional() @Allow()
  text?: string;
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
  callback_query?: unknown;

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
