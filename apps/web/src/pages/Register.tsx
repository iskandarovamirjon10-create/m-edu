import { useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { useAuth, AuthError } from '@/auth/AuthContext';
import { GlassInput, GlassButton } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n, type TranslateFn } from '@/i18n/I18nProvider';

interface RegisterFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organizationName: string;
  password: string;
  confirm: string;
}

const INITIAL_FORM: RegisterFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  organizationName: '',
  password: '',
  confirm: '',
};

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  organizationName?: string;
  password?: string;
  confirm?: string;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePassword(password: string, t: TranslateFn): string | undefined {
  if (password.length < 8) {
    return `${t('auth.passwordMinLength', { min: 8 })}.`;
  }
  if (!/[A-Z]/.test(password)) {
    return t('register.passwordUppercase');
  }
  if (!/[0-9]/.test(password)) {
    return t('register.passwordNumber');
  }
  return undefined;
}

export function RegisterPage() {
  const { t } = useI18n();
  usePageTitle(t('auth.registerTitle'));
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const set = useCallback(<K extends keyof RegisterFormState>(key: K, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear field-specific error when user starts typing
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    // Clear submit error when user makes changes
    setSubmitError('');
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!form.firstName.trim()) {
      newErrors.firstName = t('teachers.form.firstNameRequired');
    }
    if (!form.lastName.trim()) {
      newErrors.lastName = t('teachers.form.lastNameRequired');
    }
    if (!form.email.trim()) {
      newErrors.email = t('hr.form.validation.emailRequired');
    } else if (!validateEmail(form.email)) {
      newErrors.email = t('register.emailInvalid');
    }
    if (!form.organizationName.trim()) {
      newErrors.organizationName = t('register.organizationRequired');
    }
    const passwordError = validatePassword(form.password, t);
    if (passwordError) {
      newErrors.password = passwordError;
    }
    if (form.password !== form.confirm) {
      newErrors.confirm = t('auth.passwordsDoNotMatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form, t]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError('');

      if (!validateForm()) {
        return;
      }

      setBusy(true);
      try {
        const res = await register({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          organizationName: form.organizationName.trim(),
          password: form.password,
        });
        if ((res as any)?.pendingApproval) {
          setPendingMessage((res as any).message || t('auth.pendingApprovalNotice'));
          return;
        }
        navigate('/', { replace: true });
      } catch (err) {
        setSubmitError(
          err instanceof ApiError || err instanceof AuthError
            ? getErrorMessage(err)
            : t('register.failed'),
        );
      } finally {
        setBusy(false);
      }
    },
    [form, validateForm, register, navigate, t],
  );

  const canSubmit = useMemo(
    () =>
      !busy &&
      form.firstName.trim() &&
      form.lastName.trim() &&
      form.email.trim() &&
      form.organizationName.trim() &&
      form.password &&
      form.confirm,
    [busy, form],
  );

  if (pendingMessage) {
    return (
      <AuthLayout
        title={t('auth.pendingTitle')}
        subtitle={t('auth.pendingSubtitle')}
      >
        <div className="text-center py-6 space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/10">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">
            {t('auth.pendingHeader')}
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
            {pendingMessage}
          </p>
          <div className="pt-4">
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl font-medium text-white transition-all duration-200 hover:brightness-110 shadow-md"
              style={{ background: 'var(--m-vivid)' }}
            >
              {t('auth.returnToLogin')}
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('register.title')}
      subtitle={t('register.subtitle')}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {submitError && (
          <div
            className="flex items-start gap-2 rounded-lg px-4 py-3 text-sm"
            style={{
              background: 'rgba(240,112,112,0.10)',
              border: '1px solid rgba(240,112,112,0.25)',
              color: 'var(--state-error)',
            }}
            role="alert"
            aria-live="assertive"
          >
            <svg
              className="h-5 w-5 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{submitError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GlassInput
            label={t('teachers.form.firstName')}
            required
            error={errors.firstName}
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            placeholder={t('register.firstNamePlaceholder')}
            autoComplete="given-name"
            disabled={busy}
          />

          <GlassInput
            label={t('teachers.form.lastName')}
            required
            error={errors.lastName}
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            placeholder={t('register.lastNamePlaceholder')}
            autoComplete="family-name"
            disabled={busy}
          />
        </div>

        <GlassInput
          label={t('auth.emailAddress')}
          required
          error={errors.email}
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="john@example.com"
          autoComplete="email"
          disabled={busy}
        />

        <GlassInput
          label={t('settings.orgName')}
          required
          hint={t('register.organizationHint')}
          error={errors.organizationName}
          value={form.organizationName}
          onChange={(e) => set('organizationName', e.target.value)}
          placeholder={t('register.organizationPlaceholder')}
          disabled={busy}
        />

        <GlassInput
          label={t('common.phone')}
          type="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+998 90 123 4567"
          autoComplete="tel"
          disabled={busy}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GlassInput
            label={t('auth.password')}
            required
            hint={t('register.passwordHint')}
            error={errors.password}
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            autoComplete="new-password"
            disabled={busy}
          />

          <GlassInput
            label={t('auth.confirmPassword')}
            required
            error={errors.confirm}
            type="password"
            value={form.confirm}
            onChange={(e) => set('confirm', e.target.value)}
            autoComplete="new-password"
            disabled={busy}
          />
        </div>

        <GlassButton
          type="submit"
          variant="primary"
          className="w-full"
          style={{ height: '50px', fontSize: '1rem' }}
          disabled={!canSubmit}
          aria-busy={busy}
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeOpacity=".25"
                  strokeWidth="2.5"
                />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              {t('register.creating')}
            </span>
          ) : (
            t('register.createAccount')
          )}
        </GlassButton>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('register.haveAccount')}{' '}
        <Link
          to="/login"
          className="font-medium underline-offset-[3px] hover:underline"
          style={{ color: 'var(--m-vivid)' }}
        >
          {t('auth.login')}
        </Link>
      </p>
    </AuthLayout>
  );
}
