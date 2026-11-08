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
  Unlock,
} from 'lucide-react';
import { GlassModal, GlassButton, useToast } from '@/components/ui';
import { paymentsApi } from '@/lib/api';
import { formatCurrency, parseFinancialAmount } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys.factory';
import type { ZReportSummary, ZReportRecord, CurrentShiftResponse } from '@/types/finance';
import { triggerPrint } from '@/lib/printEngine';

interface CashierZReportModalProps {
  open: boolean;
  onClose: () => void;
  onShiftClosed?: (report: ZReportRecord) => void;
}

const OPENING_PRESETS = [0, 100_000, 200_000, 500_000, 1_000_000];

export function CashierZReportModal({
  open,
  onClose,
  onShiftClosed,
}: CashierZReportModalProps) {
  const { push } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [actualCashStr, setActualCashStr] = useState<string>('');
  const [handoverAmountStr, setHandoverAmountStr] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [closedReport, setClosedReport] = useState<ZReportRecord | null>(null);

  // Opening shift state
  const [openingBalanceStr, setOpeningBalanceStr] = useState<string>('0');
  const [openingNote, setOpeningNote] = useState<string>('');

  // 1. Current active shift query
  const {
    data: currentShiftData,
    isLoading: isLoadingShift,
    refetch: refetchShift,
  } = useQuery<CurrentShiftResponse>({
    queryKey: ['cashier-current-shift'],
    queryFn: () => paymentsApi.getCurrentCashierShift(),
    enabled: open && activeTab === 'current' && !closedReport,
    refetchInterval: 15_000,
  });

  const activeShift = currentShiftData?.active ? currentShiftData.shift : null;

  // 2. Live reconciliation summary for current open shift
  const {
    data: summary,
    isLoading: isLoadingSummary,
    refetch: refetchSummary,
  } = useQuery<ZReportSummary>({
    queryKey: ['cashier-z-report-summary', activeShift?.id],
    queryFn: () =>
      paymentsApi.getZReportSummary({
        startDate: activeShift?.openedAt,
        cashierId: activeShift?.cashierId,
      }),
    enabled: open && activeTab === 'current' && !closedReport,
    refetchInterval: 15_000,
  });

  // 3. Historical Z-Reports
  const { data: history = [], isLoading: isLoadingHistory } = useQuery<ZReportRecord[]>({
    queryKey: ['cashier-z-reports-history'],
    queryFn: () => paymentsApi.getRecentZReports(20),
    enabled: open && activeTab === 'history',
  });

  const openingBalance = activeShift ? Number(activeShift.openingBalance) || 0 : 0;
  const netCollectedCash = summary?.byMethod?.cash?.amount ?? 0;
  const cashRefunds = summary?.refunds?.cashRefundsAmount ?? 0;

  // Expected cash in drawer = opening cash + cash collected - cash refunds
  const expectedCash = openingBalance + netCollectedCash - cashRefunds;

  const actualCash = useMemo(() => {
    if (!actualCashStr.trim()) return expectedCash;
    const parsed = parseFinancialAmount(actualCashStr);
    return isNaN(parsed) ? 0 : parsed;
  }, [actualCashStr, expectedCash]);

  const handoverAmount = useMemo(() => {
    if (!handoverAmountStr.trim()) return 0;
    const parsed = parseFinancialAmount(handoverAmountStr);
    return isNaN(parsed) ? 0 : parsed;
  }, [handoverAmountStr]);

  const variance = actualCash - expectedCash;

  // Mutation to open cashier shift
  const openShiftMutation = useMutation({
    mutationFn: async () => {
      const balance = parseFinancialAmount(openingBalanceStr) || 0;
      return paymentsApi.openCashierShift({
        openingBalance: balance,
        openingNote: openingNote.trim() || undefined,
      });
    },
    onSuccess: () => {
      push('success', 'Kassa smenasi muvaffaqiyatli ochildi');
      queryClient.invalidateQueries({ queryKey: ['cashier-current-shift'] });
      queryClient.invalidateQueries({ queryKey: ['cashier-z-report-summary'] });
    },
    onError: (err: any) => {
      push('error', err?.message || 'Smenani ochishda xatolik yuz berdi');
    },
  });

  // Mutation to close cashier shift
  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      return paymentsApi.closeCashierShift({
        shiftId: activeShift?.id,
        startDate: activeShift?.openedAt,
        actualCashCounted: actualCash,
        handoverAmount: handoverAmount > 0 ? handoverAmount : undefined,
        closingNotes: closingNotes.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      setClosedReport(data);
      push('success', 'Kassa smenasi muvaffaqiyatli yopildi va Z-Hisobot tasdiqlandi');
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() });
      queryClient.invalidateQueries({ queryKey: ['cashier-current-shift'] });
      queryClient.invalidateQueries({ queryKey: ['cashier-z-reports-history'] });
      onShiftClosed?.(data);
    },
    onError: (err: any) => {
      push('error', err?.message || 'Kassa smenasini yopishda xatolik yuz berdi');
    },
  });

  const handlePrint = () => {
    triggerPrint({
      type: 'z-report',
      title: closedReport ? `Z_Hisobot_${closedReport.reportNumber}` : 'Z_Hisobot',
    });
  };

  const handleResetModal = () => {
    setClosedReport(null);
    setActualCashStr('');
    setHandoverAmountStr('');
    setClosingNotes('');
    setOpeningBalanceStr('0');
    setOpeningNote('');
    onClose();
  };

  const isLoading = isLoadingShift || isLoadingSummary;

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
            <div
              data-printable="thermal"
              className="printable-thermal mx-auto max-w-md rounded-2xl border border-white/15 bg-slate-900/90 p-5 shadow-2xl font-mono text-xs text-slate-300 space-y-3 print:bg-white print:text-black print:border-none print:shadow-none"
            >
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
                  <span>BOSHLANG'ICH QOLDIQ:</span>
                  <span>{formatCurrency((closedReport as any).openingBalance || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-white print:text-black pt-1">
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
                {(closedReport as any).handoverAmount > 0 && (
                  <div className="flex justify-between border-t border-dashed border-white/20 pt-1 text-sky-400 font-semibold">
                    <span>Topshirilgan summa (Inkassatsiya):</span>
                    <span>{formatCurrency((closedReport as any).handoverAmount)}</span>
                  </div>
                )}
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
            ) : !activeShift && (summary?.totalPaymentsCount === 0 || !summary) ? (
              /* PROMPT TO OPEN A NEW CASHIER SHIFT */
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                    <Unlock className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">
                      Yangi Kassa Smenasini Boshlash
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      To'lovlarni qabul qilish va kassadagi naqd pul harakatini to'liq nazorat qilish uchun yangi kassa smenasini oching.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                  <label className="text-xs font-bold text-slate-200">
                    Kassadagi boshlang'ich naqd pul qoldig'i (Tortmadagi pul, UZS)
                  </label>
                  <input
                    type="text"
                    value={openingBalanceStr}
                    onChange={(e) => setOpeningBalanceStr(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-base font-bold text-white outline-none focus:border-emerald-500/50"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 mr-1">Tezkor:</span>
                    {OPENING_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setOpeningBalanceStr(String(preset))}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                      >
                        {preset === 0 ? '0 (Bo‘sh)' : formatCurrency(preset)}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <label className="text-xs font-semibold text-slate-300">
                      Smena ochilishi haqida izoh (ixtiyoriy)
                    </label>
                    <input
                      type="text"
                      value={openingNote}
                      onChange={(e) => setOpeningNote(e.target.value)}
                      placeholder="Masalan: Ertalabki navbat boshlandi"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-white outline-none focus:border-emerald-500/50 placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <GlassButton variant="secondary" onClick={onClose}>
                    Bekor qilish
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    disabled={openShiftMutation.isPending}
                    onClick={() => openShiftMutation.mutate()}
                  >
                    <Unlock className="mr-1.5 h-4 w-4" />
                    {openShiftMutation.isPending ? 'Smena ochilmoqda...' : 'Smenani ochish'}
                  </GlassButton>
                </div>
              </div>
            ) : summary ? (
              <>
                {/* Active Shift Header if Shift is Open */}
                {activeShift && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-bold text-white">
                        Ochiq kassa smenasi
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({new Date(activeShift.openedAt).toLocaleTimeString('uz-UZ')} da ochilgan)
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-emerald-300">
                      Boshlang'ich qoldiq: <strong className="text-white">{formatCurrency(openingBalance)}</strong>
                    </div>
                  </div>
                )}

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
                      {formatCurrency(expectedCash)}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {openingBalance > 0 ? `Boshlang'ich (${formatCurrency(openingBalance)}) + ` : ''}
                      Naqd tushum ({formatCurrency(summary.byMethod.cash.amount)})
                      {cashRefunds > 0 ? ` - Qaytarish (${formatCurrency(cashRefunds)})` : ''}
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

                  {/* Handover Amount Input */}
                  <div className="pt-2">
                    <label className="text-xs font-semibold text-slate-300">
                      Topshirilayotgan summa / Inkassatsiya (ixtiyoriy, UZS)
                    </label>
                    <input
                      type="text"
                      value={handoverAmountStr}
                      placeholder="0"
                      onChange={(e) => setHandoverAmountStr(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 text-xs font-bold text-sky-300 outline-none focus:border-sky-500/50 placeholder:text-slate-500"
                    />
                  </div>

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
                    placeholder="Masalan: Barcha cheklar va terminal lentalari solishtirildi..."
                    className="w-full rounded-xl border border-white/10 bg-black/30 p-2.5 text-base sm:text-xs text-white outline-none focus:border-emerald-500/50 placeholder:text-slate-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      refetchShift();
                      refetchSummary();
                    }}
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
