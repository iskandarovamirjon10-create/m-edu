/**
 * M-EDU ResetPasswordPage — Apple Premium Liquid Glass Edition
 */

import { useEffect, useState, type FormEvent, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authApi, friendlyHttpMessage, type ApiError } from '@/lib/api';
import { GlassButton, GlassInput } from '@/components/ui';
import { MeduLogo } from '@/components/brand/MeduLogo';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';

function Backdrop() {
  return (
    <div
      aria-hidden
      className="orb-container pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="orb orb-cyan-1" />
      <div className="orb orb-cyan-2" />
      <div className="orb orb-indigo-1" />
      <div className="orb orb-deep-1" />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Eye({ off }: { off: boolean }) {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

export function ResetPasswordPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('resetPassword.heading') || 'Reset Password');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('t') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const hasToken = Boolean(token && token.length > 10);

  useEffect(() => {
    if (!hasToken) {
      setError(t('resetPassword.invalidToken') || 'Parolni tiklash havolasi yaroqsiz yoki muddati o\'tgan.');
    }
  }, [hasToken, t]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('auth.passwordMinLength', { min: 8 }) || 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak.');
      return;
    }

    if (password !== confirm) {
      setError(t('auth.passwordsDoNotMatch') || 'Parollar mos kelmadi.');
      return;
    }

    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(friendlyHttpMessage(apiErr.status, apiErr.message));
    } finally {
      setBusy(false);
    }
  }, [password, confirm, token, t]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12">
      <Backdrop />
      <motion.main
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <section className="relative overflow-hidden rounded-[2.25rem] bg-white/65 p-8 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.12),inset_0_1px_0_0_rgba(255,255,255,0.85)] ring-1 ring-inset ring-white/70 backdrop-blur-md backdrop-saturate-[1.8] dark:bg-white/[0.04] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.08)] dark:ring-white/[0.08] sm:p-9">
          {/* Specular top sheen */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
          />

          <MeduLogo size="lg" className="mx-auto mb-6" />

          <p className="mb-1 text-center text-[12.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            M-EDU
          </p>
          <h1 className="mb-2 text-center text-[22px] font-black tracking-tight text-[var(--text-primary)]">
            {t('resetPassword.heading')}
          </h1>
          <p className="mb-6 text-center text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
            {t('resetPassword.linkValid')}
          </p>

          {!hasToken ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-[14px] font-medium text-amber-600 dark:text-amber-400">
                {t('resetPassword.invalidToken')}
              </div>
              <GlassButton
                asChild
                variant="primary"
                className="h-[48px] w-full text-[15px] font-semibold"
              >
                <Link to="/forgot-password">
                  {t('resetPassword.requestNewLink')}
                </Link>
              </GlassButton>
            </motion.div>
          ) : done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-[14px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check />
                {t('resetPassword.success')}
              </div>
              <GlassButton
                asChild
                variant="primary"
                className="h-[48px] w-full text-[15px] font-semibold"
              >
                <Link to="/login">
                  {t('auth.login')}
                </Link>
              </GlassButton>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <GlassInput
                  type={showPw ? 'text' : 'password'}
                  required
                  autoFocus
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  placeholder={t('settings.newPassword')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  className="h-[48px] text-[15px]"
                  inputSuffix={
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowPw((v) => !v)}
                      disabled={busy}
                      aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-surface-500 transition-colors hover:bg-black/5 hover:text-surface-700 dark:hover:bg-white/10 dark:hover:text-surface-300"
                    >
                      <Eye off={showPw} />
                    </button>
                  }
                />
              </div>

              <GlassInput
                type={showPw ? 'text' : 'password'}
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                placeholder={t('auth.confirmPassword')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
                className="h-[48px] text-[15px]"
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="flex items-start gap-1.5 text-[13px] font-medium text-rose-600 dark:text-rose-400"
                >
                  <svg className="mt-[3px] h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.25 1.25 0 0 1 1.25 1.25v5a1.25 1.25 0 0 1-2.5 0v-5A1.25 1.25 0 0 1 12 7Zm0 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
                  </svg>
                  {error}
                </motion.p>
              )}

              <GlassButton
                type="submit"
                disabled={busy || !password || !confirm}
                aria-busy={busy}
                variant="primary"
                className="h-[48px] w-full text-[15px] font-semibold"
              >
                {busy ? (<><Spinner /> {t('resetPassword.resetting')}</>) : t('resetPassword.submit')}
              </GlassButton>
            </form>
          )}
        </section>

        <p className="mt-6 text-center text-[13.5px] font-medium text-[var(--text-secondary)]">
          <Link
            to="/login"
            className="font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← {t('auth.backToSignIn')}
          </Link>
        </p>
      </motion.main>
    </div>
  );
}

export default ResetPasswordPage;
