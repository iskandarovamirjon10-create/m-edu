import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Real SMS delivery for the Uzbekistan market via Eskiz.uz
 * (https://notify.eskiz.uz) with PlayMobile.uz as an alternative provider.
 *
 * Eskiz flow:
 *   1. POST /api/auth/login  { email, password } -> { data: { token } }
 *      Tokens are valid for a fixed window; this service caches the token in
 *      memory and transparently re-authenticates when it expires or when the
 *      API answers 401 ("token expired" / "Unauthenticated.").
 *   2. POST /api/message/sms/send  { mobile_phone, message, from }
 *      -> { id, status }
 *
 * Every attempt (success or failure) is persisted to the SMSLog table so the
 * admin UI can audit delivery costs and failures. When credentials are NOT
 * configured the service degrades honestly: sendSms() returns false and logs
 * a FAILED SMSLog row — it never fakes success.
 */
export type SmsFailureCategory =
  | 'INVALID_PHONE'
  | 'NOT_CONFIGURED'
  | 'DAILY_LIMIT_REACHED'
  | 'INSUFFICIENT_CREDITS'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR';

export interface SendSmsResult {
  ok: boolean;
  externalId?: string | null;
  failureCategory?: SmsFailureCategory;
  errorMessage?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: 'Eskiz' | 'PlayMobile' | 'STUB';
  private readonly maxRetries = 3;

  // Eskiz credentials
  private readonly eskizEmail?: string;
  private readonly eskizPassword?: string;

  // PlayMobile credentials
  private readonly playmobileBaseUrl?: string;
  private readonly playmobileToken?: string;

  /** Cached provider token with its expiry instant. */
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;
  private tokenRefreshPromise: Promise<string> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const rawProvider = this.configService?.get?.<string>('SMS_PROVIDER', 'STUB') || 'STUB';
    this.provider = (['Eskiz', 'PlayMobile'] as const).includes(rawProvider as never)
      ? (rawProvider as 'Eskiz' | 'PlayMobile')
      : 'STUB';
    this.eskizEmail = this.configService?.get?.<string>('ESKIZ_EMAIL');
    this.eskizPassword = this.configService?.get?.<string>('ESKIZ_PASSWORD');
    this.playmobileBaseUrl = this.configService?.get?.<string>('PLAYMOBILE_BASE_URL');
    this.playmobileToken = this.configService?.get?.<string>('PLAYMOBILE_TOKEN');

    if (this.provider !== 'STUB' && !this.isConfigured()) {
      this.logger.warn(
        `SMS_PROVIDER=${this.provider} but its credentials are missing — SMS delivery is disabled.`,
      );
    }
  }

  isConfigured(): boolean {
    switch (this.provider) {
      case 'Eskiz':
        return Boolean(this.eskizEmail && this.eskizPassword);
      case 'PlayMobile':
        return Boolean(this.playmobileBaseUrl && this.playmobileToken);
      default:
        return false;
    }
  }

  // ======================================================================
  // TOKEN MANAGEMENT (Eskiz)
  // ======================================================================

  /**
   * Returns a valid Eskiz token, refreshing it when expired.
   * Concurrent callers share a single in-flight refresh (single-flight).
   */
  private async getEskizToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    // Single-flight: collapse concurrent refreshes into one HTTP call.
    if (!this.tokenRefreshPromise) {
      this.tokenRefreshPromise = this.fetchEskizToken().finally(() => {
        this.tokenRefreshPromise = null;
      });
    }
    return this.tokenRefreshPromise;
  }

  private async fetchEskizToken(): Promise<string> {
    if (!this.eskizEmail || !this.eskizPassword) {
      throw new Error('Eskiz credentials are not configured (ESKIZ_EMAIL / ESKIZ_PASSWORD)');
    }

    const response = await fetch('https://notify.eskiz.uz/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.eskizEmail,
        password: this.eskizPassword,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Eskiz auth failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: { token?: string };
      message?: string;
    };
    const token = data.data?.token;
    if (!token) {
      throw new Error(`Eskiz auth returned no token: ${data.message ?? 'unknown'}`);
    }

    // Eskiz tokens last ~24h; refresh defensively after 20h.
    this.cachedToken = token;
    this.tokenExpiresAt = Date.now() + 20 * 60 * 60 * 1000;
    this.logger.log('Eskiz SMS token acquired');
    return token;
  }

  /** Force a token refresh after a 401 from the send endpoint. */
  private async invalidateAndRefreshEskizToken(): Promise<string> {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
    return this.getEskizToken();
  }

  // ======================================================================
  // PROVIDER TRANSPORTS
  // ======================================================================

  private async sendViaEskiz(
    to: string,
    message: string,
    token: string,
  ): Promise<{ externalId: string | null }> {
    const response = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile_phone: to.replace(/[^0-9]/g, ''),
        message,
        from: this.configService.get<string>('SMS_SENDER_NAME', '4546'),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    // 401 => token expired: let the caller refresh once and retry.
    if (response.status === 401) {
      throw new TokenExpiredError('Eskiz token expired');
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Eskiz API error: HTTP ${response.status} — ${errText}`);
    }

    const data = (await response.json()) as { id?: string | number; message?: string };
    return { externalId: data.id != null ? String(data.id) : null };
  }

  private async sendViaPlayMobile(
    to: string,
    message: string,
  ): Promise<{ externalId: string | null }> {
    // PlayMobile.uz personal-account API: POST /message/send with a static
    // bearer token issued in the merchant cabinet.
    const url = new URL('/message/send', this.playmobileBaseUrl).toString();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.playmobileToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: to.replace(/[^0-9+]/g, ''),
        text: message,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PlayMobile API error: HTTP ${response.status} — ${errText}`);
    }

    const data = (await response.json()) as { id?: string | number; code?: number };
    return { externalId: data.id != null ? String(data.id) : null };
  }

  private async sendViaProvider(
    to: string,
    message: string,
  ): Promise<{ externalId: string | null }> {
    if (this.provider === 'Eskiz') {
      const token = await this.getEskizToken();
      return this.sendViaEskiz(to, message, token);
    }
    if (this.provider === 'PlayMobile') {
      return this.sendViaPlayMobile(to, message);
    }
    throw new Error(`SMS provider ${this.provider} is not supported.`);
  }

  // ======================================================================
  // PUBLIC SEND & DETAILED DELIVERY RESULT
  // ======================================================================

  private categorizeError(errorText: string): SmsFailureCategory {
    const lower = errorText.toLowerCase();
    if (
      lower.includes('balance') ||
      lower.includes('credit') ||
      lower.includes('mablag') ||
      lower.includes('yetarli') ||
      lower.includes('402') ||
      lower.includes('payment') ||
      lower.includes('tariff')
    ) {
      return 'INSUFFICIENT_CREDITS';
    }
    if (lower.includes('quota') || lower.includes('limit')) {
      return 'DAILY_LIMIT_REACHED';
    }
    if (
      lower.includes('timeout') ||
      lower.includes('econnrefused') ||
      lower.includes('econnreset') ||
      lower.includes('fetch failed') ||
      lower.includes('network')
    ) {
      return 'NETWORK_ERROR';
    }
    return 'PROVIDER_ERROR';
  }

  async sendSmsDetailed(
    to: string,
    message: string,
    organizationId?: string,
  ): Promise<SendSmsResult> {
    if (!to || !message) {
      this.logger.warn('Cannot send SMS: missing phone number or message.');
      return { ok: false, failureCategory: 'INVALID_PHONE', errorMessage: 'Missing phone number or message' };
    }

    if (!this.isConfigured()) {
      this.logger.warn(
        `SMS not configured (provider=${this.provider}). SMS to ${to} will NOT be sent.`,
      );
      if (organizationId) {
        await this.logSms({
          organizationId,
          recipient: to,
          message,
          status: 'FAILED',
          errorMessage: `SMS provider not configured (provider=${this.provider})`,
        });
      }
      return { ok: false, failureCategory: 'NOT_CONFIGURED', errorMessage: `SMS provider not configured (${this.provider})` };
    }

    const dailyLimit = Number(this.configService?.get?.<string>('SMS_DAILY_LIMIT_PER_ORG') || 1000);
    if (organizationId && dailyLimit > 0 && typeof this.prisma?.sMSLog?.count === 'function') {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      try {
        const sentToday = await this.prisma.sMSLog.count({
          where: {
            organizationId,
            status: 'DELIVERED',
            createdAt: { gte: todayStart },
          },
        });
        if (sentToday >= dailyLimit) {
          const errMsg = `Daily SMS quota reached (${sentToday}/${dailyLimit})`;
          this.logger.warn(
            `Daily SMS limit (${dailyLimit}) reached for organization ${organizationId}. Suppressing SMS.`,
          );
          await this.logSms({
            organizationId,
            recipient: to,
            message,
            status: 'FAILED',
            errorMessage: errMsg,
          });
          return { ok: false, failureCategory: 'DAILY_LIMIT_REACHED', errorMessage: errMsg };
        }
      } catch (countErr) {
        this.logger.warn('Failed to query daily SMS count; proceeding safely', { error: String(countErr) });
      }
    }

    let currentAttempt = 0;
    let tokenRefreshed = false;
    let lastError: unknown = null;

    while (currentAttempt < this.maxRetries) {
      try {
        currentAttempt++;
        this.logger.log(
          `[${this.provider}] Sending SMS to ${to} (attempt ${currentAttempt})`,
        );

        const { externalId } = await this.sendViaProvider(to, message);

        this.logger.log(`SMS delivered to ${to}`);
        if (organizationId) {
          await this.logSms({
            organizationId,
            recipient: to,
            message,
            status: 'DELIVERED',
            externalId,
            sentAt: new Date(),
            deliveredAt: new Date(),
          });
        }
        return { ok: true, externalId };
      } catch (error: unknown) {
        lastError = error;
        // One-shot recovery path for an expired Eskiz token: refresh and
        // retry WITHOUT counting it as a delivery failure attempt.
        if (error instanceof TokenExpiredError && !tokenRefreshed) {
          tokenRefreshed = true;
          await this.invalidateAndRefreshEskizToken();
          currentAttempt--; // token refresh is not a delivery attempt
          continue;
        }

        this.logger.error(
          `Failed to send SMS to ${to} (attempt ${currentAttempt})`,
          error instanceof Error ? error.stack : String(error),
        );

        if (currentAttempt >= this.maxRetries) {
          const errText = error instanceof Error ? error.message : String(error);
          if (organizationId) {
            await this.logSms({
              organizationId,
              recipient: to,
              message,
              status: 'FAILED',
              errorMessage: errText,
            });
          }
          return {
            ok: false,
            failureCategory: this.categorizeError(errText),
            errorMessage: errText,
          };
        }

        // Exponential backoff between attempts.
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, currentAttempt - 1)),
        );
      }
    }

    const finalErrText = lastError instanceof Error ? lastError.message : String(lastError || 'Unknown SMS failure');
    return {
      ok: false,
      failureCategory: this.categorizeError(finalErrText),
      errorMessage: finalErrText,
    };
  }

  async sendSms(to: string, message: string, organizationId?: string): Promise<boolean> {
    const res = await this.sendSmsDetailed(to, message, organizationId);
    return res.ok;
  }

  // ======================================================================
  // DOMAIN HELPERS (parent notifications)
  // ======================================================================

  async notifyAbsentStudent(
    organizationId: string,
    studentName: string,
    parentPhone: string,
    date: string,
  ): Promise<boolean> {
    const text = `Hurmatli ota-ona! Farzandingiz ${studentName} bugun (${date}) darsga qatnashmadi.`;
    return this.sendSms(parentPhone, text, organizationId);
  }

  async notifyPaymentOverdue(
    organizationId: string,
    studentName: string,
    parentPhone: string,
    amount: string,
  ): Promise<boolean> {
    const text = `Hurmatli ota-ona! Farzandingiz ${studentName} uchun oylik to'lov (${amount}) muddati o'tdi. Iltimos, to'lovni amalga oshiring.`;
    return this.sendSms(parentPhone, text, organizationId);
  }

  // ======================================================================
  // LOGGING
  // ======================================================================

  private async logSms(entry: {
    organizationId: string;
    recipient: string;
    message: string;
    status: 'DELIVERED' | 'FAILED';
    externalId?: string | null;
    errorMessage?: string;
    sentAt?: Date;
    deliveredAt?: Date;
  }): Promise<void> {
    try {
      await this.prisma.sMSLog.create({
        data: {
          organizationId: entry.organizationId,
          recipient: entry.recipient,
          message: entry.message,
          status: entry.status,
          provider: this.provider,
          externalId: entry.externalId ?? null,
          sentAt: entry.sentAt ?? null,
          deliveredAt: entry.deliveredAt ?? null,
          errorMessage: entry.errorMessage,
        },
      });
    } catch (err) {
      // A failed audit write must never break delivery reporting.
      this.logger.error(
        `Failed to persist SMSLog: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/** Internal signal that the Eskiz bearer token must be refreshed. */
class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}
