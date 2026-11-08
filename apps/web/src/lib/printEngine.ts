/**
 * M-EDU Enterprise Print Engine
 * ============================================================================
 * Specialized print coordinator for:
 *  1. Certificates: A4 Landscape (297mm x 210mm) vector precision
 *  2. Thermal POS Receipts: 80mm & 58mm monochrome cashier roll printers
 *  3. Invoices: A4 Portrait official tax & tuition invoices
 *  4. Payment Vouchers: A4 Portrait official accounting receipts
 *  5. Cashier Z-Reports: 80mm / A4 shift close reconciliation receipts
 * ============================================================================
 */

export type PrintDocumentType =
  | 'certificate'
  | 'thermal-receipt-80'
  | 'thermal-receipt-58'
  | 'receipt-a4'
  | 'invoice-a4'
  | 'contract-a4'
  | 'z-report'
  | 'onboarding-slip-a4';

export interface PrintOptions {
  type: PrintDocumentType;
  title?: string;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

/**
 * Executes a controlled print job with page-size and styling isolation.
 */
export function triggerPrint(options: PrintOptions): void {
  if (typeof window === 'undefined') return;

  const { type, title, onBeforePrint, onAfterPrint } = options;
  const previousTitle = document.title;

  try {
    // 1. Set data attribute to isolate printable section in CSS
    document.body.setAttribute('data-print-mode', type);

    // 2. Set meaningful PDF / print-spool title
    if (title) {
      document.title = title;
    }

    onBeforePrint?.();

    // 3. Register cleanup on print completion
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.removeAttribute('data-print-mode');
      document.title = previousTitle;
      window.removeEventListener('afterprint', cleanup);
      window.removeEventListener('focus', cleanup);
      onAfterPrint?.();
    };

    window.addEventListener('afterprint', cleanup);
    // Safari/WebKit fallback: focus fires when print dialog closes
    setTimeout(() => {
      window.addEventListener('focus', cleanup, { once: true });
    }, 500);

    // 4. Trigger print dialog
    // Small timeout ensures DOM attributes have reflowed before browser rasterizes
    setTimeout(() => {
      window.print();
    }, 40);
  } catch (err) {
    console.error('[PrintEngine] Failed to initiate print:', err);
    document.body.removeAttribute('data-print-mode');
    document.title = previousTitle;
  }
}
