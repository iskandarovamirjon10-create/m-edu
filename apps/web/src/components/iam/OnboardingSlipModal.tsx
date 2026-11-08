import React, { useState, useMemo, useCallback } from 'react';
import { GlassModal, GlassButton, useToasts } from '@/components/ui';
import { OnboardingSlip, OnboardingCredentialRecord } from './OnboardingSlip';
export type { OnboardingCredentialRecord } from './OnboardingSlip';
import { triggerPrint } from '@/lib/printEngine';

export interface OnboardingSlipModalProps {
  open: boolean;
  onClose: () => void;
  records: OnboardingCredentialRecord[];
  title?: string;
}

export const OnboardingSlipModal: React.FC<OnboardingSlipModalProps> = ({
  open,
  onClose,
  records,
  title = 'Hisob Varaqalari (Onboarding Slips)',
}) => {
  const { push } = useToasts();
  const [search, setSearch] = useState('');
  const [slipsPerPage, setSlipsPerPage] = useState<1 | 2 | 3>(records.length > 1 ? 2 : 1);
  const [copiedAll, setCopiedAll] = useState(false);

  const filteredRecords = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(
      (r) =>
        r.username.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        (r.role && r.role.toLowerCase().includes(q)),
    );
  }, [records, search]);

  // Chunk records into pages for printing
  const pages = useMemo(() => {
    const result: OnboardingCredentialRecord[][] = [];
    for (let i = 0; i < filteredRecords.length; i += slipsPerPage) {
      result.push(filteredRecords.slice(i, i + slipsPerPage));
    }
    return result;
  }, [filteredRecords, slipsPerPage]);

  const handlePrint = useCallback(() => {
    if (filteredRecords.length === 0) return;
    triggerPrint({
      type: 'onboarding-slip-a4',
      title: `M-EDU_Onboarding_Slips_${new Date().toISOString().slice(0, 10)}`,
    });
  }, [filteredRecords]);

  const handleCopyAll = useCallback(() => {
    if (filteredRecords.length === 0) return;
    const lines = [
      '# M-EDU HISOB KREDENSIALLARI',
      `Sana: ${new Date().toLocaleDateString('uz-UZ')}`,
      `Jami: ${filteredRecords.length} ta hisob`,
      '------------------------------------------------------------',
      'F.I.SH\tLogin\tParol\tRol',
      ...filteredRecords.map(
        (r) =>
          `${r.fullName}\t@${r.username}\t${r.temporaryPassword || '—'}\t${r.role}`,
      ),
      '------------------------------------------------------------',
    ].join('\n');

    navigator.clipboard
      .writeText(lines)
      .then(() => {
        setCopiedAll(true);
        push('success', `${filteredRecords.length} ta hisob ma'lumotlari xotiraga nusxalandi!`);
        setTimeout(() => setCopiedAll(false), 2500);
      })
      .catch(() => {
        push('error', 'Nusxalashda xatolik yuz berdi');
      });
  }, [filteredRecords, push]);

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
    >
      <div className="space-y-4">
        {/* Controls Toolbar (Screen only) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] pb-3 print:hidden">
          {/* Search bar */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Qidiruv (ism yoki @login)..."
              className="w-full rounded-xl border border-black/[0.1] bg-white/70 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-none dark:border-white/[0.12] dark:bg-surface-800/80 dark:text-slate-100"
            />
          </div>

          {/* Slips per page layout toggle */}
          {records.length > 1 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-black/[0.03] p-1 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <span className="text-[11px] font-semibold text-slate-500 px-2">Varaqda:</span>
              {([1, 2, 3] as const).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSlipsPerPage(num)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    slipsPerPage === num
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-surface-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  {num} ta
                </button>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleCopyAll}
              className="text-xs"
              icon={
                copiedAll ? (
                  <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                ) : (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                )
              }
            >
              {copiedAll ? 'Nusxa olindi!' : 'Matnni nusxalash'}
            </GlassButton>

            <GlassButton
              type="button"
              variant="primary"
              onClick={handlePrint}
              className="text-xs shadow-md"
              icon={
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect width="12" height="8" x="6" y="14" />
                </svg>
              }
            >
              Chop etish (PDF)
            </GlassButton>
          </div>
        </div>

        {/* Modal Visual Preview (Scrollable) */}
        <div className="max-h-[60vh] overflow-y-auto space-y-4 px-1 py-1 print:hidden">
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              Qidiruv bo'yicha hech qanday hisob topilmadi
            </div>
          ) : (
            filteredRecords.map((rec, idx) => (
              <OnboardingSlip
                key={rec.username || idx}
                record={rec}
                showCutLine={idx < filteredRecords.length - 1}
                compact={slipsPerPage === 3}
              />
            ))
          )}
        </div>

        {/* =========================================================================
            ISOLATED PRINTABLE DOM (Only visible during print via @media print)
            Targeted by: body[data-print-mode="onboarding-slip-a4"] [data-printable="onboarding-slip"]
           ========================================================================= */}
        <div data-printable="onboarding-slip" className="hidden print:block">
          {pages.map((pageRecords, pageIdx) => (
            <div
              key={pageIdx}
              className={`onboarding-sheet-page ${pageIdx < pages.length - 1 ? 'break-after-page' : ''}`}
            >
              {pageRecords.map((rec, recIdx) => (
                <OnboardingSlip
                  key={rec.username || recIdx}
                  record={rec}
                  showCutLine={recIdx < pageRecords.length - 1}
                  compact={slipsPerPage === 3}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.08] print:hidden">
          <span className="text-xs text-slate-500">
            Jami: <strong className="text-slate-800 dark:text-slate-200">{filteredRecords.length} ta</strong> hisob varaqasi
          </span>
          <GlassButton type="button" variant="secondary" onClick={onClose}>
            Yopish
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
};

export default OnboardingSlipModal;
