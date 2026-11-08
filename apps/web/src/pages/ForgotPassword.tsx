/**
 * M-EDU ForgotPasswordPage — iOS 27 / visionOS Spatial Liquid Glass Edition
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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

export function ForgotPasswordPage() {
  const { t } = useSafeI18n();
  const sound = usePremiumSound();
  usePageTitle(t('forgotPassword.heading', 'Parolni tiklash'));

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setError('');
    setBusy(true);
    sound.playTick?.();
    try {
      await authApi.forgotPassword(email.trim());
      sound.playSuccess?.();
      setDone(true);
    } catch (err: unknown) {
      sound.playError?.();
      const apiErr = err as ApiError;
      setError(friendlyHttpMessage(apiErr.status, apiErr.message) || t('login.genericError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={t('forgotPassword.heading', 'Parolni unutdingizmi?')}
      subtitle={t('forgotPassword.subtitle', 'Elektron pochtangizni kiriting, biz sizga parolni tiklash havolasini yuboramiz.')}
    >
      <div className="space-y-4">
        {done ? (
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
                {t('forgotPassword.success', 'Tiklash havolasi elektron pochtangizga yuborildi!')}
              </p>
            </div>

            <GlassButton
              asChild
              variant="primary"
              size="lg"
              className="h-12 w-full rounded-2xl text-[15px] font-semibold"
            >
              <Link to="/login" onClick={() => sound.playTick?.()}>
                {t('auth.backToSignIn', 'Tizimga kirish')}
              </Link>
            </GlassButton>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <GlassInput
              id="forgot-email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              label={t('auth.email', 'Email')}
              placeholder="name@school.uz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="h-11 text-[15px]"
              inputPrefix={
                <svg
                  className="h-4 w-4 text-slate-400 dark:text-slate-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="20" height="16" x="2" y="4" rx="3" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              }
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
              disabled={busy || !email.trim()}
              aria-busy={busy}
              variant="primary"
              size="lg"
              className="h-12 w-full rounded-2xl text-[15px] font-semibold shadow-[0_12px_28px_-6px_rgba(0,122,255,0.48)] active:scale-[0.985]"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  <span>{t('forgotPassword.sending', 'Yuborilmoqda...')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span>{t('forgotPassword.submit', 'Tiklash havolasini yuborish')}</span>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              )}
            </GlassButton>
          </form>
        )}

        {/* Notice for username-only accounts managed by Platform Owner */}
        <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.03] p-3.5 text-left">
          <div className="flex items-start gap-2.5">
            <svg className="h-4 w-4 shrink-0 mt-0.5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <div className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">Muhim eslatma: </span>
              M-EDU tizimida xavfsizlik talablariga binoan faqat foydalanuvchi nomi (username) orqali ro‘yxatga olingan bo‘lsangiz yoki email biriktirilmagan bo‘lsa, parolingizni xavfsiz yangilab berishi uchun <strong>Platforma Administratori (Owner)</strong> bilan bog‘laning.
            </div>
          </div>
        </div>

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

export default ForgotPasswordPage;
