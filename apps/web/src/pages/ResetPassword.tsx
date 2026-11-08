/**
 * M-EDU ResetPasswordPage — iOS 27 / visionOS Spatial Liquid Glass Edition
 */
import { useEffect, useState, type FormEvent, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi, friendlyHttpMessage, type ApiError } from '@/lib/api';
import { GlassButton, GlassInput } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { AuthLayout } from '@/layouts/AuthLayout';

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
      <path d="M12 2.75a9.25 9.25 0 0 1 9.25 9.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="opacity-95" />
    </svg>
  );
}

function Eye({ off }: { off: boolean }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {off ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="m2 2 20 20" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export function ResetPasswordPage() {
  const { t } = useSafeI18n();
  const sound = usePremiumSound();
  usePageTitle(t('resetPassword.heading', 'Yangi parol o‘rnatish'));
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
      sound.playError?.();
      setError(t('resetPassword.invalidToken', 'Parolni tiklash havolasi yaroqsiz yoki muddati o‘tgan.'));
    }
  }, [hasToken, t, sound]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      sound.playError?.();
      setError(t('auth.passwordMinLength', { min: 8 }, 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak.'));
      return;
    }

    if (password !== confirm) {
      sound.playError?.();
      setError(t('auth.passwordsDoNotMatch', 'Parollar mos kelmadi.'));
      return;
    }

    setBusy(true);
    sound.playTick?.();
    try {
      await authApi.resetPassword(token, password);
      sound.playSuccess?.();
      setDone(true);
    } catch (err: unknown) {
      sound.playError?.();
      const apiErr = err as ApiError;
      setError(friendlyHttpMessage(apiErr.status, apiErr.message) || t('login.genericError'));
    } finally {
      setBusy(false);
    }
  }, [password, confirm, token, t, sound]);

  return (
    <AuthLayout
      title={t('resetPassword.heading', 'Yangi parol o‘rnatish')}
      subtitle={t('resetPassword.linkValid', 'Iltimos, xavfsiz va yangi parolingizni kiriting.')}
    >
      <div className="space-y-4">
        {!hasToken ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-[14px] font-medium text-amber-600 dark:text-amber-400">
              {t('resetPassword.invalidToken', 'Parolni tiklash havolasi yaroqsiz yoki muddati o‘tgan.')}
            </div>
            <GlassButton
              asChild
              variant="primary"
              size="lg"
              className="h-12 w-full rounded-2xl text-[15px] font-semibold"
            >
              <Link to="/forgot-password" onClick={() => sound.playTick?.()}>
                {t('resetPassword.requestNewLink', 'Yangi havola so‘rash')}
              </Link>
            </GlassButton>
          </motion.div>
        ) : done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-[14px] font-medium text-emerald-600 shadow-sm dark:bg-emerald-500/15 dark:text-emerald-400">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <p className="leading-snug">
                {t('resetPassword.success', 'Parolingiz muvaffaqiyatli yangilandi!')}
              </p>
            </div>
            <GlassButton
              asChild
              variant="primary"
              size="lg"
              className="h-12 w-full rounded-2xl text-[15px] font-semibold"
            >
              <Link to="/login" onClick={() => sound.playTick?.()}>
                {t('auth.login', 'Tizimga kirish')}
              </Link>
            </GlassButton>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <GlassInput
              id="reset-password"
              type={showPw ? 'text' : 'password'}
              required
              autoFocus
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              label={t('settings.newPassword', 'Yangi parol (kamida 8 ta belgi)')}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="h-11 text-[15px]"
              inputSuffix={
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    sound.playTick?.();
                    setShowPw((v) => !v);
                  }}
                  disabled={busy}
                  aria-label={showPw ? t('auth.hidePassword', 'Parolni yashirish') : t('auth.showPassword', 'Parolni ko‘rsatish')}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <Eye off={showPw} />
                </button>
              }
            />

            <GlassInput
              id="reset-confirm"
              type={showPw ? 'text' : 'password'}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              label={t('auth.confirmPassword', 'Parolni tasdiqlang')}
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
              className="h-11 text-[15px]"
            />

            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-apple-red/25 bg-apple-red/[0.08] p-3 text-[13px] font-medium text-apple-red"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.25 1.25 0 0 1 1.25 1.25v5a1.25 1.25 0 0 1-2.5 0v-5A1.25 1.25 0 0 1 12 7Zm0 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
                  </svg>
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <GlassButton
              type="submit"
              disabled={busy || !password || !confirm}
              aria-busy={busy}
              variant="primary"
              size="lg"
              className="h-12 w-full rounded-2xl text-[15px] font-semibold shadow-[0_12px_28px_-6px_rgba(0,122,255,0.48)] active:scale-[0.985]"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  <span>{t('resetPassword.resetting', 'Yangilanmoqda...')}</span>
                </span>
              ) : (
                t('resetPassword.submit', 'Parolni saqlash')
              )}
            </GlassButton>
          </form>
        )}

        <div className="pt-2 text-center">
          <Link
            to="/login"
            onClick={() => sound.playTick?.()}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            <span>{t('auth.backToSignIn', 'Tizimga qaytish')}</span>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
