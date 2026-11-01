/**
 * M-EDU Telegram Page
 * Telegram bot administration, account linking, automated notifications, and message delivery status.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

import { telegramApi, type TelegramStatusResponse, type TelegramAdminOverview } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import {
  GlassErrorState,
  GlassButton,
  useToasts,
  ConfirmDialog,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import { OmnichannelBroadcastStudio } from '@/components/telegram/OmnichannelBroadcastStudio';
import { usePageTitle } from '@/hooks/usePageTitle';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS (SVG Icons)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  telegram: [
    'M21.5 3.5 2.8 10.6l5.2 1.6 1.6 5.2 3-3.6 4.9 3.4z',
    'M8 12.2 16.9 6.4l-5 8.2',
  ],
  send: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  ],
  shieldCheck: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
  ],
  bolt: [
    'M13 2 3 14h9l-1 8 10-12h-9z',
  ],
  link: [
    'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
    'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  ],
  unlink: [
    'M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.71 1.71',
    'M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71',
  ],
  copy: [
    'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
  check: ['M20 6 9 17l-5-5'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6', 'M9 9l6 6',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4', 'M12 16h.01',
  ],
  message: [
    'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  ],
  bell: [
    'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9',
    'M13.73 21a2 2 0 0 1-3.46 0',
  ],
  key: [
    'M21 2l-2 2',
    'M15.5 7.5l3 3L22 7l-3-3z',
    'M15.5 7.5 9 14a3.5 3.5 0 1 1-3-3l6.5-6.5',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  usersRound: [
    'M18 21a8 8 0 0 0-16 0',
    'M10 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3',
  ],
  bot: [
    'M12 2v4',
    'M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z',
    'M9 14h.01', 'M15 14h.01',
    'M9 17h6',
  ],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  externalLink: [
    'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    'M15 3h6v6',
    'M10 14 21 3',
  ],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  ],
};

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * TONES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'telegram';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:     { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)', glow: 'rgba(37,99,235,0.28)', border: 'rgba(37,99,235,0.20)' },
  green:    { fg: '#10B981', bg: 'rgba(16,185,129,0.10)',  glow: 'rgba(16,185,129,0.28)',  border: 'rgba(16,185,129,0.20)' },
  orange:   { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  glow: 'rgba(245,158,11,0.28)',  border: 'rgba(245,158,11,0.20)' },
  red:      { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',  glow: 'rgba(239,68,68,0.28)',  border: 'rgba(239,68,68,0.20)' },
  purple:   { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)', glow: 'rgba(99,102,241,0.28)', border: 'rgba(99,102,241,0.20)' },
  cyan:     { fg: '#0284C7', bg: 'rgba(2,132,199,0.10)', glow: 'rgba(2,132,199,0.28)', border: 'rgba(2,132,199,0.20)' },
  gray:     { fg: '#64748B', bg: 'rgba(100,116,139,0.10)', glow: 'rgba(100,116,139,0.22)', border: 'rgba(100,116,139,0.20)' },
  emerald:  { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
  telegram: { fg: '#0088cc', bg: 'rgba(0,136,204,0.10)', glow: 'rgba(0,136,204,0.28)', border: 'rgba(0,136,204,0.20)' },
};

/* ============================================================================
 * HELPERS (preserved)
 * ========================================================================== */

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'tg:';
  } catch {
    return false;
  }
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-[#E5E5EA]/60 dark:bg-[#2C2C2E]/60 ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function TelegramSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-72 w-full" radius="1.75rem" />
    </div>
  );
}

function CountUp({
  value,
  duration = 1.1,
}: {
  value: number;
  duration?: number;
}) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      const safeVal = Number.isFinite(value) ? value : 0;
      setN(safeVal * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{Math.round(Number.isFinite(n) ? n : 0).toLocaleString('uz-UZ')}</span>;
}

/** Premium KPI tile */
function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
  stringValue,
  secondary,
}: {
  label: string;
  value?: number;
  icon: string[];
  tone?: Tone;
  stringValue?: string;
  secondary?: string;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-3.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-t-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent)' }}
      />
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)' }}
        />
        <Icon paths={icon} size={18} strokeWidth={2} className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          {typeof value === 'number' ? <CountUp value={value} /> : stringValue}
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
          {label}
        </div>
        {secondary && (
          <div className="mt-0.5 truncate text-[10.5px] font-semibold tracking-tight text-[#64748B]/80">
            {secondary}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Status pill with pulse */
function StatusPill({ active, label }: { active: boolean; label: string }) {
  const tone: Tone = active ? 'emerald' : 'orange';
  const c = TONES[tone];
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {active && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: c.fg, opacity: 0.6 }}
            animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      </span>
      {label}
    </span>
  );
}

/** Premium tab control with layoutId */
function PremiumTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon: string[]; tone: Tone }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-black/[0.04] bg-black/[0.04] p-1 dark:border-white/[0.06] dark:bg-white/[0.06]"
    >
      {tabs.map((tb) => {
        const isActive = active === tb.id;
        const c = TONES[tb.tone];
        return (
          <motion.button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tb.id)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING.snappy}
            className="relative flex-1 overflow-hidden rounded-xl px-3.5 py-2 text-[12.5px] font-bold tracking-tight outline-none transition-colors whitespace-nowrap"
            style={{
              color: isActive ? c.fg : '#64748B',
            }}
          >
            {isActive && (
              <motion.span
                layoutId="telegram-tab-active"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px -8px ${c.glow}`,
                }}
                transition={SPRING.smooth}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              <Icon paths={tb.icon} size={13} strokeWidth={2.4} />
              {tb.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Section panel */
function SectionPanel({
  icon,
  tone = 'blue',
  title,
  subtitle,
  right,
  children,
}: {
  icon: string[];
  tone?: Tone;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = TONES[tone];
  return (
    <motion.section
      variants={cardVariants}
      className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
    >
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.05] px-5 py-4 dark:border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: c.bg,
              color: c.fg,
              border: `1px solid ${c.border}`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
            }}
          >
            <Icon paths={icon} size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[13.5px] font-semibold tracking-tight text-[var(--text-primary)]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {right}
      </div>
      <div className="relative">{children}</div>
    </motion.section>
  );
}

/** Feature card */
function FeatureCard({
  icon,
  title,
  desc,
  tone = 'telegram',
}: {
  icon: string[];
  title: string;
  desc: string;
  tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -4 }}
      transition={SPRING.smooth}
      className="group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.12] transition-opacity group-hover:opacity-25"
        style={{ background: c.fg, filter: 'blur(30px)' }}
      />
      <div
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-white"
        style={{
          background: `linear-gradient(135deg, ${c.fg} 0%, ${c.glow} 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 20px -8px ${c.glow}`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
          }}
        />
        <Icon paths={icon} size={22} strokeWidth={2} className="relative" />
      </div>
      <h4 className="relative mt-4 text-[14px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
        {title}
      </h4>
      <p className="relative mt-1.5 text-[12.5px] font-medium leading-relaxed text-[#64748B]">
        {desc}
      </p>
    </motion.div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function TelegramPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('nav.telegram') || 'Telegram Integration');
  const { user } = useAuth();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    urlTab && ['personal', 'features', 'broadcast', 'admin'].includes(urlTab)
      ? urlTab
      : 'personal',
  );

  useEffect(() => {
    if (urlTab && urlTab !== activeTab && ['personal', 'features', 'broadcast', 'admin'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab, activeTab]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'personal') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [pendingLink, setPendingLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const isAdmin = useMemo(
    () =>
      user?.role === 'SUPER_ADMIN' ||
      user?.role === 'ORG_ADMIN' ||
      user?.role === 'MANAGER',
    [user?.role],
  );

  /* ── Queries ──────────────────────────────────────────────────────── */
  const statusQ = useQuery({
    queryKey: ['telegram-status'],
    queryFn: telegramApi.status,
    refetchInterval: 30_000,
  });

  const adminOverviewQ = useQuery<TelegramAdminOverview>({
    queryKey: ['telegram-admin-overview'],
    queryFn: telegramApi.adminOverview,
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  /* ── Mutations ────────────────────────────────────────────────────── */
  const createLinkMut = useMutation({
    mutationFn: () => telegramApi.createLink(),
    onSuccess: (data) => {
      setPendingLink(data.deepLink);
      setCopied(false);
      push(
        'success',
        t('settings.telegram.linkReady') || 'Integration link ready',
      );
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const unlinkMut = useMutation({
    mutationFn: () => telegramApi.unlink(),
    onSuccess: () => {
      setPendingLink(null);
      setConfirmUnlinkOpen(false);
      push(
        'success',
        t('settings.telegram.disconnected') || 'Account disconnected',
      );
      qc.invalidateQueries({ queryKey: ['telegram-status'] });
      qc.invalidateQueries({ queryKey: ['telegram-admin-overview'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const testNotifMut = useMutation({
    mutationFn: () => telegramApi.testNotification(),
    onSuccess: (data) => {
      if (data.sent)
        push(
          'success',
          t('settings.telegram.testSent') || 'Test message sent',
        );
      else
        push(
          'error',
          t('settings.telegram.testFailed') ||
            'Failed to send test message',
        );
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const copyLink = useCallback(async () => {
    if (!pendingLink) return;
    try {
      await navigator.clipboard.writeText(pendingLink);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
      push('success', t('common.copied') || 'Copied to clipboard');
    } catch {
      push('error', 'Failed to copy');
    }
  }, [pendingLink, push, t]);

  const TABS = useMemo(
    () => [
      {
        id: 'personal',
        label: t('telegram.tabPersonal') || 'My Connection',
        icon: I.bot,
        tone: 'telegram' as Tone,
      },
      {
        id: 'features',
        label: t('telegram.tabFeatures') || 'Bot Features',
        icon: I.sparkles,
        tone: 'purple' as Tone,
      },
      ...(isAdmin
        ? [
            {
              id: 'broadcast',
              label: t('telegram.tabBroadcast') || 'Broadcast Studio',
              icon: I.send,
              tone: 'blue' as Tone,
            },
            {
              id: 'admin',
              label: t('telegram.tabAdmin') || 'Admin Overview',
              icon: I.shieldCheck,
              tone: 'emerald' as Tone,
            },
          ]
        : []),
    ],
    [isAdmin, t],
  );

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (statusQ.isLoading) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80" />
        <TelegramSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (statusQ.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            title="Error"
            message={getErrorMessage(statusQ.error as Error)}
            onRetry={() => void statusQ.refetch()}
          />
        </div>
      </div>
    );
  }

  const statusData = statusQ.data as TelegramStatusResponse;
  const isLinked = statusData?.status === 'ACTIVE';

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
      <AuroraMesh variant="corporate" opacity={0.65} />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="page-container mx-auto max-w-5xl space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))]"
      >
      {toastNode}

      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card sm:p-7"
        >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {/* Gradient Telegram tile */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #0088cc 0%, #0284C7 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(0,136,204,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.telegram} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0088cc]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#0088cc]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Integration
                </span>
                <StatusPill
                  active={isLinked}
                  label={isLinked ? 'Connected' : 'Not Connected'}
                />
                {isLinked && statusData?.username && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0088cc]/10 px-2.5 py-1 text-[10.5px] font-bold tracking-[0.06em] text-[#0088cc]">
                    <Icon paths={I.bot} size={11} strokeWidth={2.4} />
                    @{statusData.username}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('nav.telegram') || 'Telegram Integration'}
              </h1>
              <p className="mt-1 max-w-2xl text-[13.5px] font-medium text-[#64748B]">
                {t('telegram.subtitle') ||
                  'Connect your account to receive instant notifications and manage classes via Telegram.'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI BAR
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <KpiTile
          label={t('common.status') || 'Status'}
          stringValue={isLinked ? t('common.active') : t('common.idle')}
          icon={isLinked ? I.checkCircle : I.alertCircle}
          tone={isLinked ? 'emerald' : 'orange'}
        />
        <KpiTile
          label={t('telegram.kpi.account')}
          stringValue={
            isLinked && statusData?.username ? `@${statusData.username}` : '—'
          }
          icon={I.bot}
          tone="telegram"
        />
        {isAdmin ? (
          <KpiTile
            label={t('telegram.kpi.linkedAccounts')}
            value={adminOverviewQ.data?.accounts?.total ?? 0}
            icon={I.users}
            tone="blue"
          />
        ) : (
          <KpiTile
            label={t('telegram.kpi.features')}
            value={4}
            icon={I.sparkles}
            tone="purple"
          />
        )}
        {isAdmin ? (
          <KpiTile
            label={t('telegram.kpi.delivered24h')}
            value={adminOverviewQ.data?.deliveries?.last24h?.sent ?? 0}
            icon={I.activity}
            tone="emerald"
          />
        ) : (
          <KpiTile
            label={t('telegram.kpi.reminders')}
            stringValue="15m"
            icon={I.bell}
            tone="orange"
          />
        )}
      </motion.div>

      {/* ============================================================
          TABS
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <PremiumTabs tabs={TABS} active={activeTab} onChange={handleTabChange} />
      </motion.div>

      {/* ============================================================
          TAB CONTENT
      ============================================================ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={SPRING.smooth}
          className="space-y-5"
        >
          {/* ========== PERSONAL TAB ========== */}
          {activeTab === 'personal' && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* Connection panel */}
              <SectionPanel
                icon={isLinked ? I.shieldCheck : I.link}
                tone={isLinked ? 'emerald' : 'telegram'}
                title={
                  isLinked ? 'Connected to Telegram' : 'Not Connected'
                }
                subtitle={
                  isLinked
                    ? 'Your account is securely linked to the M-EDU bot.'
                    : 'Link your account to get instant class updates.'
                }
                right={
                  <StatusPill
                    active={isLinked}
                    label={isLinked ? 'Active' : 'Pending'}
                  />
                }
              >
                <div className="space-y-4 p-5">
                  {isLinked ? (
                    <>
                      {/* Account card */}
                      <div
                        className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#10B98133] bg-[#10B981]/[0.06] px-4 py-3.5"
                      >
                        <div
                          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
                          style={{
                            background:
                              'linear-gradient(135deg, #0088cc 0%, #0284C7 100%)',
                            boxShadow:
                              'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(0,136,204,0.5)',
                          }}
                        >
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-2xl"
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                            }}
                          />
                          <Icon paths={I.bot} size={20} strokeWidth={2} className="relative" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                            Connected Username
                          </p>
                          <p className="mt-0.5 truncate text-[15px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                            @{statusData?.username || 'unknown'}
                          </p>
                        </div>
                        <StatusPill active label="Active" />
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={SPRING.snappy}
                        >
                          <GlassButton
                            type="button"
                            variant="primary"
                            onClick={() => testNotifMut.mutate()}
                            disabled={testNotifMut.isPending}
                          >
                            <span className="inline-flex items-center gap-2">
                              {testNotifMut.isPending ? (
                                <>
                                  <motion.span
                                    className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                                    animate={{ rotate: 360 }}
                                    transition={{
                                      duration: 0.9,
                                      repeat: Infinity,
                                      ease: 'linear',
                                    }}
                                  />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Icon
                                    paths={I.send}
                                    size={14}
                                    strokeWidth={2.4}
                                  />
                                  Test Notification
                                </>
                              )}
                            </span>
                          </GlassButton>
                        </motion.div>
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <GlassButton
                            type="button"
                            variant="danger"
                            onClick={() => setConfirmUnlinkOpen(true)}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Icon
                                paths={I.unlink}
                                size={14}
                                strokeWidth={2.2}
                              />
                              Disconnect
                            </span>
                          </GlassButton>
                        </motion.div>
                      </div>
                    </>
                  ) : (
                    <>
                      {!pendingLink ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center dark:border-[#ffffff15]">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0088cc]/10 text-[#0088cc]">
                            <Icon paths={I.link} size={22} strokeWidth={2} />
                          </div>
                          <p className="mt-3 text-[13.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            Ready to link?
                          </p>
                          <p className="mx-auto mt-1 max-w-sm text-[12px] font-medium text-[#64748B]">
                            Generate a one-time link and open it in Telegram to
                            connect your account.
                          </p>
                          <div className="mt-4 flex justify-center">
                            <motion.div
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              transition={SPRING.snappy}
                            >
                              <GlassButton
                                type="button"
                                variant="primary"
                                onClick={() => createLinkMut.mutate()}
                                disabled={createLinkMut.isPending}
                              >
                                <span className="inline-flex items-center gap-2">
                                  {createLinkMut.isPending ? (
                                    <>
                                      <motion.span
                                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                                        animate={{ rotate: 360 }}
                                        transition={{
                                          duration: 0.9,
                                          repeat: Infinity,
                                          ease: 'linear',
                                        }}
                                      />
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Icon
                                        paths={I.link}
                                        size={14}
                                        strokeWidth={2.4}
                                      />
                                      Generate Link
                                    </>
                                  )}
                                </span>
                              </GlassButton>
                            </motion.div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Steps */}
                          <div className="rounded-2xl border border-[#0088cc33] bg-[#0088cc]/[0.06] p-4">
                            <ol className="space-y-2">
                              <li className="flex items-start gap-2.5 text-[12.5px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#0088cc] text-[10px] font-bold text-white">
                                  1
                                </span>
                                Click the link or button below to open Telegram.
                              </li>
                              <li className="flex items-start gap-2.5 text-[12.5px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#0088cc] text-[10px] font-bold text-white">
                                  2
                                </span>
                                Press START in the bot.
                              </li>
                            </ol>
                          </div>

                          {/* Link copy */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={pendingLink}
                              className="flex-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-[#00000003] px-3 py-2.5 font-mono text-[11.5px] text-[#1D1D1F] outline-none dark:border-[#ffffff08] dark:bg-[#ffffff04] dark:text-[#F5F5F7]"
                            />
                            <motion.button
                              type="button"
                              onClick={copyLink}
                              whileHover={{ scale: 1.08 }}
                              whileTap={{ scale: 0.92 }}
                              transition={SPRING.snappy}
                              aria-label={t('common.copyLink')}
                              title="Copy link"
                              className="flex h-10 w-10 items-center justify-center rounded-xl outline-none"
                              style={{
                                background: copied
                                  ? 'rgba(16,185,129,0.14)'
                                  : 'rgba(0,136,204,0.10)',
                                color: copied ? '#10B981' : '#0088cc',
                                border: `1px solid ${
                                  copied
                                    ? 'rgba(16,185,129,0.28)'
                                    : 'rgba(0,136,204,0.20)'
                                }`,
                              }}
                            >
                              <AnimatePresence mode="wait">
                                <motion.span
                                  key={copied ? 'check' : 'copy'}
                                  initial={{ scale: 0.6, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.6, opacity: 0 }}
                                  transition={SPRING.snappy}
                                >
                                  <Icon
                                    paths={copied ? I.check : I.copy}
                                    size={15}
                                    strokeWidth={2.4}
                                  />
                                </motion.span>
                              </AnimatePresence>
                            </motion.button>
                          </div>

                          {/* Open in Telegram */}
                          {isSafeUrl(pendingLink) && (
                            <motion.a
                              href={pendingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              whileHover={{ scale: 1.01, y: -1 }}
                              whileTap={{ scale: 0.99 }}
                              transition={SPRING.snappy}
                              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold tracking-tight text-white outline-none"
                              style={{
                                background:
                                  'linear-gradient(135deg, #0088cc 0%, #0284C7 100%)',
                                boxShadow:
                                  'inset 0 1px 0 rgba(255,255,255,0.35), 0 10px 24px -8px rgba(0,136,204,0.5)',
                              }}
                            >
                              <Icon
                                paths={I.externalLink}
                                size={15}
                                strokeWidth={2.4}
                              />
                              Open in Telegram
                            </motion.a>
                          )}

                          <GlassButton
                            type="button"
                            variant="secondary"
                            onClick={() => setPendingLink(null)}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Icon
                                paths={I.xCircle}
                                size={14}
                                strokeWidth={2.2}
                              />
                              Cancel
                            </span>
                          </GlassButton>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </SectionPanel>

              {/* Hero bot tile */}
              <motion.div variants={cardVariants}>
                <div
                  className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-8 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
                >
                  {/* Decorative rings */}
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-6 rounded-full"
                    style={{
                      background:
                        'radial-gradient(closest-side, rgba(0,136,204,0.18), transparent 70%)',
                    }}
                    animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-12 rounded-full"
                    style={{
                      background:
                        'radial-gradient(closest-side, rgba(0,136,204,0.24), transparent 70%)',
                    }}
                    animate={{ scale: [1, 1.14, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{
                      duration: 3.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />

                  <motion.div
                    animate={{ y: [-4, 4, -4] }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="relative flex h-32 w-32 items-center justify-center rounded-2xl text-white"
                    style={{
                      background:
                        'linear-gradient(135deg, #0088cc 0%, #0284C7 100%)',
                      boxShadow:
                        'inset 0 2px 0 rgba(255,255,255,0.35), 0 20px 40px -10px rgba(0,136,204,0.5)',
                    }}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-2xl"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                      }}
                    />
                    <Icon
                      paths={I.telegram}
                      size={56}
                      strokeWidth={1.9}
                      className="relative"
                    />
                  </motion.div>
                </div>
              </motion.div>
            </div>
          )}

          {/* ========== FEATURES TAB ========== */}
          {activeTab === 'features' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={I.bell}
                title={t('telegram.feature.alertsTitle')}
                desc={t('telegram.feature.alertsDesc')}
                tone="telegram"
              />
              <FeatureCard
                icon={I.message}
                title={t('telegram.feature.repliesTitle')}
                desc={t('telegram.feature.repliesDesc')}
                tone="purple"
              />
              <FeatureCard
                icon={I.shieldCheck}
                title={t('telegram.feature.loginTitle')}
                desc={t('telegram.feature.loginDesc')}
                tone="emerald"
              />
              <FeatureCard
                icon={I.bolt}
                title={t('telegram.feature.remindersTitle')}
                desc={t('telegram.feature.remindersDesc')}
                tone="orange"
              />
              <FeatureCard
                icon={I.bot}
                title="M-EDU Telegram Mini App (TMA)"
                desc="Mobil Telegram ilovasi orqali dars jadvali, baholar, davomat, Face ID turniket statusi va to'lovlarni ko'rish imkoniyati."
                tone="purple"
              />
            </div>
          )}

          {/* ========== OMNICHANNEL BROADCAST TAB ========== */}
          {activeTab === 'broadcast' && isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING.smooth}
            >
              <OmnichannelBroadcastStudio />
            </motion.div>
          )}

          {/* ========== ADMIN TAB ========== */}
          {activeTab === 'admin' && isAdmin && (
            <SectionPanel
              icon={I.shieldCheck}
              tone="emerald"
              title={t('telegram.adminOverviewTitle')}
              subtitle={t('telegram.adminOverviewSubtitle')}
            >
              {adminOverviewQ.isLoading ? (
                <div className="p-5 space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <Shimmer key={i} className="h-20" radius="1rem" />
                  ))}
                </div>
              ) : adminOverviewQ.isError ? (
                <div className="p-8">
                  <GlassErrorState
                    title={t('telegram.adminStatsError')}
                    message={getErrorMessage(adminOverviewQ.error as Error)}
                    onRetry={() => void adminOverviewQ.refetch()}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
                  <AdminStat
                    label={t('telegram.totalLinkedAccounts')}
                    value={adminOverviewQ.data?.accounts?.total ?? 0}
                    icon={I.users}
                    tone="blue"
                  />
                  <AdminStat
                    label={t('telegram.activeBots')}
                    value={adminOverviewQ.data?.accounts?.active ?? 0}
                    icon={I.bot}
                    tone="emerald"
                  />
                  <AdminStat
                    label={t('telegram.messagesSent24h')}
                    value={adminOverviewQ.data?.deliveries?.last24h?.sent ?? 0}
                    icon={I.activity}
                    tone="telegram"
                  />
                </div>
              )}
            </SectionPanel>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Unlink confirm */}
      <ConfirmDialog
        open={confirmUnlinkOpen}
        onClose={() => setConfirmUnlinkOpen(false)}
        onConfirm={() => unlinkMut.mutate()}
        title={t('telegram.disconnectTitle')}
        description={t('telegram.disconnectDesc')}
        loading={unlinkMut.isPending}
      />
    </motion.div>
  </div>
  );
}

/* ============================================================================
 * ADMIN STAT TILE
 * ========================================================================== */

function AdminStat({
  label,
  value,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.14] transition-opacity group-hover:opacity-25"
        style={{ background: c.fg, filter: 'blur(24px)' }}
      />
      <div className="relative flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
          }}
        >
          <Icon paths={icon} size={15} strokeWidth={2.2} />
        </div>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
          {label}
        </p>
      </div>
      <p className="relative mt-3 text-[26px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
        <CountUp value={value} />
      </p>
    </motion.div>
  );
}