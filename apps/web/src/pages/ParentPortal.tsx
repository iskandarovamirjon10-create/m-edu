/**
 * ParentPortalPage — v2 "Liquid Refraction · Ambient Parent Studio"
 *
 * 🎯 v1 → v2 Complete Visual Rebirth:
 *  ✅ Liquid Glass Refraction — Multi-layer specular rims, chromatic edge ring,
 *     breathing caustic glow, refracted bottom shadow.
 *  ✅ Rolling Odometer — Digit-by-digit spring animation for all numbers.
 *  ✅ Magnetic Cards — 3D tilt on hover with spring physics.
 *  ✅ Chromatic Avatars — Rotating conic gradient ring around hero avatar.
 *  ✅ Aurora Backdrop — Fixed breathing orbs (emerald, indigo, violet).
 *  ✅ Floating Command Bar — Sticky: breadcrumb · child selector · balance.
 *  ✅ Cascade Row Reveal — Staggered blur-in on every list item.
 *  ✅ Attendance Ring — Animated SVG with chromatic segments + glow.
 *  ✅ 100% preserved — ALL queries, permissions, i18n, format helpers.
 */

import React, { useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { parentPortalApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
} from '@/components/ui';
import { formatCurrency, formatDate, formatTime, fullName } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import { ParentWeeklyDigestCard } from '@/components/parent/ParentWeeklyDigestCard';
import { FamilyGuardianHub } from '@/components/parent/FamilyGuardianHub';
import { ParentSafetyTurnstileModal } from '@/components/parent/ParentSafetyTurnstileModal';
import { useAuth } from '@/auth/AuthContext';
import type {
  ParentChild,
  ParentAttendanceRecord,
  ParentAttendanceSummary,
  ParentGradesResponse,
  ParentInvoicesResponse,
  Invoice,
} from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy:   { type: 'spring' as const, stiffness: 520, damping: 30, mass: 0.7 },
  smooth:   { type: 'spring' as const, stiffness: 340, damping: 30, mass: 0.9 },
  soft:     { type: 'spring' as const, stiffness: 220, damping: 28, mass: 1.0 },
  odometer: { type: 'spring' as const, stiffness: 180, damping: 22, mass: 1.1 },
} as const;

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES & CONSTANTS
 * ════════════════════════════════════════════════════════════════════════ */

type ParentGrade = ParentGradesResponse['grades'][number];
type ParentExamResult = NonNullable<ParentGradesResponse['examResults']>[number];
type ParentInvoice = Invoice;
type ParentPayment = NonNullable<ParentInvoicesResponse['payments']>[number];

const ATTENDANCE_STATUS_LABEL_KEYS: Record<string, string> = {
  PRESENT: 'attendance.present',
  ABSENT: 'attendance.absent',
  LATE: 'attendance.late',
  EXCUSED: 'attendance.excused',
};

const STUDENT_STATUS_LABEL_KEYS: Record<string, string> = {
  ACTIVE: 'enum.status.ACTIVE',
  INACTIVE: 'enum.status.INACTIVE',
  PENDING: 'enum.status.PENDING',
};

const INVOICE_STATUS_LABEL_KEYS: Record<string, string> = {
  DRAFT: 'parentPortal.invoiceStatus.DRAFT',
  ISSUED: 'parentPortal.invoiceStatus.ISSUED',
  PARTIALLY_PAID: 'parentPortal.invoiceStatus.PARTIALLY_PAID',
  PAID: 'payments.status.PAID',
  OVERDUE: 'payments.status.OVERDUE',
  CANCELLED: 'payments.status.CANCELLED',
  REFUNDED: 'parentPortal.invoiceStatus.REFUNDED',
};

const RELATIONSHIP_LABEL_KEYS: Record<string, string> = {
  MOTHER: 'parentPortal.relationship.MOTHER',
  FATHER: 'parentPortal.relationship.FATHER',
  PARENT: 'parentPortal.relationship.PARENT',
  GUARDIAN: 'parentPortal.relationship.GUARDIAN',
  BROTHER: 'parentPortal.relationship.BROTHER',
  SISTER: 'parentPortal.relationship.SISTER',
  OTHER: 'parentPortal.relationship.OTHER',
};

const ATTENDANCE_COLORS: Record<string, string> = {
  PRESENT: '#10B981',
  ABSENT: '#F43F5E',
  LATE: '#F59E0B',
  EXCUSED: '#3B82F6',
};

/* ══════════════════════════════════════════════════════════════════════════
 * HOOKS
 * ════════════════════════════════════════════════════════════════════════ */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}


/* ══════════════════════════════════════════════════════════════════════════
 * LIQUID GLASS CARD
 * ════════════════════════════════════════════════════════════════════════ */

function LiquidGlassCard({
  children,
  className = '',
  elevated = false,
  interactive = false,
  chromatic = true,
  caustic = true,
  tint = 'emerald',
}: {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  interactive?: boolean;
  chromatic?: boolean;
  caustic?: boolean;
  tint?: 'emerald' | 'blue' | 'violet';
}) {
  const causticColor =
    tint === 'emerald' ? 'rgba(16,185,129,0.10)' :
    tint === 'blue' ? 'rgba(59,130,246,0.10)' :
    'rgba(139,92,246,0.10)';

  return (
    <div
      className={[
        'group/glass relative overflow-hidden rounded-2xl',
        'border border-black/[0.06] dark:border-white/[0.08]',
        'bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl backdrop-saturate-150 shadow-card',
        elevated
          ? 'shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_2px_4px_rgba(15,23,42,0.04),0_24px_56px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_2px_4px_rgba(0,0,0,0.5),0_32px_72px_-20px_rgba(0,0,0,0.75)]'
          : 'shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_1px_2px_rgba(15,23,42,0.03),0_12px_32px_-12px_rgba(15,23,42,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_1px_2px_rgba(0,0,0,0.4),0_16px_40px_-14px_rgba(0,0,0,0.6)]',
        interactive ? 'transition-all duration-300 hover:border-slate-300/90 dark:hover:border-white/[0.18]' : '',
        className,
      ].join(' ')}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.95) 50%, transparent 100%)',
        }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {chromatic && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-40 mix-blend-plus-lighter"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0%, rgba(147,197,253,0.25) 25%, transparent 50%, rgba(196,181,253,0.25) 75%, transparent 100%)',
              mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              maskComposite: 'exclude',
              WebkitMaskComposite: 'xor',
              padding: '1px',
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-8 left-0 w-px bg-gradient-to-b from-transparent via-emerald-400/25 to-transparent dark:via-emerald-400/30"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-8 right-0 w-px bg-gradient-to-b from-transparent via-violet-400/25 to-transparent dark:via-violet-400/30"
          />
        </>
      )}

      {caustic && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-32 w-2/3 -translate-x-1/2 rounded-full blur-xl opacity-70 transform-gpu"
          style={{
            background: `radial-gradient(ellipse at center, ${causticColor} 0%, transparent 70%)`,
          }}
        />
      )}

      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * MAGNETIC WRAPPER
 * ════════════════════════════════════════════════════════════════════════ */

function Magnetic({
  children,
  intensity = 5,
}: {
  children: React.ReactNode;
  intensity?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotX = useSpring(useTransform(y, [-0.5, 0.5], [intensity, -intensity]), SPRING.snappy);
  const rotY = useSpring(useTransform(x, [-0.5, 0.5], [-intensity, intensity]), SPRING.snappy);

  const onMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [x, y]);

  const onLeave = React.useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d', perspective: 800 }}
    >
      {children}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * AURORA BACKDROP
 * ════════════════════════════════════════════════════════════════════════ */

function AuroraBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-[#04060C] dark:via-[#0A0F1A] dark:to-[#080A14]" />
      <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-emerald-400/10 blur-[120px] dark:bg-emerald-500/08" />
      <div className="absolute -right-32 top-1/3 h-[520px] w-[520px] rounded-full bg-indigo-400/10 blur-[120px] dark:bg-indigo-500/08" />
      <div className="absolute -bottom-32 left-1/3 h-[480px] w-[480px] rounded-full bg-violet-400/08 blur-[120px] dark:bg-violet-500/08" />
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.022]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,23,42,0.85) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.85) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * ROLLING ODOMETER
 * ════════════════════════════════════════════════════════════════════════ */

function Odometer({
  value, className = '', duration = 1.0, suffix = '', prefix = '',
}: {
  value: number; className?: string; duration?: number; suffix?: string; prefix?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const startRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (reduced) { setDisplay(value); return; }
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  const formatted = Math.round(display).toLocaleString('uz-UZ');
  const digits = formatted.split('');

  return (
    <span className={`inline-flex items-baseline tabular-nums ${className}`} aria-label={String(value)}>
      {prefix && <span className="mr-1">{prefix}</span>}
      {digits.map((d, i) => (
        <motion.span
          key={`${i}-${d}`}
          initial={reduced ? false : { y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING.snappy, delay: reduced ? 0 : i * 0.015 }}
          className="inline-block"
        >
          {d}
        </motion.span>
      ))}
      {suffix && <span className="ml-0.5">{suffix}</span>}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * CHROMATIC AVATAR
 * ════════════════════════════════════════════════════════════════════════ */

function ChromaticAvatar({
  name, imageUrl, size = 96,
}: {
  name: string; imageUrl?: string | null; size?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const initials = (name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('') || '—').toUpperCase();

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {!reduced && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #34D399, #6366F1, #A78BFA, #34D399, #6366F1)',
            padding: 3,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {reduced && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(135deg, #34D399, #6366F1)' }}
        />
      )}
      <div
        className="absolute inset-[3px] flex items-center justify-center overflow-hidden rounded-full font-black text-white"
        style={{
          background: imageUrl ? undefined : 'linear-gradient(135deg, #34D399 0%, #6366F1 100%)',
          fontSize: Math.round(size * 0.36),
          letterSpacing: '0.02em',
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4), 0 8px 24px -6px rgba(99,102,241,0.4)',
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">{initials}</span>
        )}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[3px] rounded-full"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 55%)',
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * HELPERS
 * ════════════════════════════════════════════════════════════════════════ */

function getAttendanceBadge(status: string) {
  switch (status) {
    case 'PRESENT': return { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' };
    case 'ABSENT': return { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' };
    case 'LATE': return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
    case 'EXCUSED': return { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' };
    default: return { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' };
  }
}

function relationshipLabel(t: (key: string) => string, value?: string): string {
  if (!value) return '—';
  const key = RELATIONSHIP_LABEL_KEYS[value] ?? RELATIONSHIP_LABEL_KEYS[value.toUpperCase()];
  return key ? t(key) : value;
}

/* ══════════════════════════════════════════════════════════════════════════
 * PREMIUM TAB SWITCHER — Aurora variant
 * ════════════════════════════════════════════════════════════════════════ */

function PremiumTabSwitcher({
  tabs, active, onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="relative flex max-w-full overflow-x-auto scrollbar-none rounded-2xl border border-slate-200/70 bg-white/70 p-1.5 backdrop-blur-2xl dark:border-white/[0.10] dark:bg-white/[0.05]"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 16px -8px rgba(15,23,42,0.1)' }}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className="relative z-10 flex-1 min-w-[140px] shrink-0 rounded-xl px-5 py-2.5 outline-none"
          >
            {isActive && (
              <motion.div
                layoutId="parent-portal-tab-pill"
                transition={reduced ? { duration: 0 } : SPRING.snappy}
                className="absolute inset-0 rounded-xl bg-white shadow-[0_2px_8px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.9)] dark:bg-white/[0.14] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
              />
            )}
            <span
              className={`relative block truncate text-[0.82rem] font-bold tracking-tight transition-colors ${
                isActive
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * ATTENDANCE RING — chromatic animated segments
 * ════════════════════════════════════════════════════════════════════════ */

function AttendanceRing({ summary }: { summary: ParentAttendanceSummary }) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();
  const { byStatus, total } = summary;
  if (total === 0) return null;

  let cumulative = 0;
  const entries = Object.entries((byStatus ?? {}) as Record<string, number>).filter(([, v]) => v > 0);
  const segments = entries.map(([status, count]) => {
    const pct = count / (total ?? 0);
    const start = cumulative;
    cumulative += pct;
    return { status, count, pct, start, color: ATTENDANCE_COLORS[status] || '#9ca3af' };
  });

  const cx = 60;
  const cy = 60;
  const r = 48;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-6 px-2 py-4 sm:flex-row sm:items-center">
      <div className="relative flex shrink-0 justify-center">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full blur-xl opacity-60 transform-gpu"
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
          }}
        />
        <svg width={120} height={120} viewBox="0 0 120 120" className="relative -rotate-90 drop-shadow-md">
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            className="stroke-slate-200/70 dark:stroke-white/[0.08]"
            strokeWidth={12}
          />
          {segments.map((seg) => {
            const dash = seg.pct * circumference;
            const offset = (1 - seg.start) * circumference;
            return (
              <motion.circle
                key={seg.status}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={12}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                initial={reduced ? false : { strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${dash} ${circumference - dash}` }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                style={{ filter: `drop-shadow(0 0 6px ${seg.color}55)` }}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[1.6rem] font-black leading-none text-[var(--text-primary)] tabular-nums"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {summary.attendanceRate != null ? <Odometer value={summary.attendanceRate} suffix="%" /> : '—'}
          </span>
          <span className="mt-1 text-[0.6rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {t('parentPortal.rate')}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5">
        {segments.map((s, idx) => (
          <motion.div
            key={s.status}
            initial={reduced ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING.smooth, delay: 0.3 + idx * 0.06 }}
            className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]"
          >
            <div className="flex items-center gap-2.5">
              <motion.span
                className="h-2.5 w-2.5 rounded-full shadow-sm"
                style={{ background: s.color, boxShadow: `0 0 8px ${s.color}88` }}
                animate={reduced ? undefined : { scale: [1, 1.15, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: idx * 0.3 }}
              />
              <span className="text-[0.8rem] font-bold capitalize text-[var(--text-secondary)]">
                {ATTENDANCE_STATUS_LABEL_KEYS[s.status]
                  ? t(ATTENDANCE_STATUS_LABEL_KEYS[s.status])
                  : s.status.toLowerCase()}
              </span>
            </div>
            <span className="text-[0.9rem] font-black text-[var(--text-primary)] tabular-nums">
              <Odometer value={s.count} />
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * STAT CARD — magnetic + odometer + chromatic
 * ════════════════════════════════════════════════════════════════════════ */

function StatCard({
  label, value, color, isCurrency = false,
}: {
  label: string; value: number; color: 'amber' | 'rose' | 'emerald' | 'blue';
  isCurrency?: boolean;
}) {
  const colorMap = {
    amber: { fg: '#F59E0B', glow: 'rgba(245,158,11,0.30)' },
    rose: { fg: '#F43F5E', glow: 'rgba(244,63,94,0.30)' },
    emerald: { fg: '#10B981', glow: 'rgba(16,185,129,0.30)' },
    blue: { fg: '#3B82F6', glow: 'rgba(59,130,246,0.30)' },
  };
  const c = colorMap[color];

  return (
    <Magnetic intensity={4}>
      <motion.div whileHover={{ y: -3 }} transition={SPRING.smooth}>
        <LiquidGlassCard elevated tint={color === 'rose' ? 'violet' : 'emerald'}>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-25 blur-2xl transform-gpu"
            style={{ background: c.fg }}
          />
          <div className="relative p-4">
            <p
              className="text-[1.4rem] font-black leading-none tracking-tight tabular-nums"
              style={{ color: c.fg }}
            >
              {isCurrency ? formatCurrency(value) : <Odometer value={value} />}
            </p>
            <p className="mt-1.5 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {label}
            </p>
          </div>
        </LiquidGlassCard>
      </motion.div>
    </Magnetic>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * FLOATING COMMAND BAR
 * ════════════════════════════════════════════════════════════════════════ */

function CommandBar({
  studentName, balance, status,
}: {
  studentName: string; balance: number; status?: string;
}) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="sticky top-4 z-30"
    >
      <LiquidGlassCard elevated>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.5)]"
            style={{ background: 'linear-gradient(135deg, #10B981 0%, #6366F1 100%)' }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <span>M-EDU</span>
              <span className="opacity-50">/</span>
              <span className="text-emerald-600 dark:text-emerald-400">{t('parentPortal.title')}</span>
            </div>
            <h1 className="truncate text-[14px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
              {studentName}
            </h1>
          </div>

          {status && (
            <span
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 sm:inline-flex ${
                status === 'ACTIVE'
                  ? 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-500/20 bg-slate-500/[0.08] text-slate-700 dark:text-slate-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status === 'ACTIVE' ? 'bg-emerald-500 shadow-[0_0_6px_#10B981]' : 'bg-slate-500'
                }`}
              />
              <span className="text-[10px] font-black uppercase tracking-wider">
                {STUDENT_STATUS_LABEL_KEYS[status] ? t(STUDENT_STATUS_LABEL_KEYS[status]) : status}
              </span>
            </span>
          )}

          <motion.span
            animate={reduced ? undefined : { opacity: [0.75, 1, 0.75] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              balance < 0
                ? 'border-rose-500/20 bg-rose-500/[0.08] text-rose-700 dark:text-rose-300'
                : 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider tabular-nums">
              {formatCurrency(balance)}
            </span>
          </motion.span>
        </div>
      </LiquidGlassCard>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN PAGE
 * ════════════════════════════════════════════════════════════════════════ */

export function ParentPortalPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('parentPortal.title'));
  const reduced = usePrefersReducedMotion();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [portalMode, setPortalMode] = useState<'individual' | 'familyHub'>('individual');
  const [isSafetyTurnstileOpen, setIsSafetyTurnstileOpen] = useState(false);
  const { user } = useAuth();

  const childrenQuery = useQuery({
    queryKey: ['parent-portal-children'],
    queryFn: () => parentPortalApi.children(),
  });
  const children = (childrenQuery.data as ParentChild[] | undefined) ?? [];
  const selectedChild = children.find((c) => c.studentId === selectedStudentId) ?? children[0];

  const attendanceQuery = useQuery({
    queryKey: ['parent-portal-attendance', selectedChild?.studentId],
    queryFn: () => parentPortalApi.attendance(selectedChild!.studentId, { limit: 20 }),
    enabled: !!selectedChild?.permissions?.attendance,
  });

  const attendanceSummaryQuery = useQuery({
    queryKey: ['parent-portal-attendance-summary', selectedChild?.studentId],
    queryFn: () => parentPortalApi.attendanceSummary(selectedChild!.studentId),
    enabled: !!selectedChild?.permissions?.attendance,
  });

  const gradesQuery = useQuery({
    queryKey: ['parent-portal-grades', selectedChild?.studentId],
    queryFn: () => parentPortalApi.grades(selectedChild!.studentId),
    enabled: !!selectedChild?.permissions?.grades,
  });

  const invoicesQuery = useQuery({
    queryKey: ['parent-portal-invoices', selectedChild?.studentId],
    queryFn: () => parentPortalApi.invoices(selectedChild!.studentId),
    enabled: !!selectedChild?.permissions?.payments,
  });

  const scheduleQuery = useQuery({
    queryKey: ['parent-portal-schedule', selectedChild?.studentId],
    queryFn: () => parentPortalApi.schedule(selectedChild!.studentId),
    enabled: !!selectedChild?.permissions?.attendance,
  });

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (childrenQuery.isLoading) {
    return (
      <div className="relative min-h-full pb-12">
        <AuroraBackdrop />
        <div className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
          <div className="mb-6 h-16" />
          <GlassPageHeader title={t('parentPortal.title')} subtitle={t('parentPortal.loadingProfile')} />
          <div className="mt-6 flex items-center justify-center rounded-2xl border border-slate-200/70 bg-white/70 p-16 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03]">
            <GlassPageLoader label={t('parentPortal.fetchingData') || 'Fetching data…'} />
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (childrenQuery.isError) {
    return (
      <div className="relative min-h-full pb-12">
        <AuroraBackdrop />
        <div className="mx-auto max-w-3xl px-4 pt-16 sm:px-6">
          <LiquidGlassCard elevated>
            <div className="p-8">
              <GlassErrorState
                message={getErrorMessage(childrenQuery.error)}
                onRetry={() => childrenQuery.refetch()}
              />
            </div>
          </LiquidGlassCard>
        </div>
      </div>
    );
  }

  /* ── No children ──────────────────────────────────────────────────── */
  if (children.length === 0) {
    return (
      <div className="relative min-h-full pb-12">
        <AuroraBackdrop />
        <div className="mx-auto max-w-3xl px-4 pt-16 sm:px-6">
          <GlassPageHeader title={t('parentPortal.title')} subtitle={t('parentPortal.overview')} />
          <div className="mt-6">
            <LiquidGlassCard elevated>
              <div className="p-12">
                <GlassEmptyState
                  title={t('parentPortal.noChildren')}
                  message={t('parentPortal.noChildrenHint')}
                />
              </div>
            </LiquidGlassCard>
          </div>
        </div>
      </div>
    );
  }

  const activeChild = selectedChild ?? children[0];
  const perms = activeChild.permissions ?? {};
  const student = activeChild.student;
  const studentName = fullName(student?.user.firstName ?? '', student?.user.lastName ?? '');
  const parentName = user ? fullName(user.firstName ?? '', user.lastName ?? '') : undefined;

  const attendanceData = (attendanceQuery.data as ParentAttendanceRecord[] | undefined) ?? [];
  const attendanceSummary = attendanceSummaryQuery.data as ParentAttendanceSummary | undefined;
  const gradesData = gradesQuery.data as ParentGradesResponse | undefined;
  const invoicesData = invoicesQuery.data as ParentInvoicesResponse | undefined;
  const scheduleData = (scheduleQuery.data as Array<{ id: string; dayOfWeek: string; startTime: string; endTime: string; room?: string | null; group: { id: string; name: string } }> | undefined) ?? [];

  /* ── Main Render ──────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-full pb-[max(6rem,env(safe-area-inset-bottom))] selection:bg-emerald-500/30">
      <AuroraBackdrop />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <div className="space-y-5">
          {/* ═══ FLOATING COMMAND BAR ═══ */}
          <CommandBar
            studentName={studentName}
            balance={student?.balance ?? 0}
            status={student?.status}
          />

          {/* ═══ VIEW MODE SELECTOR (Individual vs Family Hub) ═══ */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {children.length > 1 && portalMode === 'individual' && (
              <PremiumTabSwitcher
                tabs={children.map((c) => ({
                  id: c.studentId,
                  label: fullName(c.student?.user.firstName ?? '', c.student?.user.lastName ?? ''),
                }))}
                active={activeChild.studentId}
                onChange={setSelectedStudentId}
              />
            )}

            <div className="ml-auto flex items-center gap-1.5 rounded-2xl border border-white/20 bg-white/40 p-1.5 backdrop-blur-xl dark:border-white/10 dark:bg-black/20">
              <button
                type="button"
                onClick={() => setIsSafetyTurnstileOpen(true)}
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
              >
                <span>🛡️</span>
                <span>Jonli Turniket & Xavfsizlik</span>
              </button>
              <button
                type="button"
                onClick={() => setPortalMode('individual')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  portalMode === 'individual'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Farzand Profili
              </button>
              <button
                type="button"
                onClick={() => setPortalMode('familyHub')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  portalMode === 'familyHub'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>👨‍👩‍👧‍👦</span>
                <span>Oila Hubi (Multi-Farzand)</span>
              </button>
            </div>
          </div>

          {portalMode === 'familyHub' ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING.smooth}
            >
              <FamilyGuardianHub parentName={parentName} />
            </motion.div>
          ) : (
            <>
          {/* ═══ HERO PROFILE CARD ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING.smooth}
          >
            <LiquidGlassCard elevated>
              <div className="relative p-6 sm:p-8">
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                  <ChromaticAvatar
                    name={studentName}
                    imageUrl={student?.user.avatar}
                    size={112}
                  />

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h1 className="text-[1.75rem] font-black leading-[1.05] tracking-[-0.025em] text-[var(--text-primary)] sm:text-[2.25rem]">
                      {studentName}
                    </h1>

                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      {student?.status && (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[0.72rem] font-black uppercase tracking-wider shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ${
                            student.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300'
                              : 'bg-slate-500/10 text-slate-700 ring-1 ring-inset ring-slate-500/25 dark:text-slate-300'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              student.status === 'ACTIVE' ? 'bg-emerald-500 shadow-[0_0_6px_#10B981]' : 'bg-slate-500'
                            }`}
                          />
                          {STUDENT_STATUS_LABEL_KEYS[student.status] ? t(STUDENT_STATUS_LABEL_KEYS[student.status]) : student.status}
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-xl bg-indigo-500/10 px-3 py-1.5 text-[0.72rem] font-black uppercase tracking-wider text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300">
                        {relationshipLabel(t, activeChild.relationship)}
                      </span>
                    </div>

                    {(student?.groups?.length ?? 0) > 0 && (
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 border-t border-slate-200/60 pt-4 dark:border-white/[0.06] sm:justify-start">
                        {student?.groups?.map((g: { id: string; name: string }) => (
                          <motion.span
                            key={g.id}
                            whileHover={{ scale: 1.05 }}
                            transition={SPRING.snappy}
                            className="rounded-md bg-indigo-500/10 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-wider text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300"
                          >
                            {g.name}
                          </motion.span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {t('parentPortal.currentBalance')}
                    </p>
                    <motion.p
                      className={`mt-1 text-[1.9rem] font-black leading-none tracking-tight tabular-nums ${
                        (student?.balance ?? 0) < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                      animate={reduced ? undefined : { opacity: [0.85, 1, 0.85] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      {formatCurrency(student?.balance ?? 0)}
                    </motion.p>
                  </div>
                </div>
              </div>
            </LiquidGlassCard>
          </motion.div>

          {/* ═══ WEEKLY ACADEMIC DIGEST & PERFORMANCE ENGINE ═══ */}
          {perms?.attendance && (
            <ParentWeeklyDigestCard
              studentId={activeChild.studentId}
              studentName={studentName}
            />
          )}

          {/* ═══ MAIN GRID ═══ */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* LEFT COLUMN — Attendance + Grades */}
            <div className="flex flex-col gap-5 lg:col-span-7">
              {/* ── Attendance ── */}
              {perms?.attendance && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING.smooth, delay: 0.1 }}
                >
                  <LiquidGlassCard elevated>
                    <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-3.5 dark:border-white/[0.06]">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M8 2v4M16 2v4M3 10h18" />
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <path d="M9 15l2 2 4-4" />
                          </svg>
                        </div>
                        <h2 className="text-[0.95rem] font-black tracking-tight text-[var(--text-primary)]">
                          {t('parentPortal.attendanceOverview')}
                        </h2>
                      </div>
                    </div>

                    <div className="border-b border-slate-200/60 p-5 dark:border-white/[0.06]">
                      {attendanceSummaryQuery.isLoading ? (
                        <div className="flex h-32 items-center justify-center">
                          <GlassPageLoader />
                        </div>
                      ) : attendanceSummary ? (
                        <AttendanceRing summary={attendanceSummary} />
                      ) : null}
                    </div>

                    <div>
                      {attendanceQuery.isLoading ? (
                        <div className="flex items-center justify-center p-10">
                          <GlassPageLoader />
                        </div>
                      ) : attendanceData.length > 0 ? (
                        <ul className="max-h-[360px] divide-y divide-slate-200/60 overflow-y-auto dark:divide-white/[0.05]">
                          {attendanceData.slice(0, 10).map((rec, idx) => {
                            const badge = getAttendanceBadge(rec.status);
                            return (
                              <motion.li
                                key={rec.id}
                                initial={reduced ? false : { opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                                className="px-5 py-3.5 transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.03]"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span className={`inline-flex shrink-0 items-center rounded-lg px-2 py-1 text-[0.62rem] font-black uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                                      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                                      {ATTENDANCE_STATUS_LABEL_KEYS[rec.status] ? t(ATTENDANCE_STATUS_LABEL_KEYS[rec.status]) : rec.status}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate text-[0.9rem] font-bold text-[var(--text-primary)]">
                                        {rec.group?.name ?? rec.groupName}
                                      </p>
                                      {rec.lesson && (
                                        <p className="mt-0.5 truncate text-[0.75rem] font-medium text-[var(--text-muted)]">
                                          {rec.lesson.topic} · {formatTime(rec.lesson.startTime)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <span className="shrink-0 text-[0.68rem] font-black uppercase tracking-wider text-[var(--text-muted)] tabular-nums">
                                    {formatDate(rec.date)}
                                  </span>
                                </div>
                                {rec.note && (
                                  <div className="ml-12 mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-amber-700 dark:text-amber-300">
                                    <span className="text-[0.75rem] font-medium leading-relaxed">{rec.note}</span>
                                  </div>
                                )}
                              </motion.li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="flex justify-center p-10">
                          <p className="text-[0.85rem] font-medium text-[var(--text-muted)]">
                            {t('parentPortal.noAttendance')}
                          </p>
                        </div>
                      )}
                    </div>
                  </LiquidGlassCard>
                </motion.div>
              )}

              {/* ── Grades ── */}
              {perms?.grades && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING.smooth, delay: 0.15 }}
                >
                  <LiquidGlassCard elevated>
                    <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-3.5 dark:border-white/[0.06]">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400">
                          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
                          </svg>
                        </div>
                        <h2 className="text-[0.95rem] font-black tracking-tight text-[var(--text-primary)]">
                          {t('parentPortal.gradesTitle')}
                        </h2>
                      </div>
                    </div>

                    <div className="p-3">
                      {gradesQuery.isLoading ? (
                        <div className="flex h-32 items-center justify-center">
                          <GlassPageLoader />
                        </div>
                      ) : gradesData && (gradesData.grades.length > 0 || (gradesData.examResults ?? []).length > 0) ? (
                        <div className="space-y-4">
                          {gradesData.grades.length > 0 && (
                            <div>
                              <h3 className="mb-2 ml-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                                {t('parentPortal.courseAssessments')}
                              </h3>
                              <div className="space-y-1.5">
                                {gradesData.grades.map((g: ParentGrade, idx: number) => (
                                  <motion.div
                                    key={g.id ?? idx}
                                    initial={reduced ? false : { opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                                    className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-white/60 p-3 transition-all hover:border-indigo-500/30 dark:border-white/[0.06] dark:bg-white/[0.03]"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-[0.9rem] font-bold text-[var(--text-primary)]">
                                        {g.label || g.group?.name || t('parentPortal.gradeFallback')}
                                      </p>
                                      {g.notes && (
                                        <p className="mt-0.5 truncate text-[0.75rem] font-medium text-[var(--text-muted)]">
                                          {g.notes}
                                        </p>
                                      )}
                                    </div>
                                    <div className="shrink-0 rounded-lg bg-indigo-500/10 px-3 py-1 ring-1 ring-inset ring-indigo-500/20">
                                      <span className="text-[1rem] font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
                                        {g.value}
                                      </span>
                                      {g.maxValue && (
                                        <span className="text-[0.75rem] font-bold text-indigo-500/60">
                                          /{g.maxValue}
                                        </span>
                                      )}
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(gradesData.examResults ?? []).length > 0 && (
                            <div className="border-t border-slate-200/60 pt-3 dark:border-white/[0.06]">
                              <h3 className="mb-2 ml-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                                {t('parentPortal.examResults')}
                              </h3>
                              <div className="space-y-1.5">
                                {(gradesData.examResults ?? []).map((er: ParentExamResult, idx: number) => (
                                  <motion.div
                                    key={er.id ?? idx}
                                    initial={reduced ? false : { opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                                    className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-white/60 p-3 transition-all hover:border-indigo-500/30 dark:border-white/[0.06] dark:bg-white/[0.03]"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-[0.9rem] font-bold text-[var(--text-primary)]">
                                        {er.exam?.title || er.examTitle || t('parentPortal.examFallback')}
                                      </p>
                                      <p className="mt-0.5 text-[0.75rem] font-medium text-[var(--text-muted)]">
                                        {er.exam?.examType} · {t('parentPortal.maxMarks', { n: er.exam?.totalMarks ?? er.totalMarks ?? 0 })}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      <span className="text-[1.05rem] font-black text-[var(--text-primary)] tabular-nums">
                                        {er.score}
                                      </span>
                                      <span
                                        className={`rounded-lg px-2 py-1 text-[0.62rem] font-black uppercase tracking-wider ${
                                          er.isPassed
                                            ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300'
                                            : 'bg-rose-500/10 text-rose-700 ring-1 ring-inset ring-rose-500/20 dark:text-rose-300'
                                        }`}
                                      >
                                        {er.isPassed ? t('parentPortal.passed') : t('parentPortal.failed')}
                                      </span>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-center p-10">
                          <p className="text-[0.85rem] font-medium text-[var(--text-muted)]">
                            {t('parentPortal.noGrades')}
                          </p>
                        </div>
                      )}
                    </div>
                  </LiquidGlassCard>
                </motion.div>
              )}

              {/* ── Weekly Schedule ── */}
              {perms?.attendance && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING.smooth, delay: 0.18 }}
                >
                  <LiquidGlassCard elevated>
                    <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-3.5 dark:border-white/[0.06]">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/12 text-purple-600 dark:text-purple-400">
                          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </div>
                        <h2 className="text-[0.95rem] font-black tracking-tight text-[var(--text-primary)]">
                          {t('nav.schedule')}
                        </h2>
                      </div>
                      <span className="text-[0.72rem] font-bold text-[var(--text-muted)]">
                        {scheduleData.length} {t('common.total')?.toLowerCase() ?? 'classes'}
                      </span>
                    </div>

                    <div className="p-3">
                      {scheduleQuery.isLoading ? (
                        <div className="flex h-28 items-center justify-center">
                          <GlassPageLoader />
                        </div>
                      ) : scheduleData.length > 0 ? (
                        <div className="space-y-1.5">
                          {scheduleData.map((s, idx) => {
                            const dayKey = `schedule.day.${s.dayOfWeek}`;
                            const dayName = t(dayKey) !== dayKey ? t(dayKey) : s.dayOfWeek;
                            return (
                              <motion.div
                                key={s.id ?? idx}
                                initial={reduced ? false : { opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                                className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-white/60 p-3 transition-all hover:border-purple-500/30 dark:border-white/[0.06] dark:bg-white/[0.03]"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-[0.9rem] font-bold text-[var(--text-primary)]">
                                    {s.group?.name ?? '—'}
                                  </p>
                                  <p className="mt-0.5 text-[0.75rem] font-medium text-[var(--text-muted)]">
                                    {dayName} {s.room ? `· ${s.room}` : ''}
                                  </p>
                                </div>
                                <div className="shrink-0 rounded-lg bg-purple-500/10 px-3 py-1 ring-1 ring-inset ring-purple-500/20">
                                  <span className="text-[0.82rem] font-bold text-purple-700 dark:text-purple-300 tabular-nums">
                                    {s.startTime} – {s.endTime}
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex justify-center p-8">
                          <p className="text-[0.85rem] font-medium text-[var(--text-muted)]">
                            {t('schedule.noSchedule') !== 'schedule.noSchedule' ? t('schedule.noSchedule') : 'No schedule entries found'}
                          </p>
                        </div>
                      )}
                    </div>
                  </LiquidGlassCard>
                </motion.div>
              )}
            </div>

            {/* RIGHT COLUMN — Finances */}
            <div className="flex flex-col gap-5 lg:col-span-5">
              {perms?.payments && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING.smooth, delay: 0.2 }}
                  className="h-full"
                >
                  <LiquidGlassCard elevated tint="blue" className="h-full">
                    <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-3.5 dark:border-white/[0.06]">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/12 text-blue-600 dark:text-blue-400">
                          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
                            <path d="M21 12H17a2 2 0 0 0 0 4h4" />
                          </svg>
                        </div>
                        <h2 className="text-[0.95rem] font-black tracking-tight text-[var(--text-primary)]">
                          {t('parentPortal.finances')}
                        </h2>
                      </div>
                    </div>

                    <div className="flex h-full flex-col p-4">
                      {invoicesQuery.isLoading ? (
                        <div className="flex h-64 items-center justify-center">
                          <GlassPageLoader />
                        </div>
                      ) : invoicesData ? (
                        <>
                          {/* Financial KPIs */}
                          <div className="mb-5 grid grid-cols-2 gap-2.5">
                            <StatCard
                              label={t('parentPortal.outstanding')}
                              value={invoicesData.outstanding ?? 0}
                              color="amber"
                              isCurrency
                            />
                            <StatCard
                              label={t('parentPortal.overdue')}
                              value={invoicesData.overdue ?? 0}
                              color="rose"
                              isCurrency
                            />
                          </div>

                          <div className="space-y-5">
                            {/* Invoices */}
                            {invoicesData.invoices.length > 0 && (
                              <div>
                                <h3 className="mb-2 ml-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                                  {t('parentPortal.invoices')}
                                </h3>
                                <ul className="divide-y divide-slate-200/60 overflow-hidden rounded-xl border border-slate-200/60 bg-white/60 dark:divide-white/[0.05] dark:border-white/[0.06] dark:bg-white/[0.03]">
                                  {invoicesData.invoices.map((inv: ParentInvoice, idx: number) => (
                                    <motion.li
                                      key={inv.id ?? idx}
                                      initial={reduced ? false : { opacity: 0, x: -8 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                                      className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-100/60 dark:hover:bg-white/[0.04]"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate text-[0.9rem] font-bold text-[var(--text-primary)]">
                                          {inv.number || t('parentPortal.invoiceFallback')}
                                        </p>
                                        <p className="mt-0.5 text-[0.75rem] font-medium text-[var(--text-muted)]">
                                          {inv.dueDate
                                            ? t('parentPortal.dueDate', { date: formatDate(inv.dueDate) })
                                            : formatDate(inv.createdAt)}
                                        </p>
                                      </div>
                                      <div className="flex shrink-0 flex-col items-end gap-1">
                                        <span className="text-[1rem] font-black text-[var(--text-primary)] tabular-nums">
                                          {formatCurrency(inv.total)}
                                        </span>
                                        <span
                                          className={`rounded-md px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-wider ${
                                            inv.status === 'PAID'
                                              ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300'
                                              : inv.status === 'OVERDUE'
                                                ? 'bg-rose-500/10 text-rose-700 ring-1 ring-inset ring-rose-500/20 dark:text-rose-300'
                                                : inv.status === 'PARTIALLY_PAID'
                                                  ? 'bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-300'
                                                  : 'bg-slate-500/10 text-slate-700 ring-1 ring-inset ring-slate-500/20 dark:text-slate-300'
                                          }`}
                                        >
                                          {inv.status && INVOICE_STATUS_LABEL_KEYS[inv.status]
                                            ? t(INVOICE_STATUS_LABEL_KEYS[inv.status])
                                            : inv.status}
                                        </span>
                                      </div>
                                    </motion.li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Recent Payments */}
                            {(invoicesData.payments ?? []).length > 0 && (
                              <div>
                                <h3 className="mb-2 ml-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                                  {t('parentPortal.recentPayments')}
                                </h3>
                                <ul className="divide-y divide-slate-200/60 overflow-hidden rounded-xl border border-slate-200/60 bg-white/60 dark:divide-white/[0.05] dark:border-white/[0.06] dark:bg-white/[0.03]">
                                  {(invoicesData.payments ?? []).slice(0, 10).map((pay: ParentPayment, idx: number) => (
                                    <motion.li
                                      key={pay.id ?? idx}
                                      initial={reduced ? false : { opacity: 0, x: -8 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                                      className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-100/60 dark:hover:bg-white/[0.04]"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate text-[0.9rem] font-bold text-[var(--text-primary)]">
                                          {pay.reference
                                            ? t('parentPortal.paymentWithRef', { ref: pay.reference })
                                            : t('parentPortal.payment')}
                                        </p>
                                        <p className="mt-0.5 text-[0.75rem] font-medium text-[var(--text-muted)]">
                                          {pay.method || '—'} · {formatDate(pay.paidAt || pay.createdAt)}
                                        </p>
                                      </div>
                                      <span className="shrink-0 text-[1rem] font-black text-emerald-600 tabular-nums dark:text-emerald-400">
                                        {formatCurrency(pay.amount)}
                                      </span>
                                    </motion.li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-1 items-center justify-center p-10">
                          <p className="text-[0.85rem] font-medium text-[var(--text-muted)]">
                            {t('parentPortal.noFinances')}
                          </p>
                        </div>
                      )}
                    </div>
                  </LiquidGlassCard>
                </motion.div>
              )}
            </div>
          </div>
            </>
          )}
        </div>
      </div>

      <ParentSafetyTurnstileModal
        isOpen={isSafetyTurnstileOpen}
        onClose={() => setIsSafetyTurnstileOpen(false)}
      />
    </div>
  );
}

export default ParentPortalPage;