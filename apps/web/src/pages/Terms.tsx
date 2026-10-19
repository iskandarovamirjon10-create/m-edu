/**
 * M-EDU TermsPage — Apple Cupertino Legal Layout
 */

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { GlassButton } from '@/components/ui';

export function TermsPage() {
  const { t } = useI18n();
  usePageTitle(t('terms.title') || 'Terms of Service');

  return (
    <div className="relative min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      {/* Ambient background glows */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-40 right-10 h-96 w-96 rounded-full bg-brand-500/10 blur-[100px] dark:bg-blue-500/15"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed top-1/2 left-10 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px] dark:bg-indigo-500/15"
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="relative z-10 mx-auto max-w-3xl overflow-hidden rounded-[2.5rem] bg-white/60 p-8 sm:p-12 ring-1 ring-inset ring-white/70 backdrop-blur-md shadow-xl dark:bg-white/[0.035] dark:ring-white/[0.08]"
      >
        <div className="mb-6 flex items-center justify-between">
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            M-EDU Legal Agreement
          </span>
          <GlassButton asChild variant="ghost" size="sm">
            <Link to="/login">← {t('auth.backToSignIn') || 'Sign In'}</Link>
          </GlassButton>
        </div>

        <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-4xl">
          {t('terms.title') || 'Terms of Service'}
        </h1>

        <div className="mt-8 space-y-6 text-[14px] leading-relaxed text-[var(--text-secondary)]">
          <p className="text-base text-[var(--text-primary)]">
            {t('terms.intro')}
          </p>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('terms.section1Title')}</h2>
            <p>{t('terms.section1Body')}</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('terms.section2Title')}</h2>
            <p>{t('terms.section2Body')}</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('terms.section3Title')}</h2>
            <p>{t('terms.section3Body')}</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('terms.section4Title')}</h2>
            <p>{t('terms.section4Body')}</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('terms.section5Title')}</h2>
            <p>{t('terms.section5Body')}</p>
          </div>

          <div className="border-t border-white/40 pt-6 text-[12px] text-[var(--text-muted)] dark:border-white/[0.06]">
            {t('terms.footer')}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default TermsPage;
