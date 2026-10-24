/**
 * M-EDU SecurityCenter — Apple Design Award V2 Edition
 *
 * Premium craft:
 *  - Apple SF Pro visual hierarchy with ambient security lighting
 *  - Hero banner with Sentinel Shield badge & real-time risk score
 *  - Framer-motion spring transitions & segmented filter pills
 *  - Staggered security event cards with severity glow badges
 *  - Liquid glass surfaces with subtle inner borders and squircle geometry
 *  - Full preservation of queries, mutations, RBAC, and i18n
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassButton, GlassStatCard } from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { useToast } from '@/components/ui/GlassToast';
import { securityApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
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

interface SecurityAlert {
  id: string;
  type: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  title: string;
  message: string;
  actorName?: string;
  ipAddress?: string;
  detectedAt: string;
}

interface SecuritySummary {
  riskScore?: number;
  detectedThisWeek?: number;
  resolvedThisWeek?: number;
  bySeverity?: Partial<Record<SecurityAlert['severity'], number>>;
}

interface SecurityAlertsResponse {
  items: SecurityAlert[];
  total: number;
}

const SEVERITY_COLOR: Record<SecurityAlert['severity'], 'success' | 'warning' | 'error' | 'primary' | 'muted'> = {
  INFO: 'muted',
  LOW: 'muted',
  MEDIUM: 'primary',
  HIGH: 'warning',
  CRITICAL: 'error',
};

const SEVERITY_LABEL_KEYS: Record<SecurityAlert['severity'], string> = {
  INFO: 'security.severity.INFO',
  LOW: 'security.severity.LOW',
  MEDIUM: 'security.severity.MEDIUM',
  HIGH: 'security.severity.HIGH',
  CRITICAL: 'security.severity.CRITICAL',
};

const FILTER_LABEL_KEYS: Record<'all' | 'new' | 'critical', string> = {
  all: 'security.filter.all',
  new: 'security.filter.new',
  critical: 'security.filter.critical',
};

export function SecurityCenterPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('security.title'));
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'new' | 'critical'>('new');

  const toast = useToast();
  const { playTick, playPop, playSuccess } = usePremiumSound();

  const summaryQuery = useQuery({
    queryKey: ['security-summary'],
    queryFn: () => securityApi.summary() as Promise<SecuritySummary>,
  });

  const alertsQuery = useQuery({
    queryKey: ['security-alerts', filter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filter === 'new') params.status = 'NEW';
      if (filter === 'critical') {
        params.severity = 'CRITICAL';
        params.status = 'NEW';
      }
      return securityApi.alerts(params) as Promise<SecurityAlertsResponse>;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => securityApi.resolve(id),
    onSuccess: () => {
      toast.success(t('security.resolvedToast'));
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ['security-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['security-summary'] });
    },
    onError: (e) => toast.error(t('security.resolveError'), getErrorMessage(e)),
  });

  const handleOpenSecuritySidecar = useCallback((alert: SecurityAlert) => {
    playPop();
    const sidecarData: QuickLookData = {
      type: 'general',
      id: alert.id,
      title: alert.title,
      subtitle: `${alert.type} · ${alert.severity}`,
      badge: {
        text: alert.status,
        tone: alert.status === 'RESOLVED' ? 'emerald' : alert.severity === 'CRITICAL' ? 'rose' : 'amber',
      },
      metrics: [
        { label: 'Daraja', value: alert.severity },
        { label: 'Holat', value: alert.status },
        { label: 'IP Manzil', value: alert.ipAddress || '—' },
        { label: 'Foydalanuvchi', value: alert.actorName || 'Tizim' },
      ],
      details: [
        { label: 'Hodisa ID', value: alert.id, copyable: true },
        { label: 'Turi', value: alert.type },
        { label: 'Xabar', value: alert.message },
        { label: 'IP Manzil', value: alert.ipAddress || '—', copyable: Boolean(alert.ipAddress) },
        { label: 'Aniqlangan vaqt', value: new Date(alert.detectedAt).toLocaleString() },
      ],
      primaryAction: alert.status !== 'RESOLVED' ? {
        label: t('security.markResolved') || 'Hal qilindi',
        onExecute: () => {
          resolveMutation.mutate(alert.id);
        },
      } : undefined,
    };
    openSidecar(sidecarData);
  }, [playPop, resolveMutation, t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === '1') {
        playTick();
        setFilter('new');
      } else if (e.key === '2') {
        playTick();
        setFilter('critical');
      } else if (e.key === '3') {
        playTick();
        setFilter('all');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        void alertsQuery.refetch();
        void summaryQuery.refetch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [alertsQuery, summaryQuery, playTick]);

  const alerts: SecurityAlert[] = (alertsQuery.data as SecurityAlertsResponse | undefined)?.items ?? [];
  const summary = summaryQuery.data;

  const riskScore = summary?.riskScore ?? 0;
  const isHealthyRisk = riskScore < 30;

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="relative min-h-screen bg-transparent p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      {/* Ambient AuroraMesh substrate */}
      <AuroraMesh variant="security" />

      {/* ── Apple V2 Hero Header ── */}
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {t('security.title')}
              </h1>
              <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                v2 Apple
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t('security.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        <GlassStatCard
          label={t('security.riskScore')}
          value={`${riskScore}/100`}
          trend={{
            value: isHealthyRisk ? 'Low Risk' : 'Elevated',
            direction: isHealthyRisk ? 'up' : 'down',
          }}
        />
        <GlassStatCard label={t('security.alertsThisWeek')} value={summary?.detectedThisWeek ?? 0} />
        <GlassStatCard label={t('security.critical')} value={summary?.bySeverity?.CRITICAL ?? 0} />
        <GlassStatCard label={t('security.resolvedThisWeek')} value={summary?.resolvedThisWeek ?? 0} />
      </div>

      {/* ── Security Architecture Overview (Apple Liquid Glass) ── */}
      <div className="relative z-10 overflow-hidden rounded-2xl liquid-glass-surface p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <svg className="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {t('security.protection.title')}
          </h3>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Enterprise Shield Active
          </span>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300">
          <li className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]">
            <span className="text-emerald-500 font-bold">✓</span>
            <div>
              <strong className="text-slate-900 dark:text-slate-100">{t('security.protection.rateLimiting')}</strong>
              <p className="text-xs text-slate-400 mt-0.5">{t('security.protection.rateLimitingDesc')}</p>
            </div>
          </li>
          <li className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]">
            <span className="text-emerald-500 font-bold">✓</span>
            <div>
              <strong className="text-slate-900 dark:text-slate-100">{t('security.protection.jwt')}</strong>
              <p className="text-xs text-slate-400 mt-0.5">{t('security.protection.jwtDesc')}</p>
            </div>
          </li>
          <li className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]">
            <span className="text-emerald-500 font-bold">✓</span>
            <div>
              <strong className="text-slate-900 dark:text-slate-100">{t('security.protection.oauth')}</strong>
              <p className="text-xs text-slate-400 mt-0.5">{t('security.protection.oauthDesc')}</p>
            </div>
          </li>
          <li className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]">
            <span className="text-emerald-500 font-bold">✓</span>
            <div>
              <strong className="text-slate-900 dark:text-slate-100">{t('security.protection.rbac')}</strong>
              <p className="text-xs text-slate-400 mt-0.5">{t('security.protection.rbacDesc')}</p>
            </div>
          </li>
          <li className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]">
            <span className="text-emerald-500 font-bold">✓</span>
            <div>
              <strong className="text-slate-900 dark:text-slate-100">{t('security.protection.tenantIsolation')}</strong>
              <p className="text-xs text-slate-400 mt-0.5">{t('security.protection.tenantIsolationDesc')}</p>
            </div>
          </li>
          <li className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]">
            <span className="text-emerald-500 font-bold">✓</span>
            <div>
              <strong className="text-slate-900 dark:text-slate-100">{t('security.protection.prisma')}</strong>
              <p className="text-xs text-slate-400 mt-0.5">{t('security.protection.prismaDesc')}</p>
            </div>
          </li>
        </ul>
      </div>

      {/* ── Segmented Filter Tabs ── */}
      <div className="relative z-10 flex p-1 rounded-2xl liquid-glass-surface shadow-sm w-fit gap-1">
        {(['new', 'critical', 'all'] as const).map((f) => {
          const isActive = filter === f;
          return (
            <button
              key={f}
              onClick={() => {
                playTick();
                setFilter(f);
              }}
              className={`relative px-4 py-2.5 min-h-[44px] inline-flex items-center justify-center text-xs font-semibold rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="securityActiveFilter"
                  transition={SPRING.snappy}
                  className="absolute inset-0 rounded-xl bg-white dark:bg-slate-800 border border-black/[0.04] dark:border-white/[0.08] shadow-sm"
                />
              )}
              <span className="relative z-10">{t(FILTER_LABEL_KEYS[f])}</span>
            </button>
          );
        })}
      </div>

      {/* ── Alerts Feed ── */}
      <div className="relative z-10 overflow-hidden rounded-2xl liquid-glass-surface shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        {alertsQuery.isLoading ? (
          <div className="p-12"><GlassPageLoader label={t('security.loading')} /></div>
        ) : alertsQuery.isError ? (
          <div className="p-8">
            <GlassErrorState
              title={t('security.loadError')}
              message={getErrorMessage(alertsQuery.error)}
              onRetry={() => alertsQuery.refetch()}
            />
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12">
            <GlassEmptyState
              title={t('security.empty')}
              message={t('security.emptyHint')}
            />
          </div>
        ) : (
          <motion.ul
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-slate-200/80 dark:divide-slate-800 dark:divide-white/[0.05]"
          >
            {alerts.map((alert) => (
              <motion.li
                key={alert.id}
                variants={itemVariants}
                className="p-4 sm:p-5 flex items-start gap-4 transition-colors duration-200 hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"
              >
                <div className="shrink-0 mt-0.5">
                  <GlassBadge color={SEVERITY_COLOR[alert.severity]}>{t(SEVERITY_LABEL_KEYS[alert.severity])}</GlassBadge>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{alert.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{alert.message}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                    <span className="font-mono rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">{alert.type}</span>
                    {alert.actorName && (
                      <>
                        <span>·</span>
                        <span className="font-medium text-zinc-600 dark:text-zinc-300">{alert.actorName}</span>
                      </>
                    )}
                    {alert.ipAddress && (
                      <>
                        <span>·</span>
                        <span className="font-mono">{alert.ipAddress}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{new Date(alert.detectedAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-center">
                  <button
                    type="button"
                    onClick={() => handleOpenSecuritySidecar(alert)}
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] gap-1.5 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:text-indigo-400"
                    title="macOS Split-View Sidecar (◨)"
                  >
                    <span>◨</span>
                    <span className="hidden sm:inline">Sidecar</span>
                  </button>
                  <GlassButton
                    size="sm"
                    className="min-h-[44px]"
                    variant={alert.status === 'RESOLVED' ? 'ghost' : 'secondary'}
                    onClick={() => resolveMutation.mutate(alert.id)}
                    disabled={alert.status === 'RESOLVED'}
                  >
                    {alert.status === 'RESOLVED' ? t('security.resolved') : t('security.markResolved')}
                  </GlassButton>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </motion.main>
  );
}

export default SecurityCenterPage;

