/**
 * M-EDU Login — Apple Premium
 *
 * Critical fixes in this rewrite:
 *  · Exports `LoginPage` (named + default) — previously this file exported
 *    `RegisterPage`, which broke the `/login` route (lazyPage resolved undefined)
 *    and the Login tests.
 *  · Exports `googleOAuthUrl` for the Google OAuth button + tests.
 *  · Password is cleared on failure (defensive), friendly error in role="alert",
 *    submit stays disabled until the password is re-entered.
 */
import { useCallback, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { AuthError, useAuth } from '@/auth/AuthContext';
import { GlassButton, GlassInput } from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { AuthLayout } from '@/layouts/AuthLayout';

/** Backend OAuth initiation endpoint (302 → Google with state nonce). */
export const googleOAuthUrl = '/api/auth/google';

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function EyeIcon({ off = false }: { off?: boolean }) {
  return off ? (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="m1 1 22 22" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  ) : (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function LoginPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  usePageTitle(t('login.heading'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const pending = busy || oauthPending;
  const canSubmit = Boolean(email) && Boolean(password) && !pending;

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setError('');
      setBusy(true);
      try {
        await login(email, password);
      } catch (err: unknown) {
        // Defensive: never keep a bad password in the field.
        setPassword('');
        const authErr = err instanceof AuthError ? err : null;
        const friendly =
          authErr?.code === 'INVALID_CREDENTIALS'
            ? t('login.wrongEmailOrPassword')
            : getErrorMessage(err) || t('login.genericError');
        setError(friendly);
      } finally {
        setBusy(false);
      }
    },
    [canSubmit, email, password, login, t],
  );

  const handleGoogle = useCallback(() => {
    if (pending) return;
    setError('');
    setOauthPending(true);
    // Paint the loading state first, then leave for the backend endpoint.
    setTimeout(() => {
      try {
        window.location.assign(googleOAuthUrl);
      } catch {
        /* jsdom / restricted environments: state stays "redirecting" */
      }
    }, 0);
  }, [pending]);

  const trackCapsLock = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLock(e.getModifierState('CapsLock'));
    }
  }, []);

  return (
    <AuthLayout title={t('login.heading')} subtitle={t('login.subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* ── Error ─────────────────────────────────────────────── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-apple-red/25 bg-apple-red/10 px-3.5 py-3 text-[13px] font-medium text-apple-red"
          >
            <svg className="mt-[1px] h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.25 1.25 0 0 1 1.25 1.25v5a1.25 1.25 0 0 1-2.5 0v-5A1.25 1.25 0 0 1 12 7Zm0 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
            </svg>
            <span>{error}</span>
          </motion.div>
        )}

        {/* ── Email ─────────────────────────────────────────────── */}
        <GlassInput
          id="login-email"
          type="email"
          aria-required
          autoFocus
          autoComplete="email"
          inputMode="email"
          label={t('auth.email')}
          placeholder="name@school.uz"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className="h-11 text-[15px]"
        />

        {/* ── Password ──────────────────────────────────────────── */}
        <div>
          <GlassInput
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            aria-required
            autoComplete="current-password"
            label={t('auth.password')}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={trackCapsLock}
            onKeyDown={trackCapsLock}
            disabled={pending}
            className="h-11 text-[15px]"
            inputSuffix={
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPassword((v) => !v)}
                disabled={pending}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                className="flex h-7 w-7 items-center justify-center rounded-md text-surface-500 transition-colors hover:bg-black/5 hover:text-surface-700 dark:hover:bg-white/10 dark:hover:text-surface-300"
              >
                <EyeIcon off={showPassword} />
              </button>
            }
          />
          {capsLock && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-apple-orange">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              {t('login.capsLock')}
            </p>
          )}
        </div>

        {/* ── Forgot password ───────────────────────────────────── */}
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-[13px] font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            {t('auth.forgotPassword')}
          </Link>
        </div>

        {/* ── Submit ────────────────────────────────────────────── */}
        <GlassButton
          type="submit"
          variant="primary"
          size="lg"
          disabled={!canSubmit}
          aria-busy={busy}
          className="h-12 w-full text-[15px] font-semibold"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> {t('login.continue')}
            </span>
          ) : (
            t('login.continue')
          )}
        </GlassButton>

        {/* ── Divider ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3 py-1" aria-hidden>
          <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          <span className="text-[12px] font-medium text-surface-500">{t('login.or')}</span>
          <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        </div>

        {/* ── Google OAuth ──────────────────────────────────────── */}
        <GlassButton
          type="button"
          variant="secondary"
          size="lg"
          onClick={handleGoogle}
          disabled={pending}
          aria-busy={oauthPending}
          className="h-12 w-full text-[15px] font-medium"
        >
          {oauthPending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> {t('login.redirectingGoogle')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2.5">
              <GoogleMark />
              {t('login.continueWithGoogle')}
            </span>
          )}
        </GlassButton>

        {/* ── Sign up ───────────────────────────────────────────── */}
        <p className="pt-1 text-center text-[13.5px] text-surface-600 dark:text-surface-500">
          {t('login.newTo')}{' '}
          <Link
            to="/register"
            className="font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            {t('login.createAccount')}
          </Link>
        </p>

        {/* ── Legal ─────────────────────────────────────────────── */}
        <p className="text-center text-[11.5px] leading-relaxed text-surface-500">
          {t('login.agreeTo')}{' '}
          <Link to="/terms" className="underline underline-offset-2 hover:text-surface-700 dark:hover:text-surface-300">
            {t('login.terms')}
          </Link>{' '}
          {t('login.and')}{' '}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-surface-700 dark:hover:text-surface-300">
            {t('login.privacy')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
