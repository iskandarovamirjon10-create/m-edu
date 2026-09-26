import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
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
  GlassButton,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import { TelegramIntegration } from '@/components/TelegramIntegration';
import type { Organization, User } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { useI18n, isLocale } from '@/i18n/I18nProvider';

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

// Interface languages (i18n). uz/ru/en match the i18n dictionaries;
// the Organization-level `language` field remains a server-side default.
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'uz', label: 'Oʻzbekcha' },
  { value: 'ru', label: 'Русский' },
];

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
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const persist = usePersistSettings();

  const choose = (next: Theme) => {
    setTheme(next);
    // Theme is server-backed user data, not device cache: publish it so the
    // same account comes back in the same theme on another browser/device.
    persist({ theme: next });
  };

  const options: { value: Theme; label: string; icon: ReactNode }[] = [
    {
      value: 'light',
      label: t('settings.themeLight'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: t('settings.themeDark'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: t('common.system'),
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
      aria-label={t('a11y.themeSelection')}
    >
      {options.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(opt.value)}
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
  const { setLocale, locale, t } = useI18n();
  usePageTitle(t('settings.title'));
  const { push, toastNode } = useToasts();
  const { user, setUser, hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole('SUPER_ADMIN', 'ORG_ADMIN');
  const qc = useQueryClient();

  const [orgForm, setOrgForm] = useState<OrgFormState | null>(null);
  const [orgErrors, setOrgErrors] = useState<Partial<Record<keyof OrgFormState, string>>>({});
  const [pwdForm, setPwdForm] = useState<PasswordFormState>(INITIAL_PASSWORD_FORM);
  const [pwdErrors, setPwdErrors] = useState<Partial<Record<keyof PasswordFormState, string>>>({});
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>({
    language: locale,
    timezone: user?.settings?.timezone || 'UTC',
  });

  // Adopt the server language only when the browser has no stored choice yet
  // (fresh device). Local `medu-lang` always wins — never snap the UI back to
  // the server default when the user (or navbar switcher) already picked one.
  const adoptedServerLang = useRef(false);
  useEffect(() => {
    if (adoptedServerLang.current) return;
    const lang = user?.settings?.language;
    if (!lang || !isLocale(lang)) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem('medu-lang');
    } catch {
      stored = null;
    }
    if (stored) {
      adoptedServerLang.current = true;
      return;
    }
    adoptedServerLang.current = true;
    setLocale(lang);
    setSettingsForm((prev) => ({ ...prev, language: lang }));
  }, [user?.settings?.language, setLocale]);

  // Keep the language form field aligned with the live locale (navbar or
  // Settings select) so the control never shows a stale value.
  useEffect(() => {
    setSettingsForm((prev) => (prev.language === locale ? prev : { ...prev, language: locale }));
  }, [locale]);

  useEffect(() => {
    if (user?.settings) {
      setSettingsForm((prev) => ({
        language: locale,
        timezone: user.settings?.timezone || prev.timezone,
      }));
    }
  }, [user, locale]);

  const org = useQuery({
    queryKey: ['org-me'],
    queryFn: organizationsApi.me,
    enabled: isAdmin,
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
      push('success', t('settings.orgUpdated'));
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
      push('success', t('settings.passwordChanged'));
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
      push('success', t('settings.saved'));
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
        const value = e.target.value;
        setSettingsForm((prev) => ({ ...prev, [field]: value }));
        // Language applies to the live UI immediately; Save persists it.
        if (field === 'language' && isLocale(value)) {
          setLocale(value);
        }
      },
    [setLocale],
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
  const telegramIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 3.5 2.8 10.6l5.2 1.6 1.6 5.2 3-3.6 4.9 3.4z" />
      <path d="M8 12.2 16.9 6.4l-5 8.2" />
    </svg>
  );
  /* ── Loading ────────────────────────────────────────────────────────── */
  if (isAdmin && org.isLoading && !org.data) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container mx-auto max-w-3xl space-y-4">
          <PageHeader
            title={t('settings.title')}
            subtitle={t('settings.subtitle')}
          />
          <GlassPanel title={t('common.loading')}>
            <PageLoader label={t('settings.loading')} />
          </GlassPanel>
        </div>
      </div>
    );
  }

  /* ── Error ──────────────────────────────────────────────────────────── */
  if (isAdmin && org.isError) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container mx-auto max-w-3xl space-y-4">
          <PageHeader
            title={t('settings.title')}
            subtitle={t('settings.subtitle')}
          />
          <GlassPanel title={t('settings.loadFailed')}>
            <ErrorState
              title={t('settings.loadFailed')}
              message={getErrorMessage(org.error as Error)}
              onRetry={handleRetry}
            />
          </GlassPanel>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "contents" }}>

      <div className="page-container mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={t('settings.title')}
          subtitle={t('settings.subtitle')}
        />

        {/* ── Appearance (Theme Switcher) ────────────────────────────────── */}
        <GlassPanel
          title={t('settings.appearance')}
          subtitle={t('settings.appearanceHint')}
          icon={themeIcon}
        >
          <div className="space-y-3">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('settings.themeHint')}
            </p>
            <ThemeSwitcher />
          </div>
        </GlassPanel>

        {/* ── Integrations: Telegram (self-service for every role) ──────── */}
        <GlassPanel
          title={t('settings.telegram.title')}
          subtitle={t('settings.telegram.subtitle')}
          icon={telegramIcon}
        >
          <TelegramIntegration />
        </GlassPanel>

        {/* ── Organization ──────────────────────────────────────────────── */}
        {isAdmin && (
          <GlassPanel
            title={t('settings.organization')}
            subtitle={t('settings.organizationHint')}
            icon={orgIcon}
          >
            {orgForm && (
              <form className="space-y-4" onSubmit={handleOrgSubmit} noValidate>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label={t('settings.orgName')}
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

                  <Field label={t('settings.contactEmail')} required error={orgErrors.email}>
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

                  <Field label={t('settings.phone')}>
                    <TextInput
                      type="tel"
                      value={orgForm.phone}
                      onChange={handleOrgChange('phone')}
                      disabled={saveOrg.isPending}
                    />
                  </Field>
                </div>

                <div className="flex justify-end pt-2">
                  <GlassButton
                    type="submit"
                    variant="primary"
                    disabled={saveOrg.isPending}
                  >
                    {saveOrg.isPending ? t('common.saving') : t('settings.saveOrg')}
                  </GlassButton>
                </div>
              </form>
            )}
          </GlassPanel>
        )}

        {/* ── Account settings ──────────────────────────────────────────── */}
        <GlassPanel
          title={t('settings.account')}
          subtitle={t('settings.accountHint')}
          icon={userIcon}
        >
          <form className="space-y-4" onSubmit={handleSettingsSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('settings.language')}>
                <Select
                  value={settingsForm.language}
                  onChange={handleSettingsChange('language')}
                  aria-label={t('settings.language')}
                  disabled={saveSettings.isPending}
                >
                  {LANGUAGES.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('settings.timezone')}>
                <Select
                  value={settingsForm.timezone}
                  onChange={handleSettingsChange('timezone')}
                  aria-label={t('settings.timezone')}
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
              <GlassButton
                type="submit"
                variant="primary"
                disabled={saveSettings.isPending}
              >
                {saveSettings.isPending ? t('common.saving') : t('settings.save')}
              </GlassButton>
            </div>
          </form>
        </GlassPanel>

        {/* ── Change password ───────────────────────────────────────────── */}
        <GlassPanel
          title={t('settings.changePassword')}
          subtitle={t('settings.changePasswordHint')}
          icon={lockIcon}
        >
          <form className="space-y-4" onSubmit={handlePasswordSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t('settings.currentPassword')} required error={pwdErrors.currentPassword}>
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

              <Field label={t('settings.newPassword')} required error={pwdErrors.newPassword}>
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

              <Field label={t('settings.confirmPassword')} required error={pwdErrors.confirm}>
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
              <GlassButton
                type="submit"
                variant="primary"
                disabled={changePassword.isPending}
              >
                {changePassword.isPending ? t('common.saving') : t('settings.changePasswordAction')}
              </GlassButton>
            </div>
          </form>
        </GlassPanel>
      </div>

      {toastNode}
    </div>
  );
}
