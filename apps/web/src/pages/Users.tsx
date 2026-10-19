import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { usersApi } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import {
  GlassPageHeader,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassField,
  GlassInput,
  GlassSelect,
  GlassModal,
  ConfirmDialog,
  useToasts,
  GlassButton,
} from '@/components/ui';
import { fullName, formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, User, UserRole } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const ALL_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'MANAGER',
  'TEACHER',
  'ASSISTANT',
  'STUDENT',
];

interface UserFormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
}

const INITIAL_FORM: UserFormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'MANAGER',
};

function roleKey(role: string): string {
  return `users.role.${role}`;
}

function formatUserName(user: User): string {
  return fullName(user.firstName, user.lastName);
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/* ─────────────────────────  Liquid Glass Surface  ───────────────────────── */
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

/* ───────────────────────  Avatar with gradient ring  ─────────────────────── */
function UserAvatar({ user, size = 38 }: { user: User; size?: number }) {
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  const gradients = [
    'from-brand-500 to-purple-500',
    'from-emerald-500 to-cyan-500',
    'from-amber-500 to-rose-500',
    'from-purple-500 to-pink-500',
    'from-blue-500 to-indigo-500',
    'from-rose-500 to-orange-500',
  ];
  const seed = (user.id ?? user.email ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const grad = gradients[seed % gradients.length];

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-px left-3 right-3 h-px bg-white/70"
      />
      {initials || '?'}
    </div>
  );
}

/* ───────────────────  Role → gradient glass badge mapping  ─────────────────── */
const ROLE_STYLES: Record<string, { ring: string; bg: string; text: string; dot: string }> = {
  PLATFORM_OWNER:{ ring: 'ring-fuchsia-500/25', bg: 'bg-fuchsia-500/12', text: 'text-fuchsia-600 dark:text-fuchsia-400', dot: 'bg-fuchsia-500' },
  SUPER_ADMIN: { ring: 'ring-purple-500/25', bg: 'bg-purple-500/12', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  ORG_ADMIN:   { ring: 'ring-brand-500/25',  bg: 'bg-brand-500/12',  text: 'text-brand-600 dark:text-brand-400',   dot: 'bg-brand-500' },
  MANAGER:     { ring: 'ring-blue-500/25',   bg: 'bg-blue-500/12',   text: 'text-brand-600 dark:text-brand-400',     dot: 'bg-blue-500' },
  TEACHER:     { ring: 'ring-emerald-500/25', bg: 'bg-emerald-500/12', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  ASSISTANT:   { ring: 'ring-amber-500/25',  bg: 'bg-amber-500/12',  text: 'text-amber-600 dark:text-amber-400',   dot: 'bg-amber-500' },
  STUDENT:     { ring: 'ring-cyan-500/25',   bg: 'bg-cyan-500/12',   text: 'text-cyan-600 dark:text-cyan-400',     dot: 'bg-cyan-500' },
};

export function UsersPage() {
  const { t } = useI18n();
  usePageTitle(t('users.title'));
  const { push, toastNode } = useToasts();
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();

  const availableRoles = useMemo(
    () =>
      currentUser?.role === 'SUPER_ADMIN'
        ? ALL_ROLES
        : ALL_ROLES.filter((role) => role !== 'SUPER_ADMIN' && role !== 'ORG_ADMIN'),
    [currentUser?.role],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [form, setForm] = useState<UserFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UserFormState, string>>>({});

  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = users.data as Paginated<User> | undefined;
  const userList = useMemo(() => data?.items || [], [data]);

  const create = useMutation({
    mutationFn: () => {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        role: form.role,
        ...(editingId ? {} : { password: form.password || undefined }),
      };
      return editingId ? usersApi.update(editingId, payload) : usersApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('users.updated') : t('users.created'));
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      usersApi.update(id, { isActive: active }),
    onSuccess: () => {
      push('success', t('users.statusUpdated'));
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const removeUser = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      push('success', t('users.deleted'));
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof UserFormState, string>> = {};
    if (!form.firstName.trim()) errors.firstName = t('users.validation.firstNameRequired');
    if (!form.lastName.trim()) errors.lastName = t('users.validation.lastNameRequired');
    if (!form.email.trim()) {
      errors.email = t('users.validation.emailRequired');
    } else if (!validateEmail(form.email)) {
      errors.email = t('users.validation.emailInvalid');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  const handleFormChange = useCallback(
    (field: keyof UserFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) return;
      create.mutate();
    },
    [validateForm, create],
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

  const handleEdit = useCallback((user: User) => {
    setEditingId(user.id);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      role: user.role,
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleToggleActive = useCallback(
    (user: User) => toggleActive.mutate({ id: user.id, active: !user.isActive }),
    [toggleActive],
  );

  const handleDelete = useCallback((user: User) => {
    setDeleteTarget({ id: user.id, name: formatUserName(user) });
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    removeUser.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, removeUser]);

  const { refetch: refetchUsers } = users;
  const handleRetry = useCallback(() => {
    void refetchUsers();
  }, [refetchUsers]);

  /* ── Loading ── */
  if (users.isLoading && !data) {
    return (
      <div className="relative min-h-screen">
        <div className="page-container space-y-4">
          <GlassPageHeader title={t('users.title')} subtitle={t('users.pageSubtitle')} />
          <GlassSurface className="p-16">
            <div className="flex items-center justify-center">
              <GlassPageLoader label={t('users.loading')} />
            </div>
          </GlassSurface>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (users.isError) {
    return (
      <div className="relative min-h-screen">
        <div className="page-container space-y-4">
          <GlassPageHeader title={t('users.title')} subtitle={t('users.pageSubtitle')} />
          <GlassSurface className="p-12">
            <GlassErrorState
              title={t('users.loadError')}
              message={getErrorMessage(users.error as Error)}
              onRetry={handleRetry}
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
        <div className="absolute -top-[10%] -left-[10%] h-[55%] w-[55%] animate-[float_18s_ease-in-out_infinite] rounded-full bg-cyan-400/10 blur-[140px] dark:bg-cyan-500/[0.07]" />
        <div className="absolute top-[30%] -right-[10%] h-[50%] w-[45%] animate-[float_22s_ease-in-out_infinite_reverse] rounded-full bg-indigo-400/10 blur-[130px] dark:bg-indigo-500/[0.06]" />
        <div className="absolute -bottom-[15%] left-[30%] h-[45%] w-[50%] animate-[float_26s_ease-in-out_infinite] rounded-full bg-brand-400/[0.07] blur-[150px] dark:bg-brand-500/[0.05]" />
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING.smooth}
        className="page-container relative z-10 space-y-5"
      >
        <GlassPageHeader
          title={t('users.title')}
          subtitle={t('users.pageSubtitle')}
          actions={
            <GlassButton type="button" variant="primary" onClick={handleOpenModal}
              icon={
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              }
            >
              {t('users.add')}
            </GlassButton>
          }
        />

        {/* ── Apple V2 KPI Bar ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-black/[0.06] bg-white/80 p-4 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80">
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t('common.total') || 'Jami foydalanuvchilar'}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
              {data?.total ?? userList.length}
            </p>
          </div>
          <div className="rounded-2xl border border-black/[0.06] bg-white/80 p-4 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80">
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t('users.status.ACTIVE') || 'Faol'}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[#34C759] dark:text-[#30D158] tabular-nums">
              {userList.filter(u => u.isActive).length}
            </p>
          </div>
          <div className="rounded-2xl border border-black/[0.06] bg-white/80 p-4 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80">
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t('users.role.ORG_ADMIN') || 'Adminlar'}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[#AF52DE] tabular-nums">
              {userList.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ORG_ADMIN').length}
            </p>
          </div>
          <div className="rounded-2xl border border-black/[0.06] bg-white/80 p-4 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80">
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t('users.role.TEACHER') || 'O\'qituvchilar'}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[#007AFF] tabular-nums">
              {userList.filter(u => u.role === 'TEACHER').length}
            </p>
          </div>
        </div>

        {/* ── Users table ── */}
        <GlassSurface>
          {userList.length === 0 ? (
            <div className="p-12">
              <GlassEmptyState title={t('users.emptyTitle')} message={t('users.emptyMessage')} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[0.85rem] tabular-nums">
                <thead>
                  <tr className="border-b border-white/40 dark:border-white/[0.06]">
                    {[
                      t('common.name'),
                      t('common.email'),
                      t('users.col.role'),
                      t('users.col.lastLogin'),
                      t('common.status'),
                      t('common.actions'),
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`px-6 py-4 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] ${
                          i === 5 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {userList.map((user, i) => {
                    const isToggling = toggleActive.isPending && toggleActive.variables?.id === user.id;
                    const isDeleting = removeUser.isPending && removeUser.variables === user.id;
                    const isCurrentUser = currentUser?.id === user.id;
                    const roleStyle = ROLE_STYLES[user.role] ?? ROLE_STYLES.STUDENT;

                    return (
                      <tr
                        key={user.id}
                        className="group border-b border-white/30 transition-colors duration-300 last:border-0 hover:bg-white/40 dark:border-white/[0.04] dark:hover:bg-white/[0.03] animate-[slideUp_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both]"
                        style={{ animationDelay: `${Math.min(i, 15) * 45}ms` }}
                      >
                        {/* Name + avatar */}
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-semibold text-[var(--text-primary)]">
                                  {formatUserName(user)}
                                </span>
                                {isCurrentUser && (
                                  <span className="inline-flex items-center rounded-full bg-brand-500/12 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-brand-600 ring-1 ring-inset ring-brand-500/25 dark:text-brand-400">
                                    {t('users.you')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-6 py-3.5 text-[var(--text-secondary)]">
                          {user.email}
                        </td>

                        {/* Role */}
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold ring-1 ring-inset ${roleStyle.bg} ${roleStyle.text} ${roleStyle.ring}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${roleStyle.dot}`} />
                            {t(roleKey(user.role))}
                          </span>
                        </td>

                        {/* Last login */}
                        <td className="whitespace-nowrap px-6 py-3.5 text-[0.78rem] tabular-nums text-[var(--text-muted)]">
                          {formatDate(user.lastLoginAt)}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold ring-1 ring-inset ${
                              user.isActive
                                ? 'bg-emerald-500/12 text-emerald-600 ring-emerald-500/25 shadow-[0_0_16px_-4px_rgba(16,185,129,0.5)] dark:text-emerald-400'
                                : 'bg-slate-500/10 text-slate-500 ring-slate-500/20 dark:text-slate-400'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]' : 'bg-slate-400'}`} />
                            {user.isActive ? t('users.status.ACTIVE') : t('users.status.INACTIVE')}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-3.5">
                          <div className="flex items-center justify-end gap-1.5 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity duration-300">
                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleEdit(user)}
                              disabled={isCurrentUser}
                              title={isCurrentUser ? t('users.cannotEditSelf') : t('common.edit')}
                              className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-all duration-300 hover:bg-white/60 hover:text-brand-600 hover:shadow-[0_4px_12px_-4px_rgba(59,130,246,0.4)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/[0.06] dark:hover:text-brand-400"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                              </svg>
                            </button>

                            {/* Toggle active */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(user)}
                              disabled={isToggling || isCurrentUser}
                              title={isCurrentUser ? t('users.cannotDeactivateSelf') : user.isActive ? t('users.deactivate') : t('users.activate')}
                              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300 hover:bg-white/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/[0.06] ${
                                user.isActive
                                  ? 'text-emerald-600 hover:shadow-[0_4px_12px_-4px_rgba(16,185,129,0.5)] dark:text-emerald-400'
                                  : 'text-slate-500 hover:shadow-[0_4px_12px_-4px_rgba(100,116,139,0.5)]'
                              }`}
                            >
                              {isToggling ? (
                                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                              ) : user.isActive ? (
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                                  <line x1="12" y1="2" x2="12" y2="12" />
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                                  <line x1="12" y1="2" x2="12" y2="12" />
                                </svg>
                              )}
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDelete(user)}
                              disabled={isDeleting || isCurrentUser}
                              title={isCurrentUser ? t('users.cannotDeleteSelf') : t('common.delete')}
                              className="flex h-8 w-8 items-center justify-center rounded-xl text-red-500 transition-all duration-300 hover:bg-red-500/10 hover:shadow-[0_4px_12px_-4px_rgba(239,68,68,0.5)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                            >
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
          )}
        </GlassSurface>

        {/* ── Add/edit modal ── */}
        <GlassModal
          open={modalOpen}
          onClose={handleCloseModal}
          title={editingId ? t('users.editTitle') : t('users.add')}
          wide
        >
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            {/* Section: Personal info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <h4 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {t('users.form.personalInfo') || 'Personal Information'}
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <GlassField label={t('users.form.firstName')} required error={formErrors.firstName}>
                  <GlassInput
                    value={form.firstName}
                    onChange={handleFormChange('firstName')}
                    required
                    aria-invalid={Boolean(formErrors.firstName)}
                    aria-describedby={formErrors.firstName ? 'firstname-error' : undefined}
                    placeholder="John"
                    disabled={create.isPending}
                  />
                  {formErrors.firstName && (
                    <span id="firstname-error" className="mt-1 text-sm text-red-600">
                      {formErrors.firstName}
                    </span>
                  )}
                </GlassField>

                <GlassField label={t('users.form.lastName')} required error={formErrors.lastName}>
                  <GlassInput
                    value={form.lastName}
                    onChange={handleFormChange('lastName')}
                    required
                    aria-invalid={Boolean(formErrors.lastName)}
                    aria-describedby={formErrors.lastName ? 'lastname-error' : undefined}
                    placeholder="Doe"
                    disabled={create.isPending}
                  />
                  {formErrors.lastName && (
                    <span id="lastname-error" className="mt-1 text-sm text-red-600">
                      {formErrors.lastName}
                    </span>
                  )}
                </GlassField>
              </div>
            </div>

            {/* Section: Account */}
            <div className="space-y-4 rounded-2xl bg-white/30 p-4 ring-1 ring-inset ring-white/40 dark:bg-white/[0.02] dark:ring-white/[0.05]">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <h4 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {t('users.form.account') || 'Account'}
                </h4>
              </div>

              <GlassField label={t('common.email')} required error={formErrors.email}>
                <GlassInput
                  type="email"
                  value={form.email}
                  onChange={handleFormChange('email')}
                  required
                  aria-invalid={Boolean(formErrors.email)}
                  aria-describedby={formErrors.email ? 'email-error' : undefined}
                  placeholder="john@example.com"
                  disabled={create.isPending}
                />
                {formErrors.email && (
                  <span id="email-error" className="mt-1 text-sm text-red-600">
                    {formErrors.email}
                  </span>
                )}
              </GlassField>

              {!editingId && (
                <GlassField label={t('users.form.password')} hint={t('users.form.passwordHint')}>
                  <GlassInput
                    type="password"
                    value={form.password}
                    onChange={handleFormChange('password')}
                    autoComplete="new-password"
                    disabled={create.isPending}
                  />
                </GlassField>
              )}

              <GlassField label={t('users.form.role')}>
                <GlassSelect
                  value={form.role}
                  onChange={handleFormChange('role')}
                  aria-label={t('users.form.roleAria')}
                  disabled={create.isPending}
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {t(roleKey(role))}
                    </option>
                  ))}
                </GlassSelect>
              </GlassField>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <GlassButton type="button" variant="secondary" onClick={handleCloseModal} disabled={create.isPending}>
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={create.isPending}
                loading={create.isPending}
              >
                {create.isPending
                  ? t('common.saving')
                  : editingId
                    ? t('common.save')
                    : t('users.create')}
              </GlassButton>
            </div>
          </form>
        </GlassModal>

        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          description={deleteTarget ? t('users.deleteConfirm', { name: deleteTarget.name }) : ''}
          loading={removeUser.isPending}
        />

        {toastNode}
      </motion.div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0)       scale(1); }
          33%      { transform: translate(40px, -30px) scale(1.06); }
          66%      { transform: translate(-30px, 20px) scale(0.96); }
        }
      `}</style>
    </div>
  );
}
