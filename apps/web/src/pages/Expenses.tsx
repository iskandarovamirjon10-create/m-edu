import { toLocalISOString } from '@/lib/format';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { expensesApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassPageHeader,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassPagination,
  GlassInput,
  GlassSelect,
  GlassField,
  GlassModal,
  ConfirmDialog,
  GlassButton,
  useToasts,
} from '@/components/ui';
import { formatDate, formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Expense, ExpenseCategory } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { useI18n } from '@/i18n/I18nProvider';

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.03 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
};

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'SALARY', 'RENT', 'UTILITIES', 'MARKETING', 'SUPPLIES',
  'MAINTENANCE', 'SOFTWARE', 'TRAINING', 'OTHER',
];

function categoryKey(category: string): string {
  return `expenses.category.${category}`;
}

interface ExpenseFilters {
  page: number;
  limit: number;
  category?: ExpenseCategory;
}

interface ExpenseFormState {
  category: ExpenseCategory;
  amount: string;
  description: string;
  date: string;
}

const INITIAL_FORM: ExpenseFormState = {
  category: 'OTHER',
  amount: '',
  description: '',
  date: toLocalISOString(),
};

function calculateTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
}

/* ─────────────────  Category visual system  ───────────────── */
type CategoryStyle = {
  bg: string;
  text: string;
  ring: string;
  dot: string;
  accent: string;
  glow: string;
  icon: React.ReactNode;
};

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  SALARY: {
    bg: 'bg-emerald-500/12', text: 'text-emerald-600 dark:text-emerald-400',
    ring: 'ring-emerald-500/25', dot: 'bg-emerald-500',
    accent: 'from-emerald-500 to-teal-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(16,185,129,0.55)]',
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>,
  },
  RENT: {
    bg: 'bg-blue-500/12', text: 'text-brand-600 dark:text-brand-400',
    ring: 'ring-blue-500/25', dot: 'bg-blue-500',
    accent: 'from-blue-500 to-indigo-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(59,130,246,0.55)]',
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  UTILITIES: {
    bg: 'bg-amber-500/12', text: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-500/25', dot: 'bg-amber-500',
    accent: 'from-amber-500 to-orange-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(245,158,11,0.55)]',
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  },
  MARKETING: {
    bg: 'bg-purple-500/12', text: 'text-purple-600 dark:text-purple-400',
    ring: 'ring-purple-500/25', dot: 'bg-purple-500',
    accent: 'from-purple-500 to-pink-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(168,85,247,0.55)]',
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-8v18l-18-8v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>,
  },
  SUPPLIES: {
    bg: 'bg-cyan-500/12', text: 'text-cyan-600 dark:text-cyan-400',
    ring: 'ring-cyan-500/25', dot: 'bg-cyan-500',
    accent: 'from-cyan-500 to-blue-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(6,182,212,0.55)]',
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  },
  MAINTENANCE: {
    bg: 'bg-rose-500/12', text: 'text-rose-600 dark:text-rose-400',
    ring: 'ring-rose-500/25', dot: 'bg-rose-500',
    accent: 'from-rose-500 to-pink-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(244,63,94,0.55)]',
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  },
  SOFTWARE: {
    bg: 'bg-indigo-500/12', text: 'text-indigo-600 dark:text-indigo-400',
    ring: 'ring-indigo-500/25', dot: 'bg-indigo-500',
    accent: 'from-indigo-500 to-violet-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(99,102,241,0.55)]',
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  },
  TRAINING: {
    bg: 'bg-teal-500/12', text: 'text-teal-600 dark:text-teal-400',
    ring: 'ring-teal-500/25', dot: 'bg-teal-500',
    accent: 'from-teal-500 to-emerald-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(20,184,166,0.55)]',
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  },
  OTHER: {
    bg: 'bg-slate-500/12', text: 'text-slate-600 dark:text-slate-400',
    ring: 'ring-slate-500/25', dot: 'bg-slate-500',
    accent: 'from-slate-500 to-zinc-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(100,116,139,0.55)]',
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
  },
};

/* ─────────────────  Liquid Glass Surface  ───────────────── */
function GlassSurface({
  children,
  className = '',
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={[
        'liquid-glass-surface relative overflow-hidden rounded-2xl',
        'border border-black/[0.08] dark:border-white/[0.12]',
        'bg-white/75 dark:bg-surface-900/75 backdrop-blur-xl backdrop-saturate-150',
        'shadow-[0_8px_32px_-8px_rgba(15,23,42,0.08),inset_0_1px_0_0_rgba(255,255,255,0.85)]',
        'dark:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.12)]',
        hover
          ? 'transition-all duration-300 ease-apple-spring hover:-translate-y-1 hover:shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15),inset_0_1px_0_0_rgba(255,255,255,0.95)] hover:border-black/[0.14] dark:hover:border-white/[0.2]'
          : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[140%] -translate-x-1/2 rounded-full bg-gradient-to-b from-white/40 to-transparent blur-2xl dark:from-white/[0.05]"
      />
      {children}
    </div>
  );
}

/* ─────────────────  Mini Stat Card  ───────────────── */
function MiniStat({
  label,
  value,
  gradient,
  icon,
}: {
  label: string;
  value: string | number;
  gradient: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -3, transition: SPRING.snappy }}
    >
      <GlassSurface hover className="h-full">
        <div className="relative z-10 flex items-center gap-4 p-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-[0_6px_18px_-6px_rgba(0,0,0,0.4)] transition-transform duration-500 group-hover:scale-110`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {label}
            </p>
            <p className="mt-0.5 truncate text-[1.15rem] font-black leading-tight tracking-tight text-[var(--text-primary)] tabular-nums">
              {value}
            </p>
          </div>
          <div
            aria-hidden
            className={`absolute -bottom-10 -right-10 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-[0.12] blur-[40px] transition-opacity duration-700 group-hover:opacity-25`}
          />
        </div>
      </GlassSurface>
    </motion.div>
  );
}

export function ExpensesPage() {
  const { t } = useI18n();
  usePageTitle(t('expenses.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState<ExpenseFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExpenseFormState, string>>>({});

  const params = useMemo<ExpenseFilters>(
    () => ({
      page,
      limit: 20,
      category: (category as ExpenseCategory) || undefined,
    }),
    [page, category],
  );

  const expenses = useQuery({
    queryKey: queryKeys.expenses.list(params),
    queryFn: () => expensesApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const data = expenses.data as Paginated<Expense> | undefined;
  const expenseList = useMemo(() => data?.items || [], [data]);
  const totalAmount = useMemo(
    () => (expenseList.length > 0 ? calculateTotal(expenseList) : 0),
    [expenseList],
  );
  const averageAmount = expenseList.length > 0 ? totalAmount / expenseList.length : 0;

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        description: form.description.trim() || undefined,
        date: new Date(form.date).toISOString(),
      };
      return editingId ? expensesApi.update(editingId, payload) : expensesApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('expenses.updated') : t('expenses.recorded'));
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      push('success', t('expenses.deleted'));
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof ExpenseFormState, string>> = {};
    if (!form.amount || parseFloat(form.amount) <= 0) {
      errors.amount = t('expenses.validation.amountPositive');
    }
    if (!form.date) {
      errors.date = t('expenses.validation.dateRequired');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  const handleFormChange = useCallback(
    (field: keyof ExpenseFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value);
    setPage(1);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) return;
      save.mutate();
    },
    [validateForm, save],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((expense: Expense) => {
    setEditingId(expense.id);
    setForm({
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description || '',
      date: toLocalISOString(new Date(expense.date)),
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback((id: string) => setDeleteTarget(id), []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const { refetch: refetchExpenses } = expenses;
  const handleRetry = useCallback(() => {
    void refetchExpenses();
  }, [refetchExpenses]);

  const { playPop, playTick } = usePremiumSound();

  const handleOpenExpenseSidecar = useCallback((expense: Expense) => {
    const catLabel = t(categoryKey(expense.category));
    const sidecarData: QuickLookData = {
      id: expense.id,
      type: 'payment',
      title: expense.description || catLabel,
      subtitle: `${catLabel} · ${formatDate(expense.date)}`,
      badge: {
        text: catLabel,
        tone: expense.category === 'SALARY' ? 'emerald' : expense.category === 'RENT' ? 'blue' : 'amber',
      },
      avatar: {
        text: expense.category.slice(0, 2),
        color: '#EF4444',
      },
      metrics: [
        { label: 'Chiqim summasi', value: formatCurrency(expense.amount) },
        { label: 'Kategoriya', value: catLabel },
        { label: 'Sana', value: formatDate(expense.date) },
      ],
      details: [
        { label: 'Chiqim ID', value: expense.id, copyable: true },
        { label: 'Tavsif', value: expense.description || 'Kiritilmagan' },
        { label: 'Kategoriya', value: catLabel },
        { label: 'Sana', value: formatDate(expense.date) },
        { label: 'Summa', value: formatCurrency(expense.amount) },
      ],
      primaryAction: {
        label: t('common.edit') || 'Tahrirlash',
        onExecute: () => handleEdit(expense),
      },
      secondaryAction: {
        label: t('common.delete') || 'O\'chirish',
        onExecute: () => handleDelete(expense.id),
      },
    };
    openSidecar(sidecarData);
  }, [t, handleEdit, handleDelete]);

  /* Keyboard shortcut 'c' to create */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        playPop();
        handleOpenModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenModal, playPop]);

  useListKeyboardNavigation<Expense>({
    items: expenseList,
    getItemId: (e) => e.id,
    rowIdPrefix: 'expense-row-',
    onSelect: (e) => { playTick(); handleOpenExpenseSidecar(e); },
    onQuickLook: (e) => { playTick(); handleOpenExpenseSidecar(e); },
    onEdit: (e) => handleEdit(e),
    onDelete: (eList) => { if (eList && eList[0]) handleDelete(eList[0].id); },
  });

  const hasActiveFilter = Boolean(category);
  const totalExpenses = data?.total || 0;

  /* ── Loading ── */
  if (expenses.isLoading && !data) {
    return (
      <div className="relative min-h-screen">
        <div className="page-container space-y-4">
          <GlassPageHeader title={t('expenses.title')} subtitle={t('expenses.subtitle')} />
          <GlassSurface className="p-16">
            <div className="flex items-center justify-center">
              <GlassPageLoader label={t('expenses.loading')} />
            </div>
          </GlassSurface>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (expenses.isError) {
    return (
      <div className="relative min-h-screen">
        <div className="page-container space-y-4">
          <GlassPageHeader title={t('expenses.title')} subtitle={t('expenses.subtitle')} />
          <GlassSurface className="p-12">
            <GlassErrorState
              title={t('expenses.loadError')}
              message={getErrorMessage(expenses.error as Error)}
              onRetry={handleRetry}
            />
          </GlassSurface>
        </div>
      </div>
    );
  }

  /* ── Main ── */
  return (
    <div className="relative min-h-screen bg-transparent selection:bg-rose-500/30">
      {/* ── Ambient background orbs ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-[10%] -left-[10%] h-[55%] w-[55%] animate-[float_18s_ease-in-out_infinite] rounded-full bg-rose-400/10 blur-[140px] dark:bg-rose-500/[0.07]" />
        <div className="absolute top-[25%] -right-[10%] h-[50%] w-[45%] animate-[float_22s_ease-in-out_infinite_reverse] rounded-full bg-amber-400/10 blur-[130px] dark:bg-amber-500/[0.06]" />
        <div className="absolute -bottom-[15%] left-[30%] h-[45%] w-[50%] animate-[float_26s_ease-in-out_infinite] rounded-full bg-purple-400/[0.07] blur-[150px] dark:bg-purple-500/[0.05]" />
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="page-container relative z-10 space-y-5"
      >
        <GlassPageHeader
          title={t('expenses.title')}
          subtitle={t('expenses.subtitle')}
          actions={
            <GlassButton
              type="button"
              variant="primary"
              onClick={handleOpenModal}
              icon={
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e: any) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.currentTarget.click();
                }
              }}>
              {t('expenses.add')}
            </GlassButton>
          }
        />

        {/* ── Mini stats ── */}
        {expenseList.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat
              label={t('expenses.pageTotalLabel') || 'Page Total'}
              value={formatCurrency(totalAmount)}
              gradient="from-rose-500 to-pink-500"
              delay={0}
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
            />
            <MiniStat
              label={t('expenses.countLabel') || 'Total Records'}
              value={totalExpenses}
              gradient="from-blue-500 to-indigo-500"
              delay={80}
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              }
            />
            <MiniStat
              label={t('expenses.avgLabel') || 'Average'}
              value={formatCurrency(averageAmount)}
              gradient="from-emerald-500 to-cyan-500"
              delay={160}
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                </svg>
              }
            />
          </div>
        )}

        {/* ── Filters ── */}
        <GlassSurface className="p-4">
          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="sm:flex-1">
              <GlassSelect
                value={category}
                onChange={handleCategoryChange}
                aria-label={t('expenses.filterByCategory')}
              >
                <option value="">{t('expenses.allCategories')}</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(categoryKey(cat))}
                  </option>
                ))}
              </GlassSelect>
            </div>
            <div className="flex items-center justify-between gap-4 sm:shrink-0">
              <span className="text-[0.78rem] text-[var(--text-muted)]">
                {totalExpenses === 1
                  ? t('expenses.countOne')
                  : t('expenses.countMany', { count: totalExpenses })}
              </span>
              {expenseList.length > 0 && (
                <span className="text-[0.78rem] font-bold text-[var(--text-primary)]">
                  {t('expenses.pageTotal', { amount: formatCurrency(totalAmount) })}
                </span>
              )}
            </div>
          </div>
        </GlassSurface>

        {/* ── Table ── */}
        <GlassSurface className="liquid-glass-surface">
          {expenseList.length === 0 ? (
            <div className="p-12">
              <GlassEmptyState
                title={hasActiveFilter ? t('expenses.noMatching') : t('expenses.emptyTitle')}
                message={
                  hasActiveFilter
                    ? t('common.adjustFilters')
                    : t('expenses.emptyMessage')
                }
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[0.85rem]">
                  <thead>
                    <tr className="border-b border-white/40 dark:border-white/[0.06]">
                      {[
                        { label: t('common.date'), align: 'left' },
                        { label: t('expenses.category'), align: 'left' },
                        { label: t('common.description'), align: 'left' },
                        { label: t('payments.col.amount'), align: 'right' },
                        { label: t('common.actions'), align: 'right' },
                      ].map((h, i) => (
                        <th
                          key={i}
                          className={`px-6 py-4 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] ${
                            h.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expenseList.map((expense, i) => {
                      const style = CATEGORY_STYLES[expense.category] ?? CATEGORY_STYLES.OTHER;
                      const isDeleting = remove.isPending && remove.variables === expense.id;

                      return (
                        <tr
                          key={expense.id}
                          id={`expense-row-${expense.id}`}
                          className="group relative border-b border-white/30 transition-colors duration-300 last:border-0 hover:bg-white/40 dark:border-white/[0.04] dark:hover:bg-white/[0.03] animate-[slideUp_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both]"
                          style={{ animationDelay: `${Math.min(i, 15) * 45}ms` }}
                        >
                          {/* Left accent bar */}
                          <td className="relative w-0 p-0">
                            <div
                              aria-hidden
                              className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b ${style.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                            />
                          </td>

                          {/* Date */}
                          <td className="whitespace-nowrap px-6 py-3.5 text-[0.78rem] tabular-nums text-[var(--text-muted)]">
                            {formatDate(expense.date)}
                          </td>

                          {/* Category badge */}
                          <td className="px-6 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold ring-1 ring-inset transition-shadow duration-300 group-hover:${style.glow} ${style.bg} ${style.text} ${style.ring}`}
                            >
                              <span className={`flex h-3.5 w-3.5 items-center justify-center ${style.text}`}>
                                {style.icon}
                              </span>
                              {t(categoryKey(expense.category))}
                            </span>
                          </td>

                          {/* Description */}
                          <td
                            className="max-w-xs truncate px-6 py-3.5 text-[var(--text-secondary)]"
                            title={expense.description || undefined}
                          >
                            {expense.description || <span className="opacity-40">—</span>}
                          </td>

                          {/* Amount */}
                          <td className="px-6 py-3.5 text-right">
                            <span
                              className={`bg-gradient-to-br ${style.accent} bg-clip-text text-[0.95rem] font-black tabular-nums text-transparent`}
                            >
                              {formatCurrency(expense.amount)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-3.5">
                            <div className="flex items-center justify-end gap-1.5 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity duration-300">
                              <button
                                type="button"
                                onClick={() => {
                                  playPop();
                                  handleOpenExpenseSidecar(expense);
                                }}
                                title="Split View Sidecar"
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-all duration-300 hover:bg-white/60 hover:text-emerald-600 hover:shadow-[0_4px_12px_-4px_rgba(16,185,129,0.4)] active:scale-95 dark:hover:bg-white/[0.06] dark:hover:text-emerald-400"
                              >
                                <span className="text-xs font-bold font-mono">◨</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEdit(expense)}
                                title={t('common.edit')}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-all duration-300 hover:bg-white/60 hover:text-brand-600 hover:shadow-[0_4px_12px_-4px_rgba(59,130,246,0.4)] active:scale-95 dark:hover:bg-white/[0.06] dark:hover:text-brand-400"
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e: any) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.currentTarget.click();
                                  }
                                }}>
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(expense.id)}
                                disabled={isDeleting}
                                title={t('common.delete')}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-red-500 transition-all duration-300 hover:bg-red-500/10 hover:shadow-[0_4px_12px_-4px_rgba(239,68,68,0.5)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e: any) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.currentTarget.click();
                                  }
                                }}>
                                {isDeleting ? (
                                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                  </svg>
                                ) : (
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-white/40 px-4 py-3 dark:border-white/[0.06]">
                <GlassPagination
                  page={page}
                  totalPages={data?.totalPages ?? 1}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </GlassSurface>

        {/* ── Add/edit modal ── */}
        <GlassModal
          open={modalOpen}
          onClose={handleCloseModal}
          title={editingId ? t('expenses.editTitle') : t('expenses.addTitle')}
        >
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            {/* Section: Category + Date */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <h4 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {t('expenses.sectionDetails') || 'Details'}
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <GlassField label={t('expenses.category')} required>
                  <GlassSelect
                    value={form.category}
                    onChange={handleFormChange('category')}
                    aria-label={t('expenses.categoryAria')}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {t(categoryKey(cat))}
                      </option>
                    ))}
                  </GlassSelect>
                </GlassField>

                <GlassField label={t('common.date')} required error={formErrors.date}>
                  <GlassInput
                    type="date"
                    value={form.date}
                    onChange={handleFormChange('date')}
                    required
                    aria-invalid={Boolean(formErrors.date)}
                    aria-describedby={formErrors.date ? 'date-error' : undefined}
                  />
                  {formErrors.date && (
                    <span id="date-error" className="mt-1 text-sm text-red-600">
                      {formErrors.date}
                    </span>
                  )}
                </GlassField>
              </div>
            </div>

            {/* Section: Amount (highlighted) */}
            <div className="space-y-3 rounded-2xl bg-gradient-to-br from-rose-500/[0.06] to-amber-500/[0.04] p-4 ring-1 ring-inset ring-rose-500/15 dark:from-rose-500/[0.04] dark:to-amber-500/[0.02] dark:ring-rose-500/10">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
                <h4 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-rose-600/80 dark:text-rose-400/80">
                  {t('expenses.amountUsd')}
                </h4>
              </div>

              <GlassField label="" error={formErrors.amount}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[1.4rem] font-black text-rose-500/60">
                    $
                  </span>
                  <GlassInput
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.amount}
                    onChange={handleFormChange('amount')}
                    required
                    aria-invalid={Boolean(formErrors.amount)}
                    aria-describedby={formErrors.amount ? 'amount-error' : undefined}
                    placeholder="0.00"
                    className="!pl-10 !text-[1.5rem] !font-black tabular-nums"
                  />
                </div>
                {formErrors.amount && (
                  <span id="amount-error" className="mt-1 text-sm text-red-600">
                    {formErrors.amount}
                  </span>
                )}
              </GlassField>
            </div>

            {/* Section: Description */}
            <GlassField label={t('common.description')}>
              <GlassInput
                value={form.description}
                onChange={handleFormChange('description')}
                placeholder={t('common.optionalDescription')}
              />
            </GlassField>

            <div className="flex justify-end gap-3 pt-2">
              <GlassButton
                type="button"
                variant="secondary"
                onClick={handleCloseModal}
                disabled={save.isPending}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={save.isPending}
                loading={save.isPending}
              >
                {save.isPending
                  ? t('common.saving')
                  : editingId
                    ? t('expenses.saveChanges')
                    : t('expenses.add')}
              </GlassButton>
            </div>
          </form>
        </GlassModal>

        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          description={t('expenses.deleteConfirm')}
          loading={remove.isPending}
        />

        {toastNode}
      </motion.div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0)         scale(1); }
          33%      { transform: translate(40px, -30px)  scale(1.06); }
          66%      { transform: translate(-30px, 20px)  scale(0.96); }
        }
      `}</style>
    </div>
  );
}