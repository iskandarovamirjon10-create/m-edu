/**
 * M-EDU Audit Timeline Page
 * Chronological visualization of organization changes, audit stream, and historical actions.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import {
  GlassBadge,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassPagination,
  GlassInput,
  GlassSelect,
  GlassModal,
} from '@/components/ui';
import { AuditDiffViewer } from '@/components/audit';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n, type Locale } from '@/i18n/I18nProvider';
import { auditApi } from '@/lib/api';
import type { Paginated, SystemAuditEvent, AuditAction } from '@/lib/types';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { AuroraMesh } from '@/components/ui/AuroraMesh';

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
  visible: { opacity: 1, transition: { staggerChildren: 0.03, delayChildren: 0.04 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
};

const ENUM_ACTION_SET = new Set<AuditAction>([
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'EXPORT',
  'IMPORT',
]);

function actionKey(action: string): string {
  return ENUM_ACTION_SET.has(action as AuditAction)
    ? `enum.action.${action}`
    : `audit.action.${action}`;
}

const EVENT_TYPE_FILTERS = [
  { value: '', label: 'enum.allActions' },
  { value: 'LOGIN', label: 'enum.action.LOGIN' },
  { value: 'CREATE', label: 'enum.action.CREATE' },
  { value: 'UPDATE', label: 'enum.action.UPDATE' },
  { value: 'DELETE', label: 'enum.action.DELETE' },
  { value: 'EXPORT', label: 'enum.action.EXPORT' },
  { value: 'IMPORT', label: 'enum.action.IMPORT' },
];

const DATE_LOCALES: Record<Locale, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  uz: 'uz-UZ',
};

export function AuditTimelinePage() {
  const { t, locale } = useSafeI18n();
  usePageTitle(t('auditTimeline.title'));
  const { playTick, playPop } = usePremiumSound();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [limit] = useState(20);
  const [diffModalEvent, setDiffModalEvent] = useState<SystemAuditEvent | null>(null);

  const params = useMemo(() => ({
    page,
    limit,
    action: action || undefined,
    search: search || undefined,
  }), [page, limit, action, search]);

  const auditQuery = useQuery({
    queryKey: ['audit-timeline', params],
    queryFn: () => auditApi.list(params) as Promise<Paginated<SystemAuditEvent>>,
    placeholderData: (prev) => prev,
  });

  const data = auditQuery.data;

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleActionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setAction(e.target.value);
    setPage(1);
  }, []);

  const handleOpenAuditSidecar = useCallback((item: SystemAuditEvent) => {
    playPop();
    const formattedDate = new Date(item.createdAt).toLocaleString(DATE_LOCALES[locale], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      year: 'numeric',
    });

    const sidecarData: QuickLookData = {
      type: 'general',
      id: item.id,
      title: `${item.action} · ${item.entityType}`,
      subtitle: item.entityLabel || (item.entityId ? `ID: ${item.entityId}` : item.description),
      status: {
        label: item.action,
        tone: item.action === 'CREATE' ? 'green' : item.action === 'UPDATE' ? 'amber' : item.action === 'DELETE' ? 'red' : 'blue',
      },
      metrics: [
        { label: 'Harakat', value: item.action },
        { label: 'Resurs', value: item.entityType },
        { label: 'Bajaruvchi', value: item.actorName || 'Tizim' },
        { label: 'Vaqt', value: formattedDate },
      ],
      details: [
        { label: 'Hodisa ID', value: item.id, copyable: true },
        { label: 'Resurs turi', value: item.entityType },
        { label: 'Resurs ID', value: item.entityId || '—', copyable: Boolean(item.entityId) },
        { label: 'Resurs nomi/label', value: item.entityLabel || '—' },
        { label: 'Bajaruvchi (Actor)', value: item.actorName || 'Tizim' },
        { label: 'Actor ID', value: item.actorId || '—', copyable: Boolean(item.actorId) },
        { label: 'Tavsif', value: item.description },
        { label: 'IP manzil', value: item.ipAddress || '—', copyable: Boolean(item.ipAddress) },
        { label: 'User Agent', value: item.userAgent || '—' },
        { label: 'O\'zgargan maydonlar', value: item.changedFields?.join(', ') || '—' },
        { label: 'Sana va vaqt', value: formattedDate },
      ],
    };
    openSidecar(sidecarData);
  }, [locale, openSidecar, playPop]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'r') {
        playTick();
        void auditQuery.refetch();
      } else if (e.key === '1') {
        playTick();
        setAction('');
        setPage(1);
      } else if (e.key === '2') {
        playTick();
        setAction('LOGIN');
        setPage(1);
      } else if (e.key === '3') {
        playTick();
        setAction('CREATE');
        setPage(1);
      } else if (e.key === '4') {
        playTick();
        setAction('UPDATE');
        setPage(1);
      } else if (e.key === '5') {
        playTick();
        setAction('DELETE');
        setPage(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [auditQuery, playTick]);

  const statusColor = (act: string) => {
    if (act === 'CREATE') return 'success';
    if (act === 'UPDATE') return 'warning';
    if (act === 'DELETE') return 'error';
    if (act === 'LOGIN') return 'primary';
    return 'muted';
  };

  const items = data?.items || [];
  const totalEvents = data?.total || 0;

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="relative min-h-screen bg-transparent p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AuroraMesh variant="security" opacity={0.65} />

      {/* ── Apple V2 Hero Header ── */}
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 via-zinc-800 to-black text-white shadow-xl shadow-black/20 ring-1 ring-white/20">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t('auditTimeline.title')}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-500/20 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                Stream Timeline
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t('auditTimeline.pageSubtitle')} • {data ? t('auditTimeline.count', { count: totalEvents }) : '—'}
            </p>
          </div>
        </div>

        {/* Quick controls & shortcuts badge */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/40 px-3 py-1.5 text-xs text-zinc-600 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
            <span className="font-mono text-[11px] font-semibold text-brand-600 dark:text-brand-400">[R]</span>
            <span>Yangilash</span>
            <span className="mx-1 text-zinc-300 dark:text-zinc-700">|</span>
            <span className="font-mono text-[11px] font-semibold text-brand-600 dark:text-brand-400">[1-5]</span>
            <span>Filtr</span>
          </div>

          <button
            type="button"
            onClick={() => {
              playTick();
              void auditQuery.refetch();
            }}
            disabled={auditQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/60 px-4 py-2 text-xs font-semibold text-zinc-800 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 active:scale-95 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.12]"
          >
            <svg
              className={`h-4 w-4 ${auditQuery.isFetching ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{auditQuery.isFetching ? 'Yuklanmoqda…' : 'Yangilash'}</span>
          </button>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="liquid-glass-surface relative z-10 flex flex-col gap-3 rounded-3xl p-4 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
          <GlassInput
            placeholder={t('auditTimeline.searchPlaceholder')}
            aria-label={t('auditTimeline.searchAria')}
            value={search}
            onChange={handleSearchChange}
            type="search"
          />
          <GlassSelect
            value={action}
            onChange={handleActionChange}
            aria-label={t('common.filterByAction')}
          >
            {EVENT_TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{t(f.label)}</option>
            ))}
          </GlassSelect>
        </div>
      </div>

      {/* ── Table Content ── */}
      {auditQuery.isLoading && !data ? (
        <div className="liquid-glass-surface rounded-3xl p-12 backdrop-blur-xl">
          <GlassPageLoader label={t('auditTimeline.loading')} />
        </div>
      ) : auditQuery.isError ? (
        <div className="liquid-glass-surface rounded-3xl p-8 backdrop-blur-xl">
          <GlassErrorState
            title={t('auditTimeline.loadError')}
            message={auditQuery.error instanceof Error ? auditQuery.error.message : t('common.unknownError')}
            onRetry={() => {
              playTick();
              void auditQuery.refetch();
            }}
          />
        </div>
      ) : items.length === 0 ? (
        <div className="liquid-glass-surface rounded-3xl p-12 backdrop-blur-xl">
          <GlassEmptyState
            title={search || action ? t('auditTimeline.emptyFilteredTitle') : t('auditTimeline.emptyTitle')}
            message={search || action ? t('common.adjustFilters') : t('auditTimeline.emptyMessage')}
          />
        </div>
      ) : (
        <div className="liquid-glass-surface relative z-10 overflow-hidden rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/20 bg-black/[0.02] text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] dark:border-white/[0.06] dark:bg-white/[0.02]">
                <tr>
                  <th className="py-3.5 pl-6 pr-4">{t('audit.col.time')}</th>
                  <th className="px-4 py-3.5">{t('audit.col.action')}</th>
                  <th className="px-4 py-3.5">{t('auditTimeline.col.resource')}</th>
                  <th className="px-4 py-3.5">{t('audit.col.actor')}</th>
                  <th className="px-4 py-3.5">{t('auditTimeline.col.details')}</th>
                  <th className="py-3.5 pl-4 pr-6 text-right">Sidecar</th>
                </tr>
              </thead>
              <motion.tbody
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-white/20 dark:divide-white/[0.04]"
              >
                {items.map((item) => (
                  <motion.tr
                    key={item.id}
                    variants={rowVariants}
                    onClick={() => handleOpenAuditSidecar(item)}
                    className="group cursor-pointer transition-colors duration-200 hover:bg-white/40 dark:hover:bg-white/[0.03]"
                  >
                    <td className="py-4 pl-6 pr-4 whitespace-nowrap font-mono text-xs text-[var(--text-muted)]">
                      {new Date(item.createdAt).toLocaleString(DATE_LOCALES[locale], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-4">
                      <GlassBadge color={statusColor(item.action)}>
                        {t(actionKey(item.action || ''))}
                      </GlassBadge>
                    </td>
                    <td className="px-4 py-4 text-xs font-medium text-[var(--text-primary)]">
                      {item.entityType}
                      {item.entityId ? ` · ${String(item.entityId).slice(0, 8)}` : ''}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-[var(--text-secondary)]">
                      {item.actorName || t('common.system')}
                    </td>
                    <td className="px-4 py-4 max-w-xs truncate text-xs text-[var(--text-secondary)]" title={item.description}>
                      {item.description}
                    </td>
                    <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {(item.previousValue || item.newValue || (item.changedFields && item.changedFields.length > 0)) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playPop();
                              setDiffModalEvent(item);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shadow-sm backdrop-blur-md transition-all hover:bg-indigo-500/20"
                            title="Diff Ko'rish"
                          >
                            <span>⚡</span>
                            <span>Diff</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playTick();
                            handleOpenAuditSidecar(item);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/40 px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] shadow-sm backdrop-blur-md transition-all hover:bg-white/60 hover:text-[var(--text-primary)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                          title="Split View Sidecar"
                        >
                          <span>◨</span>
                          <span>Sidecar</span>
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>

          <div className="border-t border-white/20 px-6 py-4 dark:border-white/[0.06]">
            <GlassPagination
              page={page}
              totalPages={data?.totalPages ?? 1}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* ── Visual Diff Modal ── */}
      <GlassModal
        open={Boolean(diffModalEvent)}
        onClose={() => setDiffModalEvent(null)}
        size="xl"
        title={`O'zgarishlar Tafsiloti (Diff) · ${diffModalEvent?.action || ''} ${diffModalEvent?.entityType || ''}`}
        description={`${diffModalEvent?.entityLabel || diffModalEvent?.description || ''} · Bajaruvchi: ${diffModalEvent?.actorName || 'Tizim'}`}
      >
        {diffModalEvent && (
          <AuditDiffViewer
            previousValue={diffModalEvent.previousValue}
            newValue={diffModalEvent.newValue}
            changedFields={diffModalEvent.changedFields}
          />
        )}
      </GlassModal>
    </motion.main>
  );
}

export default AuditTimelinePage;
