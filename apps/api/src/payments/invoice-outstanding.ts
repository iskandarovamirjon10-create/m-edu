import { toMinor, fromMinor } from '@medu/financial-engine';

/**
 * Canonical shape needed to compute what a student still owes on an invoice.
 * Accepts Prisma `Decimal` values (any `DecimalLike`).
 */
export interface InvoiceOutstandingRow {
  status?: string | null;
  total: unknown;
  paidAmount: unknown;
  refundedAmount?: unknown;
  dueDate?: Date | null;
}

export interface InvoiceOutstanding {
  /** Total still collectable across every open invoice (minor units). */
  outstandingMinor: number;
  /** Subset of `outstandingMinor` whose due date has already passed (minor units). */
  overdueMinor: number;
  /** Convenience major-unit values (UZS etc. are 2-decimal in this system). */
  outstanding: number;
  overdue: number;
}

/**
 * Statuses that never represent a collectable obligation.
 * Must stay in sync with the invoice lifecycle in InvoicesService.
 */
export const NON_BILLABLE_INVOICE_STATUSES = ['DRAFT', 'CANCELLED'] as const;

/**
 * remaining = total - paid + refunded
 *
 * Refunded money becomes collectable again, which is why it is added back.
 * The formula MUST match `InvoicesService.findOne`'s `remaining` field and the
 * student-balance report — that is the whole point of this helper (F-009).
 */
export function computeInvoiceOutstanding(
  rows: readonly InvoiceOutstandingRow[],
  now: Date = new Date(),
): InvoiceOutstanding {
  let outstandingMinor = 0;
  let overdueMinor = 0;

  for (const invoice of rows) {
    const remaining =
      toMinor(invoice.total as never) -
      toMinor(invoice.paidAmount as never) +
      toMinor((invoice.refundedAmount ?? 0) as never);

    if (remaining <= 0) continue;

    outstandingMinor += remaining;
    if (invoice.dueDate && invoice.dueDate < now && invoice.status !== 'PAID') {
      overdueMinor += remaining;
    }
  }

  return {
    outstandingMinor,
    overdueMinor,
    outstanding: fromMinor(outstandingMinor),
    overdue: fromMinor(overdueMinor),
  };
}
