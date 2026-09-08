import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi, usersApi, authApi } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import {
  PageHeader,
  PageLoader,
  ErrorState,
  Field,
  TextInput,
  Select,
  useToasts,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Organization, User } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

interface OrgFormState {
  name: string;
  email: string;
  phone: string;
}

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirm: string;
}

interface SettingsFormState {
  language: string;
  timezone: string;
}

const INITIAL_PASSWORD_FORM: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirm: '',
};

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Asia/Tashkent', label: 'Asia/Tashkent' },
  { value: 'America/New_York', label: 'America/New_York' },
];

const LANGUAGES = [{ value: 'en', label: 'English' }];

type Theme = 'light' | 'dark' | 'system';

function validatePassword(password: string): string | undefined {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return undefined;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Glass Panel                                                              */
/* ────────────────────────────────────────────────────────────────────────── */
function GlassPanel({
  title,
  subtitle,
  icon,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.18) 0%, transparent 50%)' }}
      />
      <div className="relative z-10">
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          {icon && (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'rgba(84,115,252,0.10)',
                color: 'var(--m-vivid)',
              }}
            >
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="p-6">{children}</div>
        {footer && (
          <div
            className="px-6 py-4 flex justify-end"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Theme Switcher                                                           */
/* ────────────────────────────────────────────────────────────────────────── */
function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('medu-theme') as Theme) || 'light';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const apply = (mode: Theme) => {
      if (mode === 'dark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      } else if (mode === 'light') {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
          root.setAttribute('data-theme', 'dark');
        } else {
          root.classList.remove('dark');
          root.setAttribute('data-theme', 'light');
        }
      }
    };
    apply(theme);
    try { localStorage.setItem('medu-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const options: { value: Theme; label: string; icon: ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="grid grid-cols-3 gap-2 p-1 rounded-2xl"
      style={{
        background: 'var(--bg-glass)',
        border: '1px solid var(--border-subtle)',
      }}
      role="radiogroup"
      aria-label="Theme selection"
    >
      {options.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt.value)}
            className="flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl transition-all duration-200"
            style={{
              background: active
                ? 'linear-gradient(180deg, rgba(84,115,252,0.18) 0%, rgba(84,115,252,0.08) 100%)'
                : 'transparent',
              border: active ? '1px solid rgba(84,115,252,0.30)' : '1px solid transparent',
              color: active ? 'var(--m-vivid)' : 'var(--text-secondary)',
              boxShadow: active ? '0 4px 12px rgba(84,115,252,0.15)' : 'none',
            }}
          >
            {opt.icon}
            <span className="text-[0.75rem] font-semibold">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Settings Page                                                           */
/* ────────────────────────────────────────────────────────────────────────── */
export function SettingsPage() {
  usePageTitle('Settings');
  const { push, toastNode } = useToasts();
  const { user, setUser } = useAuth();
  const qc = useQueryClient();

  const [orgForm, setOrgForm] = useState<OrgFormState | null>(null);
  const [orgErrors, setOrgErrors] = useState<Partial<Record<keyof OrgFormState, string>>>({});
  const [pwdForm, setPwdForm] = useState<PasswordFormState>(INITIAL_PASSWORD_FORM);
  const [pwdErrors, setPwdErrors] = useState<Partial<Record<keyof PasswordFormState, string>>>({});
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>({
    language: user?.settings?.language || 'en',
    timezone: user?.settings?.timezone || 'UTC',
  });

  useEffect(() => {
    if (user?.settings) {
      setSettingsForm((prev) => ({
        language: user.settings?.language || prev.language,
        timezone: user.settings?.timezone || prev.timezone,
      }));
    }
  }, [user]);

  const org = useQuery({
    queryKey: ['org-me'],
    queryFn: organizationsApi.me,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (org.data && !orgForm) {
      const orgData = org.data as Organization;
      setOrgForm({
        name: orgData.name,
        email: orgData.email,
        phone: orgData.phone || '',
      });
    }
  }, [org.data, orgForm]);

  const saveOrg = useMutation({
    mutationFn: () => {
      if (!orgForm) throw new Error('Organization form not initialized');
      return organizationsApi.update(orgForm);
    },
    onSuccess: async () => {
      push('success', 'Organization updated successfully');
      qc.invalidateQueries({ queryKey: ['org-me'] });
      try {
        const me = (await authApi.me()) as User;
        setUser(me);
      } catch { /* noop */ }
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      usersApi.changePassword({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      }),
    onSuccess: () => {
      push('success', 'Password changed successfully');
      setPwdForm(INITIAL_PASSWORD_FORM);
      setPwdErrors({});
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const saveSettings = useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error('User not authenticated');
      return usersApi.updateSettings(user.id, settingsForm);
    },
    onSuccess: () => {
      push('success', 'Settings saved successfully');
      qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const validateOrgForm = useCallback((): boolean => {
    if (!orgForm) return false;
    const errors: Partial<Record<keyof OrgFormState, string>> = {};
    if (!orgForm.name.trim()) errors.name = 'Organization name is required';
    if (!orgForm.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgForm.email.trim()))
      errors.email = 'Please enter a valid email address';
    setOrgErrors(errors);
    return Object.keys(errors).length === 0;
  }, [orgForm]);

  const validatePasswordForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof PasswordFormState, string>> = {};
    if (!pwdForm.currentPassword) errors.currentPassword = 'Current password is required';
    const passwordError = validatePassword(pwdForm.newPassword);
    if (passwordError) errors.newPassword = passwordError;
    if (pwdForm.newPassword !== pwdForm.confirm) errors.confirm = 'Passwords do not match';
    setPwdErrors(errors);
    return Object.keys(errors).length === 0;
  }, [pwdForm]);

  const handleOrgChange = useCallback(
    (field: keyof OrgFormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setOrgForm((prev) => (prev ? { ...prev, [field]: e.target.value } : prev));
        setOrgErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handlePwdChange = useCallback(
    (field: keyof PasswordFormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setPwdForm((prev) => ({ ...prev, [field]: e.target.value }));
        setPwdErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSettingsChange = useCallback(
    (field: keyof SettingsFormState) =>
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSettingsForm((prev) => ({ ...prev, [field]: e.target.value }));
      },
    [],
  );

  const handleOrgSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateOrgForm()) return;
      saveOrg.mutate();
    },
    [validateOrgForm, saveOrg],
  );

  const handlePasswordSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validatePasswordForm()) return;
      changePassword.mutate();
    },
    [validatePasswordForm, changePassword],
  );

  const handleSettingsSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      saveSettings.mutate();
    },
    [saveSettings],
  );

  const { refetch: refetchOrg } = org;
  const handleRetry = useCallback(() => { void refetchOrg(); }, [refetchOrg]);

  /* ── Icons ─────────────────────────────────────────────────────────── */
  const orgIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
    </svg>
  );
  const themeIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18" fill="currentColor" stroke="none" />
    </svg>
  );
  const userIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
    </svg>
  );
  const lockIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );

  /* ── Loading ────────────────────────────────────────────────────────── */
  if (org.isLoading && !org.data) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container mx-auto max-w-3xl space-y-4">
          <PageHeader
            title="Settings"
            subtitle="Organization and account configuration"
          />
          <GlassPanel title="Loading">
            <PageLoader label="Loading settings…" />
          </GlassPanel>
        </div>
      </div>
    );
  }

  /* ── Error ──────────────────────────────────────────────────────────── */
  if (org.isError) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container mx-auto max-w-3xl space-y-4">
          <PageHeader
            title="Settings"
            subtitle="Organization and account configuration"
          />
          <GlassPanel title="Failed to load">
            <ErrorState
              title="Failed to load settings"
              message={getErrorMessage(org.error as Error)}
              onRetry={handleRetry}
            />
          </GlassPanel>
        </div>
      </div>
    );
  }

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-cyan-2" />
      <div className="orb orb-indigo-1" />
      <div className="orb orb-deep-1" />

      <div className="page-container mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Settings"
          subtitle="Organization and account configuration"
        />

        {/* ── Appearance (Theme Switcher) ────────────────────────────────── */}
        <GlassPanel
          title="Appearance"
          subtitle="Choose how M-EDU looks to you"
          icon={themeIcon}
        >
          <div className="space-y-3">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Pick a theme — your selection is saved on this device.
            </p>
            <ThemeSwitcher />
          </div>
        </GlassPanel>

        {/* ── Organization ──────────────────────────────────────────────── */}
        <GlassPanel
          title="Organization"
          subtitle="Branding and contact details for your center"
          icon={orgIcon}
        >
          {orgForm && (
            <form className="space-y-4" onSubmit={handleOrgSubmit} noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Organization name"
                  required
                  error={orgErrors.name}
                >
                  <TextInput
                    value={orgForm.name}
                    onChange={handleOrgChange('name')}
                    required
                    aria-invalid={Boolean(orgErrors.name)}
                    aria-describedby={orgErrors.name ? 'org-name-error' : undefined}
                    disabled={saveOrg.isPending}
                  />
                  {orgErrors.name && (
                    <span id="org-name-error" className="mt-1 text-xs" style={{ color: 'var(--state-error)' }}>
                      {orgErrors.name}
                    </span>
                  )}
                </Field>

                <Field label="Contact email" required error={orgErrors.email}>
                  <TextInput
                    type="email"
                    value={orgForm.email}
                    onChange={handleOrgChange('email')}
                    required
                    aria-invalid={Boolean(orgErrors.email)}
                    aria-describedby={orgErrors.email ? 'org-email-error' : undefined}
                    disabled={saveOrg.isPending}
                  />
                  {orgErrors.email && (
                    <span id="org-email-error" className="mt-1 text-xs" style={{ color: 'var(--state-error)' }}>
                      {orgErrors.email}
                    </span>
                  )}
                </Field>

                <Field label="Phone">
                  <TextInput
                    type="tel"
                    value={orgForm.phone}
                    onChange={handleOrgChange('phone')}
                    disabled={saveOrg.isPending}
                  />
                </Field>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="glass-btn glass-btn-primary"
                  disabled={saveOrg.isPending}
                >
                  {saveOrg.isPending ? 'Saving…' : 'Save organization'}
                </button>
              </div>
            </form>
          )}
        </GlassPanel>

        {/* ── Account settings ──────────────────────────────────────────── */}
        <GlassPanel
          title="Account settings"
          subtitle="Language and timezone preferences"
          icon={userIcon}
        >
          <form className="space-y-4" onSubmit={handleSettingsSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Language">
                <Select
                  value={settingsForm.language}
                  onChange={handleSettingsChange('language')}
                  aria-label="Select language"
                  disabled={saveSettings.isPending}
                >
                  {LANGUAGES.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Timezone">
                <Select
                  value={settingsForm.timezone}
                  onChange={handleSettingsChange('timezone')}
                  aria-label="Select timezone"
                  disabled={saveSettings.isPending}
                >
                  {TIMEZONES.map((timezone) => (
                    <option key={timezone.value} value={timezone.value}>
                      {timezone.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="glass-btn glass-btn-primary"
                disabled={saveSettings.isPending}
              >
                {saveSettings.isPending ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </form>
        </GlassPanel>

        {/* ── Change password ───────────────────────────────────────────── */}
        <GlassPanel
          title="Change password"
          subtitle="Use a strong password you don't reuse elsewhere"
          icon={lockIcon}
        >
          <form className="space-y-4" onSubmit={handlePasswordSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Current password" required error={pwdErrors.currentPassword}>
                <TextInput
                  type="password"
                  value={pwdForm.currentPassword}
                  onChange={handlePwdChange('currentPassword')}
                  required
                  aria-invalid={Boolean(pwdErrors.currentPassword)}
                  aria-describedby={pwdErrors.currentPassword ? 'current-password-error' : undefined}
                  autoComplete="current-password"
                  disabled={changePassword.isPending}
                />
                {pwdErrors.currentPassword && (
                  <span id="current-password-error" className="mt-1 text-xs" style={{ color: 'var(--state-error)' }}>
                    {pwdErrors.currentPassword}
                  </span>
                )}
              </Field>

              <Field label="New password" required error={pwdErrors.newPassword}>
                <TextInput
                  type="password"
                  value={pwdForm.newPassword}
                  onChange={handlePwdChange('newPassword')}
                  required
                  aria-invalid={Boolean(pwdErrors.newPassword)}
                  aria-describedby={pwdErrors.newPassword ? 'new-password-error' : undefined}
                  autoComplete="new-password"
                  disabled={changePassword.isPending}
                />
                {pwdErrors.newPassword && (
                  <span id="new-password-error" className="mt-1 text-xs" style={{ color: 'var(--state-error)' }}>
                    {pwdErrors.newPassword}
                  </span>
                )}
              </Field>

              <Field label="Confirm new password" required error={pwdErrors.confirm}>
                <TextInput
                  type="password"
                  value={pwdForm.confirm}
                  onChange={handlePwdChange('confirm')}
                  required
                  aria-invalid={Boolean(pwdErrors.confirm)}
                  aria-describedby={pwdErrors.confirm ? 'confirm-password-error' : undefined}
                  autoComplete="new-password"
                  disabled={changePassword.isPending}
                />
                {pwdErrors.confirm && (
                  <span id="confirm-password-error" className="mt-1 text-xs" style={{ color: 'var(--state-error)' }}>
                    {pwdErrors.confirm}
                  </span>
                )}
              </Field>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="glass-btn glass-btn-primary"
                disabled={changePassword.isPending}
              >
                {changePassword.isPending ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </form>
        </GlassPanel>
      </div>

      {toastNode}
    </div>
  );
}
