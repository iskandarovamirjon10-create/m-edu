import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  DollarSign,
  CreditCard,
  Building,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Printer,
  History,
  Lock,
} from 'lucide-react';
import { GlassModal, GlassButton, useToast } from '@/components/ui';
import { paymentsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys.factory';
import type { ZReportSummary, ZReportRecord } from '@/types/finance';

interface CashierZReportModalProps {
  open: boolean;
  onClose: () => void;
  onShiftClosed?: (report: ZReportRecord) => void;
}

export function CashierZReportModal({
  open,
  onClose,
  onShiftClosed,
}: CashierZReportModalProps) {
  const { push } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [actualCashStr, setActualCashStr] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [closedReport, setClosedReport] = useState<ZReportRecord | null>(null);

  // Live reconciliation summary for current open shift
  const {
    data: summary,
    isLoading,
    refetch,
  } = useQuery<ZReportSummary>({
    queryKey: ['cashier-z-report-summary'],
    queryFn: () => paymentsApi.getZReportSummary(),
    enabled: open && activeTab === 'current' && !closedReport,
    refetchInterval: 15_000,
  });

  // Historical Z-Reports
  const { data: history = [], isLoading: isLoadingHistory } = useQuery<ZReportRecord[]>({
    queryKey: ['cashier-z-reports-history'],
    queryFn: () => paymentsApi.getRecentZReports(15),
    enabled: open && activeTab === 'history',
  });

  const expectedCash = summary?.netCashDrawerExpected ?? 0;
  const actualCash = useMemo(() => {
    if (!actualCashStr.trim()) return expectedCash;
    const clean = actualCashStr.replace(/\s+/g, '').replace(/,/g, '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }, [actualCashStr, expectedCash]);

  const variance = actualCash - expectedCash;

  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      return paymentsApi.closeCashierShift({
        actualCashCounted: actualCash,
        closingNotes: closingNotes.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      setClosedReport(data);
      push('success', 'Kassa smenasi muvaffaqiyatli yopildi va Z-Hisobot tasdiqlandi');
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() });
      queryClient.invalidateQueries({ queryKey: ['cashier-z-reports-history'] });
      onShiftClosed?.(data);
    },
    onError: (err: any) => {
      push('error', err?.message || 'Kassa smenasini yopishda xatolik yuz berdi');
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const handleResetModal = () => {
    setClosedReport(null);
    setActualCashStr('');
    setClosingNotes('');
    onClose();
  };

  return (
    <GlassModal
      open={open}
      onClose={handleResetModal}
      title="Kunlik Kassa va Z-Hisobot"
      size="xl"
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        {!closedReport && (
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'current'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="h-4 w-4" />
              Joriy Smena va Kassa Yopish
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'history'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <History className="h-4 w-4" />
              Z-Hisobotlar Tarixi
            </button>
          </div>
        )}

        {/* PRINTABLE SLIP / FINALIZED Z-REPORT VIEW */}
        {closedReport ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <h4 className="mt-2 text-base font-bold text-white">
                Kassa Smenasi Rasman Yopildi
              </h4>
              <p className="text-xs text-emerald-300">
                Hisobot raqami: <span className="font-mono font-bold">{closedReport.reportNumber}</span>
              </p>
            </div>

            {/* Thermal Receipt Visual Preview */}
            <div className="mx-auto max-w-md rounded-2xl border border-white/15 bg-slate-900/90 p-5 shadow-2xl font-mono text-xs text-slate-300 space-y-3 print:bg-white print:text-black">
              <div className="text-center space-y-1 border-b border-dashed border-white/20 pb-3">
                <p className="font-bold text-sm text-white print:text-black">M-EDU EDUCATION</p>
                <p className="text-[11px] text-slate-400">KASSA Z-HISOBOTI (SHIFT REPORT)</p>
                <p className="text-[10px] text-slate-400">№ {closedReport.reportNumber}</p>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Yopilgan vaqti:</span>
                  <span className="font-semibold">{new Date(closedReport.closedAt).toLocaleString('uz-UZ')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kassir:</span>
                  <span className="font-semibold">{closedReport.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>To'lovlar soni:</span>
                  <span>{closedReport.summary.totalPaymentsCount} ta</span>
                </div>
              </div>

              <div className="border-t border-b border-dashed border-white/20 py-2 space-y-1.5 text-[11px]">
                <div className="flex justify-between font-bold text-white print:text-black">
                  <span>JAMI TUSHUM:</span>
                  <span>{formatCurrency(closedReport.summary.totalCollected)}</span>
                </div>
                <div className="flex justify-between pl-2 text-slate-400">
                  <span>• Naqd pul (Cash):</span>
                  <span>{formatCurrency(closedReport.summary.byMethod.cash.amount)}</span>
                </div>
                <div className="flex justify-between pl-2 text-slate-400">
                  <span>• Terminal (Uzcard/Humo):</span>
                  <span>{formatCurrency(closedReport.summary.byMethod.terminal.amount)}</span>
                </div>
                <div className="flex justify-between pl-2 text-slate-400">
                  <span>• Bank o'tkazmasi:</span>
                  <span>{formatCurrency(closedReport.summary.byMethod.bankTransfer.amount)}</span>
                </div>
                {closedReport.summary.refunds.count > 0 && (
                  <div className="flex justify-between pl-2 text-rose-400">
                    <span>• Qaytarilgan (Refunds):</span>
                    <span>-{formatCurrency(closedReport.summary.refunds.totalAmount)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-[11.5px]">
                <div className="flex justify-between">
                  <span>Kassa kutilmasi (Expected):</span>
                  <span>{formatCurrency(closedReport.expectedCash)}</span>
                </div>
                <div className="flex justify-between font-bold text-white print:text-black">
                  <span>Sanalgan naqd pul:</span>
                  <span>{formatCurrency(closedReport.actualCashCounted)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dashed border-white/20 pt-1.5">
                  <span>FARQ (VARIANCE):</span>
                  <span
                    className={
                      closedReport.variance === 0
                        ? 'text-emerald-400'
                        : closedReport.variance < 0
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }
                  >
                    {closedReport.variance > 0 ? '+' : ''}
                    {formatCurrency(closedReport.variance)}
                  </span>
                </div>
              </div>

              {closedReport.closingNotes && (
                <div className="border-t border-dashed border-white/20 pt-2 text-[10.5px] italic text-slate-400">
                  Izoh: "{closedReport.closingNotes}"
                </div>
              )}

              <div className="text-center pt-2 text-[10px] text-slate-500">
                Audit tizimida tasdiqlangan va muhrlangan
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <GlassButton variant="secondary" onClick={handlePrint}>
                <Printer className="mr-1.5 h-4 w-4" />
                Chop etish (Print)
              </GlassButton>
              <GlassButton variant="primary" onClick={handleResetModal}>
                Yopish
              </GlassButton>
            </div>
          </div>
        ) : activeTab === 'current' ? (
          /* CURRENT OPEN SHIFT FORM */
          <div className="space-y-5">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-slate-400">
                Kassa ma'lumotlari yuklanmoqda...
              </div>
            ) : summary ? (
              <>
                {/* 4 Summary Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-semibold">Naqd kassa</span>
                      <DollarSign className="h-4 w-4 text-emerald-400" />
                    </div>
                    <p className="text-lg font-black text-white">
                      {formatCurrency(summary.byMethod.cash.amount)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {summary.byMethod.cash.count} ta to'lov
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-semibold">Terminal</span>
                      <CreditCard className="h-4 w-4 text-blue-400" />
                    </div>
                    <p className="text-lg font-black text-white">
                      {formatCurrency(summary.byMethod.terminal.amount)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Uzcard / Humo ({summary.byMethod.terminal.count} ta)
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-semibold">Bank hisob</span>
                      <Building className="h-4 w-4 text-purple-400" />
                    </div>
                    <p className="text-lg font-black text-white">
                      {formatCurrency(summary.byMethod.bankTransfer.amount)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      To'lov topshirig'i ({summary.byMethod.bankTransfer.count} ta)
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-semibold">Qaytarishlar</span>
                      <RotateCcw className="h-4 w-4 text-rose-400" />
                    </div>
                    <p className="text-lg font-black text-white">
                      -{formatCurrency(summary.refunds.totalAmount)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {summary.refunds.count} ta chek
                    </p>
                  </div>
                </div>

                {/* Net Expected Cash Highlight */}
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-emerald-300">
                      Kassadagi kutilayotgan naqd pul (Sof kassa)
                    </span>
                    <p className="text-2xl font-black text-white">
                      {formatCurrency(summary.netCashDrawerExpected)}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Naqd tushum ({formatCurrency(summary.byMethod.cash.amount)}) - Naqd qaytarish ({formatCurrency(summary.refunds.cashRefundsAmount)})
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p>Jami tushum: <strong className="text-white">{formatCurrency(summary.totalCollected)}</strong></p>
                    <p>Cheklar soni: <strong className="text-white">{summary.totalPaymentsCount} ta</strong></p>
                  </div>
                </div>

                {/* Cash Drawer Counting Input */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200">
                      Kassada sanalgan haqiqiy naqd pul miqdori (UZS)
                    </label>
                    <button
                      type="button"
                      onClick={() => setActualCashStr(String(expectedCash))}
                      className="text-[11px] text-emerald-400 hover:underline font-semibold"
                    >
                      Kutilganiga tenglashtirish ({formatCurrency(expectedCash)})
                    </button>
                  </div>

                  <input
                    type="text"
                    value={actualCashStr}
                    placeholder={`Masalan: ${expectedCash}`}
                    onChange={(e) => setActualCashStr(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-base font-bold text-white outline-none focus:border-emerald-500/50"
                  />

                  {/* Discrepancy indicator */}
                  <div
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
                      variance === 0
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : variance < 0
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {variance === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      <span>
                        {variance === 0
                          ? "Kassa balansi to'liq mos keldi (Farq yo'q)"
                          : variance < 0
                          ? `Kamomad aniqlandi (${formatCurrency(Math.abs(variance))})`
                          : `Ortiqcha mablag' aniqlandi (+${formatCurrency(variance)})`}
                      </span>
                    </div>
                    <span className="font-mono font-bold">
                      {variance > 0 ? '+' : ''}
                      {formatCurrency(variance)}
                    </span>
                  </div>
                </div>

                {/* Closing Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Kassir izohi va xulosasi (ixtiyoriy)
                  </label>
                  <textarea
                    rows={2}
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="Masalan: Barcha cheklar va terminal lentalari solishtirildi. Kamomad sababi..."
                    className="w-full rounded-xl border border-white/10 bg-black/30 p-2.5 text-xs text-white outline-none focus:border-emerald-500/50 placeholder:text-slate-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Ma'lumotlarni yangilash
                  </button>

                  <div className="flex items-center gap-2.5">
                    <GlassButton variant="secondary" onClick={onClose}>
                      Bekor qilish
                    </GlassButton>
                    <GlassButton
                      variant="primary"
                      disabled={closeShiftMutation.isPending}
                      onClick={() => closeShiftMutation.mutate()}
                    >
                      <Lock className="mr-1.5 h-4 w-4" />
                      {closeShiftMutation.isPending ? "Yopilmoqda..." : "Smenani yopish (Z-Hisobot)"}
                    </GlassButton>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : (
          /* HISTORICAL Z-REPORTS TAB */
          <div className="space-y-3">
            {isLoadingHistory ? (
              <div className="py-12 text-center text-sm text-slate-400">
                Tarix yuklanmoqda...
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">
                Hozircha yopilgan kassa Z-hisobotlari mavjud emas.
              </div>
            ) : (
              <div className="max-h-[55vh] overflow-y-auto space-y-2.5 pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.07] transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">
                          {item.reportNumber}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.status === 'BALANCED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : item.status === 'SHORTAGE'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {item.status === 'BALANCED'
                            ? 'To‘liq mos'
                            : item.status === 'SHORTAGE'
                            ? 'Kamomad'
                            : 'Ortiqcha'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Kassir: <strong className="text-slate-300">{item.cashierName}</strong> • {new Date(item.closedAt).toLocaleString('uz-UZ')}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold text-white">
                        {formatCurrency(item.actualCashCounted)}
                      </p>
                      <p
                        className={`text-[11px] font-semibold ${
                          item.variance === 0
                            ? 'text-emerald-400'
                            : item.variance < 0
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        Farq: {item.variance > 0 ? '+' : ''}{formatCurrency(item.variance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </GlassModal>
  );
}
