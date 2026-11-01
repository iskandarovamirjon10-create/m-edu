import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerPrint } from '../printEngine';

describe('PrintEngine (Enterprise Print Coordinator)', () => {
  let originalPrint: typeof window.print;
  let originalTitle: string;

  beforeEach(() => {
    vi.useFakeTimers();
    originalPrint = window.print;
    originalTitle = document.title;
    window.print = vi.fn();
    document.body.removeAttribute('data-print-mode');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.print = originalPrint;
    document.title = originalTitle;
    document.body.removeAttribute('data-print-mode');
  });

  it('sets data-print-mode attribute and updates document title', () => {
    triggerPrint({
      type: 'certificate',
      title: 'Sertifikat - Ali Valiyev',
    });

    expect(document.body.getAttribute('data-print-mode')).toBe('certificate');
    expect(document.title).toBe('Sertifikat - Ali Valiyev');

    // Run timeout to trigger window.print()
    vi.advanceTimersByTime(50);
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it('calls onBeforePrint callback before printing', () => {
    const onBefore = vi.fn();
    triggerPrint({
      type: 'thermal-receipt-80',
      onBeforePrint: onBefore,
    });

    expect(onBefore).toHaveBeenCalledTimes(1);
    expect(document.body.getAttribute('data-print-mode')).toBe('thermal-receipt-80');
  });

  it('restores document title and removes attribute on afterprint event', () => {
    const onAfter = vi.fn();
    document.title = 'Old Page Title';

    triggerPrint({
      type: 'invoice-a4',
      title: 'Hisob-faktura #1002',
      onAfterPrint: onAfter,
    });

    expect(document.title).toBe('Hisob-faktura #1002');
    expect(document.body.getAttribute('data-print-mode')).toBe('invoice-a4');

    // Dispatch afterprint event
    window.dispatchEvent(new Event('afterprint'));

    expect(document.body.hasAttribute('data-print-mode')).toBe(false);
    expect(document.title).toBe('Old Page Title');
    expect(onAfter).toHaveBeenCalledTimes(1);
  });

  it('supports 58mm compact thermal receipt mode', () => {
    triggerPrint({
      type: 'thermal-receipt-58',
    });

    expect(document.body.getAttribute('data-print-mode')).toBe('thermal-receipt-58');
  });

  it('supports z-report mode', () => {
    triggerPrint({
      type: 'z-report',
      title: 'Kassa Z-Hisoboti',
    });

    expect(document.body.getAttribute('data-print-mode')).toBe('z-report');
    expect(document.title).toBe('Kassa Z-Hisoboti');
  });
});
