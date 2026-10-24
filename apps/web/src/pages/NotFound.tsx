import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassButton } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';

/**
 * 404 page — shown for unknown routes inside the authenticated app shell.
 * Includes an actionable back-to-dashboard link and the request context
 * (current URL) so users never feel stranded.
 */
export function NotFoundPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('error.notFoundTitle'));

  return (
    <div className="page-container relative flex min-h-[75vh] items-center justify-center px-4">
      {/* Ambient soft glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-brand-500/10 blur-[100px] dark:bg-brand-500/15"
      />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[2.25rem] bg-white/65 p-8 text-center shadow-[0_20px_50px_-15px_rgba(15,23,42,0.12),inset_0_1px_0_0_rgba(255,255,255,0.85)] ring-1 ring-inset ring-white/70 backdrop-blur-md backdrop-saturate-[1.8] dark:bg-white/[0.04] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.08)] dark:ring-white/[0.08] sm:p-10"
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

        {/* Squircle warning icon */}
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-brand-500/15 to-indigo-500/15 text-brand-600 shadow-inner ring-1 ring-inset ring-brand-500/20 dark:text-brand-400">
          <svg
            className="h-8 w-8"
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

        <p className="mt-6 text-5xl font-black tracking-tight text-[var(--text-primary)]">
          404
        </p>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-[var(--text-primary)]">
          {t('notFound.heading')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          {t('notFound.description')}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <GlassButton asChild variant="primary" size="md" className="w-full sm:w-auto">
            <Link to="/">
              {t('notFound.backToDashboard')}
            </Link>
          </GlassButton>
          <Link
            to="/"
            className="inline-flex items-center text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            {t('notFound.goHome')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default NotFoundPage;
