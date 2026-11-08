import { describe, it, expect } from 'vitest';
import { PAYMENT_PROVIDERS, listPaymentProviders } from '../payment-providers';

describe('payment provider registry (API-05)', () => {
  it('lists exactly the providers the codebase knows about', () => {
    expect(PAYMENT_PROVIDERS.map((p) => p.id)).toEqual([
      'payme',
      'click',
      'uzum',
      'stripe',
      'paypal',
    ]);
  });

  it('marks only Payme and Click as implemented', () => {
    const implemented = PAYMENT_PROVIDERS.filter((p) => p.implemented).map((p) => p.id);
    expect(implemented).toEqual(['payme', 'click']);
  });

  it('reports every provider as unavailable when no credentials exist', () => {
    const statuses = listPaymentProviders({});
    expect(statuses.every((s) => s.configured === false)).toBe(true);
    expect(statuses.every((s) => s.available === false)).toBe(true);
  });

  it('marks Payme available when its credentials are present', () => {
    const statuses = listPaymentProviders({
      PAYME_MERCHANT_ID: 'merchant',
      PAYME_MERCHANT_KEY: 'key',
    });
    const payme = statuses.find((s) => s.id === 'payme');
    expect(payme?.configured).toBe(true);
    expect(payme?.available).toBe(true);
  });

  it('never marks a planned provider available even with env vars set', () => {
    const statuses = listPaymentProviders({
      STRIPE_SECRET_KEY: 'sk_test',
      PAYPAL_CLIENT_ID: 'client',
      UZUM_MERCHANT_ID: 'merchant',
    });
    const planned = statuses.filter((s) => !s.implemented);
    expect(planned.every((s) => s.available === false)).toBe(true);
  });
});
