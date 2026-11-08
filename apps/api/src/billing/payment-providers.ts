/**
 * Payment provider capability registry (API-05).
 *
 * The architecture document used to promise Uzum/Stripe/PayPal while only
 * Payme and Click adapters existed. This registry is the machine-readable
 * source of truth: the API reports it, and the docs can be diffed against it.
 *
 * `implemented` means an adapter + webhook handler exist in this repository.
 * `configured` is computed from the environment at request time.
 */
export type PaymentProviderId = 'payme' | 'click' | 'uzum' | 'stripe' | 'paypal';

export interface PaymentProviderDescriptor {
  id: PaymentProviderId;
  label: string;
  /** An adapter and webhook handler exist in `billing/adapters`. */
  implemented: boolean;
  /** Environment variables required before the provider can accept traffic. */
  requiredEnv: readonly string[];
}

export interface PaymentProviderStatus extends PaymentProviderDescriptor {
  /** Every required env var is present and non-empty. */
  configured: boolean;
  /** Ready to receive traffic: implemented AND configured. */
  available: boolean;
}

export const PAYMENT_PROVIDERS: readonly PaymentProviderDescriptor[] = [
  {
    id: 'payme',
    label: 'Payme',
    implemented: true,
    requiredEnv: ['PAYME_MERCHANT_ID', 'PAYME_MERCHANT_KEY'],
  },
  {
    id: 'click',
    label: 'Click',
    implemented: true,
    requiredEnv: ['CLICK_SERVICE_ID', 'CLICK_MERCHANT_ID', 'CLICK_SECRET_KEY'],
  },
  {
    id: 'uzum',
    label: 'Uzum Bank',
    implemented: false,
    requiredEnv: [],
  },
  {
    id: 'stripe',
    label: 'Stripe',
    implemented: false,
    requiredEnv: [],
  },
  {
    id: 'paypal',
    label: 'PayPal',
    implemented: false,
    requiredEnv: [],
  },
];

/** Provider statuses with the environment evaluated right now. */
export function listPaymentProviders(
  env: NodeJS.ProcessEnv = process.env,
): PaymentProviderStatus[] {
  return PAYMENT_PROVIDERS.map((provider) => {
    const configured =
      provider.requiredEnv.length > 0 &&
      provider.requiredEnv.every((key) => {
        const value = env[key];
        return typeof value === 'string' && value.trim().length > 0;
      });

    return {
      ...provider,
      configured,
      available: provider.implemented && configured,
    };
  });
}
