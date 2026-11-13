import { useState, memo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GlassModal,
  GlassButton,
  GlassInput,
  GlassField,
  GlassSelect,
  useToasts,
} from '@/components/ui';
import { coursesApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { getErrorMessage } from '@/lib/errorMessages';
import { parseFinancialAmount } from '@/lib/format';

interface BulkCourseActionsModalsProps {
  selectedIds: string[];
  isOpen: boolean;
  activeModal: 'status' | 'price' | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkCourseActionsModals = memo(function BulkCourseActionsModals({
  selectedIds,
  isOpen,
  activeModal,
  onClose,
  onSuccess,
}: BulkCourseActionsModalsProps) {
  const { t } = useSafeI18n();
  const { push } = useToasts();
  const qc = useQueryClient();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  // 1. Bulk Status State
  const [targetStatus, setTargetStatus] = useState<boolean>(true);

  // 2. Bulk Price State
  const [priceMode, setPriceMode] = useState<'set' | 'increase_percent' | 'decrease_percent'>('set');
  const [priceValue, setPriceValue] = useState<string>('');

  const count = selectedIds.length;

  // Mutations
  const statusMutation = useMutation({
    mutationFn: () => coursesApi.bulkStatus({ courseIds: selectedIds, isActive: targetStatus }),
    onSuccess: (data) => {
      sound.playSuccess();
      haptics.success();
      push({
        type: 'success',
        title: t('courses.bulk.statusSuccessTitle', `${count} ta kurs yangilandi`),
        message: data.message || t('courses.bulk.statusSuccessDesc', 'Kurslar holati muvaffaqiyatli saqlandi'),
      });
      qc.invalidateQueries({ queryKey: queryKeys.courses.all() });
      onSuccess();
      onClose();
    },
    onError: (err) => {
      sound.playError();
      haptics.error();
      push({
        type: 'error',
        title: t('common.error', 'Xatolik yuz berdi'),
        message: getErrorMessage(err),
      });
    },
  });

  const priceMutation = useMutation({
    mutationFn: () => {
      const val = priceMode === 'set' ? parseFinancialAmount(priceValue) : parseFloat(priceValue);
      if (isNaN(val) || val < 0) {
        throw new Error('Narx qiymatini to\'g\'ri kiriting');
      }
      return coursesApi.bulkPrice({
        courseIds: selectedIds,
        mode: priceMode,
        value: val,
      });
    },
    onSuccess: (data) => {
      sound.playSuccess();
      haptics.success();
      push({
        type: 'success',
        title: t('courses.bulk.priceSuccessTitle', `Kurslar narxi yangilandi`),
        message: data.message || `${count} ta kurs narxi muvaffaqiyatli o'zgartirildi`,
      });
      qc.invalidateQueries({ queryKey: queryKeys.courses.all() });
      onSuccess();
      onClose();
    },
    onError: (err) => {
      sound.playError();
      haptics.error();
      push({
        type: 'error',
        title: t('common.error', 'Xatolik yuz berdi'),
        message: getErrorMessage(err),
      });
    },
  });

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen || !activeModal) return null;

  return (
    <>
      {/* 1. BULK STATUS MODAL */}
      <GlassModal
        open={activeModal === 'status'}
        onClose={handleClose}
        title={t('courses.bulk.statusModalTitle', 'Kurslar holatini o\'zgartirish')}
        className="max-w-md"
      >
        <div className="space-y-5">
          <p className="text-[13px] text-[var(--text-secondary)]">
            {t(
              'courses.bulk.statusModalSubtitle',
              { count },
              `Tanlangan ${count} ta kursning faollik holatini birdaniga yangilash:`
            )}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTargetStatus(true)}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
                targetStatus
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold ring-2 ring-emerald-500/20'
                  : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-[var(--text-secondary)]'
              }`}
            >
              <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-[14px]">{t('courses.bulk.activate', 'Faollashtirish')}</span>
              <span className="text-[11px] opacity-75 mt-0.5">{t('courses.bulk.activeDesc', 'Yangi guruhlar ochish mumkin')}</span>
            </button>

            <button
              type="button"
              onClick={() => setTargetStatus(false)}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
                !targetStatus
                  ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold ring-2 ring-amber-500/20'
                  : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-[var(--text-secondary)]'
              }`}
            >
              <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              </div>
              <span className="text-[14px]">{t('courses.bulk.deactivate', 'Nofaol qilish')}</span>
              <span className="text-[11px] opacity-75 mt-0.5">{t('courses.bulk.deactiveDesc', 'Arxivlash / Qabulni yopish')}</span>
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <GlassButton variant="ghost" onClick={handleClose} disabled={statusMutation.isPending}>
              {t('common.cancel', 'Bekor qilish')}
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={() => statusMutation.mutate()}
              loading={statusMutation.isPending}
            >
              {t('courses.bulk.apply', 'Qo\'llash')} ({count})
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* 2. BULK PRICE MODAL */}
      <GlassModal
        open={activeModal === 'price'}
        onClose={handleClose}
        title={t('courses.bulk.priceModalTitle', 'Kurslar narxini ommaviy yangilash')}
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--text-secondary)]">
            {t(
              'courses.bulk.priceModalSubtitle',
              { count },
              `Tanlangan ${count} ta kurs uchun yangi to'lov miqdorini belgilang:`
            )}
          </p>

          <GlassField label={t('courses.bulk.priceMode', 'O\'zgartirish usuli')}>
            <GlassSelect
              value={priceMode}
              onChange={(e) => setPriceMode(e.target.value as any)}
            >
              <option value="set">💵 Yangi qat'iy narx belgilash (UZS)</option>
              <option value="increase_percent">📈 Foizda oshirish (+ %)</option>
              <option value="decrease_percent">📉 Chegirma / Foizda kamaytirish (- %)</option>
            </GlassSelect>
          </GlassField>

          <GlassField
            label={
              priceMode === 'set'
                ? t('courses.bulk.priceAmountLabel', 'Yangi narx (UZS)')
                : t('courses.bulk.pricePercentLabel', 'Foiz miqdori (%)')
            }
          >
            <GlassInput
              type="number"
              min="0"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              placeholder={priceMode === 'set' ? 'Masalan: 450000' : 'Masalan: 10'}
            />
          </GlassField>

          {/* Quick presets */}
          {priceMode !== 'set' ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Tezkor foizlar:</span>
              {['5', '10', '15', '20', '25'].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setPriceValue(pct)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    priceValue === pct
                      ? 'bg-brand-500 text-white'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:bg-black/[0.08]'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Tezkor narxlar:</span>
              {['200000', '300000', '400000', '500000', '600000'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriceValue(p)}
                  className={`rounded-lg px-2 py-0.5 text-[10.5px] font-semibold transition-all ${
                    priceValue === p
                      ? 'bg-brand-500 text-white'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:bg-black/[0.08]'
                  }`}
                >
                  {(parseInt(p, 10) / 1000).toLocaleString('uz-UZ')}k
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <GlassButton variant="ghost" onClick={handleClose} disabled={priceMutation.isPending}>
              {t('common.cancel', 'Bekor qilish')}
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={() => priceMutation.mutate()}
              loading={priceMutation.isPending}
              disabled={!priceValue}
            >
              {t('common.save', 'Saqlash')} ({count})
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </>
  );
});
