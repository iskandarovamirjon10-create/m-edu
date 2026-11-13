import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi, paymentsApi, generateIdempotencyKey } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { useToast } from '@/components/ui/GlassToast';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { parseFinancialAmount } from '@/lib/format';

const PRESET_AMOUNTS = [
  { label: '100 ming', value: 100000 },
  { label: '200 ming', value: 200000 },
  { label: '300 ming', value: 300000 },
  { label: '400 ming', value: 400000 },
  { label: '500 ming', value: 500000 },
  { label: '800 ming', value: 800000 },
  { label: '1 mln', value: 1000000 },
];

const METHODS = [
  { id: 'CASH', label: 'Naqd pul', icon: '💵' },
  { id: 'CARD', label: 'Plastik karta', icon: '💳' },
  { id: 'CLICK', label: 'Click', icon: '🔵' },
  { id: 'PAYME', label: 'Payme', icon: '🟢' },
  { id: 'BANK_TRANSFER', label: 'Bank o\'tkazmasi', icon: '🏦' },
];

/** Tezkor to‘lov oqimida ishlatiladigan minimal o‘quvchi shakli. */
interface QuickStudent {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  balance?: number;
  user?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
}

interface QuickStudentListResponse {
  items?: QuickStudent[];
  data?: QuickStudent[];
  total?: number;
}

export function QuickPaymentModal() {
  const { t } = useSafeI18n();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const voice = useVoiceFeedback();
  const { playSuccess } = usePremiumSound();

  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<QuickStudent | null>(null);
  const [amount, setAmount] = useState<string>('300 000');
  const [method, setMethod] = useState<string>('CASH');
  const [description, setDescription] = useState<string>('');
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  const searchInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Global listeners: Alt+P, custom event, and Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && e.key.toLowerCase() === 'p') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };

    const handleCustomOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ student?: QuickStudent; studentId?: string }>;
      if (customEvent.detail?.student) {
        setSelectedStudent(customEvent.detail.student);
      } else if (customEvent.detail?.studentId) {
        // Resolve student by studentId if only ID was passed (e.g. from Retention Radar)
        studentsApi
          .get(customEvent.detail.studentId)
          .then((res: unknown) => {
            if (res) setSelectedStudent(res as QuickStudent);
          })
          .catch(() => {});
      }
      setOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-quick-payment', handleCustomOpen);
    window.addEventListener('medu:open-quick-payment', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-quick-payment', handleCustomOpen);
      window.removeEventListener('medu:open-quick-payment', handleCustomOpen);
    };
  }, [open]);

  // Fetch students matching search term
  const { data: studentsData, isFetching: loadingStudents } = useQuery({
    queryKey: ['students', 'quick-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.trim().length < 2) return { items: [] };
      return studentsApi.list({ search: searchTerm.trim(), limit: 8 }) as Promise<QuickStudentListResponse>;
    },
    enabled: open && !selectedStudent && searchTerm.trim().length >= 2,
    staleTime: 30000,
  });

  // Focus management on open
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (open) {
      timer = setTimeout(() => {
        if (!selectedStudent) {
          searchInputRef.current?.focus();
        } else {
          amountInputRef.current?.focus();
        }
      }, 100);
    } else {
      setSearchTerm('');
      setSelectedStudent(null);
      setDescription('');
      idempotencyKeyRef.current = generateIdempotencyKey();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [open, selectedStudent]);

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!selectedStudent?.id) {
        throw new Error('Iltimos, o\'quvchini tanlang');
      }
      const numAmount = parseFinancialAmount(amount);
      if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Iltimos, to\'g\'ri to\'lov summasini kiriting');
      }

      return paymentsApi.create(
        {
          studentId: selectedStudent.id,
          amount: numAmount,
          method,
          description: description.trim() || undefined,
        },
        { idempotencyKey: idempotencyKeyRef.current },
      );
    },
    onSuccess: () => {
      idempotencyKeyRef.current = generateIdempotencyKey();
      const sName = selectedStudent?.user
        ? `${selectedStudent.user.firstName} ${selectedStudent.user.lastName}`
        : (selectedStudent?.firstName ? `${selectedStudent.firstName} ${selectedStudent.lastName || ''}` : 'O\'quvchi');
      const formattedAmount = (parseFinancialAmount(amount) || 0).toLocaleString('uz-UZ');

      playSuccess();
      voice.speakPaymentSuccess();

      window.dispatchEvent(
        new CustomEvent('medu:payment-received', {
          detail: {
            studentName: sName,
            amount: formattedAmount,
          },
        }),
      );

      push('success', `✅ ${sName} uchun ${formattedAmount} so'm to'lov qabul qilindi!`);

      // Invalidate queries so tables update everywhere
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });

      setOpen(false);
    },
    onError: (err: Error) => {
      push('error', err?.message || 'To\'lovni kiritishda xatolik yuz berdi');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (recordPayment.isPending || !selectedStudent?.id) return;
    recordPayment.mutate();
  };

  if (!open) return null;

  const studentsResponse = studentsData as QuickStudentListResponse | QuickStudent[] | undefined;
  const studentList: QuickStudent[] = Array.isArray(studentsResponse)
    ? studentsResponse
    : Array.isArray(studentsResponse?.items)
      ? studentsResponse.items
      : Array.isArray(studentsResponse?.data)
        ? studentsResponse.data
        : [];

  // Dropdown search results
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 dark:bg-slate-950/70 backdrop-blur-md animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-payment-title"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-[28px] rounded-b-none sm:rounded-2xl border border-black/10 bg-white/95 p-4 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] shadow-2xl backdrop-blur-md text-slate-900 dark:border-white/15 dark:bg-[#121826]/95 dark:text-white"
        style={{
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 40px -10px rgba(99, 102, 241, 0.2)',
        }}
      >
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mb-3 shrink-0 sm:hidden" aria-hidden="true" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-xl shadow-lg shadow-emerald-500/30">
              ⚡️
            </div>
            <div>
              <h2 id="quick-payment-title" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                {t('quickPayment.title', "Tezkor To'lov (3 soniya)")}
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Instant
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('quickPayment.subtitle', "O'quvchidan to'lovni qabul qilish va avtomat chek yuborish")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('common.close', 'Yopish')}
            className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/5 text-slate-500 hover:bg-black/10 hover:text-slate-800 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Student Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              1. {t('payments.form.student', "O'quvchi")}
            </label>

            {selectedStudent ? (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                    {selectedStudent.user?.firstName?.[0] || selectedStudent.firstName?.[0] || 'O'}
                    {selectedStudent.user?.lastName?.[0] || selectedStudent.lastName?.[0] || ''}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">
                      {selectedStudent.user?.firstName || selectedStudent.firstName}{' '}
                      {selectedStudent.user?.lastName || selectedStudent.lastName || ''}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <span>📞 {selectedStudent.user?.phone || selectedStudent.phone || 'Telefon yo\'q'}</span>
                      {selectedStudent.balance !== undefined && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Balans: {Number(selectedStudent.balance).toLocaleString('uz-UZ')} so'm
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setSearchTerm('');
                  }}
                  className="rounded-lg bg-black/5 text-slate-700 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20 dark:hover:text-white transition-colors px-2.5 py-1 text-xs"
                >
                  O'zgartirish
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  ref={searchInputRef}
                  id="quick-payment-search-student"
                  name="quick-payment-search-student"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('quickPayment.searchStudent', 'Ism, familiya yoki telefon raqami bilan qidiring...')}
                  aria-label={t('quickPayment.searchStudent', 'Ism, familiya yoki telefon raqami bilan qidiring...')}
                  className="w-full rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-base sm:text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                />

                {loadingStudents && (
                  <div className="absolute right-3.5 top-3.5 h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                )}

                {/* Dropdown search results */}
                {searchTerm.trim().length >= 2 && studentList.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-black/10 bg-white/95 p-1 shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-slate-900/95">
                    {studentList.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(student);
                          setSearchTerm('');
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {student.user?.firstName || student.firstName} {student.user?.lastName || student.lastName || ''}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {student.user?.phone || student.phone || 'Telefon kiritilmagan'}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Tanlash →
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Amount with Quick Presets */}
          <div>
            <label htmlFor="quick-payment-amount" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              2. {t('quickPayment.amount', "To'lov Summasi (UZS)")}
            </label>
            <div className="relative">
              <input
                ref={amountInputRef}
                id="quick-payment-amount"
                name="quick-payment-amount"
                type="text"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setAmount(val ? Number(val).toLocaleString('uz-UZ') : '');
                }}
                className="w-full rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-lg font-bold tracking-tight text-emerald-600 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all dark:border-white/10 dark:bg-white/5 dark:text-emerald-400"
                placeholder="0"
              />
              <span className="absolute right-4 top-3 text-sm font-semibold text-slate-400">
                so'm
              </span>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setAmount(preset.value.toLocaleString('uz-UZ'))}
                  className="rounded-xl border border-black/10 bg-black/[0.03] px-3.5 py-2 min-h-[44px] text-xs font-semibold text-slate-700 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-700 transition-all dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-emerald-500/20 dark:hover:border-emerald-500/30 dark:hover:text-emerald-300 flex items-center justify-center"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Payment Method */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              3. {t('quickPayment.method', "To'lov turi")}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {METHODS.map((m) => {
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex flex-col items-center justify-center rounded-xl p-2 min-h-[56px] border text-center transition-all ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/20 dark:text-white shadow-lg shadow-indigo-500/20 font-bold'
                        : 'border-black/10 bg-black/[0.03] text-slate-600 hover:bg-black/[0.06] hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
                    }`}
                  >
                    <span className="text-lg">{m.icon}</span>
                    <span className="text-[11px] mt-1 truncate w-full">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <input
              id="quick-payment-description"
              name="quick-payment-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-label={t('quickPayment.description', 'Izoh (masalan: Oktyabr oyi ingliz tili kursi uchun)')}
              placeholder={t('quickPayment.description', 'Izoh (masalan: Oktyabr oyi ingliz tili kursi uchun)')}
              className="w-full rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 text-base sm:text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={recordPayment.isPending || !selectedStudent}
              className="w-full relative flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 px-4 font-bold text-white shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {recordPayment.isPending ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>{t('quickPayment.savePayment', "To'lovni qabul qilish")}</span>
                  <span className="rounded-lg bg-black/20 px-2 py-0.5 text-xs font-mono">
                    ↵ Enter
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body,
  );
}

export default QuickPaymentModal;
