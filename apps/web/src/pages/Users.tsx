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
import { useSafeI18n } from '@/i18n/I18nProvider';
import { SpatialIdentityCard360 } from '@/components/cards/SpatialIdentityCard360';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { cn } from '@/lib/design';
import { BulkProvisioningModal } from '@/components/iam/BulkProvisioningModal';
import { AdminResetPasswordModal } from '@/components/iam/AdminResetPasswordModal';
import { OnboardingSlipModal } from '@/components/iam/OnboardingSlipModal';
import { IamSecurityRadarModal } from '@/components/iam/IamSecurityRadarModal';

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
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
}

const INITIAL_FORM: UserFormState = {
  username: '',
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
  const { t } = useSafeI18n();
  usePageTitle(t('users.title'));
  const { push, toastNode } = useToasts();
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const { playPop, playTick } = usePremiumSound();

  const availableRoles = useMemo(
    () =>
      currentUser?.role === 'SUPER_ADMIN'
        ? ALL_ROLES
        : ALL_ROLES.filter((role) => role !== 'SUPER_ADMIN' && role !== 'ORG_ADMIN'),
    [currentUser?.role],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [radarModalOpen, setRadarModalOpen] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<User | null>(null);
  const [slipTarget, setSlipTarget] = useState<User | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [cardUser, setCardUser] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ACTIVE' | 'ADMIN' | 'TEACHER'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState<UserFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UserFormState, string>>>({});

  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ limit: 500 }),
    placeholderData: (previousData) => previousData,
  });

  const data = users.data as Paginated<User> | undefined;
  const rawUserList = useMemo(() => {
    if (Array.isArray(users.data)) return users.data as User[];
    return data?.items || [];
  }, [users.data, data]);

  const userList = useMemo(() => {
    return rawUserList.filter((u) => {
      if (!u) return false;
      if (roleFilter === 'ACTIVE' && !u.isActive) return false;
      if (roleFilter === 'ADMIN' && u.role !== 'SUPER_ADMIN' && u.role !== 'ORG_ADMIN') return false;
      if (roleFilter === 'TEACHER' && u.role !== 'TEACHER') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [rawUserList, roleFilter, searchQuery]);

  const create = useMutation({
    mutationFn: () => {
      const payload = {
        username: form.username.trim().toLowerCase() || undefined,
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
      username: user.username || '',
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email || '',
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

  const handleOpenUserSidecar = useCallback((user: User) => {
    playPop();
    const roleColors: Record<string, 'blue' | 'emerald' | 'amber' | 'purple' | 'slate'> = {
      SUPER_ADMIN: 'purple',
      ORG_ADMIN: 'blue',
      MANAGER: 'blue',
      TEACHER: 'emerald',
      ASSISTANT: 'amber',
      STUDENT: 'blue',
    };
    const sidecarData: QuickLookData = {
      title: formatUserName(user),
      subtitle: user.email || (user.username ? `@${user.username}` : ''),
      badge: {
        text: t(roleKey(user.role)) || user.role,
        tone: roleColors[user.role] ?? 'slate',
      },
      avatar: {
        text: `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U',
      },
      metrics: [
        { label: t('common.status') || 'Holat', value: user.isActive ? (t('users.status.ACTIVE') || 'Faol') : (t('users.status.INACTIVE') || 'Nofaol') },
        { label: t('users.col.role') || 'Rol', value: t(roleKey(user.role)) || user.role },
        { label: t('users.col.lastLogin') || 'Oxirgi kirish', value: user.lastLoginAt ? formatDate(user.lastLoginAt) : '—' },
      ],
      details: [
        { label: 'Foydalanuvchi ID', value: user.id, copyable: true },
        { label: t('common.name') || 'Ism familiya', value: formatUserName(user) },
        { label: t('common.email') || 'Email', value: user.email || (user.username ? `@${user.username}` : '—'), copyable: Boolean(user.email) },
        { label: t('users.col.role') || 'Tizimdagi roli', value: user.role },
        { label: t('common.status') || 'Holati', value: user.isActive ? 'Faol akkaunt' : 'Nofaol akkaunt' },
        { label: 'Tashkilot ID', value: user.organizationId || '—', copyable: Boolean(user.organizationId) },
        { label: 'Yaratilgan sana', value: user.createdAt ? formatDate(user.createdAt) : '—' },
      ],
      primaryAction: {
        label: t('common.edit') || 'Tahrirlash',
        onExecute: () => {
          handleEdit(user);
        },
      },
    };
    openSidecar(sidecarData);
  }, [playPop, t, handleEdit]);

  const { refetch: refetchUsers } = users;
  const handleRetry = useCallback(() => {
    void refetchUsers();
  }, [refetchUsers]);

  /* ── Loading ── */
  if (users.isLoading && !data) {
    return (
      <div className="relative min-h-full">
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
      <div className="relative min-h-full">
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
    <div className="relative min-h-full bg-transparent selection:bg-brand-500/30">
      <AuroraMesh variant="corporate" opacity={0.65} />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING.smooth}
        className="page-container relative z-10 space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))]"
      >
        <GlassPageHeader
          title={t('users.title')}
          subtitle={t('users.pageSubtitle')}
          actions={
            currentUser?.role === 'PLATFORM_OWNER' || currentUser?.role === 'SUPER_ADMIN' ? (
              <div className="flex items-center gap-2">
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => { playTick(); setRadarModalOpen(true); }}
                  icon={
                    <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  }
                >
                  Xavfsizlik Radari
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => { playTick(); setBulkModalOpen(true); }}
                  icon={
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  }
                >
                  Ommaviy import (Excel/CSV)
                </GlassButton>
                <GlassButton type="button" variant="primary" onClick={handleOpenModal}
                  icon={
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  }
                >
                  {t('users.add')}
                </GlassButton>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium">
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>Hisob yaratish: Faqat Platform Owner vakolatida</span>
              </div>
            )
          }
        />

        {/* ── Apple V2 KPI Bar (Interactive Filter) ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <button
            type="button"
            onClick={() => { playTick(); setRoleFilter('ALL'); }}
            className={cn(
              'text-left rounded-2xl border p-4 shadow-card backdrop-blur-xl transition-all duration-200 active:scale-[0.98]',
              roleFilter === 'ALL'
                ? 'border-brand-500/50 bg-white/95 ring-2 ring-brand-500/30 dark:border-brand-400/40 dark:bg-surface-900/95'
                : 'border-black/[0.06] bg-white/80 hover:bg-white/90 dark:border-white/[0.08] dark:bg-surface-900/80 dark:hover:bg-surface-900/90'
            )}
          >
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t('common.total') || 'Jami foydalanuvchilar'}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
              {data?.total ?? rawUserList.length}
            </p>
          </button>
          <button
            type="button"
            onClick={() => { playTick(); setRoleFilter('ACTIVE'); }}
            className={cn(
              'text-left rounded-2xl border p-4 shadow-card backdrop-blur-xl transition-all duration-200 active:scale-[0.98]',
              roleFilter === 'ACTIVE'
                ? 'border-emerald-500/50 bg-white/95 ring-2 ring-emerald-500/30 dark:border-emerald-400/40 dark:bg-surface-900/95'
                : 'border-black/[0.06] bg-white/80 hover:bg-white/90 dark:border-white/[0.08] dark:bg-surface-900/80 dark:hover:bg-surface-900/90'
            )}
          >
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t('users.status.ACTIVE') || 'Faol'}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[#34C759] dark:text-[#30D158] tabular-nums">
              {rawUserList.filter(u => u?.isActive).length}
            </p>
          </button>
          <button
            type="button"
            onClick={() => { playTick(); setRoleFilter('ADMIN'); }}
            className={cn(
              'text-left rounded-2xl border p-4 shadow-card backdrop-blur-xl transition-all duration-200 active:scale-[0.98]',
              roleFilter === 'ADMIN'
                ? 'border-purple-500/50 bg-white/95 ring-2 ring-purple-500/30 dark:border-purple-400/40 dark:bg-surface-900/95'
                : 'border-black/[0.06] bg-white/80 hover:bg-white/90 dark:border-white/[0.08] dark:bg-surface-900/80 dark:hover:bg-surface-900/90'
            )}
          >
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t('users.role.ORG_ADMIN') || 'Adminlar'}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[#AF52DE] tabular-nums">
              {rawUserList.filter(u => u?.role === 'SUPER_ADMIN' || u?.role === 'ORG_ADMIN').length}
            </p>
          </button>
          <button
            type="button"
            onClick={() => { playTick(); setRoleFilter('TEACHER'); }}
            className={cn(
              'text-left rounded-2xl border p-4 shadow-card backdrop-blur-xl transition-all duration-200 active:scale-[0.98]',
              roleFilter === 'TEACHER'
                ? 'border-blue-500/50 bg-white/95 ring-2 ring-blue-500/30 dark:border-blue-400/40 dark:bg-surface-900/95'
                : 'border-black/[0.06] bg-white/80 hover:bg-white/90 dark:border-white/[0.08] dark:bg-surface-900/80 dark:hover:bg-surface-900/90'
            )}
          >
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t('users.role.TEACHER') || 'O\'qituvchilar'}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[#007AFF] tabular-nums">
              {rawUserList.filter(u => u?.role === 'TEACHER').length}
            </p>
          </button>
        </div>

        {/* ── Search & Filter Pill Bar ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="users-search-input"
              name="users-search-input"
              aria-label={t('common.search') || 'Foydalanuvchilarni qidirish...'}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search') || 'Foydalanuvchilarni qidirish...'}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white/70 dark:bg-surface-900/70 text-sm backdrop-blur-md outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          {roleFilter !== 'ALL' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Filtr: {roleFilter}</span>
              <button
                type="button"
                onClick={() => { playTick(); setRoleFilter('ALL'); }}
                className="h-9 px-3 rounded-lg text-xs font-semibold bg-brand-500/10 text-brand-600 hover:bg-brand-500/20 transition-colors"
              >
                ✕ Tozalash
              </button>
            </div>
          )}
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
                              {user.username && (
                                <p className="text-[11px] font-mono text-[var(--text-muted)]">
                                  @{user.username}
                                </p>
                              )}
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
                            {/* Sidecar QuickLook */}
                            <button
                              type="button"
                              onClick={() => handleOpenUserSidecar(user)}
                              title={t('common.details') || 'Sidecarda ko‘rish'}
                              aria-label={`${formatUserName(user)} ma'lumotlari`}
                              className="flex min-h-10 min-w-[40px] sm:min-h-0 sm:min-w-0 sm:h-8 sm:w-8 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-all duration-300 hover:bg-white/60 hover:text-brand-600 hover:shadow-[0_4px_12px_-4px_rgba(59,130,246,0.4)] active:scale-95 dark:hover:bg-white/[0.06] dark:hover:text-brand-400"
                            >
                              <svg className="h-4 w-4 sm:h-3.5 sm:w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="18" height="18" x="3" y="3" rx="2" />
                                <path d="M15 3v18" />
                                <path d="m8 9 3 3-3 3" />
                              </svg>
                            </button>

                            {/* 360° Glass ID Card */}
                            <button
                              type="button"
                              onClick={() => setCardUser(user)}
                              title="360° Shaffof ID Karta"
                              className="flex min-h-10 px-2.5 sm:min-h-0 sm:h-8 sm:px-2 items-center justify-center gap-1 rounded-xl text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-all duration-300 active:scale-95"
                            >
                              <span className="text-xs">🪪</span>
                              <span className="text-[10px] font-bold">360°</span>
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleEdit(user)}
                              disabled={isCurrentUser}
                              title={isCurrentUser ? t('users.cannotEditSelf') : t('common.edit')}
                              className="flex min-h-10 min-w-[40px] sm:min-h-0 sm:min-w-0 sm:h-8 sm:w-8 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-all duration-300 hover:bg-white/60 hover:text-brand-600 hover:shadow-[0_4px_12px_-4px_rgba(59,130,246,0.4)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/[0.06] dark:hover:text-brand-400"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                              </svg>
                            </button>

                            {/* Reset Password (Platform Owner IAM) */}
                            {(currentUser?.role === 'PLATFORM_OWNER' || currentUser?.role === 'SUPER_ADMIN') && (
                              <button
                                type="button"
                                onClick={() => { playTick(); setResetPasswordTarget(user); }}
                                title="Parolni yangilash (Platform Owner)"
                                aria-label={`${formatUserName(user)} parolini yangilash`}
                                className="flex min-h-10 min-w-[40px] sm:min-h-0 sm:min-w-0 sm:h-8 sm:w-8 items-center justify-center rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:shadow-[0_4px_12px_-4px_rgba(245,158,11,0.4)] transition-all duration-300 active:scale-95"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                              </button>
                            )}

                            {/* Onboarding Slip (Platform Owner IAM) */}
                            {(currentUser?.role === 'PLATFORM_OWNER' || currentUser?.role === 'SUPER_ADMIN') && (
                              <button
                                type="button"
                                onClick={() => { playTick(); setSlipTarget(user); }}
                                title="Hisob varaqasini chop etish (Onboarding Slip)"
                                aria-label={`${formatUserName(user)} hisob varaqasini chop etish`}
                                className="flex min-h-10 min-w-[40px] sm:min-h-0 sm:min-w-0 sm:h-8 sm:w-8 items-center justify-center rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 hover:shadow-[0_4px_12px_-4px_rgba(59,130,246,0.4)] transition-all duration-300 active:scale-95"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="6 9 6 2 18 2 18 9" />
                                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                  <rect width="12" height="8" x="6" y="14" />
                                </svg>
                              </button>
                            )}

                            {/* Toggle active */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(user)}
                              disabled={isToggling || isCurrentUser}
                              title={isCurrentUser ? t('users.cannotDeactivateSelf') : user.isActive ? t('users.deactivate') : t('users.activate')}
                              className={`flex min-h-10 min-w-[40px] sm:min-h-0 sm:min-w-0 sm:h-8 sm:w-8 items-center justify-center rounded-xl transition-all duration-300 hover:bg-white/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/[0.06] ${
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
                              className="flex min-h-10 min-w-[40px] sm:min-h-0 sm:min-w-0 sm:h-8 sm:w-8 items-center justify-center rounded-xl text-red-500 transition-all duration-300 hover:bg-red-500/10 hover:shadow-[0_4px_12px_-4px_rgba(239,68,68,0.5)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
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

              <GlassField label="Foydalanuvchi nomi (Username)" hint="Tizimga kirish uchun yagona login identifikatori">
                <GlassInput
                  value={form.username}
                  onChange={handleFormChange('username')}
                  placeholder="masalan: teacher_rustam"
                  disabled={create.isPending}
                />
              </GlassField>

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

        {cardUser && (
          <GlassModal
            open={Boolean(cardUser)}
            onClose={() => setCardUser(null)}
            title={`${formatUserName(cardUser)} · 360° Shaffof Karta`}
            size="md"
          >
            <div className="py-2 flex flex-col items-center">
              <SpatialIdentityCard360
                data={{
                  id: cardUser.id,
                  fullName: formatUserName(cardUser),
                  role: cardUser.role,
                  email: cardUser.email || undefined,
                  phone: cardUser.phone || undefined,
                  status: cardUser.isActive ? 'Faol' : 'Nofaol',
                  biometricVerified: Boolean(cardUser.faceEnrolled),
                  nfcEnabled: false,
                }}
              />
            </div>
          </GlassModal>
        )}

        {/* ── Platform Owner IAM Bulk Provisioning Studio ── */}
        <BulkProvisioningModal
          open={bulkModalOpen}
          onClose={() => setBulkModalOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['users'] });
          }}
        />

        {/* ── Platform Owner IAM Administrative Password Reset ── */}
        <AdminResetPasswordModal
          user={resetPasswordTarget}
          open={Boolean(resetPasswordTarget)}
          onClose={() => setResetPasswordTarget(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['users'] });
          }}
        />

        {/* ── Platform Owner Onboarding Slip Modal ── */}
        {slipTarget && (
          <OnboardingSlipModal
            open={Boolean(slipTarget)}
            onClose={() => setSlipTarget(null)}
            title={`Hisob Varaqasi — @${slipTarget.username || formatUserName(slipTarget)}`}
            records={[
              {
                id: slipTarget.id,
                fullName: formatUserName(slipTarget),
                username: slipTarget.username || '',
                temporaryPassword: '••••••••',
                role: slipTarget.role,
                organizationName: (slipTarget as any).organization?.name,
                mustChangePassword: slipTarget.mustChangePassword,
              },
            ]}
          />
        )}

        {/* ── Platform Owner IAM Security Radar Modal ── */}
        <IamSecurityRadarModal
          open={radarModalOpen}
          onClose={() => setRadarModalOpen(false)}
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
