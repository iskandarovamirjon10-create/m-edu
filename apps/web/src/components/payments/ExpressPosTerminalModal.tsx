import { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
  CheckCircle2,
  Search,
  User,
  Zap,
  Phone,
  Building2,
  Delete,
  Sparkles,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { studentsApi, paymentsApi } from '@/lib/api';
import { queueOfflineAction } from '@/lib/offline-sync';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Student } from '@/types/students';

export interface StudentPosMatch {
  id: string;
  name: string;
  phone: string;
  groupName: string;
  debt: number;
  monthlyFee: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (payment: any) => void;
}

type PaymentMethod = 'CASH' | 'TERMINAL' | 'CLICK' | 'PAYME';

export const ExpressPosTerminalModal = memo(function ExpressPosTerminalModal({
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useSafeI18n();
  const sound = usePremiumSound();
  const haptics = useHaptics();
  const qc = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentPosMatch | null>(null);
  const [amountStr, setAmountStr] = useState('0');
  const [method, setMethod] = useState<PaymentMethod>('CLICK');
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);

  // Fetch real students from PostgreSQL via backend API
  const { data: studentsResponse, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students-pos-search', searchQuery],
    queryFn: () => studentsApi.list({ search: searchQuery.trim() || undefined, limit: 12 }),
    enabled: isOpen,
    staleTime: 30000,
  });

  const studentsList: StudentPosMatch[] = useMemo(() => {
    if (!studentsResponse) return [];
    const rawItems: Student[] = Array.isArray(studentsResponse)
      ? studentsResponse
      : (studentsResponse as any)?.items || [];

    return rawItems.map((s) => {
      const u = s.user;
      const fullName = u
        ? [u.firstName, u.lastName].filter(Boolean).join(' ') || (s as any).name || 'O\'quvchi'
        : (s as any).name || 'O\'quvchi';
      const phone = u?.phone || (s as any).phone || s.parentPhone || '—';
      const groupName =
        s.groups?.[0]?.group?.name || s.groups?.[0]?.name || (s as any).groupName || 'Asosiy Guruh';
      const balance = Number(s.balance) || 0;
      const debt = balance < 0 ? Math.abs(balance) : 0;
      const monthlyFee = (s as any).monthlyFee || 800000;

      return {
        id: s.id,
        name: fullName,
        phone,
        groupName,
        debt,
        monthlyFee,
      };
    });
  }, [studentsResponse]);

  const numAmount = parseInt(amountStr.replace(/\D/g, '') || '0', 10);

  // Real backend payment creation mutation with Offline Mesh fallback
  const createPaymentMutation = useMutation({
    mutationFn: async (payload: {
      studentId: string;
      amount: number;
      method: string;
      description?: string;
      status: 'PAID';
    }) => {
      // If client is offline, queue into IndexedDB Mesh immediately
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await queueOfflineAction({
          endpoint: '/payments',
          method: 'POST',
          payload,
          label: `Offline POS To'lovi (${selectedStudent?.name || "O'quvchi"} - ${payload.amount.toLocaleString()} UZS)`,
          meta: { studentId: payload.studentId, amount: payload.amount },
        });
        return {
          id: `offline-${Date.now()}`,
          offline: true,
          ...payload,
        };
      }

      try {
        return await paymentsApi.create(payload);
      } catch (err: any) {
        // If network error occurred, queue to offline mesh
        if (!navigator.onLine || err?.message?.includes('NetworkError') || err?.message?.includes('Failed to fetch')) {
          await queueOfflineAction({
            endpoint: '/payments',
            method: 'POST',
            payload,
            label: `Offline POS To'lovi (${selectedStudent?.name || "O'quvchi"} - ${payload.amount.toLocaleString()} UZS)`,
            meta: { studentId: payload.studentId, amount: payload.amount },
          });
          return {
            id: `offline-${Date.now()}`,
            offline: true,
            ...payload,
          };
        }
        throw err;
      }
    },
    onSuccess: (res: any) => {
      let rcpSuffix = '';
      if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
        const arr = new Uint32Array(1);
        window.crypto.getRandomValues(arr);
        rcpSuffix = String((arr[0] % 900000) + 100000);
      } else {
        rcpSuffix = String(Date.now()).slice(-6);
      }

      const receipt = {
        receiptNumber: res?.id ? `RCP-${String(res.id).slice(0, 8).toUpperCase()}` : `RCP-${rcpSuffix}`,
        studentName: selectedStudent?.name || "O'quvchi",
        groupName: selectedStudent?.groupName || 'Guruh',
        studentId: selectedStudent?.id || '',
        amount: numAmount,
        method,
        date: formatDate(new Date().toISOString()),
        cashier: "Kassir / Operator",
        isOfflineQueued: Boolean(res?.offline),
      };

      setSuccessReceipt(receipt);
      sound?.play('success');
      haptics?.trigger?.('success');
      void qc.invalidateQueries({ queryKey: ['payments'] });
      void qc.invalidateQueries({ queryKey: ['students'] });
      onSuccess?.(receipt);
    },
    onError: (err: any) => {
      console.error('POS Payment Error:', err);
      sound?.play('error');
      haptics?.trigger?.('error');
    },
  });

  // Keypad Actions
  const handleDigit = useCallback(
    (d: string) => {
      sound?.play('tap');
      haptics?.trigger?.('light');
      setAmountStr((prev) => {
        const clean = prev.replace(/\D/g, '');
        if (clean === '0') return d;
        if (clean.length >= 9) return prev;
        return clean + d;
      });
    },
    [sound, haptics]
  );

  const handleBackspace = useCallback(() => {
    sound?.play('tap');
    haptics?.trigger?.('light');
    setAmountStr((prev) => {
      const clean = prev.replace(/\D/g, '');
      if (clean.length <= 1) return '0';
      return clean.slice(0, -1);
    });
  }, [sound, haptics]);

  const handleClear = useCallback(() => {
    sound?.play('tap');
    haptics?.trigger?.('light');
    setAmountStr('0');
  }, [sound, haptics]);

  const handleSetAmount = useCallback(
    (amt: number) => {
      sound?.play('tap');
      haptics?.trigger?.('medium');
      setAmountStr(String(amt));
    },
    [sound, haptics]
  );

  // Submit Payment to Real API
  const handleProcessPayment = useCallback(() => {
    if (!selectedStudent || numAmount <= 0) return;

    sound?.play('tap');
    haptics?.trigger?.('medium');

    createPaymentMutation.mutate({
      studentId: selectedStudent.id,
      amount: numAmount,
      method: method === 'TERMINAL' ? 'CARD' : method,
      description: `Express Kassa to'lovi — ${selectedStudent.groupName}`,
      status: 'PAID',
    });
  }, [selectedStudent, numAmount, method, sound, haptics, createPaymentMutation]);

  const handlePrintReceipt = useCallback(() => {
    window.print();
  }, []);

  const handleReset = useCallback(() => {
    setSelectedStudent(null);
    setAmountStr('0');
    setSuccessReceipt(null);
    setSearchQuery('');
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-white/20 bg-slate-900/90 text-white shadow-2xl backdrop-blur-3xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/25">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Express Kassa & POS Terminal
                </h3>
                <p className="text-xs text-slate-400">
                  Real backend integratsiya · Tezkor to'lov qabul qilish & QR kvitansiya
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Success Receipt View */}
          {successReceipt ? (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-2xl font-black text-white">
                To'lov Muvaffaqiyatli Qabul Qilindi!
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Chek raqami: <span className="font-mono font-bold text-emerald-400">{successReceipt.receiptNumber}</span>
              </p>

              {/* Receipt Ticket Preview */}
              <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-left shadow-lg">
                <div className="border-b border-dashed border-white/20 pb-4 text-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    M-EDU Ta'lim Markazi
                  </span>
                  <h4 className="mt-1 text-lg font-black text-white">To'lov Kvitansiyasi</h4>
                </div>
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">O'quvchi:</span>
                    <span className="font-bold text-white">{successReceipt.studentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Guruh:</span>
                    <span className="font-bold text-white">{successReceipt.groupName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Usul:</span>
                    <span className="font-bold text-cyan-400">{successReceipt.method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sana:</span>
                    <span className="font-mono text-slate-300">{successReceipt.date}</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-white/20 pt-3 text-sm font-black">
                    <span className="text-slate-200">Summa:</span>
                    <span className="text-emerald-400">{formatCurrency(successReceipt.amount)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-white/15"
                >
                  <Printer className="h-4 w-4" />
                  <span>Chekni Chop Etish (80mm)</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-blue-700 shadow-lg shadow-blue-600/30"
                >
                  <Zap className="h-4 w-4" />
                  <span>Yangi To'lov</span>
                </button>
              </div>
            </div>
          ) : (
            /* POS Main Grid */
            <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
              {/* Left Column: Student Selector & Method (5 cols) */}
              <div className="space-y-4 md:col-span-5">
                <div>
                  <label className="text-xs font-semibold text-slate-300">
                    O'quvchini qidirish:
                  </label>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ism, telefon yoki ID..."
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {isLoadingStudents && (
                      <Loader2 className="absolute right-3.5 top-3 h-4 w-4 animate-spin text-blue-400" />
                    )}
                  </div>
                </div>

                {/* Candidate Students List */}
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {studentsList.length > 0 ? (
                    studentsList.map((s) => {
                      const isSelected = selectedStudent?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedStudent(s);
                            if (s.debt > 0) setAmountStr(String(s.debt));
                          }}
                          className={`w-full rounded-2xl border p-3 text-left transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/20 shadow-md'
                              : 'border-white/5 bg-white/5 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-white">{s.name}</h4>
                            <span
                              className={`text-[10px] font-bold ${
                                s.debt > 0 ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {s.debt > 0 ? `Qarz: ${formatCurrency(s.debt)}` : 'Qarzi yo\'q'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {s.groupName} · {s.phone}
                          </p>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-center text-xs text-slate-500">
                      {isLoadingStudents ? 'O\'quvchilar qidirilmoqda...' : 'O\'quvchi topilmadi'}
                    </div>
                  )}
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-300">
                    To'lov turi:
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      { id: 'CLICK', label: 'Click QR', icon: QrCode, color: 'text-sky-400' },
                      { id: 'PAYME', label: 'Payme QR', icon: QrCode, color: 'text-teal-400' },
                      { id: 'TERMINAL', label: 'Uzcard/Humo', icon: CreditCard, color: 'text-blue-400' },
                      { id: 'CASH', label: 'Naqd Pul', icon: Banknote, color: 'text-emerald-400' },
                    ].map((item) => {
                      const active = method === item.id;
                      const IconComp = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setMethod(item.id as PaymentMethod)}
                          className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-xs font-bold transition-all ${
                            active
                              ? 'border-blue-500 bg-blue-500/20 text-white shadow-sm'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <IconComp className={`h-4 w-4 ${item.color}`} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Amount Display, Quick Pills & Touch Numpad (7 cols) */}
              <div className="flex flex-col justify-between space-y-4 md:col-span-7">
                {/* Amount Header Display */}
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    To'lov Summasi
                  </span>
                  <div className="mt-1 flex items-baseline justify-end gap-2">
                    <span className="text-3xl font-black tracking-tight text-emerald-400">
                      {formatCurrency(numAmount)}
                    </span>
                  </div>
                </div>

                {/* Preset Pills */}
                <div className="flex flex-wrap gap-2">
                  {[500000, 800000, 1000000, 1200000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSetAmount(preset)}
                      className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 active:scale-95"
                    >
                      +{formatCurrency(preset)}
                    </button>
                  ))}
                  {selectedStudent && selectedStudent.debt > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetAmount(selectedStudent.debt)}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 active:scale-95"
                    >
                      To'liq Qarz ({formatCurrency(selectedStudent.debt)})
                    </button>
                  )}
                </div>

                {/* Touch Keypad */}
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleDigit(digit)}
                      className="h-12 rounded-2xl border border-white/10 bg-white/5 text-lg font-black text-white transition-all hover:bg-white/15 active:scale-95"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="h-12 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-xs font-bold text-rose-400 hover:bg-rose-500/20 active:scale-95"
                  >
                    Tozalash
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDigit('0')}
                    className="h-12 rounded-2xl border border-white/10 bg-white/5 text-lg font-black text-white hover:bg-white/15 active:scale-95"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    aria-label="O'chirish"
                    className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/15 active:scale-95"
                  >
                    <Delete className="h-5 w-5" />
                  </button>
                </div>

                {/* Final Checkout Button */}
                <button
                  type="button"
                  onClick={handleProcessPayment}
                  disabled={!selectedStudent || numAmount <= 0 || createPaymentMutation.isPending}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-black text-white shadow-xl shadow-emerald-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
                >
                  {createPaymentMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>To'lov backendga yozilmoqda...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>
                        {formatCurrency(numAmount)} — To'lovni Tasdiqlash
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

export default ExpressPosTerminalModal;
