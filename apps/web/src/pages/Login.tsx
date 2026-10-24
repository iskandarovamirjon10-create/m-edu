/**
 * M-EDU Login — Apple VisionOS / macOS Sequoia Liquid Glass Edition
 *
 * Clean, distraction-free authentication experience:
 *  · Focused exclusively on email/password credentials
 *  · Responsive Liquid Glass UI with optical rim highlights
 *  · Integrated floating language switcher (uz, ru, en) and theme toggle (light/dark) via AuthLayout
 *  · Instant input validation, CapsLock detection, defensive password clearing
 *  · Zero visual clutter (removed third-party sign-in, noisy badges, and enterprise callout)
 *  · Exports `LoginPage` (named + default) and `googleOAuthUrl` for contract stability
 */
import { useCallback, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { AuthError, useAuth } from '@/auth/AuthContext';
import { GlassButton, GlassInput } from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { AuthLayout } from '@/layouts/AuthLayout';

/** Backend OAuth initiation endpoint (preserved for contract stability). */
export const googleOAuthUrl = '/api/auth/google';

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
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
  const { t } = useSafeI18n();
  const { login } = useAuth();
  usePageTitle(t('login.heading'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const canSubmit = Boolean(email) && Boolean(password) && !busy;

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

  const trackCapsLock = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLock(e.getModifierState('CapsLock'));
    }
  }, []);

  return (
    <AuthLayout title={t('login.heading')} subtitle={t('login.subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* ── Error Notification ─────────────────────────────────── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-apple-red/25 bg-apple-red/10 px-3.5 py-3 text-[13px] font-medium text-apple-red shadow-sm backdrop-blur-md"
          >
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-apple-red" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.25 1.25 0 0 1 1.25 1.25v5a1.25 1.25 0 0 1-2.5 0v-5A1.25 1.25 0 0 1 12 7Zm0 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
            </svg>
            <span className="flex-1 leading-snug">{error}</span>
          </motion.div>
        )}

        {/* ── Email Field ────────────────────────────────────────── */}
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
          disabled={busy}
          className="h-11 text-[15px]"
        />

        {/* ── Password Field ─────────────────────────────────────── */}
        <div className="space-y-1.5">
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
            disabled={busy}
            className="h-11 text-[15px]"
            inputSuffix={
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPassword((v) => !v)}
                disabled={busy}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                className="flex h-7 w-7 items-center justify-center rounded-md text-surface-500 transition-colors hover:bg-black/5 hover:text-surface-700 dark:hover:bg-white/10 dark:hover:text-surface-300"
              >
                <EyeIcon off={showPassword} />
              </button>
            }
          />
          {capsLock && (
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-apple-orange">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              {t('login.capsLock')}
            </p>
          )}
        </div>

        {/* ── Forgot Password Link ───────────────────────────────── */}
        <div className="flex justify-end pt-0.5">
          <Link
            to="/forgot-password"
            className="text-[13px] font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            {t('auth.forgotPassword')}
          </Link>
        </div>

        {/* ── Submit Action ──────────────────────────────────────── */}
        <div className="pt-2">
          <GlassButton
            type="submit"
            variant="primary"
            size="lg"
            disabled={!canSubmit}
            aria-busy={busy}
            className="h-12 w-full text-[15px] font-semibold tracking-[-0.01em] shadow-[0_8px_20px_-6px_rgba(0,122,255,0.45)] active:scale-[0.985] transition-all"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> {t('login.continue')}
              </span>
            ) : (
              t('login.continue')
            )}
          </GlassButton>
        </div>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
