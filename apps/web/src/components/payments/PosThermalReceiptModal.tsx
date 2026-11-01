/**
 * 80mm / 58mm POS Thermal Cashier Receipt Modal (M-EDU Payments v2)
 * High-precision monochrome thermal receipt tailored for direct thermal printer output.
 */

import { useRef, useState, useCallback } from 'react';
import { Printer } from 'lucide-react';
import { GlassModal, GlassButton } from '@/components/ui';
import { RealQrCode } from '@/components/ui/RealQrCode';
import { formatCurrency, formatDate } from '@/lib/format';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { triggerPrint } from '@/lib/printEngine';
import type { Payment } from '@/lib/types';

interface PosThermalReceiptModalProps {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
  orgName?: string;
  cashierName?: string;
}

export function PosThermalReceiptModal({
  open,
  onClose,
  payment,
  orgName = 'M-EDU ACADEMY',
  cashierName = 'Kassir-Operator',
}: PosThermalReceiptModalProps) {
  const { t } = useSafeI18n();
  const receiptRef = useRef<HTMLDivElement>(null);
  const sound = usePremiumSound();
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');

  const handlePrint = useCallback(() => {
    sound.playPop();
    const receiptNo = payment ? `CHK-${payment.id.slice(0, 8).toUpperCase()}` : 'Chek';
    triggerPrint({
      type: paperWidth === '58mm' ? 'thermal-receipt-58' : 'thermal-receipt-80',
      title: `Chek_${receiptNo}`,
    });
  }, [sound, payment, paperWidth]);

  if (!payment) return null;

  const studentName = payment.student
    ? `${payment.student.user?.firstName || ''} ${payment.student.user?.lastName || ''}`.trim()
    : "O'quvchi";

  const receiptNo = `CHK-${payment.id.slice(0, 8).toUpperCase()}`;
  const verifyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/payments?receipt=${payment.id}`
    : `https://m-edu.uz/receipt/${payment.id}`;

  const is58mm = paperWidth === '58mm';

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={t('payments.thermal.title')}
    >
      <div className="space-y-4">
        {/* Paper format selector */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            {t('payments.thermal.paperSize')}
          </span>
          <div className="inline-flex rounded-xl bg-black/[0.05] dark:bg-white/[0.08] p-1 gap-1">
            <button
              type="button"
              onClick={() => { sound.playTick(); setPaperWidth('80mm'); }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                paperWidth === '80mm'
                  ? 'bg-white dark:bg-surface-800 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              80 mm (Standart)
            </button>
            <button
              type="button"
              onClick={() => { sound.playTick(); setPaperWidth('58mm'); }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                paperWidth === '58mm'
                  ? 'bg-white dark:bg-surface-800 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              58 mm (Ixcham)
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Frame */}
        <div className="flex justify-center p-3 bg-neutral-900/10 dark:bg-black/40 rounded-2xl overflow-x-auto">
          <div
            ref={receiptRef}
            data-printable="thermal"
            id="medu-pos-receipt"
            className={`printable-thermal bg-white text-neutral-900 p-5 rounded-lg shadow-xl font-mono leading-tight select-none border border-neutral-300 transition-all ${
              is58mm ? 'w-[240px] text-[10.5px]' : 'w-[320px] text-[12px]'
            }`}
            style={{
              fontFamily: '"Courier New", Courier, monospace',
            }}
          >
            {/* Header */}
            <div className="text-center space-y-1 border-b border-dashed border-neutral-400 pb-3">
              <h2 className={`${is58mm ? 'text-[13px]' : 'text-[15px]'} font-black tracking-wider uppercase`}>{orgName}</h2>
              <p className="text-[10px] text-neutral-600">O'QUV VA INNOVATSIYA MARKAZI</p>
              <p className="text-[9.5px] text-neutral-500">TOSHKENT SHAHAR</p>
              <div className="pt-1 text-[11px] font-bold">RASMIY TO'LOV CHEKI</div>
            </div>

            {/* Meta */}
            <div className="py-2 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Chek raqami:</span>
                <span className="font-bold">{receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Sana va vaqt:</span>
                <span>{formatDate(payment.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kassir:</span>
                <span>{cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>To'lov turi:</span>
                <span className="font-bold uppercase">{payment.method || 'CASH'}</span>
              </div>
            </div>

            {/* Recipient info */}
            <div className="py-2 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
              <div className="text-neutral-500 text-[10px] uppercase">O'quvchi ma'lumoti:</div>
              <div className="font-bold text-[13px]">{studentName}</div>
              {payment.student?.user?.phone && (
                <div className="text-neutral-600">Tel: {payment.student.user.phone}</div>
              )}
            </div>

            {/* Line Items */}
            <div className="py-2.5 border-b border-dashed border-neutral-400 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-neutral-500 text-[10px] uppercase">
                <span>Xizmat nomi</span>
                <span>Summa</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="max-w-[170px] truncate">
                  {payment.description || "O'quv kursi to'lovi"}
                </span>
                <span className="font-bold shrink-0">{formatCurrency(payment.amount)}</span>
              </div>
            </div>

            {/* Total */}
            <div className="py-2.5 border-b-2 border-neutral-900 space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-[13px]">JAMI TO'LANDI:</span>
                <span className="font-black text-[15px]">{formatCurrency(payment.amount)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-neutral-500">
                <span>Holati:</span>
                <span className="font-bold text-emerald-700 uppercase">{payment.status}</span>
              </div>
            </div>

            {/* Verification QR Code & Cut line */}
            <div className="pt-3 text-center space-y-2">
              <div className="flex justify-center">
                <RealQrCode
                  value={verifyUrl}
                  className={is58mm ? 'w-16 h-16' : 'w-20 h-20'}
                  level="M"
                  fgColor="#000000"
                  bgColor="#FFFFFF"
                />
              </div>
              <p className="text-[9px] text-neutral-600 font-sans tracking-wide">
                * TO'LOV MUVAFFAQIYATLI QABUL QILINDI *
              </p>
              <p className="text-[8px] text-neutral-400 font-sans">
                M-EDU Cloud POS · Rahmat, ta'limda zafarlar!
              </p>
              <div className="text-[10px] text-neutral-400 tracking-widest pt-1">
                - - - - - - - - - - - - - - - - -
              </div>
            </div>
          </div>
        </div>

        {/* Modal Controls */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 pt-2 border-t border-slate-900/[0.06] dark:border-white/[0.08]">
          <GlassButton type="button" variant="secondary" onClick={onClose}>
            {t('common.close')}
          </GlassButton>

          <GlassButton
            type="button"
            variant="primary"
            onClick={handlePrint}
            className="!bg-neutral-900 hover:!bg-black !text-white"
          >
            <span className="inline-flex items-center gap-2">
              <Printer className="w-4 h-4" />
              {t('payments.thermal.print', { width: paperWidth })}
            </span>
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
