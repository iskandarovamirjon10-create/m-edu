/**
 * M-EDU Universal Search Page
 * Global search across students, teachers, groups, courses, lessons, and financial records.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import {
  GlassPageHeader,
  GlassInput,
  GlassEmptyState,
  GlassButton,
  GlassBadge,
  GlassPageLoader,
  GlassErrorState,
} from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUniversalSearch } from '@/hooks/useUniversalSearch';
import { getErrorMessage } from '@/lib/errorMessages';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
};

const TYPE_BADGE: Record<string, { labelKey: string; color: 'success' | 'warning' | 'error' | 'primary' | 'muted' }> = {
  STUDENT: { labelKey: 'enum.badge.STUDENT', color: 'primary' },
  TEACHER: { labelKey: 'enum.badge.TEACHER', color: 'success' },
  GROUP: { labelKey: 'enum.badge.GROUP', color: 'warning' },
  COURSE: { labelKey: 'enum.badge.COURSE', color: 'primary' },
  LEAD: { labelKey: 'enum.badge.LEAD', color: 'warning' },
  PAYMENT: { labelKey: 'enum.badge.PAYMENT', color: 'success' },
  EMPLOYEE: { labelKey: 'enum.badge.EMPLOYEE', color: 'primary' },
  BOOK: { labelKey: 'enum.badge.BOOK', color: 'muted' },
  CERTIFICATE: { labelKey: 'enum.badge.CERTIFICATE', color: 'success' },
  USER: { labelKey: 'enum.badge.USER', color: 'muted' },
};

const TYPE_FILTERS = [
  { value: '', labelKey: 'enum.all' },
  { value: 'STUDENT', labelKey: 'enum.searchType.STUDENT' },
  { value: 'TEACHER', labelKey: 'enum.searchType.TEACHER' },
  { value: 'GROUP', labelKey: 'enum.searchType.GROUP' },
  { value: 'COURSE', labelKey: 'enum.searchType.COURSE' },
  { value: 'LEAD', labelKey: 'enum.searchType.LEAD' },
  { value: 'PAYMENT', labelKey: 'enum.searchType.PAYMENT' },
  { value: 'BOOK', labelKey: 'enum.searchType.BOOK' },
  { value: 'CERTIFICATE', labelKey: 'enum.searchType.CERTIFICATE' },
];

export function UniversalSearchPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('search.title'));
  const { playTick } = usePremiumSound();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQ);
  const [typeFilter, setTypeFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, loading, error, runSearch } = useUniversalSearch(query, typeFilter || undefined);

  // Sync URL ?q= changes into state
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setQuery((prev) => (prev !== q ? q : prev));
  }, [searchParams]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.length >= 2) runSearch(query);
      else if (query.length === 0) {
        runSearch('');
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, runSearch]);

  const handleResultClick = useCallback(
    (href: string) => {
      navigate(href);
    },
    [navigate],
  );

  const grouped = useMemo(() => {
    const map: Record<string, typeof results.results> = {};
    results.results.forEach((r) => {
      (map[r.type] ||= []).push(r);
    });
    return map;
  }, [results.results]);

  return (
    <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
      {/* Ambient background lighting */}
      <AuroraMesh variant="corporate" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]"
      >
        <motion.div variants={itemVariants}>
          <GlassPageHeader
            title={t('search.title')}
            subtitle={t('search.subtitle')}
          />
        </motion.div>

        {/* ── Spotlight Search Bar ─────────────────────────────────────────── */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl glass-card p-4 sm:p-6 space-y-4 border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />

          <div className="relative">
            <GlassInput
              ref={inputRef as unknown as React.Ref<HTMLInputElement>}
              type="search"
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-base sm:text-lg py-3.5 pl-12 pr-12 rounded-2xl"
              aria-label={t('search.placeholder')}
            />
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-white/10 transition-colors"
                aria-label="Clear search"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {TYPE_FILTERS.map((f) => (
              <GlassButton
                key={f.value}
                size="sm"
                className="min-h-[44px]"
                variant={typeFilter === f.value ? 'primary' : 'ghost'}
                onClick={() => {
                  playTick();
                  setTypeFilter(f.value);
                }}
              >
                {t(f.labelKey)}
              </GlassButton>
            ))}
          </div>
        </motion.div>

        {/* ── Search Results Area ─────────────────────────────────────────── */}
        {query.length < 2 ? (
          <motion.div
            variants={itemVariants}
            className="glass-card p-16 text-center rounded-2xl border border-white/40 dark:border-white/10"
          >
            <p className="text-sm font-medium text-[var(--text-muted)]">{t('search.typeMore')}</p>
          </motion.div>
        ) : loading ? (
          <motion.div
            variants={itemVariants}
            className="glass-card p-16 rounded-2xl border border-white/40 dark:border-white/10"
          >
            <GlassPageLoader label={t('search.searching')} />
          </motion.div>
        ) : error ? (
          <motion.div
            variants={itemVariants}
            className="glass-card p-12 rounded-2xl border border-white/40 dark:border-white/10"
          >
            <GlassErrorState
              message={getErrorMessage(error)}
              onRetry={() => runSearch(query)}
            />
          </motion.div>
        ) : results.results.length === 0 ? (
          <motion.div
            variants={itemVariants}
            className="glass-card p-16 rounded-2xl border border-white/40 dark:border-white/10"
          >
            <GlassEmptyState
              title={t('search.noResults')}
              message={t('search.noResultsHint', { query })}
            />
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} className="space-y-5">
            <div className="text-xs font-semibold text-[var(--text-muted)] px-1">
              {t('search.foundSummary', { n: results.total, ms: results.tookMs })}
            </div>

            {Object.entries(grouped).map(([type, items]) => {
              const meta = TYPE_BADGE[type] || { labelKey: '', color: 'muted' as const };
              return (
                <motion.section
                  key={type}
                  variants={itemVariants}
                  className="glass-card overflow-hidden rounded-2xl border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
                >
                  <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-white/40 dark:bg-[#131622]/40 backdrop-blur-md">
                    <div className="flex items-center gap-2.5">
                      <GlassBadge color={meta.color}>
                        {meta.labelKey ? t(meta.labelKey) : type}
                      </GlassBadge>
                      <span className="text-xs font-medium text-[var(--text-muted)]">
                        {t('search.matchCount', { n: items.length })}
                      </span>
                    </div>
                  </header>

                  <ul className="divide-y divide-black/5 dark:divide-white/5">
                    {items.map((item) => (
                      <motion.li
                        key={`${type}-${item.id}`}
                        whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.4)', transition: SPRING.snappy }}
                        className="px-6 py-4 cursor-pointer transition-colors"
                        onClick={() => handleResultClick(item.href)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-sm text-[var(--text-primary)] truncate">
                              {item.title || t('search.untitled')}
                            </h3>
                            {item.subtitle && (
                              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{item.subtitle}</p>
                            )}
                          </div>
                          <div className="text-xs font-mono font-semibold text-[var(--text-muted)] bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md whitespace-nowrap">
                            {item.relevanceScore}%
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </motion.section>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default UniversalSearchPage;
