/**
 * M-EDU Branches Page
 *
 * Module Features:
 *  - Liquid glass styling with rim highlights.
 *  - Dynamic Aurora mesh backdrop with ambient lighting.
 *  - Animated KPI metrics strip (Total branches, Active branches, Total students, Managers).
 *  - WCAG 2.2 AA SC 2.5.8 compliant touch targets (>= 44x44px for all controls).
 *  - macOS Split-View Sidecar integration for instant branch inspection.
 *  - Apple spring physics (SPRING.snappy, SPRING.smooth).
 *  - Trilingual resilience using `useSafeI18n()` (UZ, RU, EN).
 *  - Sound feedback via `usePremiumSound` (pop, tick, success, error).
 *  - 100% preserved API contracts, TanStack Query, and mutations.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { branchesApi, usersApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassModal,
  GlassField,
  GlassInput,
  GlassSelect,
  GlassButton,
  ConfirmDialog,
  useToasts,
} from '@/components/ui';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Branch } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthState } from '@/auth/AuthContext';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar } from '@/stores/ui.store';
import { cn } from '@/lib/design';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

export const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

export const rowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * TYPES & CONSTANTS
 * ========================================================================== */

export interface BranchFormState {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  currency: string;
}

export const INITIAL_FORM: BranchFormState = {
  name: '',
  code: '',
  address: '',
  phone: '',
  email: '',
  timezone: 'Asia/Tashkent',
  currency: 'UZS',
};

export const TIMEZONES = [
  'Asia/Tashkent',
  'Asia/Almaty',
  'Asia/Novosibirsk',
  'Europe/Moscow',
  'UTC',
] as const;

export const CURRENCIES = ['UZS', 'USD', 'RUB', 'KZT', 'EUR'] as const;

export const BRANCH_GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-rose-600',
  'from-purple-600 to-pink-600',
  'from-blue-500 to-cyan-500',
  'from-rose-500 to-orange-500',
  'from-teal-500 to-emerald-600',
] as const;

/* ============================================================================
 * PURE DOMAIN HELPERS
 * ========================================================================== */

export function getBranchSeed(branch: Partial<Branch>): number {
  const str = branch.id ?? branch.name ?? '';
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i);
  }
  return sum;
}

export function getBranchInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.[0] ?? '';
  const l = lastName?.[0] ?? '';
  const init = `${f}${l}`.toUpperCase();
  return init || '?';
}

export function validateBranchForm(form: BranchFormState): { name?: string } {
  const errors: { name?: string } = {};
  if (!form.name.trim()) {
    errors.name = 'branches.nameRequired';
  }
  return errors;
}

export function computeBranchStats(branches: Branch[]) {
  const total = branches.length;
  const active = branches.filter((b) => b.isActive).length;
  const totalStudents = branches.reduce((acc, b) => acc + (b._count?.students ?? 0), 0);
  const withManager = branches.filter((b) => Boolean(b.manager)).length;
  return { total, active, totalStudents, withManager };
}

/* ============================================================================
 * ATMOSPHERIC AURORA BACKDROP
 * ========================================================================== */

export function AuroraBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-40 left-1/4 h-96 w-96 rounded-full blur-3xl opacity-30 dark:opacity-20 animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(0,122,255,0.4) 0%, rgba(52,199,89,0.25) 60%, transparent 80%)',
          animationDuration: '10s',
        }}
      />
      <div
        className="absolute top-1/3 -right-20 h-96 w-96 rounded-full blur-3xl opacity-25 dark:opacity-15 animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(175,82,222,0.35) 0%, rgba(0,122,255,0.2) 70%, transparent 85%)',
          animationDuration: '12s',
        }}
      />
      <div
        className="absolute -bottom-20 left-10 h-80 w-80 rounded-full blur-3xl opacity-20 dark:opacity-10 animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(52,199,89,0.3) 0%, transparent 75%)',
          animationDuration: '14s',
        }}
      />
    </div>
  );
}

/* ============================================================================
 * COUNT UP NUMBER
 * ========================================================================== */

export function CountUp({
  value,
  duration = 1.0,
}: {
  value: number;
  duration?: number;
}) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      const safeVal = Number.isFinite(value) ? value : 0;
      setN(Math.round(safeVal * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{(Number.isFinite(n) ? n : 0).toLocaleString()}</span>;
}

/* ============================================================================
 * LIQUID GLASS SUB-COMPONENTS
 * ========================================================================== */

export function GlassSurface({
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
      className={cn(
        'liquid-glass-surface relative overflow-hidden rounded-3xl',
        'border border-black/[0.08] dark:border-white/[0.12]',
        'bg-white/80 dark:bg-surface-900/80 backdrop-blur-2xl',
        'shadow-sm',
        hover && 'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
      />
      {children}
    </div>
  );
}

export function BranchIcon({ branch, size = 44 }: { branch: Branch; size?: number }) {
  const seed = getBranchSeed(branch);
  const grad = BRANCH_GRADIENTS[seed % BRANCH_GRADIENTS.length];

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm ring-1 ring-white/40 dark:ring-white/10',
        grad,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        className="h-[46%] w-[46%]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
        <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
      </svg>
    </div>
  );
}

export function ManagerAvatar({
  firstName,
  lastName,
  size = 32,
}: {
  firstName?: string;
  lastName?: string;
  size?: number;
}) {
  const initials = getBranchInitials(firstName, lastName);
  const seed = (firstName ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const grad = BRANCH_GRADIENTS[seed % BRANCH_GRADIENTS.length];

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-black text-white shadow-sm ring-1 ring-white/30',
        grad,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

export function StatCard({
  label,
  value,
  gradient,
  icon,
}: {
  label: string;
  value: number;
  gradient: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl p-4.5 bg-white/60 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 shadow-xs">
      <div className="flex items-center gap-3.5">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm bg-gradient-to-br',
            gradient,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-black leading-none tracking-tight text-slate-900 dark:text-white tabular-nums">
            <CountUp value={value} />
          </p>
          <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN COMPONENT: BranchesPage
 * ========================================================================== */

export function BranchesPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('branches.title', 'Filiallar'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const { hasAnyRole } = useAuthState();
  const canManage = hasAnyRole('SUPER_ADMIN', 'ORG_ADMIN');
  const { playPop, playTick, playSuccess, playError } = usePremiumSound();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BranchFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});
  const [managerModal, setManagerModal] = useState<string | null>(null);
  const [managerId, setManagerId] = useState('');
  const [statsModal, setStatsModal] = useState<Branch | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Branch | null>(null);

  const { data: branches = [], isLoading, error } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchesApi.list() as Promise<Branch[]>,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list-for-manager'],
    queryFn: () =>
      usersApi.list({ limit: 200 }) as Promise<{
        items: { id: string; firstName: string; lastName: string; email: string }[];
      }>,
    enabled: managerModal !== null,
  });

  const stats = useMemo(() => computeBranchStats(branches), [branches]);

  const createMutation = useMutation({
    mutationFn: (data: BranchFormState) => branchesApi.create(data),
    onSuccess: () => {
      playSuccess();
      qc.invalidateQueries({ queryKey: ['branches'] });
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      push({ type: 'success', message: t('branches.created', 'Yangi filial muvaffaqiyatli yaratildi!') });
    },
    onError: (err: unknown) => {
      playError();
      push({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BranchFormState }) => branchesApi.update(id, data),
    onSuccess: () => {
      playSuccess();
      qc.invalidateQueries({ queryKey: ['branches'] });
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      push({ type: 'success', message: t('branches.updated', 'Filial ma\'lumotlari yangilandi!') });
    },
    onError: (err: unknown) => {
      playError();
      push({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => branchesApi.deactivate(id),
    onSuccess: () => {
      playSuccess();
      qc.invalidateQueries({ queryKey: ['branches'] });
      push({ type: 'success', message: t('branches.deactivated', 'Filial faolsizlantirildi!') });
    },
    onError: (err: unknown) => {
      playError();
      push({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => branchesApi.activate(id),
    onSuccess: () => {
      playSuccess();
      qc.invalidateQueries({ queryKey: ['branches'] });
      push({ type: 'success', message: t('branches.activated', 'Filial faollashtirildi!') });
    },
    onError: (err: unknown) => {
      playError();
      push({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const managerMutation = useMutation({
    mutationFn: ({ id, managerId: mId }: { id: string; managerId: string }) =>
      branchesApi.assignManager(id, mId),
    onSuccess: () => {
      playSuccess();
      qc.invalidateQueries({ queryKey: ['branches'] });
      setManagerModal(null);
      setManagerId('');
      push({ type: 'success', message: t('branches.managerAssigned', 'Filialga menejer biriktirildi!') });
    },
    onError: (err: unknown) => {
      playError();
      push({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const openCreate = useCallback(() => {
    playPop();
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, [playPop]);

  const openEdit = useCallback((branch: Branch) => {
    playPop();
    setEditingId(branch.id);
    setForm({
      name: branch.name,
      code: branch.code || '',
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      timezone: branch.timezone || 'Asia/Tashkent',
      currency: branch.currency || 'UZS',
    });
    setFormErrors({});
    setModalOpen(true);
  }, [playPop]);

  const handleSubmit = useCallback(() => {
    const errs = validateBranchForm(form);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      playError();
      return;
    }
    playTick();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }, [form, editingId, updateMutation, createMutation, playTick, playError]);

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="relative page-container space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]">
        <AuroraBackdrop />
        <GlassPageHeader
          title={t('branches.title', 'Filiallar')}
          subtitle={t('branches.subtitle', 'O\'quv markazining barcha filiallarini boshqarish va nazorat qilish')}
        />
        <GlassSurface className="p-16">
          <div className="flex items-center justify-center">
            <GlassPageLoader label={t('common.loading', 'Yuklanmoqda...')} />
          </div>
        </GlassSurface>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="relative page-container space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]">
        <AuroraBackdrop />
        <GlassPageHeader
          title={t('branches.title', 'Filiallar')}
          subtitle={t('branches.subtitle', 'O\'quv markazining barcha filiallarini boshqarish va nazorat qilish')}
        />
        <GlassSurface className="p-12">
          <GlassErrorState
            message={getErrorMessage(error)}
            onRetry={() => {
              playTick();
              qc.invalidateQueries({ queryKey: ['branches'] });
            }}
          />
        </GlassSurface>
      </div>
    );
  }

  /* ── Main ── */
  return (
    <div className="relative page-container space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))] selection:bg-blue-500/30">
      <AuroraBackdrop />
      {toastNode}

      <ConfirmDialog
        open={deactivateTarget !== null}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => {
          if (!deactivateTarget) return;
          playTick();
          deactivateMutation.mutate(deactivateTarget.id);
          setDeactivateTarget(null);
        }}
        description={t(
          'branches.deactivateConfirm',
          'Ushbu filialni faolsizlantirmoqchimisiz? Faol bo\'lmagan filialga yangi talabalar yoki guruhlar biriktirilmaydi.',
        )}
        confirmLabel={t('branches.deactivate', 'Faolsizlantirish')}
        loading={deactivateMutation.isPending}
      />

      <GlassPageHeader
        title={t('branches.title', 'Filiallar')}
        subtitle={t('branches.subtitle', 'O\'quv markazining barcha filiallarini boshqarish va nazorat qilish')}
        actions={
          canManage ? (
            <GlassButton
              type="button"
              variant="primary"
              onClick={openCreate}
              className="min-h-[44px] shadow-sm"
              icon={
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              }
            >
              {t('branches.add', 'Yangi filial')}
            </GlassButton>
          ) : undefined
        }
      />

      {/* ── KPI Metric Strip ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
      >
        <GlassSurface className="p-4.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('common.total', 'Jami filiallar')}
          </p>
          <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
            <CountUp value={stats.total} />
          </p>
        </GlassSurface>

        <GlassSurface className="p-4.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('branches.statusActive', 'Faol filiallar')}
          </p>
          <p className="mt-1 text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            <CountUp value={stats.active} />
          </p>
        </GlassSurface>

        <GlassSurface className="p-4.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('branches.students', 'Jami o\'quvchilar')}
          </p>
          <p className="mt-1 text-2xl font-black tracking-tight text-purple-600 dark:text-purple-400 tabular-nums">
            <CountUp value={stats.totalStudents} />
          </p>
        </GlassSurface>

        <GlassSurface className="p-4.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('branches.manager', 'Menejerlar')}
          </p>
          <p className="mt-1 text-2xl font-black tracking-tight text-blue-600 dark:text-blue-400 tabular-nums">
            <CountUp value={stats.withManager} />
          </p>
        </GlassSurface>
      </motion.div>

      {/* ── Branches Table ── */}
      <GlassSurface>
        {branches.length === 0 ? (
          <div className="p-12">
            <GlassEmptyState
              title={t('branches.empty', 'Hozircha filiallar mavjud emas')}
              message={t('branches.emptyHint', 'Yangi filial yaratish uchun yuqoridagi tugmadan foydalaning')}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
                  {[
                    { label: t('common.name', 'Nomi'), align: 'left' },
                    { label: t('branches.code', 'Kodi'), align: 'left' },
                    { label: t('branches.address', 'Manzili'), align: 'left' },
                    { label: t('branches.manager', 'Menejer'), align: 'left' },
                    { label: t('branches.students', 'Talabalar'), align: 'center' },
                    { label: t('common.status', 'Holat'), align: 'left' },
                    ...(canManage ? [{ label: t('common.actions', 'Amallar'), align: 'right' }] : []),
                  ].map((h, i) => (
                    <th
                      key={i}
                      className={cn(
                        'px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400',
                        h.align === 'right'
                          ? 'text-right'
                          : h.align === 'center'
                          ? 'text-center'
                          : 'text-left',
                      )}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                {branches.map((b, i) => {
                  const isDeactivating =
                    deactivateMutation.isPending && deactivateMutation.variables === b.id;
                  const isActivating =
                    activateMutation.isPending && activateMutation.variables === b.id;

                  return (
                    <motion.tr
                      key={b.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...SPRING.smooth, delay: Math.min(i, 15) * 0.03 }}
                      className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.03]"
                    >
                      {/* Branch name + icon */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <BranchIcon branch={b} />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900 dark:text-white">
                              {b.name}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="px-6 py-3.5">
                        {b.code ? (
                          <span className="inline-flex items-center rounded-lg bg-black/[0.05] dark:bg-white/[0.08] px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            {b.code}
                          </span>
                        ) : (
                          <span className="opacity-40">—</span>
                        )}
                      </td>

                      {/* Address */}
                      <td
                        className="max-w-[220px] truncate px-6 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                        title={b.address || undefined}
                      >
                        {b.address || <span className="opacity-40">—</span>}
                      </td>

                      {/* Manager */}
                      <td className="px-6 py-3.5">
                        {b.manager ? (
                          <div className="flex items-center gap-2.5">
                            <ManagerAvatar
                              firstName={b.manager.firstName}
                              lastName={b.manager.lastName}
                            />
                            <span className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                              {b.manager.firstName} {b.manager.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-600 dark:text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            {t('branches.noManager', 'Biriktirilmagan')}
                          </span>
                        )}
                      </td>

                      {/* Students count */}
                      <td className="px-6 py-3.5 text-center">
                        <span className="inline-flex min-w-[2.5rem] items-center justify-center gap-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 px-3 py-1 text-xs font-black text-blue-600 dark:text-blue-400 tabular-nums">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          {b._count?.students ?? 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                            b.isActive
                              ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-500/10 text-slate-500 dark:text-slate-400',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              b.isActive ? 'bg-emerald-500 shadow-sm' : 'bg-slate-400',
                            )}
                          />
                          {b.isActive
                            ? t('branches.statusActive', 'Faol')
                            : t('branches.statusInactive', 'Faol emas')}
                        </span>
                      </td>

                      {/* Actions (>= 44x44px touch targets) */}
                      {canManage && (
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Split-View Sidecar */}
                            <button
                              type="button"
                              onClick={() => {
                                playPop();
                                openSidecar({
                                  id: b.id,
                                  type: 'general',
                                  title: b.name,
                                  subtitle: (b.code || b.address) || undefined,
                                  details: [
                                    { label: 'Filial kodi', value: b.code || '—', copyable: true },
                                    { label: 'Manzili', value: b.address || '—' },
                                    { label: 'Telefon', value: b.phone || '—', copyable: true },
                                    { label: 'Email', value: b.email || '—', copyable: true },
                                    { label: 'Talabalar soni', value: String(b._count?.students ?? 0) },
                                    { label: 'Holat', value: b.isActive ? 'Faol' : 'Faol emas' },
                                  ],
                                });
                              }}
                              title="Split-View Sidecar"
                              aria-label={t('common.sidecar', 'Split-view sidecar')}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-white/[0.08] transition-colors"
                            >
                              <span className="text-[13px] leading-none">◨</span>
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => openEdit(b)}
                              title={t('common.edit', 'Tahrirlash')}
                              aria-label={t('common.edit', 'Tahrirlash')}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-white/[0.08] transition-colors"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                              </svg>
                            </button>

                            {/* Assign manager */}
                            <button
                              type="button"
                              onClick={() => {
                                playPop();
                                setManagerModal(b.id);
                              }}
                              title={t('branches.assignManager', 'Menejer biriktirish')}
                              aria-label={t('branches.assignManager', 'Menejer biriktirish')}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-purple-600 hover:bg-purple-500/10 dark:text-slate-400 dark:hover:text-purple-400 dark:hover:bg-purple-500/10 transition-colors"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <line x1="19" y1="8" x2="19" y2="14" />
                                <line x1="22" y1="11" x2="16" y2="11" />
                              </svg>
                            </button>

                            {/* Stats */}
                            <button
                              type="button"
                              onClick={() => {
                                playPop();
                                setStatsModal(b);
                              }}
                              title={t('branches.stats', 'Statistika')}
                              aria-label={t('branches.stats', 'Statistika')}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-500/10 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-500/10 transition-colors"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="20" x2="12" y2="10" />
                                <line x1="18" y1="20" x2="18" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="16" />
                              </svg>
                            </button>

                            {/* Activate / Deactivate */}
                            {b.isActive ? (
                              <button
                                type="button"
                                onClick={() => {
                                  playTick();
                                  setDeactivateTarget(b);
                                }}
                                disabled={isDeactivating}
                                title={t('branches.deactivate', 'Faolsizlantirish')}
                                aria-label={t('branches.deactivate', 'Faolsizlantirish')}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                              >
                                {isDeactivating ? (
                                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                  </svg>
                                ) : (
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                                    <line x1="12" y1="2" x2="12" y2="12" />
                                  </svg>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  playTick();
                                  activateMutation.mutate(b.id);
                                }}
                                disabled={isActivating}
                                title={t('branches.activate', 'Faollashtirish')}
                                aria-label={t('branches.activate', 'Faollashtirish')}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-emerald-500 hover:bg-emerald-500/10 transition-colors disabled:opacity-30"
                              >
                                {isActivating ? (
                                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                  </svg>
                                ) : (
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassSurface>

      {/* ── Create/Edit Modal ── */}
      <GlassModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingId(null);
        }}
        title={editingId ? t('branches.edit', 'Filialni tahrirlash') : t('branches.create', 'Yangi filial yaratish')}
        footer={
          <div className="flex justify-end gap-2.5">
            <GlassButton
              variant="secondary"
              onClick={() => {
                setModalOpen(false);
                setEditingId(null);
              }}
              className="min-h-[44px]"
            >
              {t('common.cancel', 'Bekor qilish')}
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
              className="min-h-[44px]"
            >
              {editingId ? t('common.save', 'Saqlash') : t('common.create', 'Yaratish')}
            </GlassButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Section: General */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18" />
                  <path d="M5 21V7l7-4 7 4v14" />
                </svg>
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('branches.sectionGeneral', 'Umumiy ma\'lumotlar')}
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField
                label={t('common.name', 'Nomi *')}
                error={formErrors.name ? t(formErrors.name) : undefined}
                required
              >
                <GlassInput
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    setFormErrors({});
                  }}
                  className="min-h-[44px]"
                />
              </GlassField>
              <GlassField label={t('branches.code', 'Kodi')}>
                <GlassInput
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="MAIN"
                  className="min-h-[44px]"
                />
              </GlassField>
            </div>

            <GlassField label={t('branches.address', 'Manzili')}>
              <GlassInput
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="min-h-[44px]"
              />
            </GlassField>
          </div>

          {/* Section: Contact */}
          <div className="space-y-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] p-4 border border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('branches.sectionContact', 'Aloqa')}
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label={t('branches.phone', 'Telefon')}>
                <GlassInput
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="min-h-[44px]"
                />
              </GlassField>
              <GlassField label={t('branches.email', 'Email')}>
                <GlassInput
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="min-h-[44px]"
                />
              </GlassField>
            </div>
          </div>

          {/* Section: Regional */}
          <div className="space-y-4 rounded-2xl bg-indigo-500/[0.04] p-4 border border-indigo-500/15">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {t('branches.sectionRegional', 'Mintaqaviy parametrlar')}
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label={t('branches.timezone', 'Vaqt mintaqasi')}>
                <GlassSelect
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
                  className="min-h-[44px]"
                />
              </GlassField>
              <GlassField label={t('branches.currency', 'Valyuta')}>
                <GlassSelect
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  className="min-h-[44px]"
                />
              </GlassField>
            </div>
          </div>
        </div>
      </GlassModal>

      {/* ── Assign Manager Modal ── */}
      <GlassModal
        open={managerModal !== null}
        onClose={() => {
          setManagerModal(null);
          setManagerId('');
        }}
        title={t('branches.assignManager', 'Menejer biriktirish')}
        footer={
          <div className="flex justify-end gap-2.5">
            <GlassButton
              variant="secondary"
              onClick={() => {
                setManagerModal(null);
                setManagerId('');
              }}
              className="min-h-[44px]"
            >
              {t('common.cancel', 'Bekor qilish')}
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={() => {
                if (managerModal && managerId) {
                  playTick();
                  managerMutation.mutate({ id: managerModal, managerId });
                }
              }}
              disabled={!managerId}
              loading={managerMutation.isPending}
              className="min-h-[44px]"
            >
              {t('common.save', 'Saqlash')}
            </GlassButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl bg-purple-500/[0.06] p-4 border border-purple-500/15">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </span>
            <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              {t(
                'branches.managerHint',
                'Ushbu filialga boshqaruvchi sifatida mas\'ul foydalanuvchini tanlang. U filial talabalari, o\'qituvchilari va guruhlarini nazorat qilish huquqiga ega bo\'ladi.',
              )}
            </p>
          </div>

          <GlassField label={t('branches.selectManager', 'Menejerni tanlang')}>
            <GlassSelect
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="min-h-[44px]"
              options={[
                { value: '', label: '—' },
                ...((users as any)?.items || []).map((u: any) => ({
                  value: u.id,
                  label: `${u.firstName} ${u.lastName}`,
                })),
              ]}
            />
          </GlassField>
        </div>
      </GlassModal>

      {/* ── Stats Modal ── */}
      <GlassModal
        open={statsModal !== null}
        onClose={() => setStatsModal(null)}
        title={t('branches.statsTitle', 'Filial statistikasi')}
        footer={null}
      >
        {statsModal && (
          <div className="space-y-4">
            {/* Branch header */}
            <div className="flex items-center gap-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-4 border border-black/[0.06] dark:border-white/[0.08]">
              <BranchIcon branch={statsModal} size={48} />
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-900 dark:text-white">
                  {statsModal.name}
                </p>
                {statsModal.code && (
                  <p className="mt-0.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {statsModal.code}
                  </p>
                )}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3.5">
              <StatCard
                label={t('branches.users', 'Foydalanuvchilar')}
                value={statsModal._count?.users ?? 0}
                gradient="from-blue-600 to-indigo-600"
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                }
              />
              <StatCard
                label={t('branches.students', 'Talabalar')}
                value={statsModal._count?.students ?? 0}
                gradient="from-emerald-500 to-teal-600"
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                }
              />
              <StatCard
                label={t('branches.teachers', 'O\'qituvchilar')}
                value={statsModal._count?.teachers ?? 0}
                gradient="from-indigo-600 to-violet-600"
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                }
              />
              <StatCard
                label={t('branches.groups', 'Guruhlar')}
                value={statsModal._count?.groups ?? 0}
                gradient="from-orange-500 to-amber-600"
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                }
              />
            </div>
          </div>
        )}
      </GlassModal>
    </div>
  );
}

export default BranchesPage;
