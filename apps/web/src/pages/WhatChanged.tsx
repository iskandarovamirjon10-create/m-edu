/**
 * M-EDU What Changed Page
 * System audit history, entity modification deltas, timeline inspection, and user activity tracking.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { GlassBadge, GlassButton, GlassPageLoader, GlassEmptyState, GlassErrorState } from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n, type TranslateFn } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { auditApi } from '@/lib/api';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ══════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
};

interface ChangeEvent {
  id: string;
  createdAt: string;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityLabel?: string | null;
  entityId?: string | null;
  description?: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  changedFields?: string[] | null;
}

const ACTION_LABEL_KEYS: Record<string, string> = {
  LOGIN: 'enum.action.LOGIN',
  CREATE: 'enum.action.CREATE',
  UPDATE: 'enum.action.UPDATE',
  DELETE: 'enum.action.DELETE',
  EXPORT: 'enum.action.EXPORT',
  IMPORT: 'enum.action.IMPORT',
};

const FILTER_LABEL_KEYS = {
  all: 'enum.all',
  created: 'whatChanged.filterCreated',
  updated: 'whatChanged.filterUpdated',
  deleted: 'whatChanged.filterDeleted',
} as const;

function actionLabel(action: string, t: TranslateFn): string {
  const key = ACTION_LABEL_KEYS[action];
  return key ? t(key) : action;
}

export function WhatChangedPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('whatChanged.title'));
  const { playTick, playPop, playSuccess } = usePremiumSound();
  const [filter, setFilter] = useState<'all' | 'created' | 'updated' | 'deleted'>('all');

  const auditQuery = useQuery({
    queryKey: ['what-changed'],
    queryFn: () => auditApi.list({ limit: 50 }) as Promise<{ items: ChangeEvent[]; total: number }>,
  });

  const events: ChangeEvent[] = auditQuery.data?.items ?? [];

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) =>
      filter === 'created' ? e.action === 'CREATE' :
      filter === 'updated' ? e.action === 'UPDATE' :
      filter === 'deleted' ? e.action === 'DELETE' : true,
    );
  }, [events, filter]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = events.length;
    const created = events.filter((e) => e.action === 'CREATE').length;
    const updated = events.filter((e) => e.action === 'UPDATE').length;
    const deleted = events.filter((e) => e.action === 'DELETE').length;
    return { total, created, updated, deleted };
  }, [events]);

  const handleOpenEventSidecar = useCallback((e: ChangeEvent) => {
    playTick();
    const sidecarData: QuickLookData = {
      title: `${e.entityType} ${e.entityLabel ? `· ${e.entityLabel}` : ''}`,
      subtitle: `${e.action} • Initiated by ${e.actorName ?? 'System'}`,
      badge: {
        text: e.action,
        tone: e.action === 'CREATE' ? 'emerald' : e.action === 'DELETE' ? 'rose' : 'blue',
      },
      metrics: [
        { label: 'Action Kind', value: e.action },
        { label: 'Target Entity', value: e.entityType },
        { label: 'Actor Name', value: e.actorName ?? 'System' },
        { label: 'Occurred At', value: new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ],
      details: [
        { label: 'Event ID', value: e.id },
        { label: 'Entity Reference ID', value: e.entityId || 'N/A' },
        { label: 'Full Timestamp', value: new Date(e.createdAt).toLocaleString() },
        { label: 'Changed Fields', value: e.changedFields && e.changedFields.length > 0 ? e.changedFields.join(', ') : 'None / Initial State' },
        { label: 'Summary Description', value: e.description || 'No description provided' },
        { label: 'Before Snapshot', value: e.previousValue ? JSON.stringify(e.previousValue, null, 2) : 'None' },
        { label: 'After Snapshot', value: e.newValue ? JSON.stringify(e.newValue, null, 2) : 'None' },
      ],
    };
    openSidecar(sidecarData);
  }, [playTick]);

  // Keyboard Shortcuts: 1..4 for filters, R for refresh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.key === '1') {
        e.preventDefault();
        playTick();
        setFilter('all');
      } else if (e.key === '2') {
        e.preventDefault();
        playTick();
        setFilter('created');
      } else if (e.key === '3') {
        e.preventDefault();
        playTick();
        setFilter('updated');
      } else if (e.key === '4') {
        e.preventDefault();
        playTick();
        setFilter('deleted');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playPop();
        auditQuery.refetch().then(() => playSuccess());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playTick, playPop, playSuccess, auditQuery]);

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="relative min-h-screen bg-transparent p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      {/* Ambient background lighting */}
      <AuroraMesh variant="subtle" />

      {/* ── Apple V2 Hero Header ── */}
      <div className="liquid-glass-card liquid-glass-surface relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between rounded-[2.25rem] border border-white/40 dark:border-white/10 p-6 sm:p-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.07)] backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/30">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t('whatChanged.title')}
              </h1>
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Delta Inspector
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t('whatChanged.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GlassButton
            variant="secondary"
            onClick={() => {
              playPop();
              auditQuery.refetch().then(() => playSuccess());
            }}
            disabled={auditQuery.isFetching}
            className="inline-flex items-center gap-2"
            icon={
              <svg className={`h-4 w-4 ${auditQuery.isFetching ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            }
          >
            <span>{auditQuery.isFetching ? t('automation.running') : t('common.refresh')}</span>
            <kbd className="text-[10px] opacity-75 font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 ml-1">R</kbd>
          </GlassButton>
        </div>
      </div>

      {/* ── Metric Summary Tiles ── */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="liquid-glass-card liquid-glass-surface rounded-3xl border border-white/40 dark:border-white/10 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">{t('enum.all')}</div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-blue-600 dark:text-blue-400">{metrics.total}</div>
        </div>
        <div className="liquid-glass-card liquid-glass-surface rounded-3xl border border-white/40 dark:border-white/10 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">{t('whatChanged.filterCreated')}</div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">{metrics.created}</div>
        </div>
        <div className="liquid-glass-card liquid-glass-surface rounded-3xl border border-white/40 dark:border-white/10 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">{t('whatChanged.filterUpdated')}</div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">{metrics.updated}</div>
        </div>
        <div className="liquid-glass-card liquid-glass-surface rounded-3xl border border-white/40 dark:border-white/10 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">{t('whatChanged.filterDeleted')}</div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-rose-600 dark:text-rose-400">{metrics.deleted}</div>
        </div>
      </div>

      {/* ── How It Works Card ── */}
      <div className="liquid-glass-card liquid-glass-surface relative z-10 overflow-hidden rounded-3xl border border-white/40 dark:border-white/10 p-6 shadow-[0_12px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl space-y-3">
        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          {t('whatChanged.howItWorks')}
        </h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <li className="flex items-center gap-2">
            <span className="text-blue-500 font-bold">•</span>
            <span><strong className="text-zinc-900 dark:text-zinc-200">{t('whatChanged.sourceOfTruth')}</strong> — {t('whatChanged.sourceOfTruthDesc')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-blue-500 font-bold">•</span>
            <span><strong className="text-zinc-900 dark:text-zinc-200">{t('whatChanged.fieldsChanged')}</strong> — {t('whatChanged.fieldsChangedDesc')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-blue-500 font-bold">•</span>
            <span><strong className="text-zinc-900 dark:text-zinc-200">{t('whatChanged.actorTracking')}</strong> — {t('whatChanged.actorTrackingDesc')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-blue-500 font-bold">•</span>
            <span><strong className="text-zinc-900 dark:text-zinc-200">{t('whatChanged.noAiSummary')}</strong> — {t('whatChanged.noAiSummaryDesc')}</span>
          </li>
        </ul>
      </div>

      {/* ── Segmented Filter Tabs ── */}
      <div className="relative z-10 flex max-w-full overflow-x-auto scrollbar-none p-1.5 rounded-2xl liquid-glass-card liquid-glass-surface border border-white/40 dark:border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl w-fit gap-1">
        {(['all', 'created', 'updated', 'deleted'] as const).map((f, idx) => {
          const isActive = filter === f;
          return (
            <button
              key={f}
              onClick={() => {
                playTick();
                setFilter(f);
              }}
              className={`relative px-3.5 sm:px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap ${
                isActive
                  ? 'text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="whatChangedActiveFilter"
                  transition={SPRING.snappy}
                  className="absolute inset-0 rounded-xl bg-white dark:bg-zinc-800 border border-black/[0.04] dark:border-white/[0.08] shadow-sm"
                />
              )}
              <span className="relative z-10">{t(FILTER_LABEL_KEYS[f])}</span>
              <kbd className="relative z-10 hidden sm:inline-block text-[9px] font-mono px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-zinc-400">
                {idx + 1}
              </kbd>
            </button>
          );
        })}
      </div>

      {/* ── Changes Feed ── */}
      <div className="liquid-glass-card liquid-glass-surface relative z-10 overflow-hidden rounded-[2rem] border border-white/40 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] backdrop-blur-2xl">
        {auditQuery.isLoading ? (
          <div className="p-12"><GlassPageLoader label={t('whatChanged.loading')} /></div>
        ) : auditQuery.isError ? (
          <div className="p-8">
            <GlassErrorState
              title={t('whatChanged.loadFailed')}
              message={
                auditQuery.error instanceof Error
                  ? auditQuery.error.message
                  : t('whatChanged.unknownError')
              }
              onRetry={() => auditQuery.refetch()}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12">
            <GlassEmptyState
              title={t('whatChanged.emptyTitle')}
              message={t('whatChanged.emptyMessage')}
            />
          </div>
        ) : (
          <motion.ul
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-white/20 dark:divide-white/[0.05]"
          >
            {filtered.map((e) => (
              <motion.li
                key={e.id}
                variants={itemVariants}
                onClick={() => handleOpenEventSidecar(e)}
                className="group p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 transition-all duration-200 hover:bg-white/30 dark:hover:bg-white/[0.04] cursor-pointer"
              >
                <div className="shrink-0 mt-0.5">
                  <GlassBadge
                    color={
                      e.action === 'CREATE' ? 'success' :
                      e.action === 'DELETE' ? 'error' :
                      'primary'
                    }
                  >
                    {actionLabel(e.action, t)}
                  </GlassBadge>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {e.entityType}
                    {(e.entityLabel || e.entityId) && (
                      <span className="text-zinc-400 font-normal">
                        {' '}· {e.entityLabel ?? String(e.entityId).slice(0, 8)}
                      </span>
                    )}
                  </h4>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    {e.action === 'UPDATE' && (e.changedFields?.length || e.previousValue || e.newValue) ? (
                      <>
                        {e.changedFields && e.changedFields.length > 0 && (
                          <span>
                            {t('whatChanged.changedFields')}{' '}
                            <strong className="text-zinc-800 dark:text-zinc-200 font-mono bg-white/50 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-black/[0.04] dark:border-white/10">
                              {e.changedFields.join(', ')}
                            </strong>
                          </span>
                        )}
                        {e.previousValue != null && e.newValue != null && (
                          <span className="block mt-1 font-mono text-xs text-zinc-400 break-all">
                            {t('whatChanged.fromTo', {
                              from: JSON.stringify(e.previousValue).substring(0, 40),
                              to: JSON.stringify(e.newValue).substring(0, 40),
                            })}
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-zinc-400">
                        <span>{e.description || t('whatChanged.noDescription')}</span>
                        <span>·</span>
                        <span className="font-medium text-zinc-600 dark:text-zinc-300">{e.actorName ?? t('whatChanged.systemActor')}</span>
                        <span>·</span>
                        <span>{new Date(e.createdAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center justify-end w-full sm:w-auto gap-2 self-start sm:self-center mt-2 sm:mt-0" onClick={(ev) => ev.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleOpenEventSidecar(e)}
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white/40 hover:bg-white/60 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-white/40 dark:border-white/10 shadow-sm transition-all"
                    title="Quick Look Detail"
                  >
                    <span>◨</span>
                    <span>Sidecar</span>
                  </button>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </motion.main>
  );
}

export default WhatChangedPage;
