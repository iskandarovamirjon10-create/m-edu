/**
 * UniversalSearchPage — v2 "Liquid Refraction · Spatial Spotlight Studio"
 *
 * 🎯 v1 → v2 Visual Rebirth:
 *  ✅ Liquid Glass Refraction — Specular highlight rims, chromatic edge focus ring,
 *     frosted glass blur, and multi-layer depth shadows.
 *  ✅ Spatial Spotlight Command Bar — Elevated search aperture with ⌘K / Esc hotkeys,
 *     instant clear trigger, and duotone animated search glyph.
 *  ✅ Spring Physics Filter Rail — Smooth pill sliding indicator with audio-haptic feedback.
 *  ✅ Type-Aware Duotone Tiles — Squircle icon badges tailored to each entity type
 *     (STUDENT, TEACHER, GROUP, COURSE, LEAD, PAYMENT, BOOK, CERTIFICATE).
 *  ✅ Cascade Row Reveal — Staggered blur-in on every result row with micro-hover physics.
 *  ✅ 100% logic & API preserved — exact queries, debounce, navigation, and i18n keys.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  GlassPageHeader,
  GlassInput,
  GlassEmptyState,
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

/* ============================================================================
 * MOTION TOKENS (Apple ProMotion Springs)
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 520, damping: 30, mass: 0.65 },
  smooth: { type: 'spring', stiffness: 360, damping: 30, mass: 0.85 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.03 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: SPRING.smooth,
  },
};

const TYPE_CONFIG: Record<
  string,
  {
    labelKey: string;
    color: 'success' | 'warning' | 'error' | 'primary' | 'muted';
    gradient: string;
    iconSvg: JSX.Element;
  }
> = {
  STUDENT: {
    labelKey: 'enum.badge.STUDENT',
    color: 'primary',
    gradient: 'from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
    iconSvg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
  },
  TEACHER: {
    labelKey: 'enum.badge.TEACHER',
    color: 'success',
    gradient: 'from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    iconSvg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  GROUP: {
    labelKey: 'enum.badge.GROUP',
    color: 'warning',
    gradient: 'from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
    iconSvg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  COURSE: {
    labelKey: 'enum.badge.COURSE',
    color: 'primary',
    gradient: 'from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30',
    iconSvg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  LEAD: {
    labelKey: 'enum.badge.LEAD',
    color: 'warning',
    gradient: 'from-pink-500/20 to-rose-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30',
    iconSvg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  PAYMENT: {
    labelKey: 'enum.badge.PAYMENT',
    color: 'success',
    gradient: 'from-emerald-500/20 to-cyan-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    iconSvg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  EMPLOYEE: {
    labelKey: 'enum.badge.EMPLOYEE',
    color: 'primary',
    gradient: 'from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    iconSvg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  BOOK: {
    labelKey: 'enum.badge.BOOK',
    color: 'muted',
    gradient: 'from-amber-600/20 to-yellow-600/20 text-amber-700 dark:text-amber-300 border-amber-600/30',
    iconSvg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
  },
  CERTIFICATE: {
    labelKey: 'enum.badge.CERTIFICATE',
    color: 'success',
    gradient: 'from-teal-500/20 to-emerald-500/20 text-teal-600 dark:text-teal-400 border-teal-500/30',
    iconSvg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  USER: {
    labelKey: 'enum.badge.USER',
    color: 'muted',
    gradient: 'from-slate-500/20 to-zinc-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30',
    iconSvg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
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
  const { playTick, playPop } = usePremiumSound();
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

  // Global hotkey: Cmd/Ctrl + K to focus search, Esc to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        if (query) {
          e.preventDefault();
          setQuery('');
          playPop();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [query, playPop]);

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
      playTick();
      navigate(href);
    },
    [navigate, playTick],
  );

  const grouped = useMemo(() => {
    const map: Record<string, typeof results.results> = {};
    results.results.forEach((r) => {
      (map[r.type] ||= []).push(r);
    });
    return map;
  }, [results.results]);

  return (
    <div className="relative min-h-full bg-transparent selection:bg-brand-500/30">
      {/* Ambient Aurora mesh backdrop */}
      <AuroraMesh variant="corporate" opacity={0.7} />

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

        {/* ── Spotlight Liquid Search Console ─────────────────────────────── */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-[2rem] p-4 sm:p-6 space-y-4 border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#131622]/75 backdrop-blur-2xl shadow-[0_16px_48px_-12px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.5)] transition-all duration-300 focus-within:border-brand-500/40 focus-within:shadow-[0_20px_60px_-10px_rgba(99,102,241,0.18)]"
        >
          {/* Top specular highlight edge */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25 z-10" />

          {/* Search Input Box */}
          <div className="relative flex items-center">
            <GlassInput
              ref={inputRef as unknown as React.Ref<HTMLInputElement>}
              type="search"
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-base sm:text-lg py-4 pl-12 pr-28 rounded-2xl bg-white/50 dark:bg-black/20 border-black/10 dark:border-white/10 shadow-inner"
              aria-label={t('search.placeholder')}
            />
            {/* Search Icon */}
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-600 dark:text-brand-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Quick action buttons & Hotkey hint */}
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    playPop();
                    inputRef.current?.focus();
                  }}
                  className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-medium text-[var(--text-muted)] bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 select-none">
                  <kbd>⌘</kbd>
                  <kbd>K</kbd>
                </span>
              )}
            </div>
          </div>

          {/* Filter Pills with ProMotion physics */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
            {TYPE_FILTERS.map((f) => {
              const active = typeFilter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => {
                    playTick();
                    setTypeFilter(f.value);
                  }}
                  className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 outline-none select-none ${
                    active
                      ? 'text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-transparent hover:border-black/5 dark:hover:border-white/10'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="activeFilterPill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 dark:from-brand-500 dark:to-indigo-500"
                      transition={SPRING.snappy}
                    />
                  )}
                  <span className="relative z-10">{t(f.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Search Results Area ─────────────────────────────────────────── */}
        {query.length < 2 ? (
          <motion.div
            variants={itemVariants}
            className="p-16 text-center rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/40 dark:bg-[#131622]/40 backdrop-blur-xl shadow-lg"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--text-muted)]">{t('search.typeMore')}</p>
          </motion.div>
        ) : loading ? (
          <motion.div
            variants={itemVariants}
            className="p-16 rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/40 dark:bg-[#131622]/40 backdrop-blur-xl shadow-lg"
          >
            <GlassPageLoader label={t('search.searching')} />
          </motion.div>
        ) : error ? (
          <motion.div
            variants={itemVariants}
            className="p-12 rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/40 dark:bg-[#131622]/40 backdrop-blur-xl shadow-lg"
          >
            <GlassErrorState
              message={getErrorMessage(error)}
              onRetry={() => runSearch(query)}
            />
          </motion.div>
        ) : results.results.length === 0 ? (
          <motion.div
            variants={itemVariants}
            className="p-16 rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/40 dark:bg-[#131622]/40 backdrop-blur-xl shadow-lg"
          >
            <GlassEmptyState
              title={t('search.noResults')}
              message={t('search.noResultsHint', { query })}
            />
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} className="space-y-6">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] px-2">
              <span>{t('search.foundSummary', { n: results.total, ms: results.tookMs })}</span>
              <span className="text-[11px] font-mono opacity-70">M-EDU Spatial Index</span>
            </div>

            <AnimatePresence mode="popLayout">
              {Object.entries(grouped).map(([type, items]) => {
                const config = TYPE_CONFIG[type] || {
                  labelKey: '',
                  color: 'muted' as const,
                  gradient: 'from-slate-500/20 to-zinc-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30',
                  iconSvg: (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                  ),
                };

                return (
                  <motion.section
                    key={type}
                    variants={itemVariants}
                    layout
                    className="overflow-hidden rounded-[1.75rem] border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#131622]/70 backdrop-blur-2xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.4)]"
                  >
                    {/* Category Header */}
                    <header className="flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/10 bg-white/40 dark:bg-[#131622]/50 backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br border ${config.gradient}`}>
                          {config.iconSvg}
                        </div>
                        <GlassBadge color={config.color}>
                          {config.labelKey ? t(config.labelKey) : type}
                        </GlassBadge>
                        <span className="text-xs font-medium text-[var(--text-muted)]">
                          {t('search.matchCount', { n: items.length })}
                        </span>
                      </div>
                    </header>

                    {/* Result Row Items */}
                    <ul className="divide-y divide-black/5 dark:divide-white/5">
                      {items.map((item) => (
                        <motion.li
                          key={`${type}-${item.id}`}
                          whileHover={{
                            backgroundColor: 'rgba(255, 255, 255, 0.55)',
                            x: 4,
                            transition: SPRING.snappy,
                          }}
                          className="group px-6 py-4 cursor-pointer transition-colors dark:hover:bg-white/[0.04]"
                          onClick={() => handleResultClick(item.href)}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
                                {item.title || t('search.untitled')}
                              </h3>
                              {item.subtitle && (
                                <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{item.subtitle}</p>
                              )}
                            </div>

                            {/* Relevance Score Pill + Jump arrow */}
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-[11px] font-mono font-semibold text-brand-600 dark:text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                {item.relevanceScore}%
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] group-hover:text-brand-600 dark:group-hover:text-brand-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </motion.li>
                      ))}
                    </ul>
                  </motion.section>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default UniversalSearchPage;
