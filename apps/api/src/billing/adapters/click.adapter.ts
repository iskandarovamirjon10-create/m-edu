import { Injectable, Logger } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

export interface ClickWebhookPayload {
  click_trans_id: string;
  service_id: string;
  click_paydoc_id?: string;
  merchant_trans_id: string; // Invoice number
  merchant_prepare_id?: string | number;
  amount: string;
  action: string; // "0" for Prepare, "1" for Complete
  error: string;
  error_note: string;
  sign_time: string;
  sign_string: string;
}

export interface ClickWebhookResponse {
  click_trans_id: number | string;
  merchant_trans_id: string;
  merchant_prepare_id?: number | string;
  merchant_confirm_id?: number | string;
  error: number;
  error_note: string;
}

@Injectable()
export class ClickAdapter {
  private readonly logger = new Logger(ClickAdapter.name);

  private safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  /**
   * Generates Click MD5 signature.
   */
  generateSignature(params: {
    clickTransId: string;
    serviceId: string;
    secretKey: string;
    merchantTransId: string;
    merchantPrepareId?: string | number;
    amount: number | string;
    action: number | string;
    signTime: string;
  }): string {
    const preparePart = params.merchantPrepareId ? String(params.merchantPrepareId).trim() : '';
    const raw = `${params.clickTransId}${params.serviceId}${params.secretKey}${params.merchantTransId}${preparePart}${params.amount}${params.action}${params.signTime}`;
    return createHash('md5').update(raw, 'utf8').digest('hex').toLowerCase();
  }

  /**
   * Validates Click MD5 signature according to the official Click Merchant specification:
   * MD5(click_trans_id + service_id + secret_key + merchant_trans_id + [merchant_prepare_id] + amount + action + sign_time)
   */
  verifySignature(payload: ClickWebhookPayload, secretKey: string): boolean {
    if (!payload?.sign_string || !secretKey) return false;

    const actionNum = Number(payload.action);
    const preparePart =
      actionNum === 1 &&
      payload.merchant_prepare_id !== undefined &&
      payload.merchant_prepare_id !== null &&
      String(payload.merchant_prepare_id).trim() !== ''
        ? String(payload.merchant_prepare_id).trim()
        : '';

    const rawWithPrepare = `${payload.click_trans_id}${payload.service_id}${secretKey}${payload.merchant_trans_id}${preparePart}${payload.amount}${payload.action}${payload.sign_time}`;
    const digestWithPrepare = createHash('md5').update(rawWithPrepare, 'utf8').digest('hex').toLowerCase();

    const rawWithoutPrepare = `${payload.click_trans_id}${payload.service_id}${secretKey}${payload.merchant_trans_id}${payload.amount}${payload.action}${payload.sign_time}`;
    const digestWithoutPrepare = createHash('md5').update(rawWithoutPrepare, 'utf8').digest('hex').toLowerCase();

    const incoming = payload.sign_string.trim().toLowerCase();
    return this.safeEquals(incoming, digestWithPrepare) || this.safeEquals(incoming, digestWithoutPrepare);
  }

  /**
   * Generates a Click checkout deep link.
   */
  generateCheckoutUrl(serviceId: string, merchantId: string, invoiceNumber: string, amountUzs: number): string {
    return `https://my.click.uz/services/pay?service_id=${encodeURIComponent(serviceId)}&merchant_id=${encodeURIComponent(merchantId)}&amount=${amountUzs}&transaction_param=${encodeURIComponent(invoiceNumber)}`;
  }
}
