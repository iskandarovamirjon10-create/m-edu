import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useI18n } from '../i18n/I18nProvider';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Branch } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthState } from '@/auth/AuthContext';

interface BranchFormState {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  currency: string;
}

const INITIAL_FORM: BranchFormState = {
  name: '',
  code: '',
  address: '',
  phone: '',
  email: '',
  timezone: 'Asia/Tashkent',
  currency: 'UZS',
};

const TIMEZONES = [
  'Asia/Tashkent',
  'Asia/Almaty',
  'Asia/Novosibirsk',
  'Europe/Moscow',
  'UTC',
];

const CURRENCIES = ['UZS', 'USD', 'RUB', 'KZT', 'EUR'];

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
        'relative overflow-hidden rounded-[2rem]',
        'bg-white/55 dark:bg-white/[0.035]',
        'backdrop-blur-2xl backdrop-saturate-[1.8]',
        'ring-1 ring-inset ring-white/60 dark:ring-white/[0.08]',
        'shadow-[0_8px_32px_-8px_rgba(15,23,42,0.12),inset_0_1px_0_0_rgba(255,255,255,0.75)]',
        'dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.06)]',
        hover
          ? 'transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 hover:shadow-[0_20px_60px_-15px_rgba(15,23,42,0.22),inset_0_1px_0_0_rgba(255,255,255,0.85)]'
          : '',
        className,
      ].join(' ')}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[140%] -translate-x-1/2 rounded-full bg-gradient-to-b from-white/50 to-transparent blur-2xl dark:from-white/[0.06]"
      />
      {children}
    </div>
  );
}

/* ─────────────────  Branch Icon (seed-based gradient)  ───────────────── */
const BRANCH_GRADIENTS = [
  'from-brand-500 to-purple-500',
  'from-emerald-500 to-cyan-500',
  'from-amber-500 to-rose-500',
  'from-purple-500 to-pink-500',
  'from-blue-500 to-indigo-500',
  'from-rose-500 to-orange-500',
  'from-teal-500 to-emerald-500',
];

function BranchIcon({ branch, size = 40 }: { branch: Branch; size?: number }) {
  const seed = (branch.id ?? branch.name ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const grad = BRANCH_GRADIENTS[seed % BRANCH_GRADIENTS.length];

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]`}
      style={{ width: size, height: size }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-px left-3 right-3 h-px bg-white/70"
      />
      <svg
        className="h-[45%] w-[45%]"
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

/* ─────────────────  Manager Avatar  ───────────────── */
function ManagerAvatar({
  firstName,
  lastName,
  size = 30,
}: {
  firstName?: string;
  lastName?: string;
  size?: number;
}) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  const seed = (firstName ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const grad = BRANCH_GRADIENTS[seed % BRANCH_GRADIENTS.length];

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grad} font-bold text-white shadow-[0_2px_10px_-3px_rgba(0,0,0,0.35)]`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/40"
      />
      {initials || '?'}
    </div>
  );
}

/* ─────────────────  Stat Card (Stats Modal)  ───────────────── */
function StatCard({
  label,
  value,
  gradient,
  icon,
  delay = 0,
}: {
  label: string;
  value: number;
  gradient: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="animate-[slideUp_0.55s_cubic-bezier(0.34,1.56,0.64,1)_both]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={[
          'group relative overflow-hidden rounded-2xl p-4',
          'bg-white/50 dark:bg-white/[0.035]',
          'ring-1 ring-inset ring-white/60 dark:ring-white/[0.08]',
          'backdrop-blur-xl',
          'transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          'hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-10px_rgba(15,23,42,0.2)]',
        ].join(' ')}
      >
        <div
          aria-hidden
          className={`absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-[0.15] blur-[40px] transition-opacity duration-700 group-hover:opacity-30`}
        />
        <div className="relative z-10 flex flex-col items-center gap-2 text-center">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.4)] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}
          >
            {icon}
          </div>
          <p className="text-[1.6rem] font-black leading-none tracking-tight text-[var(--text-primary)] tabular-nums">
            {value}
          </p>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

export function BranchesPage() {
  const { t } = useI18n();
  usePageTitle(t('branches.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const { hasAnyRole } = useAuthState();
  const canManage = hasAnyRole('SUPER_ADMIN', 'ORG_ADMIN');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BranchFormState>(INITIAL_FORM);
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

  const createMutation = useMutation({
    mutationFn: (data: BranchFormState) => branchesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setModalOpen(false);
      setForm(INITIAL_FORM);
      push({ type: 'success', message: t('branches.created') });
    },
    onError: (err: unknown) => push({ type: 'error', message: getErrorMessage(err) }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BranchFormState }) => branchesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      push({ type: 'success', message: t('branches.updated') });
    },
    onError: (err: unknown) => push({ type: 'error', message: getErrorMessage(err) }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => branchesApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      push({ type: 'success', message: t('branches.deactivated') });
    },
    onError: (err: unknown) => push({ type: 'error', message: getErrorMessage(err) }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => branchesApi.activate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      push({ type: 'success', message: t('branches.activated') });
    },
    onError: (err: unknown) => push({ type: 'error', message: getErrorMessage(err) }),
  });

  const managerMutation = useMutation({
    mutationFn: ({ id, managerId }: { id: string; managerId: string }) =>
      branchesApi.assignManager(id, managerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setManagerModal(null);
      setManagerId('');
      push({ type: 'success', message: t('branches.managerAssigned') });
    },
    onError: (err: unknown) => push({ type: 'error', message: getErrorMessage(err) }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setModalOpen(true);
  }

  function openEdit(branch: Branch) {
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
    setModalOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="relative min-h-screen">
        <div className="page-container space-y-4">
          <GlassPageHeader title={t('branches.title')} subtitle={t('branches.subtitle')} />
          <GlassSurface className="p-16">
            <div className="flex items-center justify-center">
              <GlassPageLoader label={t('common.loading')} />
            </div>
          </GlassSurface>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="relative min-h-screen">
        <div className="page-container space-y-4">
          <GlassPageHeader title={t('branches.title')} subtitle={t('branches.subtitle')} />
          <GlassSurface className="p-12">
            <GlassErrorState
              message={getErrorMessage(error)}
              onRetry={() => qc.invalidateQueries({ queryKey: ['branches'] })}
            />
          </GlassSurface>
        </div>
      </div>
    );
  }

  /* ── Main ── */
  return (
    <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
      {/* ── Ambient background orbs ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-[10%] -left-[10%] h-[55%] w-[55%] animate-[float_18s_ease-in-out_infinite] rounded-full bg-emerald-400/10 blur-[140px] dark:bg-emerald-500/[0.07]" />
        <div className="absolute top-[25%] -right-[10%] h-[50%] w-[45%] animate-[float_22s_ease-in-out_infinite_reverse] rounded-full bg-brand-400/10 blur-[130px] dark:bg-brand-500/[0.06]" />
        <div className="absolute -bottom-[15%] left-[30%] h-[45%] w-[50%] animate-[float_26s_ease-in-out_infinite] rounded-full bg-indigo-400/[0.07] blur-[150px] dark:bg-indigo-500/[0.05]" />
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <div className="page-container relative z-10 space-y-5 animate-in fade-in duration-700">
        {toastNode}

        <ConfirmDialog
          open={deactivateTarget !== null}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={() => {
            if (!deactivateTarget) return;
            deactivateMutation.mutate(deactivateTarget.id);
            setDeactivateTarget(null);
          }}
          description={t('branches.deactivateConfirm')}
          confirmLabel={t('branches.deactivate')}
          loading={deactivateMutation.isPending}
        />

        <GlassPageHeader
          title={t('branches.title')}
          subtitle={t('branches.subtitle')}
          actions={
            canManage ? (
              <GlassButton
                type="button"
                variant="primary"
                onClick={openCreate}
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
                {t('branches.add')}
              </GlassButton>
            ) : undefined
          }
        />

        {/* ── Branches Table ── */}
        <GlassSurface>
          {branches.length === 0 ? (
            <div className="p-12">
              <GlassEmptyState title={t('branches.empty')} message={t('branches.emptyHint')} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[0.85rem]">
                <thead>
                  <tr className="border-b border-white/40 dark:border-white/[0.06]">
                    {[
                      { label: t('common.name'), align: 'left' },
                      { label: t('branches.code'), align: 'left' },
                      { label: t('branches.address'), align: 'left' },
                      { label: t('branches.manager'), align: 'left' },
                      { label: t('branches.students'), align: 'center' },
                      { label: t('common.status'), align: 'left' },
                      ...(canManage ? [{ label: t('common.actions'), align: 'right' }] : []),
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={`px-6 py-4 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] ${
                          h.align === 'right'
                            ? 'text-right'
                            : h.align === 'center'
                              ? 'text-center'
                              : 'text-left'
                        }`}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b, i) => {
                    const isDeactivating =
                      deactivateMutation.isPending && deactivateMutation.variables === b.id;
                    const isActivating =
                      activateMutation.isPending && activateMutation.variables === b.id;

                    return (
                      <tr
                        key={b.id}
                        className="group relative border-b border-white/30 transition-colors duration-300 last:border-0 hover:bg-white/40 dark:border-white/[0.04] dark:hover:bg-white/[0.03] animate-[slideUp_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both]"
                        style={{ animationDelay: `${Math.min(i, 15) * 45}ms` }}
                      >
                        {/* Branch name + icon */}
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <BranchIcon branch={b} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[var(--text-primary)]">
                                {b.name}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Code */}
                        <td className="px-6 py-3.5">
                          {b.code ? (
                            <span className="inline-flex items-center rounded-lg bg-white/50 px-2 py-0.5 font-mono text-[0.72rem] font-bold uppercase tracking-wider text-[var(--text-secondary)] ring-1 ring-inset ring-white/60 dark:bg-white/[0.04] dark:ring-white/[0.06]">
                              {b.code}
                            </span>
                          ) : (
                            <span className="opacity-40">—</span>
                          )}
                        </td>

                        {/* Address */}
                        <td
                          className="max-w-[220px] truncate px-6 py-3.5 text-[0.78rem] text-[var(--text-secondary)]"
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
                              <span className="truncate text-[0.82rem] font-medium text-[var(--text-primary)]">
                                {b.manager.firstName} {b.manager.lastName}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[0.66rem] font-bold text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              {t('branches.noManager') || 'Unassigned'}
                            </span>
                          )}
                        </td>

                        {/* Students count */}
                        <td className="px-6 py-3.5 text-center">
                          <span className="inline-flex min-w-[2.5rem] items-center justify-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-[0.72rem] font-bold text-brand-600 ring-1 ring-inset ring-brand-500/20 tabular-nums dark:text-brand-400">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold ring-1 ring-inset ${
                              b.isActive
                                ? 'bg-emerald-500/12 text-emerald-600 ring-emerald-500/25 shadow-[0_0_16px_-4px_rgba(16,185,129,0.5)] dark:text-emerald-400'
                                : 'bg-slate-500/10 text-slate-500 ring-slate-500/20 dark:text-slate-400'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                b.isActive
                                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]'
                                  : 'bg-slate-400'
                              }`}
                            />
                            {b.isActive ? t('branches.statusActive') || 'Active' : t('branches.statusInactive') || 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        {canManage && (
                          <td className="px-6 py-3.5">
                            <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity duration-300 group-hover:opacity-100">
                              {/* Edit */}
                              <button
                                type="button"
                                onClick={() => openEdit(b)}
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

                              {/* Assign manager */}
                              <button
                                type="button"
                                onClick={() => setManagerModal(b.id)}
                                title={t('branches.assignManager')}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-all duration-300 hover:bg-white/60 hover:text-purple-600 hover:shadow-[0_4px_12px_-4px_rgba(168,85,247,0.4)] active:scale-95 dark:hover:bg-white/[0.06] dark:hover:text-purple-400"
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e: any) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.currentTarget.click();
                                  }
                                }}>
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                  <circle cx="9" cy="7" r="4" />
                                  <line x1="19" y1="8" x2="19" y2="14" />
                                  <line x1="22" y1="11" x2="16" y2="11" />
                                </svg>
                              </button>

                              {/* Stats */}
                              <button
                                type="button"
                                onClick={() => setStatsModal(b)}
                                title={t('branches.stats')}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-all duration-300 hover:bg-white/60 hover:text-indigo-600 hover:shadow-[0_4px_12px_-4px_rgba(99,102,241,0.4)] active:scale-95 dark:hover:bg-white/[0.06] dark:hover:text-indigo-400"
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e: any) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.currentTarget.click();
                                  }
                                }}>
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="20" x2="12" y2="10" />
                                  <line x1="18" y1="20" x2="18" y2="4" />
                                  <line x1="6" y1="20" x2="6" y2="16" />
                                </svg>
                              </button>

                              {/* Activate / Deactivate */}
                              {b.isActive ? (
                                <button
                                  type="button"
                                  onClick={() => setDeactivateTarget(b)}
                                  disabled={isDeactivating}
                                  title={t('branches.deactivate')}
                                  className="flex h-8 w-8 items-center justify-center rounded-xl text-red-500 transition-all duration-300 hover:bg-red-500/10 hover:shadow-[0_4px_12px_-4px_rgba(239,68,68,0.5)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e: any) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      e.currentTarget.click();
                                    }
                                  }}>
                                  {isDeactivating ? (
                                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                    </svg>
                                  ) : (
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                                      <line x1="12" y1="2" x2="12" y2="12" />
                                    </svg>
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => activateMutation.mutate(b.id)}
                                  disabled={isActivating}
                                  title={t('branches.activate')}
                                  className="flex h-8 w-8 items-center justify-center rounded-xl text-emerald-500 transition-all duration-300 hover:bg-emerald-500/10 hover:shadow-[0_4px_12px_-4px_rgba(16,185,129,0.5)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e: any) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      e.currentTarget.click();
                                    }
                                  }}>
                                  {isActivating ? (
                                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                    </svg>
                                  ) : (
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
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
          title={editingId ? t('branches.edit') : t('branches.create')}
          footer={
            <div className="flex justify-end gap-3">
              <GlassButton
                variant="secondary"
                onClick={() => {
                  setModalOpen(false);
                  setEditingId(null);
                }}
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
                onClick={handleSubmit}
                loading={createMutation.isPending || updateMutation.isPending}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                {editingId ? t('common.save') : t('common.create')}
              </GlassButton>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Section: General */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18" />
                    <path d="M5 21V7l7-4 7 4v14" />
                  </svg>
                </span>
                <h4 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {t('branches.sectionGeneral') || 'General'}
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <GlassField label={t('common.name')} required>
                  <GlassInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </GlassField>
                <GlassField label={t('branches.code')}>
                  <GlassInput
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="MAIN"
                  />
                </GlassField>
              </div>

              <GlassField label={t('branches.address')}>
                <GlassInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </GlassField>
            </div>

            {/* Section: Contact */}
            <div className="space-y-4 rounded-2xl bg-white/30 p-4 ring-1 ring-inset ring-white/40 dark:bg-white/[0.02] dark:ring-white/[0.05]">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </span>
                <h4 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {t('branches.sectionContact') || 'Contact'}
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <GlassField label={t('branches.phone')}>
                  <GlassInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </GlassField>
                <GlassField label={t('branches.email')}>
                  <GlassInput
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </GlassField>
              </div>
            </div>

            {/* Section: Regional */}
            <div className="space-y-4 rounded-2xl bg-gradient-to-br from-indigo-500/[0.06] to-purple-500/[0.04] p-4 ring-1 ring-inset ring-indigo-500/15 dark:from-indigo-500/[0.04] dark:to-purple-500/[0.02] dark:ring-indigo-500/10">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </span>
                <h4 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-indigo-600/80 dark:text-indigo-400/80">
                  {t('branches.sectionRegional') || 'Regional'}
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <GlassField label={t('branches.timezone')}>
                  <GlassSelect
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
                  />
                </GlassField>
                <GlassField label={t('branches.currency')}>
                  <GlassSelect
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    options={CURRENCIES.map((c) => ({ value: c, label: c }))}
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
          title={t('branches.assignManager')}
          footer={
            <div className="flex justify-end gap-3">
              <GlassButton
                variant="secondary"
                onClick={() => {
                  setManagerModal(null);
                  setManagerId('');
                }}
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
                onClick={() => {
                  if (managerModal && managerId) {
                    managerMutation.mutate({ id: managerModal, managerId });
                  }
                }}
                disabled={!managerId}
                loading={managerMutation.isPending}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                {t('common.save')}
              </GlassButton>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-purple-500/[0.06] p-3 ring-1 ring-inset ring-purple-500/15">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
              <p className="text-[0.78rem] leading-relaxed text-[var(--text-secondary)]">
                {t('branches.managerHint') || 'Select a user to become the manager of this branch. They will have access to manage students, groups and teachers.'}
              </p>
            </div>

            <GlassField label={t('branches.selectManager')}>
              <GlassSelect
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
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
          title={t('branches.statsTitle')}
          footer={null}
        >
          {statsModal && (
            <div className="space-y-4">
              {/* Branch header */}
              <div className="flex items-center gap-3 rounded-2xl bg-white/40 p-3 ring-1 ring-inset ring-white/50 dark:bg-white/[0.03] dark:ring-white/[0.06]">
                <BranchIcon branch={statsModal} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-[0.95rem] font-bold text-[var(--text-primary)]">
                    {statsModal.name}
                  </p>
                  {statsModal.code && (
                    <p className="mt-0.5 font-mono text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)]">
                      {statsModal.code}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label={t('branches.users')}
                  value={statsModal._count?.users ?? 0}
                  gradient="from-brand-500 to-blue-500"
                  delay={0}
                  icon={
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  }
                />
                <StatCard
                  label={t('branches.students')}
                  value={statsModal._count?.students ?? 0}
                  gradient="from-emerald-500 to-teal-500"
                  delay={80}
                  icon={
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                      <path d="M6 12v5c3 3 9 3 12 0v-5" />
                    </svg>
                  }
                />
                <StatCard
                  label={t('branches.teachers')}
                  value={statsModal._count?.teachers ?? 0}
                  gradient="from-indigo-500 to-violet-500"
                  delay={160}
                  icon={
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                  }
                />
                <StatCard
                  label={t('branches.groups')}
                  value={statsModal._count?.groups ?? 0}
                  gradient="from-orange-500 to-amber-500"
                  delay={240}
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