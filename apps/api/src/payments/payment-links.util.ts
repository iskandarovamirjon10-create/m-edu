/**
 * Payment deep-link generators for Uzbekistan payment providers: Payme & Click.
 */

export interface PaymentLinkParams {
  invoiceId: string;
  amountUzs: number;
  organizationId: string;
  studentName?: string;
  merchantIdPayme?: string;
  merchantIdClick?: string;
  serviceIdClick?: string;
}

export interface PaymentLinksResult {
  paymeUrl: string;
  clickUrl: string;
  amountUzs: number;
  invoiceId: string;
  formattedAmount: string;
  qrPayload: {
    payme: string;
    click: string;
  };
}

export function generatePaymentLinks(params: PaymentLinkParams): PaymentLinksResult {
  const paymeMerchant = params.merchantIdPayme || process.env.PAYME_MERCHANT_ID || 'demo_merchant';
  const clickMerchant = params.merchantIdClick || process.env.CLICK_MERCHANT_ID || 'demo_merchant';
  const clickService = params.serviceIdClick || process.env.CLICK_SERVICE_ID || 'demo_service';

  // Payme expects amount in tiyin (1 UZS = 100 tiyin)
  const amountTiyin = Math.round(params.amountUzs * 100);
  const paymeParams = `m=${paymeMerchant};ac.invoice_id=${params.invoiceId};a=${amountTiyin}`;
  const paymeBase64 = Buffer.from(paymeParams).toString('base64');
  const paymeUrl = `https://checkout.paycom.uz/${paymeBase64}`;

  // Click expects amount in standard UZS
  const clickUrl = `https://my.click.uz/services/pay?service_id=${encodeURIComponent(clickService)}&merchant_id=${encodeURIComponent(clickMerchant)}&amount=${params.amountUzs}&transaction_param=${encodeURIComponent(params.invoiceId)}`;

  const formattedAmount = new Intl.NumberFormat('uz-UZ').format(params.amountUzs) + " so'm";

  return {
    paymeUrl,
    clickUrl,
    amountUzs: params.amountUzs,
    invoiceId: params.invoiceId,
    formattedAmount,
    qrPayload: {
      payme: paymeUrl,
      click: clickUrl,
    },
  };
}
