import { Injectable, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

export interface PaymeRpcRequest {
  method: string;
  params: Record<string, any>;
  id: number | string;
}

export interface PaymeRpcResponse {
  result?: Record<string, any>;
  error?: {
    code: number;
    message: {
      ru: string;
      uz: string;
      en: string;
    };
    data?: string;
  };
  id: number | string;
}

export const PAYME_ERRORS = {
  AUTH_ERROR: { code: -32504, message: { ru: 'Неверная авторизация', uz: 'Avtorizatsiya xatosi', en: 'Auth error' } },
  INVOICE_NOT_FOUND: { code: -31001, message: { ru: 'Счет не найден', uz: 'Hisob topilmadi', en: 'Invoice not found' } },
  INVALID_AMOUNT: { code: -31001, message: { ru: 'Неверная сумма', uz: "Noto'g'ri summa", en: 'Invalid amount' } },
  CANT_PERFORM: { code: -31008, message: { ru: 'Невозможно выполнить', uz: 'Bajarib bo‘lmaydi', en: 'Cannot perform' } },
  ALREADY_DONE: { code: -31007, message: { ru: 'Транзакция уже завершена', uz: 'Tranzaksiya yakunlangan', en: 'Already done' } },
};

@Injectable()
export class PaymeAdapter {
  private readonly logger = new Logger(PaymeAdapter.name);

  private safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  /**
   * Verifies Payme Basic Auth header: `Basic base64(Paycom:SECRET_KEY)`
   */
  verifyAuth(authHeader: string | undefined, secretKey: string): boolean {
    if (!authHeader || !authHeader.startsWith('Basic ') || !secretKey) {
      return false;
    }
    try {
      const token = authHeader.slice(6).trim();
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx === -1) return false;
      const login = decoded.slice(0, colonIdx);
      const key = decoded.slice(colonIdx + 1);
      return this.safeEquals(login, 'Paycom') && this.safeEquals(key, secretKey);
    } catch {
      return false;
    }
  }

  /**
   * Generates a Payme checkout URL for an issued subscription invoice.
   */
  generateCheckoutUrl(merchantId: string, invoiceNumber: string, amountUzs: number): string {
    const amountTiyin = Math.round(amountUzs * 100);
    const params = `m=${merchantId};ac.invoice_number=${invoiceNumber};a=${amountTiyin}`;
    const base64 = Buffer.from(params).toString('base64');
    return `https://checkout.paycom.uz/${base64}`;
  }
}
