import { toMinor } from '@medu/financial-engine';

/**
 * Single source of truth for how a Payment row affects Student.balance.
 *
 * Invariant: one financial event mutates balance at most once.
 *   - money-in applies when (and only while) the payment is PAID
 *   - each PROCESSED refund reverses its share of that money-in
 *   - leaving PAID reverses only the still-unreversed remainder
 *
 * Both PaymentsService (status/amount transitions) and InvoicesService
 * (processRefund) MUST derive balance deltas from these helpers inside a
 * transaction that holds a FOR UPDATE lock on the Payment row.
 */

/** Legal Payment.status transitions (same-status field updates always allowed). */
export const PAYMENT_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['PAID', 'CANCELLED', 'OVERDUE'],
  OVERDUE: ['PAID', 'CANCELLED', 'PENDING'],
  // A paid payment may be cancelled (one reverse) but must not silently
  // return to PENDING — use refund or CANCELLED. Prevents the P0 path
  // PAID → PENDING double-reversing after a refund.
  PAID: ['CANCELLED'],
  CANCELLED: ['PENDING', 'PAID'],
  PARTIALLY_PAID: ['PAID', 'CANCELLED', 'PENDING'],
};

export function isLegalPaymentTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return (PAYMENT_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Balance contribution of one payment, in minor units.
 * Non-PAID payments contribute 0. PAID payments contribute amount net of
 * already-PROCESSED refunds (floored at 0) so a fully-refunded payment
 * that is still marked PAID no longer holds balance.
 */
export function balanceContributionMinor(
  isPaid: boolean,
  amountMinor: number,
  processedRefundMinor: number,
): number {
  if (!isPaid) return 0;
  return Math.max(0, amountMinor - processedRefundMinor);
}

/**
 * Delta (minor units) to apply to Student.balance when a payment's
 * status and/or amount change, given the sum of PROCESSSED refunds
 * (which is unchanged by a pure status/amount write).
 */
export function paymentStatusBalanceDeltaMinor(opts: {
  wasPaid: boolean;
  willBePaid: boolean;
  oldAmountMinor: number;
  newAmountMinor: number;
  processedRefundMinor: number;
}): number {
  const before = balanceContributionMinor(
    opts.wasPaid,
    opts.oldAmountMinor,
    opts.processedRefundMinor,
  );
  const after = balanceContributionMinor(
    opts.willBePaid,
    opts.newAmountMinor,
    opts.processedRefundMinor,
  );
  return after - before;
}

/**
 * How much of a newly PROCESSSED refund should reverse Student.balance now
 * (minor units). Zero when the payment is no longer PAID (money-in already
 * reversed by a status leave). Capped so we never drive contribution below 0.
 */
export function refundBalanceReverseMinor(opts: {
  paymentIsPaid: boolean;
  paymentAmountMinor: number;
  refundAmountMinor: number;
  /** Sum of refunds already PROCESSSED before this one (excludes current). */
  priorProcessedRefundMinor: number;
}): number {
  if (!opts.paymentIsPaid) return 0;
  const appliedBefore = balanceContributionMinor(
    true,
    opts.paymentAmountMinor,
    opts.priorProcessedRefundMinor,
  );
  return Math.min(opts.refundAmountMinor, appliedBefore);
}

export { toMinor };
