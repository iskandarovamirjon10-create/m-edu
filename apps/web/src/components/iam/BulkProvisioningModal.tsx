/**
 * M-EDU Bulk Provisioning Studio — Apple "iOS 27 · Spatial Liquid Glass"
 *
 * Exclusively for PLATFORM_OWNER to preview, validate, and atomically commit
 * hundreds of student, teacher, manager, or admin accounts via Excel / CSV.
 */
import { useState, useCallback, useRef, memo } from 'react';
import { GlassModal, GlassButton, useToasts } from '@/components/ui';
import { iamApi, type BulkPreviewResult, type BulkCommitResult } from '@/lib/api';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { OnboardingSlipModal } from './OnboardingSlipModal';
import type { OnboardingCredentialRecord } from './OnboardingSlip';

interface BulkProvisioningModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultOrgId?: string;
}

/**
 * Shablonda faqat sarlavhalar bo'ladi — namunaviy ismlar, telefonlar yoki
 * parollar hech qachon eksport qilinmaydi (tasodifiy haqiqiy import oldini oladi).
 */
const TEMPLATE_CSV_CONTENT = `username,password,firstName,lastName,email,phone,role,organizationId`;

export const BulkProvisioningModal = memo(function BulkProvisioningModal({
  open,
  onClose,
  onSuccess,
  defaultOrgId,
}: BulkProvisioningModalProps) {
  const { push } = useToasts();
  const sound = usePremiumSound();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<BulkPreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<BulkCommitResult | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'ERRORS_ONLY'>('ALL');
  const [committedAccounts, setCommittedAccounts] = useState<OnboardingCredentialRecord[]>([]);
  const [showSlipModal, setShowSlipModal] = useState(false);

  const handleDownloadTemplate = useCallback(() => {
    sound.playPop?.();
    const blob = new Blob([TEMPLATE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'medu_bulk_provisioning_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    push('info', 'Shablon yuklab olindi (Excel yoki CSV shaklida to\'ldiring)');
  }, [push, sound]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setSelectedFile(file);
      setPreviewData(null);
      setCommitResult(null);
      setBusy(true);

      try {
        const preview = await iamApi.uploadBulkFile(file);
        setPreviewData(preview);
        sound.playSuccess?.();
        if (preview.errorCount > 0) {
          push('warning', `${preview.total} tadan ${preview.errorCount} ta qatorda xatolik aniqlandi`);
        } else {
          push('success', `Barcha ${preview.total} ta qator muvaffaqiyatli tekshirildi!`);
        }
      } catch (err: any) {
        sound.playError?.();
        push('error', err?.message || 'Faylni tahlil qilishda xatolik yuz berdi');
      } finally {
        setBusy(false);
      }
    },
    [push, sound],
  );

  const handleCommit = useCallback(async () => {
    if (!previewData || previewData.errorCount > 0) return;

    setBusy(true);
    try {
      if (!selectedFile) throw new Error('Fayl tanlanmagan');
      // Upload again to commit
      const res = await iamApi.uploadBulkFile(selectedFile);
      if (res.errorCount > 0) {
        throw new Error('Faylda tekshiruvdan o\'tmagan qatorlar mavjud');
      }

      // Re-trigger commit endpoint using parsed buffer or raw rows
      // Read raw rows from file via Excel parser on client or trigger commit
      push('info', 'Hisoblar xavfsiz tranzaksiya bilan yaratilmoqda...');
      // To ensure atomicity with passwords preserved from file, we send the file
      // via uploadBulkFile which previewed. Then we commit:
      const accountsToCommit = res.preview.map((p) => ({
        username: p.username,
        password: (p as any).password || 'InitialPassword123!',
        firstName: (p as any).firstName || 'Foydalanuvchi',
        lastName: (p as any).lastName || '',
        organizationId: p.organizationId || defaultOrgId || '',
        role: p.role,
      }));
      const commitRes = await iamApi.commitBulk(accountsToCommit);
      setCommitResult(commitRes);
      setCommittedAccounts(
        accountsToCommit.map((a) => ({
          fullName: `${a.firstName} ${a.lastName}`.trim(),
          username: a.username,
          temporaryPassword: a.password,
          role: a.role,
          organizationName: 'Tashkilot',
          mustChangePassword: true,
        })),
      );
      sound.playSuccess?.();
      push('success', `${commitRes.created} ta hisob muvaffaqiyatli yaratildi!`);
      onSuccess?.();
    } catch (err: any) {
      sound.playError?.();
      push('error', err?.message || 'Ommaviy hisoblarni saqlashda xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  }, [defaultOrgId, onSuccess, previewData, push, selectedFile, sound]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setPreviewData(null);
    setCommitResult(null);
    setCommittedAccounts([]);
    setShowSlipModal(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const displayRows = previewData?.preview.filter((r) =>
    filterMode === 'ERRORS_ONLY' ? !r.valid : true,
  );

  return (
    <GlassModal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Ommaviy Hisob Yaratish (Bulk Provisioning)"
      size="xl"
    >
      <div className="space-y-5 antialiased selection:bg-brand-500/20">
        <p className="text-xs text-[var(--text-secondary)] -mt-2">
          Excel (.xlsx) yoki .csv orqali yuzlab foydalanuvchilarni bir zumda tekshirish va yaratish
        </p>
        {/* Step 1: Upload or Download Template */}
        {!previewData && !commitResult && (
          <div className="space-y-4">
            {/* Template Download Card */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-brand-500/20 bg-brand-500/[0.06] p-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </span>
                <div>
                  <h4 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F8FAFC]">
                    Tayyor Excel / CSV Shablonini oling
                  </h4>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    To'g'ri ustunlar: username, password, firstName, lastName, email, phone, role, organizationId
                  </p>
                </div>
              </div>
              <GlassButton type="button" variant="secondary" onClick={handleDownloadTemplate} size="sm">
                Shablonni yuklab olish
              </GlassButton>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-surface-900/40 p-9 text-center transition-all duration-200 hover:border-brand-500 hover:bg-brand-500/[0.03] cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                disabled={busy}
              />
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500 transition-transform group-hover:scale-110">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </span>
              <p className="mt-3 text-[14.5px] font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                {busy ? 'Fayl tekshirilmoqda...' : 'Excel (.xlsx) yoki CSV faylni yuklang'}
              </p>
              <p className="text-[12.5px] text-slate-400 mt-1">
                Faylni bu yerga sudrab tashlang yoki tanlash uchun bosing
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Validation Preview Table */}
        {previewData && !commitResult && (
          <div className="space-y-4">
            {/* KPI Summary Bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white/60 dark:bg-surface-900/60 p-3.5 backdrop-blur-xl">
                <p className="text-[11px] font-medium text-slate-400">Jami qatorlar</p>
                <p className="text-[20px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  {previewData.total}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] p-3.5 backdrop-blur-xl">
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Yaroqli hisoblar</p>
                <p className="text-[20px] font-bold text-emerald-600 dark:text-emerald-400">
                  {previewData.validCount}
                </p>
              </div>
              <div className={`rounded-2xl border p-3.5 backdrop-blur-xl ${
                previewData.errorCount > 0
                  ? 'border-rose-500/25 bg-rose-500/[0.08]'
                  : 'border-slate-200 dark:border-slate-800 bg-white/30'
              }`}>
                <p className={`text-[11px] font-medium ${
                  previewData.errorCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                }`}>
                  Xatoliklar
                </p>
                <p className={`text-[20px] font-bold ${
                  previewData.errorCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                }`}>
                  {previewData.errorCount}
                </p>
              </div>
            </div>

            {/* Error filter toggle */}
            {previewData.errorCount > 0 && (
              <div className="flex items-center justify-between px-1">
                <p className="text-[12px] font-medium text-rose-600 dark:text-rose-400">
                  ⚠️ {previewData.errorCount} ta qatorda xatolik bor. Yaratishdan oldin faylni to'g'rilang.
                </p>
                <button
                  type="button"
                  onClick={() => setFilterMode((m) => (m === 'ALL' ? 'ERRORS_ONLY' : 'ALL'))}
                  className="text-[12px] font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  {filterMode === 'ALL' ? 'Faqat xatoliklarni ko\'rsatish' : 'Barchasini ko\'rsatish'}
                </button>
              </div>
            )}

            {/* Table */}
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white/50 dark:bg-surface-900/50">
              <table className="w-full text-[12.5px] tabular-nums">
                <thead className="sticky top-0 bg-white/90 dark:bg-surface-900/90 backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.08]">
                  <tr>
                    <th className="px-3.5 py-2.5 text-left font-semibold text-slate-500">#</th>
                    <th className="px-3.5 py-2.5 text-left font-semibold text-slate-500">Username</th>
                    <th className="px-3.5 py-2.5 text-left font-semibold text-slate-500">Rol</th>
                    <th className="px-3.5 py-2.5 text-left font-semibold text-slate-500">Holat</th>
                    <th className="px-3.5 py-2.5 text-left font-semibold text-slate-500">Izoh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {displayRows?.map((row) => (
                    <tr key={row.row} className={row.valid ? 'hover:bg-emerald-500/[0.03]' : 'bg-rose-500/[0.04]'}>
                      <td className="px-3.5 py-2 text-slate-400">{row.row}</td>
                      <td className="px-3.5 py-2 font-mono font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                        @{row.username}
                      </td>
                      <td className="px-3.5 py-2">
                        <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {row.role}
                        </span>
                      </td>
                      <td className="px-3.5 py-2">
                        {row.valid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-[11.5px] font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Tayyor
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 text-[11.5px] font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Xato
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2 text-slate-500 dark:text-slate-400">
                        {row.errors.length > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            {row.errors.join(', ')}
                          </span>
                        ) : (
                          'Yaroqli'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={busy}
                className="text-[13px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Boshqa fayl tanlash
              </button>
              <div className="flex gap-2">
                <GlassButton type="button" variant="secondary" onClick={onClose} disabled={busy}>
                  Bekor qilish
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={handleCommit}
                  disabled={busy || previewData.errorCount > 0}
                  className="min-w-[160px]"
                >
                  {busy ? 'Yaratilmoqda...' : `${previewData.validCount} ta hisobni yaratish`}
                </GlassButton>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Success Confirmation Receipt */}
        {commitResult && (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.3)]">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-[18px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Ommaviy import muvaffaqiyatli yakunlandi!
            </h3>
            <p className="text-[13.5px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Jami <strong className="text-emerald-600">{commitResult.created} ta</strong> hisob bazada yaratildi.
              Barcha yangi foydalanuvchilar birinchi kirishda parollarini majburiy almashtiradilar.
            </p>

            <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
              {committedAccounts.length > 0 && (
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={() => setShowSlipModal(true)}
                  icon={
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></svg>
                  }
                >
                  {committedAccounts.length} ta hisob varaqasini chop etish (PDF)
                </GlassButton>
              )}
              <GlassButton type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">
                Yopish
              </GlassButton>
            </div>
          </div>
        )}
      </div>

      {showSlipModal && committedAccounts.length > 0 && (
        <OnboardingSlipModal
          open={showSlipModal}
          onClose={() => setShowSlipModal(false)}
          title={`Ommaviy Hisob Varaqalari (${committedAccounts.length} ta)`}
          records={committedAccounts}
        />
      )}
    </GlassModal>
  );
});

export default BulkProvisioningModal;
