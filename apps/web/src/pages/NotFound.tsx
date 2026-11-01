/**
 * M-EDU 404 NotFoundPage — Ultra-Luxury VisionOS / Apple Glass Edition
 * Features ambient soft glow, specular light beams, location context badge,
 * tactile sound triggers, history navigate(-1), and instant quick-jump navigation pills.
 */

import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassButton } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';

interface QuickDestination {
  label: string;
  path: string;
  icon: string;
}

const QUICK_DESTINATIONS: QuickDestination[] = [
  { label: 'Guruhlar', path: '/groups', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { label: 'O‘quvchilar', path: '/students', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { label: 'Dars jadvali', path: '/schedule', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { label: 'AI Yordamchi', path: '/ai-copilot', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
];

export function NotFoundPage() {
  const { t } = useSafeI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const sound = usePremiumSound();

  usePageTitle(t('error.notFoundTitle', 'Sahifa topilmadi'));

  // Soft subdued error chime on mount
  useEffect(() => {
    sound.playError?.();
  }, [sound]);

  return (
    <div className="page-container relative flex min-h-[80vh] items-center justify-center px-4 py-8">
      {/* Ambient soft glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-80 w-80 rounded-full bg-gradient-to-tr from-rose-500/10 via-brand-500/15 to-indigo-500/15 blur-[120px] dark:from-rose-500/15 dark:to-indigo-500/20"
      />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-white/70 p-8 text-center shadow-[0_20px_50px_-15px_rgba(15,23,42,0.12),inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-inset ring-white/80 backdrop-blur-xl backdrop-saturate-[1.8] dark:bg-white/[0.04] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.08)] dark:ring-white/[0.08] sm:p-10"
      >
        {/* Specular top sheen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
        />

        {/* Ambient inner beam */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-gradient-to-b from-white/60 to-transparent blur-xl dark:from-white/[0.06]"
        />

        {/* Squircle warning icon */}
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-b from-amber-500/15 to-rose-500/15 text-amber-600 shadow-inner ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
          <svg
            className="h-10 w-10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <p className="mt-6 bg-gradient-to-b from-slate-900 to-slate-600 bg-clip-text text-5xl font-black tracking-tight text-transparent drop-shadow-sm dark:from-white dark:to-slate-400">
          404
        </p>

        <h1 className="mt-2 text-xl font-bold tracking-tight text-[var(--text-primary)]">
          {t('notFound.heading', 'Sahifa topilmadi')}
        </h1>

        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
          {t('notFound.description', 'Siz izlayotgan sahifa mavjud emas yoki boshqa manzilga ko‘chirilgan.')}
        </p>

        {/* Pathname debug badge */}
        {location.pathname && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-black/[0.03] px-3 py-1 font-mono text-[11px] text-[var(--text-muted)] dark:border-white/[0.08] dark:bg-white/[0.04]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="truncate max-w-[260px]">{location.pathname}</span>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
            asChild
            variant="secondary"
            size="md"
            className="w-full sm:w-auto min-h-[44px]"
          >
            <Link
              to="/"
              onClick={() => sound.playTick?.()}
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
              {t('notFound.backToDashboard', 'Bosh sahifa')}
            </Link>
          </GlassButton>
        </div>

        {/* Quick Jump Section */}
        <div className="mt-8 border-t border-black/[0.06] pt-6 dark:border-white/[0.08]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Tezkor o‘tish bo‘limlari
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUICK_DESTINATIONS.map((dest) => (
              <Link
                key={dest.path}
                to={dest.path}
                onClick={() => sound.playPop?.()}
                className="group flex min-h-[44px] flex-col items-center justify-center rounded-2xl border border-black/[0.05] bg-white/40 p-2.5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-black/[0.1] hover:bg-white/80 hover:shadow-sm active:scale-95 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/[0.12] dark:hover:bg-white/[0.06]"
              >
                <svg
                  className="h-4 w-4 text-[var(--text-secondary)] transition-colors group-hover:text-brand-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={dest.icon} />
                </svg>
                <span className="mt-1 text-[11.5px] font-medium text-[var(--text-primary)] transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400">
                  {dest.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default NotFoundPage;
