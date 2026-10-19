/**
 * UnauthorizedPage — Ultra Premium Apple-Style 403 Error
 * Features soft ambient blurs, deep frosted glass container, fluid 
 * typography, and high-end squircle iconography.
 */
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { GlassButton } from '@/components/ui';

export function UnauthorizedPage() {
  const { t } = useI18n();
  usePageTitle(t('error.forbiddenTitle'));
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-transparent p-4 selection:bg-brand-500/30">
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
        className="relative z-10 w-full max-w-[28rem] overflow-hidden rounded-[2.5rem] bg-white/65 p-10 text-center shadow-[0_20px_50px_-15px_rgba(15,23,42,0.12),inset_0_1px_0_0_rgba(255,255,255,0.85)] ring-1 ring-inset ring-white/70 backdrop-blur-md backdrop-saturate-[1.8] dark:bg-white/[0.04] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.08)] dark:ring-white/[0.08] sm:p-12"
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
                className="h-8 w-8 text-amber-600 dark:text-amber-400"
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
            {t('unauthorized.heading')}
          </h2>
          <p className="mx-auto mb-8 max-w-[17rem] text-[0.92rem] font-medium leading-relaxed text-[var(--text-secondary)]">
            {t('unauthorized.description')}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <GlassButton
              type="button"
              variant="primary"
              className="w-full sm:w-auto"
              onClick={() => navigate(-1)}
            >
              {t('unauthorized.goBack')}
            </GlassButton>
            <GlassButton
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => navigate('/')}
            >
              {t('nav.dashboard')}
            </GlassButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default UnauthorizedPage;