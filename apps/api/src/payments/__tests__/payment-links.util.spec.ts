import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generatePaymentLinks, type PaymentLinkParams } from '../payment-links.util';

describe('generatePaymentLinks (Uzbekistan Payment Deep Links)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('generates valid Payme Base64 checkout URL with amount converted to tiyin', () => {
    const params: PaymentLinkParams = {
      invoiceId: 'inv-12345',
      amountUzs: 500000,
      organizationId: 'org-abc',
      merchantIdPayme: 'payme_merchant_test',
      merchantIdClick: 'click_merchant_test',
      serviceIdClick: 'click_service_test',
    };

    const result = generatePaymentLinks(params);

    expect(result.amountUzs).toBe(500000);
    expect(result.invoiceId).toBe('inv-12345');
    expect(result.formattedAmount).toContain("so'm");

    // Verify Payme URL
    expect(result.paymeUrl).toMatch(/^https:\/\/checkout\.paycom\.uz\//);
    const base64Part = result.paymeUrl.replace('https://checkout.paycom.uz/', '');
    const decoded = Buffer.from(base64Part, 'base64').toString('utf8');
    expect(decoded).toBe('m=payme_merchant_test;ac.invoice_id=inv-12345;a=50000000'); // 500,000 UZS = 50,000,000 tiyin
  });

  it('generates valid Click checkout URL with properly encoded query parameters', () => {
    const params: PaymentLinkParams = {
      invoiceId: 'inv-xyz/99',
      amountUzs: 150000.5,
      organizationId: 'org-abc',
      merchantIdClick: 'merchant_11',
      serviceIdClick: 'service_22',
    };

    const result = generatePaymentLinks(params);

    expect(result.clickUrl).toContain('https://my.click.uz/services/pay');
    expect(result.clickUrl).toContain('service_id=service_22');
    expect(result.clickUrl).toContain('merchant_id=merchant_11');
    expect(result.clickUrl).toContain('amount=150000.5');
    expect(result.clickUrl).toContain('transaction_param=inv-xyz%2F99');
  });

  it('falls back to environment variables when custom merchants are omitted', () => {
    process.env.PAYME_MERCHANT_ID = 'env_payme_mid';
    process.env.CLICK_MERCHANT_ID = 'env_click_mid';
    process.env.CLICK_SERVICE_ID = 'env_click_sid';

    const params: PaymentLinkParams = {
      invoiceId: 'inv-env-1',
      amountUzs: 100000,
      organizationId: 'org-default',
    };

    const result = generatePaymentLinks(params);

    const base64Part = result.paymeUrl.replace('https://checkout.paycom.uz/', '');
    const decoded = Buffer.from(base64Part, 'base64').toString('utf8');
    expect(decoded).toContain('m=env_payme_mid');

    expect(result.clickUrl).toContain('merchant_id=env_click_mid');
    expect(result.clickUrl).toContain('service_id=env_click_sid');
  });

  it('falls back to demo defaults when neither params nor env vars are provided', () => {
    delete process.env.PAYME_MERCHANT_ID;
    delete process.env.CLICK_MERCHANT_ID;
    delete process.env.CLICK_SERVICE_ID;

    const params: PaymentLinkParams = {
      invoiceId: 'inv-demo',
      amountUzs: 75000,
      organizationId: 'org-demo',
    };

    const result = generatePaymentLinks(params);

    const base64Part = result.paymeUrl.replace('https://checkout.paycom.uz/', '');
    const decoded = Buffer.from(base64Part, 'base64').toString('utf8');
    expect(decoded).toContain('m=demo_merchant');
    expect(result.clickUrl).toContain('merchant_id=demo_merchant');
    expect(result.clickUrl).toContain('service_id=demo_service');
    expect(result.qrPayload.payme).toBe(result.paymeUrl);
    expect(result.qrPayload.click).toBe(result.clickUrl);
  });
});
