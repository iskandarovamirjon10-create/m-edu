import { describe, it, expect } from 'vitest';
import { computeInvoiceOutstanding } from '../invoice-outstanding';

describe('computeInvoiceOutstanding', () => {
  it('should ignore DRAFT and CANCELLED invoices', () => {
    const result = computeInvoiceOutstanding([
      { status: 'DRAFT', total: 100, paidAmount: 0 },
      { status: 'CANCELLED', total: 100, paidAmount: 0 },
    ]);
    expect(result.outstandingMinor).toBe(0);
  });

  it('should correctly calculate total and paid amounts', () => {
    const result = computeInvoiceOutstanding([
      { status: 'ISSUED', total: 100, paidAmount: 20 },
      { status: 'PARTIAL', total: 100, paidAmount: 50 },
    ]);
    expect(result.outstandingMinor).toBe(13000); // 130 * 100 = 13000
    expect(result.outstanding).toBe(130);
  });

  it('should handle refunds properly', () => {
    const result = computeInvoiceOutstanding([
      { status: 'ISSUED', total: 100, paidAmount: 50, refundedAmount: 20 },
    ]);
    expect(result.outstandingMinor).toBe(7000); // 100 - 50 + 20 = 70
  });

  it('should ignore overpayments or zero remaining', () => {
    const result = computeInvoiceOutstanding([
      { status: 'PAID', total: 100, paidAmount: 100 },
      { status: 'PAID', total: 100, paidAmount: 150 }, // Overpaid
    ]);
    expect(result.outstandingMinor).toBe(0);
  });

  it('should correctly calculate overdue amounts', () => {
    const now = new Date('2024-01-10T00:00:00Z');
    const result = computeInvoiceOutstanding([
      { status: 'ISSUED', total: 100, paidAmount: 0, dueDate: new Date('2024-01-05T00:00:00Z') }, // Overdue
      { status: 'ISSUED', total: 100, paidAmount: 0, dueDate: new Date('2024-01-15T00:00:00Z') }, // Not overdue
    ], now);
    expect(result.outstandingMinor).toBe(20000);
    expect(result.overdueMinor).toBe(10000);
  });

  it('should handle decimals precision', () => {
    const result = computeInvoiceOutstanding([
      { status: 'ISSUED', total: 100.05, paidAmount: 50.01 },
    ]);
    expect(result.outstandingMinor).toBe(5004); // 50.04 * 100
  });
});
