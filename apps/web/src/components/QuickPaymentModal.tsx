import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi, paymentsApi } from '@/lib/api';
import { useToast } from '@/components/ui/GlassToast';

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
  { id: 'BANK_TRANSFER', label: 'Bank o‘tkazmasi', icon: '🏦' },
];

export function QuickPaymentModal() {
  const queryClient = useQueryClient();
  const { push } = useToast();

  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [amount, setAmount] = useState<string>('300 000');
  const [method, setMethod] = useState<string>('CASH');
  const [description, setDescription] = useState<string>('');

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
      const customEvent = e as CustomEvent<{ student?: any; studentId?: string }>;
      if (customEvent.detail?.student) {
        setSelectedStudent(customEvent.detail.student);
      } else if (customEvent.detail?.studentId) {
        // Resolve student by studentId if only ID was passed (e.g. from Retention Radar)
        studentsApi
          .get(customEvent.detail.studentId)
          .then((res: any) => {
            if (res) setSelectedStudent(res);
          })
          .catch(() => {});
      }
      setOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-quick-payment', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-quick-payment', handleCustomOpen);
    };
  }, [open]);

  // Fetch students matching search term
  const { data: studentsData, isFetching: loadingStudents } = useQuery({
    queryKey: ['quick-payment-students-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.trim().length < 2) return { items: [] };
      return studentsApi.list({ search: searchTerm.trim(), limit: 8 }) as Promise<{ items: any[]; total: number }>;
    },
    enabled: open && !selectedStudent && searchTerm.trim().length >= 2,
    staleTime: 30000,
  });

  // Focus management on open
  useEffect(() => {
    if (open) {
      setTimeout(() => {
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
    }
  }, [open, selectedStudent]);

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!selectedStudent?.id) {
        throw new Error('Iltimos, o‘quvchini tanlang');
      }
      const numAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
      if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Iltimos, to‘g‘ri to‘lov summasini kiriting');
      }

      return paymentsApi.create({
        studentId: selectedStudent.id,
        amount: numAmount,
        method,
        description: description.trim() || undefined,
      });
    },
    onSuccess: () => {
      const sName = selectedStudent?.user
        ? `${selectedStudent.user.firstName} ${selectedStudent.user.lastName}`
        : (selectedStudent?.firstName ? `${selectedStudent.firstName} ${selectedStudent.lastName || ''}` : 'O‘quvchi');
      const formattedAmount = Number(amount.replace(/[^0-9.]/g, '')).toLocaleString('uz-UZ');

      push('success', `✅ ${sName} uchun ${formattedAmount} so‘m to‘lov qabul qilindi!`);

      // Invalidate queries so tables update everywhere
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });

      setOpen(false);
    },
    onError: (err: any) => {
      push('error', err?.message || 'To‘lovni kiritishda xatolik yuz berdi');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordPayment.mutate();
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-[#121826]/95 p-6 shadow-2xl backdrop-blur-2xl text-white"
        style={{
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px -10px rgba(99, 102, 241, 0.25)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-xl shadow-lg shadow-emerald-500/30">
              ⚡️
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Tezkor To‘lov (3 soniya)
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Instant
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                O‘quvchidan to‘lovni qabul qilish va avtomat chek yuborish
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Student Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              1. O‘quvchi
            </label>

            {selectedStudent ? (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-sm">
                    {selectedStudent.user?.firstName?.[0] || selectedStudent.firstName?.[0] || 'O'}
                    {selectedStudent.user?.lastName?.[0] || selectedStudent.lastName?.[0] || ''}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-white">
                      {selectedStudent.user?.firstName || selectedStudent.firstName}{' '}
                      {selectedStudent.user?.lastName || selectedStudent.lastName || ''}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span>📞 {selectedStudent.user?.phone || selectedStudent.phone || 'Telefon yo‘q'}</span>
                      {selectedStudent.balance !== undefined && (
                        <span className="text-emerald-400 font-medium">
                          Balans: {Number(selectedStudent.balance).toLocaleString('uz-UZ')} so‘m
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
                  className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/20 hover:text-white transition-colors"
                >
                  O‘zgartirish
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ism, familiya yoki telefon raqami bilan qidiring..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                />

                {loadingStudents && (
                  <div className="absolute right-3.5 top-3.5 h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                )}

                {/* Dropdown search results */}
                {searchTerm.trim().length >= 2 && studentsData?.items && studentsData.items.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-white/15 bg-slate-900/95 p-1 shadow-2xl backdrop-blur-xl">
                    {studentsData.items.map((student: any) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(student);
                          setSearchTerm('');
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-white/10 transition-colors"
                      >
                        <div>
                          <div className="text-sm font-medium text-white">
                            {student.user?.firstName || student.firstName} {student.user?.lastName || student.lastName || ''}
                          </div>
                          <div className="text-xs text-slate-400">
                            {student.user?.phone || student.phone || 'Telefon kiritilmagan'}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-emerald-400">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              2. To‘lov Summasi (UZS)
            </label>
            <div className="relative">
              <input
                ref={amountInputRef}
                type="text"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setAmount(val ? Number(val).toLocaleString('uz-UZ') : '');
                }}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-bold tracking-tight text-emerald-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all"
                placeholder="0"
              />
              <span className="absolute right-4 top-3 text-sm font-semibold text-slate-400">
                so‘m
              </span>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setAmount(preset.value.toLocaleString('uz-UZ'))}
                  className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:text-emerald-300 transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Payment Method */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              3. To‘lov turi
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {METHODS.map((m) => {
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex flex-col items-center justify-center rounded-xl p-2 border text-center transition-all ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/20 text-white shadow-lg shadow-indigo-500/20 font-bold'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
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
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Izoh (masalan: Oktyabr oyi ingliz tili kursi uchun)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-white/30"
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
                  <span>To‘lovni qabul qilish</span>
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
