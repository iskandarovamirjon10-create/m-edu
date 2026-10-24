import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Callback actions whose value must expire quickly and never be replayable
 * for long: disconnecting the link and changing language.
 */
/**
 * Actions that must expire quickly: disconnect, language, and the settings
 * toggles (channel / quiet hours / category). `sc` (open the category list) is
 * navigation and keeps the long TTL.
 */
const SENSITIVE_CODES = new Set(['ul', 'lg', 'st', 'sq', 'sx']);

const NAVIGATION_TTL_SECONDS = 60 * 60; // 1h — re-authorized on every press
const SENSITIVE_TTL_SECONDS = 5 * 60; // 5min

/** Truncated HMAC (80 bits) keeps `callback_data` inside Telegram's 64-byte cap. */
const SIGNATURE_BYTES = 10;

/**
 * Codes that must be consumed AT MOST ONCE (state-changing actions).
 *
 * The HMAC/TTL/chat-binding envelope already bounds what a captured payload is
 * worth, but a sensitive action must not be repeatable within its lifetime —
 * e.g. an unlink confirm captured from the same chat (the attacker's own
 * chat session) must not be re-pressable after the first use. Codes listed
 * here get a distributed one-time claim at dispatch time (see
 * TelegramCallbackRouter); navigation codes do not, because re-pressing a
 * menu/pagination button is normal usage and every press re-authorizes.
 */
export const ONE_TIME_CALLBACK_CODES = new Set(['ul']);

export interface CallbackEnvelope {
  code: string;
  arg: string | null;
}

/**
 * Opaque, signed, chat-bound callback payloads.
 *
 * Telegram rejects `callback_data` longer than 64 bytes, and a callback is
 * fully attacker-controlled: anyone can replay or forge the JSON Telegram
 * delivers. The envelope is therefore:
 *
 *     <code>~<argBase64url>~<expEpochBase36>~<hmac10>
 *
 * where the HMAC covers `code|arg|exp|chatId`. Binding the CHAT ID means a
 * callback captured from one conversation cannot be replayed from another —
 * the signature will not verify. The TTL bounds replay of navigation presses
 * and makes sensitive actions (unlink, language) short-lived.
 *
 * A valid signature is NOT authorization. Handlers always re-resolve the
 * principal and re-authorize the underlying resource server-side.
 */
@Injectable()
export class TelegramCallbackService {
  private readonly logger = new Logger(TelegramCallbackService.name);
  private readonly secret: Buffer | null;

  constructor(private readonly config?: ConfigService) {
    // Prefer a dedicated secret; fall back to JWT_SECRET (always present) so
    // the feature cannot silently break on an existing deployment.
    const raw =
      this.config?.get<string>('TELEGRAM_CALLBACK_SECRET') ||
      this.config?.get<string>('JWT_SECRET');
    this.secret = raw ? Buffer.from(raw, 'utf8') : null;
    if (!this.secret) {
      this.logger.error(
        JSON.stringify({ event: 'telegram_callback_secret_missing' }),
      );
    }
  }

  isConfigured(): boolean {
    return this.secret !== null;
  }

  /** True when a code is a short-lived sensitive action. */
  isSensitive(code: string): boolean {
    return SENSITIVE_CODES.has(code);
  }

  /**
   * True when a code must be consumed at most once (see ONE_TIME_CALLBACK_CODES).
   * The claim itself is distributed (Redis SET NX), executed by the router.
   */
  isOneTime(code: string): boolean {
    return ONE_TIME_CALLBACK_CODES.has(code);
  }

  /**
   * Stable replay-claim key for an envelope.
   *
   * NOTE: the HMAC is deterministic over (code, arg, exp, chat) with a fixed
   * key, so a full payload re-signed at different moments differs only in
   * `exp` — hashing the VERIFIED payload yields a key that is identical for
   * every replay of the same payload and different for any tampered one.
   */
  claimKeyFor(data: string): string {
    return createHash('sha256').update('cb-once').update(data).digest('hex');
  }

  /** Remaining lifetime of a payload, for sizing the one-time claim TTL. */
  ttlFor(code: string): number {
    return SENSITIVE_CODES.has(code) ? SENSITIVE_TTL_SECONDS : NAVIGATION_TTL_SECONDS;
  }

  /**
   * Encode a callback payload bound to `chatId`.
   * @throws when no signing secret is configured (fail closed, not unsigned).
   */
  encode(code: string, arg: string | null, chatId: string, ttlSeconds?: number): string {
    if (!this.secret) {
      throw new Error('Telegram callback signing secret is not configured');
    }
    const ttl = ttlSeconds ?? this.ttlFor(code);
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const argPart = Buffer.from(arg ?? '', 'utf8').toString('base64url');
    const expPart = exp.toString(36);
    const signature = this.sign(code, arg ?? '', expPart, chatId);
    return `${code}~${argPart}~${expPart}~${signature}`;
  }

  /**
   * Decode and verify a payload for `chatId`.
   * @returns the envelope, or `null` when malformed/forged/expired.
   */
  decode(data: string, chatId: string): CallbackEnvelope | null {
    if (!this.secret || typeof data !== 'string') return null;

    const parts = data.split('~');
    if (parts.length !== 4) return null;

    const [code, argPart, expPart, signature] = parts;
    if (!code || !expPart || !signature) return null;

    const exp = Number.parseInt(expPart, 36);
    if (!Number.isFinite(exp)) return null;
    if (exp <= Math.floor(Date.now() / 1000)) return null;

    let arg = '';
    try {
      arg = Buffer.from(argPart, 'base64url').toString('utf8');
    } catch {
      return null;
    }

    const expected = this.sign(code, arg, expPart, chatId);
    if (!this.safeEqual(signature, expected)) return null;

    return { code, arg: arg.length > 0 ? arg : null };
  }

  private sign(code: string, arg: string, expPart: string, chatId: string): string {
    return createHmac('sha256', this.secret as Buffer)
      .update(`${code}|${arg}|${expPart}|${chatId}`)
      .digest()
      .subarray(0, SIGNATURE_BYTES)
      .toString('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
