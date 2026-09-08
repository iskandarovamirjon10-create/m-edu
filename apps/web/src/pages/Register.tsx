import { useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { useAuth } from '@/auth/AuthContext';
import { GlassInput } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';

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

function validatePassword(password: string): string | undefined {
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  return undefined;
}

export function RegisterPage() {
  usePageTitle('Create Account');
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);

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
      newErrors.firstName = 'First name is required';
    }
    if (!form.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(form.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!form.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required';
    }
    const passwordError = validatePassword(form.password);
    if (passwordError) {
      newErrors.password = passwordError;
    }
    if (form.password !== form.confirm) {
      newErrors.confirm = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError('');

      if (!validateForm()) {
        return;
      }

      setBusy(true);
      try {
        await register({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          organizationName: form.organizationName.trim(),
          password: form.password,
        });
        navigate('/', { replace: true });
      } catch (err) {
        setSubmitError(
          err instanceof ApiError
            ? getErrorMessage(err)
            : 'Registration failed. Please try again.',
        );
      } finally {
        setBusy(false);
      }
    },
    [form, validateForm, register, navigate],
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

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your education center in minutes"
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
            label="First name"
            required
            error={errors.firstName}
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            aria-invalid={Boolean(errors.firstName)}
            aria-describedby={errors.firstName ? 'firstname-error' : undefined}
            placeholder="John"
            autoComplete="given-name"
            disabled={busy}
          />
          {errors.firstName && (
            <span id="firstname-error" className="text-sm" style={{ color: 'var(--state-error)' }}>
              {errors.firstName}
            </span>
          )}

          <GlassInput
            label="Last name"
            required
            error={errors.lastName}
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            aria-invalid={Boolean(errors.lastName)}
            aria-describedby={errors.lastName ? 'lastname-error' : undefined}
            placeholder="Doe"
            autoComplete="family-name"
            disabled={busy}
          />
          {errors.lastName && (
            <span id="lastname-error" className="text-sm" style={{ color: 'var(--state-error)' }}>
              {errors.lastName}
            </span>
          )}
        </div>

        <GlassInput
          label="Email address"
          required
          error={errors.email}
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          placeholder="john@example.com"
          autoComplete="email"
          disabled={busy}
        />
        {errors.email && (
          <span id="email-error" className="text-sm" style={{ color: 'var(--state-error)' }}>
            {errors.email}
          </span>
        )}

        <GlassInput
          label="Organization name"
          required
          hint="The name of your education center."
          error={errors.organizationName}
          value={form.organizationName}
          onChange={(e) => set('organizationName', e.target.value)}
          aria-invalid={Boolean(errors.organizationName)}
          aria-describedby={errors.organizationName ? 'org-error' : undefined}
          placeholder="Bright Future Academy"
          disabled={busy}
        />
        {errors.organizationName && (
          <span id="org-error" className="text-sm" style={{ color: 'var(--state-error)' }}>
            {errors.organizationName}
          </span>
        )}

        <GlassInput
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+998 90 123 4567"
          autoComplete="tel"
          disabled={busy}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GlassInput
            label="Password"
            required
            hint="At least 8 characters with uppercase and number."
            error={errors.password}
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            autoComplete="new-password"
            disabled={busy}
          />
          {errors.password && (
            <span id="password-error" className="text-sm" style={{ color: 'var(--state-error)' }}>
              {errors.password}
            </span>
          )}

          <GlassInput
            label="Confirm password"
            required
            error={errors.confirm}
            type="password"
            value={form.confirm}
            onChange={(e) => set('confirm', e.target.value)}
            aria-invalid={Boolean(errors.confirm)}
            aria-describedby={errors.confirm ? 'confirm-error' : undefined}
            autoComplete="new-password"
            disabled={busy}
          />
          {errors.confirm && (
            <span id="confirm-error" className="text-sm" style={{ color: 'var(--state-error)' }}>
              {errors.confirm}
            </span>
          )}
        </div>

        <button
          type="submit"
          className="glass-btn glass-btn-primary w-full"
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
              Creating account…
            </span>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium underline-offset-[3px] hover:underline"
          style={{ color: 'var(--m-vivid)' }}
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
