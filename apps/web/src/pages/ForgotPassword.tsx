import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authApi, friendlyHttpMessage, type ApiError } from '@/lib/api';
import { GlassButton, GlassInput } from '@/components/ui';
import { MeduLogo } from '@/components/brand/MeduLogo';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';

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

function Arrow() {
  return (
    <svg className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BrandMark() {
  return <MeduLogo size="lg" className="mx-auto mb-6" />;
}

export function ForgotPasswordPage() {
  const { t } = useSafeI18n();
  const sound = usePremiumSound();
  usePageTitle(t('auth.forgotPasswordTitle', 'Parolni tiklash'));

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    sound.playTick?.();
    try {
      await authApi.forgotPassword(email);
      sound.playSuccess?.();
      setDone(true);
    } catch (err: unknown) {
      sound.playError?.();
      const apiErr = err as ApiError;
      setError(friendlyHttpMessage(apiErr.status, apiErr.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-5">
      <Backdrop />
      <motion.main
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <section className="relative overflow-hidden rounded-[2.25rem] bg-white/70 p-8 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.12),inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-inset ring-white/80 backdrop-blur-xl backdrop-saturate-[1.8] dark:bg-white/[0.04] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.08)] dark:ring-white/[0.08] sm:p-9">
          {/* Specular top sheen */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
          />

          <BrandMark />

          <p className="mb-1 text-center text-[12.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {t('common.medu', 'M-EDU')}
          </p>
          <h1 className="mb-2 text-center text-[22px] font-black tracking-tight text-[var(--text-primary)]">
            {t('forgotPassword.heading', 'Parolni unutdingizmi?')}
          </h1>
          <p className="mb-6 text-center text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
            {t('forgotPassword.subtitle', 'Elektron pochtangizni kiriting, biz sizga parolni tiklash havolasini yuboramiz.')}
          </p>

          {done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-[14px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check />
                {t('forgotPassword.success', 'Tiklash havolasi elektron pochtangizga yuborildi!')}
              </div>
              <GlassButton
                asChild
                variant="primary"
                className="h-[48px] w-full text-[15px] font-semibold min-h-[44px]"
              >
                <Link to="/login" onClick={() => sound.playTick?.()}>
                  {t('auth.backToSignIn', 'Tizimga kirish')}
                </Link>
              </GlassButton>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <GlassInput
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder={t('auth.emailAddress', 'Elektron pochta manzili')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                disabled={busy || !email}
                aria-busy={busy}
                variant="primary"
                className="group h-[48px] w-full text-[15px] font-semibold min-h-[44px]"
              >
                {busy ? (
                  <>
                    <Spinner /> {t('forgotPassword.sending', 'Yuborilmoqda...')}
                  </>
                ) : (
                  <>
                    <span>{t('forgotPassword.submit', 'Tiklash havolasini yuborish')}</span>
                    <Arrow />
                  </>
                )}
              </GlassButton>
            </form>
          )}
        </section>

        <p className="mt-6 text-center text-[13.5px] font-medium text-[var(--text-secondary)]">
          <Link
            to="/login"
            onClick={() => sound.playTick?.()}
            className="inline-flex min-h-[44px] items-center font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← {t('auth.backToSignIn', 'Tizimga qaytish')}
          </Link>
        </p>
      </motion.main>
    </div>
  );
}

export default ForgotPasswordPage;
