/**
 * Invoicing and billing domain models.
 */

import type { Student } from './students';

export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
}

export interface InvoicePayment {
  id: string;
  amount: string;
  status: string;
  method?: string | null;
  reference?: string | null;
  receiptNumber?: string | null;
  receiptIssuedAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface InvoiceRefund {
  id: string;
  amount: string;
  status: 'REQUESTED' | 'PROCESSED' | 'REJECTED';
  reason?: string | null;
  requestedBy: string;
  processedBy?: string | null;
  requestedAt: string;
  processedAt?: string | null;
}

export interface Invoice {
  id: string;
  organizationId: string;
  studentId: string;
  number: string;
  status: InvoiceStatus;
  subtotal: string;
  discount: string;
  penalty: string;
  total: string;
  paidAmount: string;
  refundedAmount?: string;
  currency?: string | null;
  dueDate?: string | null;
  issueDate?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  /** Present on GET /invoices/:id detail response */
  remaining?: number;
  student?: Student;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  refunds?: InvoiceRefund[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceTotals {
  invoiced: number;
  paid: number;
  outstanding: number;
  refunded: number;
  totalOutstanding: number;
  totalPaid: number;
  totalOverdue: number;
  countByStatus: Record<InvoiceStatus, number>;
}
