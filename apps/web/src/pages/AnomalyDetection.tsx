/**
 * M-EDU AnomalyDetectionPage — Liquid Glass Edition
 *
 * Apple-grade anomaly dashboard.
 *  - Multi-layer liquid glass surfaces (specular edge + chromatic hint)
 *  - Refined motion (no bounce, no pulse)
 *  - Severity filter tabs with live counts
 *  - Delta percentage (observed vs baseline)
 *  - Preserves 100% API contracts, TanStack Query, i18n
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  GlassPageHeader,
  GlassPageLoader,
  GlassEmptyState,
  GlassErrorState,
} from '@/components/ui';
import { analyticsApi } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

interface Anomaly {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  metric: string;
  observed: number;
  baseline: number | null;
  period: string;
  recommendation: string;
  insufficientData?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════
 * MOTION TOKENS — sokin, muqarrar
 * ═══════════════════════════════════════════════════════════════════ */

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const SPRING_GLASS = { type: 'spring' as const, stiffness: 280, damping: 32, mass: 0.85 };

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.03 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

/* ═══════════════════════════════════════════════════════════════════
 * LIQUID GLASS PRIMITIVE
 * ═══════════════════════════════════════════════════════════════════ */

function GlassPanel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`liquid-glass-card liquid-glass-surface relative overflow-hidden rounded-[20px] ${className}`}
      style={{
        boxShadow:
          '0 24px 60px -32px rgba(0,0,0,0.16), 0 4px 12px -6px rgba(0,0,0,0.05)',
      }}
    >
      <div className="absolute inset-0 bg-white/72 backdrop-blur-[40px] backdrop-saturate-150 dark:bg-neutral-950/60" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/20" />
      <div className="pointer-events-none absolute inset-0 rounded-[20px] ring-1 ring-inset ring-black/[0.05] dark:ring-white/[0.06]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * SEVERITY SYSTEM
 * ═══════════════════════════════════════════════════════════════════ */

function severityConfig(severity: Anomaly['severity']) {
  switch (severity) {
    case 'HIGH':
      return {
        dot: 'bg-rose-500',
        text: 'text-rose-600 dark:text-rose-400',
        deltaUp: 'bg-rose-500/[0.09] text-rose-700 dark:text-rose-300',
      };
    case 'MEDIUM':
      return {
        dot: 'bg-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
        deltaUp: 'bg-amber-500/[0.09] text-amber-700 dark:text-amber-300',
      };
    case 'LOW':
    default:
      return {
        dot: 'bg-blue-500',
        text: 'text-blue-600 dark:text-blue-400',
        deltaUp: 'bg-blue-500/[0.09] text-blue-700 dark:text-blue-300',
      };
  }
}

function formatType(type: string): string {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDelta(observed: number, baseline: number | null): { label: string; up: boolean } | null {
  if (baseline === null || baseline === 0) return null;
  const pct = ((observed - baseline) / Math.abs(baseline)) * 100;
  const up = pct > 0;
  return { label: `${up ? '+' : ''}${pct.toFixed(1)}%`, up };
}

/* ═══════════════════════════════════════════════════════════════════
 * SMALL CHIP
 * ═══════════════════════════════════════════════════════════════════ */

function Chip({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'amber';
}) {
  const cls =
    tone === 'amber'
      ? 'bg-amber-500/[0.08] text-amber-700 dark:text-amber-300'
      : 'bg-black/[0.035] dark:bg-white/[0.05] text-black/55 dark:text-white/55';
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * KPI STRIP — single glass surface, hairline dividers
 * ═══════════════════════════════════════════════════════════════════ */

function KpiStrip({
  items,
}: {
  items: { label: string; value: number; tone?: string }[];
}) {
  return (
    <GlassPanel>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item, i) => (
          <div key={i} className="relative flex flex-col gap-2 p-5">
            {i > 0 && (
              <span
                className="pointer-events-none absolute left-0 top-4 bottom-4 hidden w-px bg-black/[0.05] dark:bg-white/[0.05] lg:block"
                aria-hidden
              />
            )}
            <div className="flex items-center gap-1.5">
              {item.tone && (
                <span className={`h-1 w-1 rounded-full ${item.tone}`} aria-hidden />
              )}
              <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-black/45 dark:text-white/45">
                {item.label}
              </span>
            </div>
            <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-black/90 dark:text-white/90">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * DETECTOR PANEL — compact, expandable
 * ═══════════════════════════════════════════════════════════════════ */

function DetectorPanel({
  detectors,
  open,
  onToggle,
}: {
  detectors: { title: string; desc: string }[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <GlassPanel>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="text-[12.5px] font-medium text-black/80 dark:text-white/80">
            {detectors.length} detektor faol
          </span>
          <span className="text-[11px] text-black/25 dark:text-white/25" aria-hidden>·</span>
          <span className="text-[11.5px] text-black/45 dark:text-white/45">
            Avtonom monitoring
          </span>
        </div>
        <svg
          className={`h-3.5 w-3.5 text-black/40 transition-transform dark:text-white/40 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="grid gap-1.5 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
              {detectors.map((d, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-black/[0.025] px-3 py-2 dark:bg-white/[0.03]"
                >
                  <div className="text-[11px] font-semibold text-black/75 dark:text-white/75">
                    {d.title}
                  </div>
                  <div className="mt-0.5 text-[10.5px] leading-tight text-black/45 dark:text-white/45">
                    {d.desc}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * FILTER TAB
 * ═══════════════════════════════════════════════════════════════════ */

function FilterTab({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: 'rose' | 'amber' | 'blue';
}) {
  const toneCls =
    tone === 'rose'
      ? 'bg-rose-500'
      : tone === 'amber'
      ? 'bg-amber-500'
      : tone === 'blue'
      ? 'bg-blue-500'
      : 'bg-black/40 dark:bg-white/40';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
        active
          ? 'bg-black/[0.06] text-black/90 dark:bg-white/[0.08] dark:text-white/90'
          : 'text-black/55 hover:bg-black/[0.03] dark:text-white/55 dark:hover:bg-white/[0.04]'
      }`}
    >
      {tone && <span className={`h-1.5 w-1.5 rounded-full ${toneCls}`} aria-hidden />}
      <span>{label}</span>
      <span className="text-[11px] tabular-nums opacity-60">{count}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * ANOMALY ROW
 * ═══════════════════════════════════════════════════════════════════ */

function AnomalyRow({ anomaly, onOpenSidecar }: { anomaly: Anomaly; onOpenSidecar: () => void }) {
  const { t } = useI18n();
  const cfg = severityConfig(anomaly.severity);
  const delta = formatDelta(anomaly.observed, anomaly.baseline);

  return (
    <div className="group relative px-5 py-5 transition-colors hover:bg-black/[0.015] sm:px-6 dark:hover:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-4">
        {/* Left — main content */}
        <div className="min-w-0 flex-1">
          {/* Header: severity · type */}
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden />
            <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${cfg.text}`}>
              {anomaly.severity}
            </span>
            <span className="text-[10px] text-black/20 dark:text-white/20" aria-hidden>·</span>
            <span className="font-mono text-[10.5px] font-medium text-black/45 dark:text-white/45">
              {formatType(anomaly.type)}
            </span>
          </div>

          {/* Title + description */}
          <h4 className="text-[14.5px] font-semibold leading-snug text-black/90 dark:text-white/90">
            {anomaly.title}
          </h4>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-black/55 dark:text-white/55">
            {anomaly.description}
          </p>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Chip>{anomaly.metric}</Chip>
            <Chip>Davr: {anomaly.period}</Chip>
            {anomaly.insufficientData && (
              <Chip tone="amber">{t('anomaly.insufficientDataBadge')}</Chip>
            )}
          </div>

          {/* Recommendation */}
          {anomaly.recommendation && (
            <div className="mt-3 max-w-2xl rounded-lg border border-indigo-500/10 bg-indigo-500/[0.06] px-3 py-2 dark:bg-indigo-500/[0.08]">
              <p className="text-[12px] leading-relaxed text-indigo-900/80 dark:text-indigo-200/85">
                <span className="font-semibold">Tavsiya.</span> {anomaly.recommendation}
              </p>
            </div>
          )}
        </div>

        {/* Right — data column & Sidecar button */}
        <div className="flex flex-col items-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenSidecar}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-black/[0.03] px-2.5 py-1 text-xs font-semibold text-black/70 shadow-sm transition-all hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:text-indigo-400"
            title="macOS Split-View Sidecar (◨)"
          >
            <span>◨</span>
            <span className="hidden sm:inline">Sidecar</span>
          </button>
          {!anomaly.insufficientData && (
            <div className="text-right">
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-black/40 dark:text-white/40">
                {t('anomaly.observed')}
              </div>
              <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-black/90 dark:text-white/90">
                {anomaly.observed.toLocaleString()}
              </div>
              {anomaly.baseline !== null && (
                <div className="mt-1.5 text-[10.5px] font-medium text-black/40 dark:text-white/40">
                  Baseline {anomaly.baseline.toLocaleString()}
                </div>
              )}
              {delta && (
                <div
                  className={`mt-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums ${
                    delta.up ? cfg.deltaUp : 'bg-emerald-500/[0.09] text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {delta.label}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */

type SeverityFilter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';

export function AnomalyDetectionPage() {
  const { t } = useI18n();
  usePageTitle(t('anomaly.title'));
  const { playTick, playPop } = usePremiumSound();

  const [filter, setFilter] = useState<SeverityFilter>('ALL');
  const [detectorsOpen, setDetectorsOpen] = useState(false);

  const anomaliesQuery = useQuery({
    queryKey: ['anomalies-detect-all'],
    queryFn: () => analyticsApi.detectAllAnomalies() as Promise<Anomaly[]>,
  });

  const anomalies: Anomaly[] = anomaliesQuery.data ?? [];

  const handleOpenAnomalyDetailSidecar = useCallback((anomaly: Anomaly) => {
    playPop();
    const sidecarData: QuickLookData = {
      type: 'general',
      id: `${anomaly.type}-${anomaly.metric}`,
      title: anomaly.title,
      subtitle: `${anomaly.type} · ${anomaly.severity}`,
      status: {
        label: anomaly.severity,
        tone: anomaly.severity === 'HIGH' ? 'red' : anomaly.severity === 'MEDIUM' ? 'amber' : 'neutral',
      },
      metrics: [
        { label: 'Kuzatilgan', value: anomaly.observed.toLocaleString() },
        { label: 'Baza (Baseline)', value: anomaly.baseline !== null ? anomaly.baseline.toLocaleString() : '—' },
        { label: 'Metrika', value: anomaly.metric },
        { label: 'Davr', value: anomaly.period },
      ],
      details: [
        { label: 'Anomaliya turi', value: anomaly.type },
        { label: 'Tavsif', value: anomaly.description },
        { label: 'Metrika', value: anomaly.metric },
        { label: 'Kuzatilgan qiymat', value: String(anomaly.observed) },
        { label: 'Baza qiymat', value: anomaly.baseline !== null ? String(anomaly.baseline) : 'Mavjud emas' },
        { label: 'Tavsiya', value: anomaly.recommendation || '—' },
      ],
    };
    openSidecar(sidecarData);
  }, [playPop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === '1') {
        playTick();
        setFilter('ALL');
      } else if (e.key === '2') {
        playTick();
        setFilter('HIGH');
      } else if (e.key === '3') {
        playTick();
        setFilter('MEDIUM');
      } else if (e.key === '4') {
        playTick();
        setFilter('LOW');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        void anomaliesQuery.refetch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [anomaliesQuery, playTick]);

  const counts = useMemo(
    () => ({
      all: anomalies.length,
      HIGH: anomalies.filter((a) => a.severity === 'HIGH').length,
      MEDIUM: anomalies.filter((a) => a.severity === 'MEDIUM').length,
      LOW: anomalies.filter((a) => a.severity === 'LOW').length,
      insufficient: anomalies.filter((a) => a.insufficientData).length,
    }),
    [anomalies],
  );

  const filtered = useMemo(
    () => (filter === 'ALL' ? anomalies : anomalies.filter((a) => a.severity === filter)),
    [anomalies, filter],
  );

  /* ── Loading state ── */
  if (anomaliesQuery.isLoading && !anomaliesQuery.data) {
    return (
      <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
        <GlassPageHeader title={t('anomaly.title')} subtitle="System patterns scanning…" />
        <div className="mt-8 flex items-center justify-center rounded-[20px] border border-black/[0.05] bg-white/60 py-24 backdrop-blur-xl dark:border-white/[0.06] dark:bg-neutral-950/60">
          <GlassPageLoader label={t('anomaly.loading')} />
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (anomaliesQuery.isError) {
    return (
      <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
        <GlassPageHeader title={t('anomaly.title')} subtitle="Connection error" />
        <div className="mt-8 rounded-[20px] border border-black/[0.05] bg-white/60 p-12 backdrop-blur-xl dark:border-white/[0.06] dark:bg-neutral-950/60">
          <GlassErrorState
            message={getErrorMessage(anomaliesQuery.error)}
            onRetry={() => anomaliesQuery.refetch()}
          />
        </div>
      </div>
    );
  }

  /* ── Detector definitions ── */
  const detectors = [
    { title: t('anomaly.detector.revenueDrop'), desc: t('anomaly.detector.revenueDropDesc') },
    { title: t('anomaly.detector.expenseSpike'), desc: t('anomaly.detector.expenseSpikeDesc') },
    { title: t('anomaly.detector.refundAnomaly'), desc: t('anomaly.detector.refundAnomalyDesc') },
    { title: t('anomaly.detector.debtIncrease'), desc: t('anomaly.detector.debtIncreaseDesc') },
    { title: t('anomaly.detector.cashFlowNegative'), desc: t('anomaly.detector.cashFlowNegativeDesc') },
    { title: t('anomaly.detector.payrollExceedsRevenue'), desc: t('anomaly.detector.payrollExceedsRevenueDesc') },
    { title: t('anomaly.detector.latePayment'), desc: t('anomaly.detector.latePaymentDesc') },
    { title: t('anomaly.detector.enrollmentDrop'), desc: t('anomaly.detector.enrollmentDropDesc') },
  ];

  /* ── KPI items ── */
  const kpis = [
    { label: t('anomaly.totalDetected'), value: counts.all, tone: 'bg-indigo-500' },
    { label: t('anomaly.highSeverity'), value: counts.HIGH, tone: 'bg-rose-500' },
    { label: t('anomaly.mediumSeverity'), value: counts.MEDIUM, tone: 'bg-amber-500' },
    { label: t('anomaly.lowSeverity'), value: counts.LOW, tone: 'bg-blue-500' },
    { label: t('anomaly.insufficientData'), value: counts.insufficient, tone: 'bg-black/30 dark:bg-white/30' },
  ];

  return (
    <div className="relative min-h-screen bg-transparent selection:bg-indigo-500/25">
      {/* Ambient atmosphere — super subtle */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-[-15%] top-[-10%] h-[50%] w-[45%] rounded-full bg-rose-500/[0.03] blur-[120px] dark:bg-rose-500/[0.04]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[45%] w-[40%] rounded-full bg-indigo-500/[0.03] blur-[120px] dark:bg-indigo-500/[0.04]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto w-full max-w-[1400px] space-y-5 p-4 sm:p-6 lg:p-8"
      >
        {/* Header */}
        <motion.div variants={itemVariants}>
          <GlassPageHeader title={t('anomaly.title')} subtitle={t('anomaly.subtitle')} />
        </motion.div>

        {/* KPI strip */}
        <motion.div variants={itemVariants}>
          <KpiStrip items={kpis} />
        </motion.div>

        {/* Detector panel */}
        <motion.div variants={itemVariants}>
          <DetectorPanel
            detectors={detectors}
            open={detectorsOpen}
            onToggle={() => setDetectorsOpen((v) => !v)}
          />
        </motion.div>

        {/* Anomalies list */}
        <motion.div variants={itemVariants}>
          <GlassPanel className="min-h-[300px]">
            {/* Filter header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.05] px-4 py-2.5 dark:border-white/[0.05] sm:px-5">
              <div className="flex flex-wrap items-center gap-0.5">
                <FilterTab
                  active={filter === 'ALL'}
                  onClick={() => setFilter('ALL')}
                  label="Barchasi"
                  count={counts.all}
                />
                <FilterTab
                  active={filter === 'HIGH'}
                  onClick={() => setFilter('HIGH')}
                  label="High"
                  count={counts.HIGH}
                  tone="rose"
                />
                <FilterTab
                  active={filter === 'MEDIUM'}
                  onClick={() => setFilter('MEDIUM')}
                  label="Medium"
                  count={counts.MEDIUM}
                  tone="amber"
                />
                <FilterTab
                  active={filter === 'LOW'}
                  onClick={() => setFilter('LOW')}
                  label="Low"
                  count={counts.LOW}
                  tone="blue"
                />
              </div>
              <span className="text-[11px] font-medium tabular-nums text-black/40 dark:text-white/40">
                {filtered.length} ta belgilangan
              </span>
            </div>

            {/* Body */}
            <div className="relative z-10">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center p-16">
                  {filter === 'ALL' ? (
                    <GlassEmptyState
                      title={t('anomaly.noAnomalies')}
                      message={t('anomaly.noAnomaliesDesc')}
                    />
                  ) : (
                    <GlassEmptyState
                      title="Bu toifada anomaliya yo'q"
                      message="Boshqa severity darajasini tanlang."
                    />
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {filtered.map((a, idx) => (
                      <motion.li
                        key={`${a.type}-${a.period}-${idx}`}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                        transition={SPRING_GLASS}
                      >
                        <AnomalyRow
                          anomaly={a}
                          onOpenSidecar={() => handleOpenAnomalyDetailSidecar(a)}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </GlassPanel>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default AnomalyDetectionPage;