/**
 * M-EDU Audit Page
 * Organization audit logs, security event tracking, user action timestamps, and compliance records.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { auditApi } from '@/lib/api';
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
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, SystemAuditEvent, AuditAction } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
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

const AUDIT_ACTIONS: { value: AuditAction; label: string }[] = [
  { value: 'CREATE', label: 'enum.action.CREATE' },
  { value: 'UPDATE', label: 'enum.action.UPDATE' },
  { value: 'DELETE', label: 'enum.action.DELETE' },
  { value: 'RESTORE', label: 'audit.action.RESTORE' },
  { value: 'LOGIN', label: 'enum.action.LOGIN' },
  { value: 'LOGOUT', label: 'audit.action.LOGOUT' },
  { value: 'LOGIN_FAILED', label: 'audit.action.LOGIN_FAILED' },
  { value: 'EXPORT', label: 'enum.action.EXPORT' },
  { value: 'IMPORT', label: 'enum.action.IMPORT' },
  { value: 'BULK_UPDATE', label: 'audit.action.BULK_UPDATE' },
  { value: 'PAYMENT_RECEIVED', label: 'audit.action.PAYMENT_RECEIVED' },
  { value: 'ENROLLMENT_CREATED', label: 'audit.action.ENROLLMENT_CREATED' },
  { value: 'ENROLLMENT_REVOKED', label: 'audit.action.ENROLLMENT_REVOKED' },
  { value: 'ATTENDANCE_RECORDED', label: 'audit.action.ATTENDANCE_RECORDED' },
  { value: 'GRADE_RECORDED', label: 'audit.action.GRADE_RECORDED' },
  { value: 'DOCUMENT_UPLOADED', label: 'audit.action.DOCUMENT_UPLOADED' },
  { value: 'DOCUMENT_DELETED', label: 'audit.action.DOCUMENT_DELETED' },
  { value: 'WORKFLOW_TRIGGERED', label: 'audit.action.WORKFLOW_TRIGGERED' },
  { value: 'WORKFLOW_COMPLETED', label: 'audit.action.WORKFLOW_COMPLETED' },
  { value: 'CUSTOM', label: 'audit.action.CUSTOM' },
];

interface AuditFilters {
  page: number;
  limit: number;
  action?: AuditAction;
  search?: string;
}

function actionKey(action: string): string {
  return ENUM_ACTION_SET.has(action as AuditAction)
    ? `enum.action.${action}`
    : `audit.action.${action}`;
}

function actionColor(action: string): 'success' | 'warning' | 'error' | 'primary' | 'slate' {
  if (action === 'CREATE') return 'success';
  if (action === 'UPDATE') return 'warning';
  if (action === 'DELETE') return 'error';
  if (action === 'LOGIN' || action === 'LOGOUT') return 'primary';
  if (action === 'LOGIN_FAILED') return 'error';
  return 'slate';
}

function truncateId(id: string | null | undefined, maxLength = 8): string {
  if (!id) return '';
  return id.length > maxLength ? `${id.slice(0, maxLength)}…` : id;
}

export function AuditPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('nav.audit'));
  const { playTick, playPop } = usePremiumSound();

  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [limit] = useState(20);
  const [diffModalEvent, setDiffModalEvent] = useState<SystemAuditEvent | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const params = useMemo<AuditFilters>(
    () => ({
      page,
      limit,
      action: (action as AuditAction) || undefined,
      search: debouncedSearch || undefined,
    }),
    [page, debouncedSearch, action, limit],
  );

  const audit = useQuery({
    queryKey: ['audit', params],
    queryFn: () => auditApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const data = audit.data as Paginated<SystemAuditEvent> | undefined;

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleActionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setAction(e.target.value);
    setPage(1);
  }, []);

  const { refetch: refetchAudit } = audit;
  const handleRetry = useCallback(() => {
    void refetchAudit();
  }, [refetchAudit]);

  const handleOpenAuditSidecar = useCallback((event: SystemAuditEvent) => {
    playPop();
    const sidecarData: QuickLookData = {
      type: 'general',
      id: event.id,
      title: `${event.action} · ${event.entityType}`,
      subtitle: event.entityLabel || (event.entityId ? `ID: ${event.entityId}` : event.description),
      status: {
        label: event.action,
        tone: event.action === 'CREATE' ? 'green' : event.action === 'UPDATE' ? 'amber' : event.action === 'DELETE' ? 'red' : 'blue',
      },
      metrics: [
        { label: 'Harakat', value: event.action },
        { label: 'Resurs', value: event.entityType },
        { label: 'Bajaruvchi', value: event.actorName || 'Tizim' },
        { label: 'Vaqt', value: formatDateTime(event.createdAt) },
      ],
      details: [
        { label: 'Hodisa ID', value: event.id, copyable: true },
        { label: 'Resurs turi', value: event.entityType },
        { label: 'Resurs ID', value: event.entityId || '—', copyable: Boolean(event.entityId) },
        { label: 'Resurs nomi/label', value: event.entityLabel || '—' },
        { label: 'Bajaruvchi (Actor)', value: event.actorName || 'Tizim' },
        { label: 'Actor ID', value: event.actorId || '—', copyable: Boolean(event.actorId) },
        { label: 'Tavsif', value: event.description },
        { label: 'IP manzil', value: event.ipAddress || '—', copyable: Boolean(event.ipAddress) },
        { label: 'User Agent', value: event.userAgent || '—' },
        { label: 'O\'zgargan maydonlar', value: event.changedFields?.join(', ') || '—' },
        { label: 'Sana va vaqt', value: formatDateTime(event.createdAt) },
      ],
    };
    openSidecar(sidecarData);
  }, [openSidecar, playPop]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'r') {
        playTick();
        void refetchAudit();
      } else if (e.key === '1') {
        playTick();
        setAction('');
        setPage(1);
      } else if (e.key === '2') {
        playTick();
        setAction('CREATE');
        setPage(1);
      } else if (e.key === '3') {
        playTick();
        setAction('UPDATE');
        setPage(1);
      } else if (e.key === '4') {
        playTick();
        setAction('DELETE');
        setPage(1);
      } else if (e.key === '5') {
        playTick();
        setAction('LOGIN');
        setPage(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playTick, refetchAudit]);

  const hasActiveFilters = Boolean(search || action);
  const totalEvents = data?.total || 0;
  const items = data?.items || [];

  // Summary Metrics Breakdown
  const stats = useMemo(() => {
    let creates = 0;
    let updates = 0;
    let deletes = 0;
    let security = 0;
    items.forEach((item) => {
      if (item.action === 'CREATE') creates++;
      else if (item.action === 'UPDATE') updates++;
      else if (item.action === 'DELETE') deletes++;
      else if (item.action === 'LOGIN' || item.action === 'LOGIN_FAILED' || item.action === 'LOGOUT') security++;
    });
    return { creates, updates, deletes, security };
  }, [items]);

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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t('nav.audit')}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-500/20 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Immutable Ledger
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t('audit.pageSubtitle')} • {totalEvents === 1 ? t('audit.countOne') : t('audit.countMany', { count: totalEvents })}
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
              void refetchAudit();
            }}
            disabled={audit.isFetching}
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/60 px-4 py-2 text-xs font-semibold text-zinc-800 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 active:scale-95 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.12]"
          >
            <svg
              className={`h-4 w-4 ${audit.isFetching ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{audit.isFetching ? 'Yuklanmoqda…' : 'Yangilash'}</span>
          </button>
        </div>
      </div>

      {/* ── Apple KPI Strip ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="liquid-glass-card rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Jami hodisalar</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[var(--text-primary)]">{totalEvents}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">Ushbu ro'yxatda {items.length} ta</p>
        </div>
        <div className="liquid-glass-card rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Yaratish (Creates)</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[var(--text-primary)]">{stats.creates}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">Yangi yozuvlar</p>
        </div>
        <div className="liquid-glass-card rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">O'zgartirish (Updates)</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[var(--text-primary)]">{stats.updates}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">Tahrirlangan ma'lumotlar</p>
        </div>
        <div className="liquid-glass-card rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">O'chirish & Kirish</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[var(--text-primary)]">{stats.deletes + stats.security}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">O'chirish: {stats.deletes} · Kirish: {stats.security}</p>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="liquid-glass-surface relative z-10 flex flex-col gap-3 rounded-3xl p-4 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
          <GlassInput
            placeholder={t('audit.searchPlaceholder')}
            aria-label={t('audit.searchAria')}
            value={search}
            onChange={handleSearchChange}
            type="search"
          />
          <GlassSelect
            value={action}
            onChange={handleActionChange}
            aria-label={t('common.filterByAction')}
          >
            <option value="">{t('enum.allActions')}</option>
            {AUDIT_ACTIONS.map((auditAction) => (
              <option key={auditAction.value} value={auditAction.value}>
                {t(auditAction.label)}
              </option>
            ))}
          </GlassSelect>
        </div>
      </div>

      {/* ── Content View ── */}
      {audit.isLoading && !data ? (
        <div className="liquid-glass-surface rounded-3xl p-12 backdrop-blur-xl">
          <GlassPageLoader label={t('audit.loading')} />
        </div>
      ) : audit.isError ? (
        <div className="liquid-glass-surface rounded-3xl p-8 backdrop-blur-xl">
          <GlassErrorState
            title={t('audit.loadError')}
            message={getErrorMessage(audit.error as Error)}
            onRetry={handleRetry}
          />
        </div>
      ) : items.length === 0 ? (
        <div className="liquid-glass-surface rounded-3xl p-12 backdrop-blur-xl">
          <GlassEmptyState
            title={t('audit.emptyTitle')}
            message={hasActiveFilters ? t('common.adjustFilters') : t('audit.emptyMessage')}
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
                  <th className="px-4 py-3.5">{t('audit.col.entity')}</th>
                  <th className="px-4 py-3.5">{t('common.description')}</th>
                  <th className="px-4 py-3.5">{t('audit.col.actor')}</th>
                  <th className="py-3.5 pl-4 pr-6 text-right">Sidecar</th>
                </tr>
              </thead>
              <motion.tbody
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-white/20 dark:divide-white/[0.04]"
              >
                {items.map((event) => (
                  <motion.tr
                    key={event.id}
                    variants={rowVariants}
                    onClick={() => handleOpenAuditSidecar(event)}
                    className="group cursor-pointer transition-colors duration-200 hover:bg-white/40 dark:hover:bg-white/[0.03]"
                  >
                    <td className="py-4 pl-6 pr-4 whitespace-nowrap text-xs font-mono text-[var(--text-muted)]">
                      {formatDateTime(event.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <GlassBadge color={actionColor(event.action)}>
                        {t(actionKey(event.action))}
                      </GlassBadge>
                    </td>
                    <td className="px-4 py-4 text-xs">
                      <span className="font-semibold text-[var(--text-primary)]">{event.entityType}</span>
                      {event.entityId && (
                        <span className="font-mono text-[var(--text-muted)] ml-1.5">
                          · {truncateId(event.entityId)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 max-w-sm truncate text-xs text-[var(--text-secondary)]" title={event.description}>
                      {event.description}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs font-medium text-[var(--text-secondary)]">
                      {event.actorName || t('common.system')}
                    </td>
                    <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {(event.previousValue || event.newValue || (event.changedFields && event.changedFields.length > 0)) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playPop();
                              setDiffModalEvent(event);
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
                            handleOpenAuditSidecar(event);
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

export default AuditPage;