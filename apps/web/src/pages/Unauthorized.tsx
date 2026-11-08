/**
 * UnauthorizedPage — Ultra Premium Apple-Style 403 Error
 * Features soft ambient blurs, deep frosted glass container, fluid 
 * typography, high-end squircle iconography, tactile sound cues and WCAG 44px touch targets.
 */
import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { GlassButton } from '@/components/ui';

export function UnauthorizedPage() {
  const { t } = useSafeI18n();
  const navigate = useNavigate();
  const sound = usePremiumSound();

  usePageTitle(t('error.forbiddenTitle', 'Ruxsat berilmagan'));

  useEffect(() => {
    sound.playFaceIdDenied?.();
  }, [sound]);

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-transparent p-4 selection:bg-brand-500/30">
      {/* Soft Apple-style Background Ambient Orbs (Warning Theme) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-[20%] top-[10%] h-[40%] w-[40%] rounded-full bg-rose-500/10 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[20%] h-[50%] w-[30%] rounded-full bg-amber-500/10 blur-[100px]" />
      </div>

      {/* Main Glass Card */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }}
        className="relative z-10 w-full max-w-[28rem] overflow-hidden rounded-[2.5rem] bg-white/70 p-8 text-center shadow-[0_20px_50px_-15px_rgba(15,23,42,0.12),inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-inset ring-white/80 backdrop-blur-xl backdrop-saturate-[1.8] dark:bg-white/[0.04] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.08)] dark:ring-white/[0.08] sm:p-10"
      >
        {/* Specular top sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
        />

        {/* Ambient inner beam */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-gradient-to-b from-white/60 to-transparent blur-xl dark:from-white/[0.06]"
        />

        <div className="relative z-10">
          {/* iOS Squircle Icon Container */}
          <div className="group relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem]">
            {/* Ambient inner glow */}
            <div className="absolute inset-0 rounded-[1.5rem] bg-amber-500/20 blur-xl transition-all duration-500 group-hover:blur-2xl" />

            {/* Surface */}
            <div className="relative flex h-full w-full items-center justify-center rounded-[1.5rem] border border-white/60 bg-gradient-to-b from-amber-500/10 to-rose-500/10 shadow-inner ring-1 ring-inset ring-amber-500/20 transition-transform duration-500 group-hover:scale-105 dark:border-white/10">
              <svg
                className="h-9 w-9 text-amber-600 dark:text-amber-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
          </div>

          {/* Typography */}
          <h1 className="mb-2 bg-gradient-to-b from-gray-900 to-gray-500 bg-clip-text text-[4rem] font-black leading-none tracking-tighter text-transparent drop-shadow-sm dark:from-white dark:to-gray-500">
            403
          </h1>
          <h2 className="mb-3 text-[1.25rem] font-extrabold tracking-tight text-[var(--text-primary)]">
            {t('unauthorized.heading', 'Kirish taqiqlangan')}
          </h2>
          <p className="mx-auto mb-8 max-w-[20rem] text-[0.92rem] font-medium leading-relaxed text-[var(--text-secondary)]">
            {t('unauthorized.description', 'Sizda ushbu sahifani ko‘rish uchun yetarli huquqlar mavjud emas. Administratorga murojaat qiling.')}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <GlassButton
              type="button"
              variant="primary"
              size="md"
              className="w-full sm:w-auto min-h-[44px]"
              onClick={() => {
                sound.playTick?.();
                navigate(-1);
              }}
            >
              <svg
                className="mr-1.5 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5m7 7l-7-7 7-7" />
              </svg>
              {t('unauthorized.goBack', 'Orqaga qaytish')}
            </GlassButton>

            <GlassButton
              type="button"
              variant="secondary"
              size="md"
              className="w-full sm:w-auto min-h-[44px]"
              onClick={() => {
                sound.playTick?.();
                navigate('/');
              }}
            >
              <svg
                className="mr-1.5 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {t('nav.dashboard', 'Bosh sahifa')}
            </GlassButton>
          </div>

          <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
            Hisobni almashtirish kerakmi?{' '}
            <Link
              to="/login"
              onClick={() => sound.playTick?.()}
              className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              {t('auth.login', 'Qayta kirish')}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default UnauthorizedPage;
