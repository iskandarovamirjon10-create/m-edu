/**
 * M-EDU V2 — Multi-Currency & Banknote Split Calculator (`CurrencySplitCalculator.tsx`)
 * Handles multi-currency split payments (UZS, USD, EUR, RUB), real-time rate conversion,
 * and optimal cash drawer change return breakdown (100k, 50k, 20k, 10k banknotes).
 */

import { useState, useMemo, useCallback, memo } from 'react';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/design';

interface CurrencySplitCalculatorProps {
  requiredAmountUzs: number;
  onApplyPayment?: (params: {
    cashUzs: number;
    cardUzs: number;
    foreignCurrency?: { code: string; amount: number; rate: number };
    changeUzs: number;
  }) => void;
  onClose?: () => void;
}

const EXCHANGE_RATES: Record<string, number> = {
  USD: 12850,
  EUR: 13950,
  RUB: 135,
};

const BANKNOTES_UZS = [200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

export const CurrencySplitCalculator = memo(function CurrencySplitCalculator({
  requiredAmountUzs,
  onApplyPayment,
  onClose,
}: CurrencySplitCalculatorProps) {
  const { playTick, playSuccess, playError } = usePremiumSound();

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'split' | 'foreign'>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [cardTendered, setCardTendered] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'EUR' | 'RUB'>('USD');
  const [foreignAmount, setForeignAmount] = useState<string>('');

  // Parsed numerical values
  const parsedCash = useMemo(() => {
    const num = parseFloat(cashTendered.replace(/\s+/g, ''));
    return isNaN(num) || num < 0 ? 0 : num;
  }, [cashTendered]);

  const parsedCard = useMemo(() => {
    const num = parseFloat(cardTendered.replace(/\s+/g, ''));
    return isNaN(num) || num < 0 ? 0 : num;
  }, [cardTendered]);

  const parsedForeign = useMemo(() => {
    const num = parseFloat(foreignAmount.replace(/\s+/g, ''));
    return isNaN(num) || num < 0 ? 0 : num;
  }, [foreignAmount]);

  // Foreign converted to UZS
  const foreignInUzs = useMemo(() => {
    const rate = EXCHANGE_RATES[selectedCurrency] || 1;
    return Math.round(parsedForeign * rate);
  }, [parsedForeign, selectedCurrency]);

  // Total paid by customer
  const totalPaidUzs = useMemo(() => {
    if (paymentMethod === 'foreign') {
      return foreignInUzs + parsedCash;
    }
    if (paymentMethod === 'split') {
      return parsedCash + parsedCard;
    }
    return parsedCash;
  }, [paymentMethod, foreignInUzs, parsedCash, parsedCard]);

  // Remaining or change
  const changeUzs = Math.max(0, totalPaidUzs - requiredAmountUzs);
  const remainingUzs = Math.max(0, requiredAmountUzs - totalPaidUzs);

  // Banknotes distribution for change
  const changeBanknotes = useMemo(() => {
    if (changeUzs <= 0) return [];
    let rem = changeUzs;
    const result: { value: number; count: number }[] = [];

    for (const note of BANKNOTES_UZS) {
      if (rem >= note) {
        const count = Math.floor(rem / note);
        result.push({ value: note, count });
        rem = rem % note;
      }
    }
    return result;
  }, [changeUzs]);

  // Quick cash buttons
  const quickCashPresets = useMemo(() => {
    const req = requiredAmountUzs;
    return [
      req,
      Math.ceil(req / 50000) * 50000,
      Math.ceil(req / 100000) * 100000,
      Math.ceil((req + 50000) / 100000) * 100000,
    ].filter((v, idx, arr) => v > 0 && arr.indexOf(v) === idx);
  }, [requiredAmountUzs]);

  const handleApply = useCallback(() => {
    if (totalPaidUzs < requiredAmountUzs) {
      playError();
      return;
    }
    playSuccess();
    onApplyPayment?.({
      cashUzs: paymentMethod === 'split' ? parsedCash : totalPaidUzs - parsedCard,
      cardUzs: paymentMethod === 'split' ? parsedCard : 0,
      foreignCurrency:
        paymentMethod === 'foreign'
          ? {
              code: selectedCurrency,
              amount: parsedForeign,
              rate: EXCHANGE_RATES[selectedCurrency] || 1,
            }
          : undefined,
      changeUzs,
    });
    onClose?.();
  }, [
    totalPaidUzs,
    requiredAmountUzs,
    paymentMethod,
    parsedCash,
    parsedCard,
    selectedCurrency,
    parsedForeign,
    changeUzs,
    onApplyPayment,
    onClose,
    playSuccess,
    playError,
  ]);

  return (
    <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-2xl backdrop-blur-3xl dark:border-white/15 dark:bg-[#18181b]/90 text-[var(--text-primary,#1d1d1f)] dark:text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300 text-lg">
            💱
          </span>
          <div>
            <h4 className="text-sm font-bold tracking-tight">
              Kassa & Valyuta Qaytim Kalkulyatori
            </h4>
            <p className="text-[11px] text-[var(--text-secondary,#86868b)]">
              To'lov taqsimoti, valyuta kurslari va aniq qaytim
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block">
            To'lanishi kerak:
          </span>
          <span className="text-sm font-black text-brand-600 dark:text-brand-400">
            {formatCurrency(requiredAmountUzs)}
          </span>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex rounded-xl bg-black/[0.04] dark:bg-white/[0.06] p-1 gap-1 mb-4 text-xs font-semibold">
        <button
          type="button"
          onClick={() => { playTick(); setPaymentMethod('cash'); }}
          className={cn(
            'flex-1 py-1.5 rounded-lg transition-all',
            paymentMethod === 'cash'
              ? 'bg-white dark:bg-black/40 shadow-sm font-bold text-brand-600 dark:text-brand-400'
              : 'text-[var(--text-secondary)] hover:text-black dark:hover:text-white',
          )}
        >
          💵 Naqd To'lov
        </button>
        <button
          type="button"
          onClick={() => { playTick(); setPaymentMethod('split'); }}
          className={cn(
            'flex-1 py-1.5 rounded-lg transition-all',
            paymentMethod === 'split'
              ? 'bg-white dark:bg-black/40 shadow-sm font-bold text-brand-600 dark:text-brand-400'
              : 'text-[var(--text-secondary)] hover:text-black dark:hover:text-white',
          )}
        >
          💳 Aralash (Naqd + Karta)
        </button>
        <button
          type="button"
          onClick={() => { playTick(); setPaymentMethod('foreign'); }}
          className={cn(
            'flex-1 py-1.5 rounded-lg transition-all',
            paymentMethod === 'foreign'
              ? 'bg-white dark:bg-black/40 shadow-sm font-bold text-brand-600 dark:text-brand-400'
              : 'text-[var(--text-secondary)] hover:text-black dark:hover:text-white',
          )}
        >
          🌎 Xorijiy Valyuta
        </button>
      </div>

      {/* Inputs Stage */}
      <div className="space-y-3">
        {paymentMethod === 'cash' && (
          <div>
            <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1 block">
              Mijoz bergan naqd pul miqdori:
            </label>
            <input
              type="text"
              autoFocus
              value={cashTendered}
              onChange={(e) => setCashTendered(e.target.value)}
              placeholder="Masalan: 1 500 000"
              className="w-full text-lg font-bold px-3.5 py-2.5 rounded-2xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] outline-none focus:border-brand-500"
            />
            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickCashPresets.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => { playTick(); setCashTendered(String(val)); }}
                  className="rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] hover:text-black dark:hover:text-white"
                >
                  {formatCurrency(val)}
                </button>
              ))}
            </div>
          </div>
        )}

        {paymentMethod === 'split' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1 block">
                💵 Naqd to'lov:
              </label>
              <input
                type="text"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                placeholder="0"
                className="w-full text-base font-bold px-3 py-2 rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1 block">
                💳 Karta (Payme/Humo):
              </label>
              <input
                type="text"
                value={cardTendered}
                onChange={(e) => setCardTendered(e.target.value)}
                placeholder="0"
                className="w-full text-base font-bold px-3 py-2 rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] outline-none focus:border-brand-500"
              />
            </div>
          </div>
        )}

        {paymentMethod === 'foreign' && (
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value as 'USD' | 'EUR' | 'RUB')}
                className="w-28 text-sm font-bold px-3 py-2 rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] outline-none"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="RUB">RUB (₽)</option>
              </select>
              <input
                type="text"
                value={foreignAmount}
                onChange={(e) => setForeignAmount(e.target.value)}
                placeholder={`Miqdori (${selectedCurrency})`}
                className="flex-1 text-base font-bold px-3 py-2 rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] outline-none focus:border-brand-500"
              />
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] flex justify-between px-1">
              <span>Kurs: 1 {selectedCurrency} = {formatCurrency(EXCHANGE_RATES[selectedCurrency] || 1)}</span>
              <span>So'mda: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(foreignInUzs)}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Summary & Change Display */}
      <div className="mt-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06] p-3.5 space-y-2">
        <div className="flex justify-between text-xs text-[var(--text-secondary)]">
          <span>Jami kiritilgan mablag':</span>
          <span className="font-bold text-[var(--text-primary)] dark:text-white">
            {formatCurrency(totalPaidUzs)}
          </span>
        </div>

        {remainingUzs > 0 ? (
          <div className="flex justify-between text-xs font-bold text-rose-500">
            <span>Yetmayotgan mablag':</span>
            <span>{formatCurrency(remainingUzs)}</span>
          </div>
        ) : (
          <div className="flex justify-between items-baseline border-t border-black/[0.05] dark:border-white/[0.06] pt-2">
            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
              Qaytim (Mijozga beriladi):
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(changeUzs)}
            </span>
          </div>
        )}

        {/* Banknote breakdown */}
        {changeBanknotes.length > 0 && (
          <div className="border-t border-black/[0.05] dark:border-white/[0.06] pt-2">
            <span className="text-[10px] font-semibold text-[var(--text-secondary)] block mb-1">
              Kassadan chiqariladigan kupyuralar:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {changeBanknotes.map((b) => (
                <span
                  key={b.value}
                  className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                >
                  {formatCurrency(b.value)} × {b.count} dona
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Apply Button */}
      <div className="flex gap-2.5 mt-4">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-black/10 dark:border-white/15 px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
          >
            Bekor qilish
          </button>
        )}
        <button
          type="button"
          disabled={totalPaidUzs < requiredAmountUzs}
          onClick={handleApply}
          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-40 transition-all"
        >
          ✓ To'lovni Qabul Qilish ({formatCurrency(totalPaidUzs)})
        </button>
      </div>
    </div>
  );
});
