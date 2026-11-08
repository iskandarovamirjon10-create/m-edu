/**
 * ============================================================================
 *  M-EDU Telegram Integration & Administration Center (v2.0 Premium Edition)
 *  Hisobni ulash (Link + QR), Bot imkoniyatlari, Omnichannel Broadcast va
 *  Admin diagnostika (Long-Polling / Webhook / Ping / Delivery Analytics).
 * ============================================================================
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';

import {
  telegramApi,
  type TelegramStatusResponse,
  type TelegramAdminOverview,
  type TelegramBotInfoResponse,
  type TelegramWebhookInfoResponse,
} from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { RealQrCode } from '@/components/ui/RealQrCode';
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
  visible: { opacity: 1, transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
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
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  shieldCheck: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
  ],
  bolt: ['M13 2 3 14h9l-1 8 10-12h-9z'],
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
    'M15 9l-6 6',
    'M9 9l6 6',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4',
    'M12 16h.01',
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
  bot: [
    'M12 2v4',
    'M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z',
    'M9 14h.01',
    'M15 14h.01',
    'M9 17h6',
  ],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3',
    'M20 5h-3',
    'M5.5 18v2.5',
    'M6.75 19.25h-2.5',
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
  radio: [
    'M4.93 19.07A10 10 0 0 1 2 12a10 10 0 0 1 2.93-7.07',
    'M19.07 4.93A10 10 0 0 1 22 12a10 10 0 0 1-2.93 7.07',
    'M7.76 16.24A6 6 0 0 1 6 12a6 6 0 0 1 1.76-4.24',
    'M16.24 7.76A6 6 0 0 1 18 12a6 6 0 0 1-1.76 4.24',
    'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  ],
  qrCode: [
    'M3 3h7v7H3z',
    'M14 3h7v7h-7z',
    'M3 14h7v7H3z',
    'M14 14h3v3h-3z',
    'M18 18h3v3h-3z',
    'M18 14h3',
    'M14 18v3',
  ],
  terminal: ['M4 17l6-6-6-6', 'M12 19h8'],
  smartphone: [
    'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z',
    'M12 18h.01',
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
      aria-hidden="true"
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * TONES & CONSTANTS
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'telegram';
type TabKey = 'personal' | 'features' | 'broadcast' | 'admin';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:     { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)',   glow: 'rgba(37,99,235,0.28)',   border: 'rgba(37,99,235,0.20)' },
  green:    { fg: '#10B981', bg: 'rgba(16,185,129,0.10)',  glow: 'rgba(16,185,129,0.28)',  border: 'rgba(16,185,129,0.20)' },
  orange:   { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  glow: 'rgba(245,158,11,0.28)',  border: 'rgba(245,158,11,0.20)' },
  red:      { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',   glow: 'rgba(239,68,68,0.28)',   border: 'rgba(239,68,68,0.20)' },
  purple:   { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)',  glow: 'rgba(99,102,241,0.28)',  border: 'rgba(99,102,241,0.20)' },
  cyan:     { fg: '#0284C7', bg: 'rgba(2,132,199,0.10)',   glow: 'rgba(2,132,199,0.28)',   border: 'rgba(2,132,199,0.20)' },
  gray:     { fg: '#64748B', bg: 'rgba(100,116,139,0.10)', glow: 'rgba(100,116,139,0.22)', border: 'rgba(100,116,139,0.20)' },
  emerald:  { fg: '#10B981', bg: 'rgba(16,185,129,0.10)',  glow: 'rgba(16,185,129,0.28)',  border: 'rgba(16,185,129,0.20)' },
  telegram: { fg: '#0088cc', bg: 'rgba(0,136,204,0.10)',   glow: 'rgba(0,136,204,0.28)',   border: 'rgba(0,136,204,0.20)' },
};

const BOT_COMMANDS = [
  { cmd: '/start', desc: "Botni ishga tushirish va hisobni bog'lash" },
  { cmd: '/davomat', desc: "Bugungi va oylik davomat ko'rsatkichlari" },
  { cmd: '/baholar', desc: "Oxirgi fan baholari va imtihon natijalari" },
  { cmd: '/tolov', desc: "Joriy balans, invoyslar va to'lovlar tarixi" },
  { cmd: '/id', desc: "Shaxsiy M-EDU va Telegram identifikatorni olish" },
] as const;

const NOTIFICATION_CHANNELS = [
  {
    id: 'attendance',
    title: 'Turniket va Dars davomati',
    desc: "O'quvchi markazga kirganida yoki darsga kelmaganida tezkor xabar",
    tone: 'emerald' as Tone,
    icon: I.shieldCheck,
    defaultOn: true,
  },
  {
    id: 'grades',
    title: 'Baholar va Imtihon natijalari',
    desc: "Yangi baho qo'yilganda va imtihon javoblari chiqqanda bildirishnoma",
    tone: 'purple' as Tone,
    icon: I.sparkles,
    defaultOn: true,
  },
  {
    id: 'finance',
    title: "To'lov kvitansiyalari va Eslatmalar",
    desc: "To'lov qabul qilinganda rasmiy elektron chek va muddat eslatmalari",
    tone: 'blue' as Tone,
    icon: I.bell,
    defaultOn: true,
  },
  {
    id: 'security',
    title: 'Xavfsizlik va Tizimga kirish',
    desc: "Yangi qurilmadan kirish va muhim tizim o'zgarishlari haqida ogohlantirish",
    tone: 'orange' as Tone,
    icon: I.shield,
    defaultOn: true,
  },
] as const;

/* ============================================================================
 * HELPERS
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
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-[88px]" radius="1rem" />
        ))}
      </div>
      <Shimmer className="h-72 w-full" radius="1.75rem" />
    </div>
  );
}

/**
 * XATO TUZATILDI: CountUp endi har refetch bo'lganda 0 dan emas,
 * oldingi qiymatdan yangi qiymatga silliq o'tadi va reducedMotion ni hurmat qiladi.
 */
function CountUp({
  value,
  duration = 0.9,
}: {
  value: number;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const safeTarget = Number.isFinite(value) ? value : 0;
  const [n, setN] = useState(safeTarget);
  const prevValRef = useRef(safeTarget);

  useEffect(() => {
    if (reduced || duration <= 0) {
      setN(safeTarget);
      prevValRef.current = safeTarget;
      return;
    }

    const from = prevValRef.current;
    const to = safeTarget;
    if (from === to) return;

    let raf: number;
    let startTs: number | null = null;

    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      const current = from + (to - from) * eased;
      setN(current);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prevValRef.current = to;
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [safeTarget, duration, reduced]);

  return (
    <span className="tabular-nums">
      {Math.round(Number.isFinite(n) ? n : 0).toLocaleString('uz-UZ')}
    </span>
  );
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
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-3.5 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80"
    >
      <span
        aria-hidden="true"
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
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)' }}
        />
        <Icon paths={icon} size={18} strokeWidth={2} className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="truncate text-[21px] font-bold leading-none tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7]">
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

/** Premium tab control with layoutId & ARIA attributes */
function PremiumTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: TabKey; label: string; icon: string[]; tone: Tone; badge?: string }[];
  active: TabKey;
  onChange: (id: TabKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Telegram bo'limlari"
      className="no-scrollbar inline-flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-black/[0.05] bg-black/[0.035] p-1.5 dark:border-white/[0.07] dark:bg-white/[0.05]"
    >
      {tabs.map((tb) => {
        const isActive = active === tb.id;
        const c = TONES[tb.tone];
        return (
          <motion.button
            key={tb.id}
            id={`tg-page-tab-${tb.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`tg-page-panel-${tb.id}`}
            onClick={() => onChange(tb.id)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING.snappy}
            className="relative flex-1 overflow-hidden whitespace-nowrap rounded-xl px-3.5 py-2.5 text-[12.5px] font-bold tracking-tight outline-none transition-colors"
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
            <span className="relative inline-flex items-center justify-center gap-1.5">
              <Icon paths={tb.icon} size={14} strokeWidth={2.3} />
              <span>{tb.label}</span>
              {tb.badge && (
                <span
                  className="ml-1 rounded-full px-1.5 py-0.2 text-[9.5px] font-extrabold"
                  style={{ background: c.bg, color: c.fg }}
                >
                  {tb.badge}
                </span>
              )}
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
      className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80"
    >
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.05] px-5 py-4 dark:border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
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
            <h2 className="text-[14px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[11.5px] font-medium text-[#64748B]">
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
  badge,
  tone = 'telegram',
}: {
  icon: string[];
  title: string;
  desc: string;
  badge?: string;
  tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -4 }}
      transition={SPRING.smooth}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-5 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 transform-gpu rounded-full opacity-[0.14] blur-2xl transition-opacity group-hover:opacity-25"
        style={{ background: c.fg }}
      />
      <div>
        <div className="flex items-start justify-between gap-2">
          <div
            className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-white"
            style={{
              background: `linear-gradient(135deg, ${c.fg} 0%, ${c.glow} 100%)`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 20px -8px ${c.glow}`,
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
              }}
            />
            <Icon paths={icon} size={22} strokeWidth={2} className="relative" />
          </div>
          {badge && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
            >
              {badge}
            </span>
          )}
        </div>
        <h4 className="relative mt-4 text-[14.5px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          {title}
        </h4>
        <p className="relative mt-1.5 text-[12.5px] font-medium leading-relaxed text-[#64748B]">
          {desc}
        </p>
      </div>
    </motion.div>
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
  subtext,
}: {
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
  subtext?: string;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-4 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 transform-gpu rounded-full opacity-[0.14] blur-2xl transition-opacity group-hover:opacity-25"
        style={{ background: c.fg }}
      />
      <div className="relative flex items-center gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
          }}
        >
          <Icon paths={icon} size={15} strokeWidth={2.2} />
        </div>
        <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
          {label}
        </p>
      </div>
      <p className="relative mt-3 text-[26px] font-bold leading-none tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7]">
        <CountUp value={value} />
      </p>
      {subtext && (
        <p className="relative mt-1.5 text-[11px] font-medium text-[#64748B]">
          {subtext}
        </p>
      )}
    </motion.div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function TelegramPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('nav.telegram', 'Telegram Integratsiyasi'));
  const { user, hasAnyRole } = useAuth();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // XATO TUZATILDI: ADMIN roli ham qo'shildi va hasAnyRole orqali tekshiriladi
  const isAdmin = useMemo(
    () =>
      Boolean(
        hasAnyRole?.('PLATFORM_OWNER', 'SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN', 'MANAGER') ||
        user?.role === 'PLATFORM_OWNER' ||
        user?.role === 'MANAGER' ||
        (user?.role as string) === 'ADMIN' ||
        (user?.role as string) === 'SUPER_ADMIN' ||
        (user?.role as string) === 'ORG_ADMIN'
      ),
    [hasAnyRole, user?.role],
  );

  const allowedTabs = useMemo<TabKey[]>(
    () => (isAdmin ? ['personal', 'features', 'broadcast', 'admin'] : ['personal', 'features']),
    [isAdmin],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const rawUrlTab = searchParams.get('tab') as TabKey | null;

  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    rawUrlTab && allowedTabs.includes(rawUrlTab) ? rawUrlTab : 'personal',
  );

  // XATO TUZATILDI: Oddiy foydalanuvchi ?tab=admin ga kirsa, avtomatik 'personal' ga qaytariladi
  useEffect(() => {
    if (rawUrlTab && allowedTabs.includes(rawUrlTab)) {
      if (rawUrlTab !== activeTab) setActiveTab(rawUrlTab);
    } else if (rawUrlTab && !allowedTabs.includes(rawUrlTab)) {
      setActiveTab('personal');
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('tab');
          return next;
        },
        { replace: true },
      );
    }
  }, [rawUrlTab, allowedTabs, activeTab, setSearchParams]);

  const handleTabChange = useCallback(
    (tab: TabKey) => {
      if (!allowedTabs.includes(tab)) return;
      setActiveTab(tab);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'personal') next.delete('tab');
          else next.set('tab', tab);
          return next;
        },
        { replace: true },
      );
    },
    [allowedTabs, setSearchParams],
  );

  const [pendingLink, setPendingLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('medu_tg_notif_prefs');
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return { attendance: true, grades: true, finance: true, security: true };
  });

  const togglePref = (id: string) => {
    setPrefs((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('medu_tg_notif_prefs', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  /* ── Queries ──────────────────────────────────────────────────────── */
  // YANGILIK: pendingLink faol bo'lganda har 3 soniyada tekshiradi (Fast-Polling)
  const statusQ = useQuery({
    queryKey: ['telegram-status'],
    queryFn: telegramApi.status,
    refetchInterval: pendingLink ? 3_000 : 30_000,
  });

  const statusData = statusQ.data as TelegramStatusResponse | undefined;
  const isLinked = statusData?.status === 'ACTIVE';

  // Foydalanuvchi Telegramda START bosib ulanishi bilan pendingLink tozalanadi va tabrik chiqadi
  useEffect(() => {
    if (isLinked && pendingLink) {
      setPendingLink(null);
      push('success', "Telegram hisobingiz muvaffaqiyatli ulandi!");
      void qc.invalidateQueries({ queryKey: ['telegram-admin-overview'] });
    }
  }, [isLinked, pendingLink, push, qc]);

  const adminOverviewQ = useQuery<TelegramAdminOverview>({
    queryKey: ['telegram-admin-overview'],
    queryFn: telegramApi.adminOverview,
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  const botInfoQ = useQuery<TelegramBotInfoResponse>({
    queryKey: ['telegram-bot-info'],
    queryFn: telegramApi.botInfo,
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  const webhookInfoQ = useQuery<TelegramWebhookInfoResponse>({
    queryKey: ['telegram-webhook-info'],
    queryFn: telegramApi.webhookInfo,
    enabled: isAdmin,
    refetchInterval: 15_000,
  });

  const [pingLatency, setPingLatency] = useState<number | null>(null);

  /* ── Mutations ────────────────────────────────────────────────────── */
  const pingMut = useMutation({
    mutationFn: () => telegramApi.ping(),
    onSuccess: (data) => {
      setPingLatency(data.pingMs);
      push('success', `Telegram API javob berdi (${data.pingMs} ms)`);
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const toggleModeMut = useMutation({
    mutationFn: (mode: 'WEBHOOK' | 'POLLING') => telegramApi.toggleMode(mode),
    onSuccess: (data) => {
      push('success', data.message || `Rejim o'zgartirildi: ${data.mode}`);
      void qc.invalidateQueries({ queryKey: ['telegram-webhook-info'] });
      void qc.invalidateQueries({ queryKey: ['telegram-bot-info'] });
      void qc.invalidateQueries({ queryKey: ['telegram-admin-overview'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const createLinkMut = useMutation({
    mutationFn: () => telegramApi.createLink(),
    onSuccess: (data) => {
      setPendingLink(data.deepLink);
      setCopied(false);
      push(
        'success',
        t('settings.telegram.linkReady', 'Maxfiy ulanish havolasi va QR-kod tayyor!'),
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
        t('settings.telegram.disconnected', 'Telegram hisobi uzildi'),
      );
      void qc.invalidateQueries({ queryKey: ['telegram-status'] });
      void qc.invalidateQueries({ queryKey: ['telegram-admin-overview'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const testNotifMut = useMutation({
    mutationFn: () => telegramApi.testNotification(),
    onSuccess: (data) => {
      if (data.sent) {
        push(
          'success',
          t('settings.telegram.testSent', 'Sinov xabari Telegramingizga yuborildi!'),
        );
      } else {
        push(
          'error',
          t('settings.telegram.testFailed', "Sinov xabarini yuborib bo'lmadi"),
        );
      }
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
      push('success', t('common.copied', 'Havola nusxalandi'));
    } catch {
      push('error', "Nusxalab bo'lmadi");
    }
  }, [pendingLink, push, t]);

  const copyCommand = useCallback(
    async (cmd: string) => {
      try {
        await navigator.clipboard.writeText(cmd);
        setCopiedCmd(cmd);
        setTimeout(() => setCopiedCmd((prev) => (prev === cmd ? null : prev)), 1600);
        push('success', `${cmd} buyrug'i nusxalandi`);
      } catch {
        /* ignore */
      }
    },
    [push],
  );

  const TABS = useMemo(
    () => [
      {
        id: 'personal' as TabKey,
        label: t('telegram.tabPersonal', 'Mening Ulanishim'),
        icon: I.bot,
        tone: 'telegram' as Tone,
        badge: isLinked ? 'Faol' : undefined,
      },
      {
        id: 'features' as TabKey,
        label: t('telegram.tabFeatures', 'Bot Imkoniyatlari'),
        icon: I.sparkles,
        tone: 'purple' as Tone,
      },
      ...(isAdmin
        ? [
            {
              id: 'broadcast' as TabKey,
              label: t('telegram.tabBroadcast', 'Xabarnoma Studiyasi'),
              icon: I.send,
              tone: 'blue' as Tone,
            },
            {
              id: 'admin' as TabKey,
              label: t('telegram.tabAdmin', 'Boshqaruv va Diagnostika'),
              icon: I.shieldCheck,
              tone: 'emerald' as Tone,
            },
          ]
        : []),
    ],
    [isAdmin, isLinked, t],
  );

  // 24 soatlik yetkazib berish ko'rsatkichi
  const deliveryStats = useMemo(() => {
    const sent = adminOverviewQ.data?.deliveries?.last24h?.sent ?? 0;
    const failed = (adminOverviewQ.data?.deliveries?.last24h as Record<string, number> | undefined)?.failed ?? 0;
    const total = sent + failed;
    const rate = total > 0 ? Math.round((sent / total) * 100) : 100;
    return { sent, failed, total, rate };
  }, [adminOverviewQ.data]);

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (statusQ.isLoading) {
    return (
      <div className="page-container mx-auto max-w-5xl space-y-5">
        <TelegramSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (statusQ.isError) {
    return (
      <div className="page-container mx-auto max-w-5xl space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            title={t('common.error', 'Xatolik yuz berdi')}
            message={getErrorMessage(statusQ.error as Error)}
            onRetry={() => void statusQ.refetch()}
          />
        </div>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-full bg-transparent selection:bg-brand-500/30">
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
          <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-6 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 sm:p-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20" />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-24"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
              }}
            />
            <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
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
                    aria-hidden="true"
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
                      Smart Ekotizim
                    </span>
                    <StatusPill
                      active={isLinked}
                      label={
                        isLinked
                          ? t('telegram.statusConnected', 'Ulangan')
                          : t('telegram.statusNotConnected', 'Ulanmagan')
                      }
                    />
                    {isLinked && statusData?.username && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0088cc]/10 px-2.5 py-1 text-[10.5px] font-bold tracking-[0.06em] text-[#0088cc]">
                        <Icon paths={I.bot} size={11} strokeWidth={2.4} />
                        @{statusData.username}
                      </span>
                    )}
                  </div>

                  <h1 className="mt-2 text-2xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-3xl">
                    {t('nav.telegram', 'Telegram Integratsiya Markazi')}
                  </h1>
                  <p className="mt-1 max-w-2xl text-[13.5px] font-medium text-[#64748B]">
                    {t(
                      'telegram.subtitle',
                      "Real vaqtdagi davomat, Face ID turniket bildirishnomalari, baholar va M-EDU Mini App ilovasini Telegram orqali boshqaring.",
                    )}
                  </p>
                </div>
              </div>

              {/* Tezkor WebApp tugmasi */}
              <div className="flex shrink-0 items-center gap-2 self-stretch sm:self-center">
                <Link
                  to="/tg-webapp"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#0088cc]/25 bg-[#0088cc]/10 px-3.5 py-2.5 text-[12px] font-bold text-[#0088cc] transition-all hover:bg-[#0088cc]/15 sm:w-auto"
                >
                  <Icon paths={I.smartphone} size={15} strokeWidth={2.2} />
                  Mini App (WebApp)
                </Link>
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
            label={t('common.status', 'Holat')}
            stringValue={
              isLinked
                ? t('common.active', 'Faol')
                : t('common.idle', 'Kutilmoqda')
            }
            secondary={isLinked ? 'Xabarlar yoqilgan' : "Bog'lanmagan"}
            icon={isLinked ? I.checkCircle : I.alertCircle}
            tone={isLinked ? 'emerald' : 'orange'}
          />
          <KpiTile
            label={t('telegram.kpi.account', 'Telegram Profil')}
            stringValue={
              isLinked && statusData?.username ? `@${statusData.username}` : '—'
            }
            secondary={isLinked ? 'Tasdiqlangan' : 'Ulanmagan'}
            icon={I.bot}
            tone="telegram"
          />
          {isAdmin ? (
            <KpiTile
              label={t('telegram.kpi.linkedAccounts', 'Ulangan Hisoblar')}
              value={adminOverviewQ.data?.accounts?.total ?? 0}
              secondary={`Faol: ${adminOverviewQ.data?.accounts?.active ?? 0} ta`}
              icon={I.users}
              tone="blue"
            />
          ) : (
            <KpiTile
              label={t('telegram.kpi.features', 'Faol Modullar')}
              value={5}
              secondary="Turniket, Baho, To'lov, AI"
              icon={I.sparkles}
              tone="purple"
            />
          )}
          {isAdmin ? (
            <KpiTile
              label={t('telegram.kpi.delivered24h', '24s Xabarlar')}
              value={deliveryStats.sent}
              secondary={`Samaradorlik: ${deliveryStats.rate}%`}
              icon={I.activity}
              tone="emerald"
            />
          ) : (
            <KpiTile
              label={t('telegram.kpi.reminders', 'Dars Eslatmasi')}
              stringValue="15 daq"
              secondary="Darsdan oldin"
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
            id={`tg-page-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tg-page-tab-${activeTab}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SPRING.smooth}
            className="space-y-5"
          >
            {/* ========== PERSONAL TAB ========== */}
            {activeTab === 'personal' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                  {/* Connection panel */}
                  <SectionPanel
                    icon={isLinked ? I.shieldCheck : I.link}
                    tone={isLinked ? 'emerald' : 'telegram'}
                    title={
                      isLinked
                        ? t('telegram.connectedTitle', 'Telegram hisobingiz ulangan')
                        : t('telegram.notConnectedTitle', 'Telegram hisobi ulanmagan')
                    }
                    subtitle={
                      isLinked
                        ? t(
                            'telegram.connectedSubtitle',
                            'Hisobingiz M-EDU rasmiy botiga kriptografik token orqali xavfsiz ulangan.',
                          )
                        : t(
                            'telegram.notConnectedSubtitle',
                            'Dars jadvali, davomat va tezkor xabarlarni olish uchun hisobingizni ulang.',
                          )
                    }
                    right={
                      <StatusPill
                        active={isLinked}
                        label={isLinked ? 'Faol' : pendingLink ? 'Kutilmoqda...' : 'Ulanmagan'}
                      />
                    }
                  >
                    <div className="space-y-4 p-5">
                      {isLinked ? (
                        <>
                          {/* Account card */}
                          <div className="relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-[#10B981]/25 bg-[#10B981]/[0.06] px-4 py-4">
                            <div
                              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
                              style={{
                                background: 'linear-gradient(135deg, #0088cc 0%, #0284C7 100%)',
                                boxShadow:
                                  'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(0,136,204,0.5)',
                              }}
                            >
                              <Icon paths={I.bot} size={22} strokeWidth={2} className="relative" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                                Bog&apos;langan Telegram Profil
                              </p>
                              <p className="mt-0.5 truncate text-[16px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                                @{statusData?.username || 'foydalanuvchi'}
                              </p>
                              <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">
                                Real-vaqt bildirishnomalari va Mini App kirishi faol
                              </p>
                            </div>
                            <StatusPill active label="Tasdiqlangan" />
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap items-center gap-2.5 pt-1">
                            <GlassButton
                              type="button"
                              variant="primary"
                              onClick={() => testNotifMut.mutate()}
                              disabled={testNotifMut.isPending}
                            >
                              <span className="inline-flex items-center gap-2">
                                {testNotifMut.isPending ? (
                                  <>
                                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                    Yuborilmoqda...
                                  </>
                                ) : (
                                  <>
                                    <Icon paths={I.send} size={14} strokeWidth={2.4} />
                                    Sinov xabarini yuborish
                                  </>
                                )}
                              </span>
                            </GlassButton>

                            <GlassButton
                              type="button"
                              variant="secondary"
                              onClick={() => void statusQ.refetch()}
                              disabled={statusQ.isFetching}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <Icon
                                  paths={I.refresh}
                                  size={14}
                                  strokeWidth={2.2}
                                  className={statusQ.isFetching ? 'animate-spin' : ''}
                                />
                                Holatni yangilash
                              </span>
                            </GlassButton>

                            <GlassButton
                              type="button"
                              variant="danger"
                              onClick={() => setConfirmUnlinkOpen(true)}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Icon paths={I.unlink} size={14} strokeWidth={2.2} />
                                Aloqani uzish
                              </span>
                            </GlassButton>
                          </div>
                        </>
                      ) : !pendingLink ? (
                        <div className="rounded-2xl border border-dashed border-slate-300/80 p-6 text-center dark:border-white/[0.12]">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0088cc]/10 text-[#0088cc]">
                            <Icon paths={I.link} size={24} strokeWidth={2} />
                          </div>
                          <p className="mt-3 text-[15px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            1-Bosishda Telegramga Ulanish
                          </p>
                          <p className="mx-auto mt-1 max-w-md text-[12.5px] font-medium leading-relaxed text-[#64748B]">
                            Bir martalik xavfsiz havola va QR-kod yarating. Uni telefon yoki kompyuter orqali ochib, botda <strong>START</strong> tugmasini bosing.
                          </p>
                          <div className="mt-5 flex justify-center">
                            <GlassButton
                              type="button"
                              variant="primary"
                              onClick={() => createLinkMut.mutate()}
                              disabled={createLinkMut.isPending}
                            >
                              <span className="inline-flex items-center gap-2">
                                {createLinkMut.isPending ? (
                                  <>
                                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                    Yaratilmoqda...
                                  </>
                                ) : (
                                  <>
                                    <Icon paths={I.qrCode} size={15} strokeWidth={2.2} />
                                    Ulanish havolasi va QR yaratish
                                  </>
                                )}
                              </span>
                            </GlassButton>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Steps */}
                          <div className="rounded-2xl border border-[#0088cc]/25 bg-[#0088cc]/[0.06] p-4">
                            <div className="mb-2.5 flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0088cc]">
                                Ulanish bo&apos;yicha qadamlar
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500">
                                <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                                Tasdiqlash kutilmoqda...
                              </span>
                            </div>
                            <ol className="space-y-2">
                              <li className="flex items-start gap-2.5 text-[12.5px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#0088cc] text-[10px] font-bold text-white">
                                  1
                                </span>
                                Quyidagi tugmani bosing yoki o&apos;ng tomondagi QR-kodni telefoningizda skanerlang.
                              </li>
                              <li className="flex items-start gap-2.5 text-[12.5px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#0088cc] text-[10px] font-bold text-white">
                                  2
                                </span>
                                Telegram bot ochilganda <strong>START (Boshlash)</strong> tugmasini bosing — sahifa avtomatik yangilanadi.
                              </li>
                            </ol>
                          </div>

                          {/* Link copy */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={pendingLink}
                              aria-label="Telegram ulanish havolasi"
                              className="flex-1 rounded-xl border border-slate-200/80 bg-black/[0.02] px-3.5 py-2.5 font-mono text-[11.5px] text-[#1D1D1F] outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#F5F5F7]"
                            />
                            <motion.button
                              type="button"
                              onClick={() => void copyLink()}
                              whileHover={{ scale: 1.06 }}
                              whileTap={{ scale: 0.94 }}
                              transition={SPRING.snappy}
                              aria-label="Havolani nusxalash"
                              title="Havolani nusxalash"
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl outline-none"
                              style={{
                                background: copied ? 'rgba(16,185,129,0.14)' : 'rgba(0,136,204,0.10)',
                                color: copied ? '#10B981' : '#0088cc',
                                border: `1px solid ${copied ? 'rgba(16,185,129,0.28)' : 'rgba(0,136,204,0.20)'}`,
                              }}
                            >
                              <Icon paths={copied ? I.check : I.copy} size={15} strokeWidth={2.4} />
                            </motion.button>
                          </div>

                          {/* Open in Telegram + Cancel */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            {isSafeUrl(pendingLink) && (
                              <motion.a
                                href={pendingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                whileHover={{ scale: 1.01, y: -1 }}
                                whileTap={{ scale: 0.99 }}
                                transition={SPRING.snappy}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold tracking-tight text-white outline-none"
                                style={{
                                  background: 'linear-gradient(135deg, #0088cc 0%, #0284C7 100%)',
                                  boxShadow:
                                    'inset 0 1px 0 rgba(255,255,255,0.35), 0 10px 24px -8px rgba(0,136,204,0.5)',
                                }}
                              >
                                <Icon paths={I.externalLink} size={15} strokeWidth={2.4} />
                                Telegramda Ochish
                              </motion.a>
                            )}

                            <GlassButton
                              type="button"
                              variant="secondary"
                              onClick={() => setPendingLink(null)}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <Icon paths={I.xCircle} size={14} strokeWidth={2.2} />
                                Bekor qilish
                              </span>
                            </GlassButton>
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionPanel>

                  {/* YANGILIK: Interaktiv QR Skaner yoki Ulangan Smart Karta */}
                  <motion.div variants={cardVariants}>
                    <div className="relative flex h-full flex-col items-center justify-between overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-6 text-center shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80">
                      {pendingLink && !isLinked ? (
                        <>
                          <div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0088cc]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0088cc]">
                              <Icon paths={I.qrCode} size={12} strokeWidth={2.2} />
                              Tezkor QR Ulanish
                            </span>
                            <h3 className="mt-2 text-[15px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                              Telefon kamerasi bilan skanerlang
                            </h3>
                          </div>

                          <div className="my-4 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-md">
                            <RealQrCode
                              value={pendingLink}
                              className="h-44 w-44"
                              fgColor="#0F172A"
                              bgColor="#FFFFFF"
                              margin={1}
                              title="Telegram hisobni ulash QR-kodi"
                            />
                          </div>

                          <p className="text-[11.5px] font-medium text-[#64748B]">
                            Kompyuterda ishlayotgan bo&apos;lsangiz, telefoningiz kamerasini QR-kodga qarating.
                          </p>
                        </>
                      ) : (
                        <>
                          {/* Decorative rings */}
                          <motion.span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-6 rounded-full"
                            style={{
                              background:
                                'radial-gradient(closest-side, rgba(0,136,204,0.16), transparent 70%)',
                            }}
                            animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                          />

                          <div className="relative z-10 flex flex-col items-center pt-2">
                            <motion.div
                              animate={{ y: [-4, 4, -4] }}
                              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                              className="relative flex h-24 w-24 items-center justify-center rounded-3xl text-white"
                              style={{
                                background: isLinked
                                  ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                                  : 'linear-gradient(135deg, #0088cc 0%, #0284C7 100%)',
                                boxShadow: isLinked
                                  ? 'inset 0 2px 0 rgba(255,255,255,0.35), 0 18px 36px -10px rgba(16,185,129,0.5)'
                                  : 'inset 0 2px 0 rgba(255,255,255,0.35), 0 18px 36px -10px rgba(0,136,204,0.5)',
                              }}
                            >
                              <Icon
                                paths={isLinked ? I.shieldCheck : I.telegram}
                                size={42}
                                strokeWidth={1.9}
                                className="relative"
                              />
                            </motion.div>

                            <h3 className="mt-4 text-[15px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {isLinked ? 'Smart Campus Pass Faol' : 'M-EDU Telegram Bot'}
                            </h3>
                            <p className="mt-1 max-w-[240px] text-[12px] font-medium leading-relaxed text-[#64748B]">
                              {isLinked
                                ? "Telegram Mini App orqali raqamli ruxsatnoma (QR Pass) va AI yordamchidan foydalanishingiz mumkin."
                                : "Ulanish havolasini yaratganingizda shu yerda skanerlash uchun QR-kod paydo bo'ladi."}
                            </p>
                          </div>

                          <div className="relative z-10 mt-5 w-full">
                            <Link
                              to="/tg-webapp"
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/[0.08] bg-black/[0.03] px-4 py-2.5 text-[12px] font-bold text-[#1D1D1F] transition-colors hover:bg-black/[0.06] dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.1]"
                            >
                              <Icon paths={I.smartphone} size={15} strokeWidth={2.2} />
                              WebApp portalni ochish
                            </Link>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Bildirishnoma kanallari matritsasi */}
                <SectionPanel
                  icon={I.bell}
                  tone="purple"
                  title="Avtomatik Bildirishnoma Kanallari"
                  subtitle="Telegram orqali qabul qilinadigan tezkor xabarnoma turlari."
                >
                  <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
                    {NOTIFICATION_CHANNELS.map((ch) => {
                      const enabled = prefs[ch.id] ?? ch.defaultOn;
                      const c = TONES[ch.tone];
                      return (
                        <div
                          key={ch.id}
                          className="flex items-start justify-between gap-3 rounded-2xl border border-black/[0.06] bg-black/[0.015] p-4 transition-colors dark:border-white/[0.07] dark:bg-white/[0.02]"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                              style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
                            >
                              <Icon paths={ch.icon} size={16} strokeWidth={2.1} />
                            </div>
                            <div>
                              <h4 className="text-[13px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                                {ch.title}
                              </h4>
                              <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#64748B]">
                                {ch.desc}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            onClick={() => togglePref(ch.id)}
                            className={`relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                              enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </SectionPanel>
              </div>
            )}

            {/* ========== FEATURES TAB ========== */}
            {activeTab === 'features' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <FeatureCard
                    icon={I.bell}
                    title={t('telegram.feature.alertsTitle', 'Turniket va Davomat Xabarlari')}
                    desc={t(
                      'telegram.feature.alertsDesc',
                      "O'quvchi Face ID yoki turniketdan o'tishi bilan ota-onaga kirish/chiqish vaqti haqida soniyasida xabar boradi.",
                    )}
                    badge="Real-time"
                    tone="telegram"
                  />
                  <FeatureCard
                    icon={I.message}
                    title={t('telegram.feature.repliesTitle', 'AI Copilot va Ikki Tomonlama Aloqa')}
                    desc={t(
                      'telegram.feature.repliesDesc',
                      "Telegram ichidan turib AI yordamchiga savol berish, sababli dars qoldirish arizasini yuborish va ma'muriyat bilan bog'lanish.",
                    )}
                    badge="AI Powered"
                    tone="purple"
                  />
                  <FeatureCard
                    icon={I.shieldCheck}
                    title={t('telegram.feature.loginTitle', 'Zero-Click Kriptografik Kirish')}
                    desc={t(
                      'telegram.feature.loginDesc',
                      "Parol va login kiritmasdan Telegram WebApp initData imzosi orqali bir zumda xavfsiz avtorizatsiya.",
                    )}
                    badge="HMAC-SHA256"
                    tone="emerald"
                  />
                  <FeatureCard
                    icon={I.bolt}
                    title={t('telegram.feature.remindersTitle', 'Aqlli Dars va Vazifa Eslatmalari')}
                    desc={t(
                      'telegram.feature.remindersDesc',
                      "Dars boshlanishidan 15 daqiqa avval xona raqami va uyga vazifa muddatlari haqida avtomatik eslatma.",
                    )}
                    badge="Avtomatik"
                    tone="orange"
                  />
                  <FeatureCard
                    icon={I.bot}
                    title="M-EDU Telegram Mini App (TMA)"
                    desc="Mobil Telegram ilovasi ichida to'liq ota-ona, o'quvchi, ustoz va direktor panellari, M-Coin do'koni hamda raqamli QR ruxsatnoma."
                    badge="WebApp v6.0"
                    tone="blue"
                  />
                  <FeatureCard
                    icon={I.qrCode}
                    title="Raqamli Kampus Ruxsatnomasi (QR Pass)"
                    desc="Har 60 soniyada yangilanuvchi dinamik QR-kod orqali o'quv markazi turniketlaridan xavfsiz o'tish."
                    badge="Smart Pass"
                    tone="cyan"
                  />
                </div>

                {/* Bot Buyruqlari Ma'lumotnomasi */}
                <SectionPanel
                  icon={I.terminal}
                  tone="telegram"
                  title="Botning Tezkor Buyruqlari (Commands)"
                  subtitle="Foydalanuvchilar bot bilan muloqotda ishlatishi mumkin bo'lgan asosiy buyruqlar."
                >
                  <div className="divide-y divide-black/[0.05] px-5 py-2 dark:divide-white/[0.05]">
                    {BOT_COMMANDS.map((item) => {
                      const isCmdCopied = copiedCmd === item.cmd;
                      return (
                        <div
                          key={item.cmd}
                          className="flex items-center justify-between gap-3 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <code className="rounded-lg border border-[#0088cc]/25 bg-[#0088cc]/10 px-2.5 py-1 font-mono text-[12px] font-bold text-[#0088cc]">
                              {item.cmd}
                            </code>
                            <span className="text-[12.5px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {item.desc}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void copyCommand(item.cmd)}
                            className="inline-flex items-center gap-1 rounded-lg border border-black/[0.06] bg-black/[0.02] px-2.5 py-1 text-[11px] font-bold text-[#64748B] transition-colors hover:text-[#1D1D1F] dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:text-white"
                          >
                            <Icon paths={isCmdCopied ? I.check : I.copy} size={12} strokeWidth={2.2} />
                            {isCmdCopied ? 'Nusxalandi' : 'Nusxa'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </SectionPanel>
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
              <div className="space-y-6">
                {/* Bot Health, Polling vs Webhook Mode & Latency Diagnostic */}
                <SectionPanel
                  icon={I.radio}
                  tone="purple"
                  title="Telegram Bot Dvigateli va Aloqa Holati"
                  subtitle="Botning jonli Telegram ulanishi, yetkazib berish rejimi (Long-Polling / Webhook) va server kechikish vaqti."
                  right={
                    <div className="flex items-center gap-2">
                      <GlassButton
                        size="sm"
                        variant="ghost"
                        onClick={() => pingMut.mutate()}
                        disabled={pingMut.isPending}
                      >
                        <Icon
                          paths={I.activity}
                          className={`mr-1.5 h-4 w-4 ${pingMut.isPending ? 'animate-pulse text-purple-400' : 'text-purple-500'}`}
                        />
                        {pingMut.isPending ? "Ping o'lchanmoqda..." : 'Ping Tekshirish'}
                      </GlassButton>
                      <GlassButton
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void botInfoQ.refetch();
                          void webhookInfoQ.refetch();
                          void adminOverviewQ.refetch();
                        }}
                        disabled={botInfoQ.isFetching || webhookInfoQ.isFetching}
                        title="Ma'lumotlarni yangilash"
                      >
                        <Icon
                          paths={I.refresh}
                          className={`h-4 w-4 ${botInfoQ.isFetching || webhookInfoQ.isFetching ? 'animate-spin' : ''}`}
                        />
                      </GlassButton>
                    </div>
                  }
                >
                  {botInfoQ.isLoading || webhookInfoQ.isLoading ? (
                    <div className="space-y-3 p-5">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                          <Shimmer key={i} className="h-24" radius="1rem" />
                        ))}
                      </div>
                      <Shimmer className="h-20" radius="1rem" />
                    </div>
                  ) : botInfoQ.isError || webhookInfoQ.isError ? (
                    <div className="p-8">
                      <GlassErrorState
                        title="Telegram bot holatini yuklashda xatolik"
                        message={getErrorMessage((botInfoQ.error || webhookInfoQ.error) as Error)}
                        onRetry={() => {
                          void botInfoQ.refetch();
                          void webhookInfoQ.refetch();
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4 p-5">
                      {/* Status KPI Cards */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {/* 1. Bot Identity */}
                        <div className="flex flex-col justify-between rounded-xl border border-black/[0.06] bg-black/[0.02] p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Telegram Bot</span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                botInfoQ.data?.configured
                                  ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  botInfoQ.data?.configured ? 'animate-pulse bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              {botInfoQ.data?.configured ? 'Faol (Online)' : 'Ulanmagan'}
                            </span>
                          </div>
                          <div className="mt-2">
                            <p className="truncate text-sm font-bold text-slate-800 dark:text-white">
                              {botInfoQ.data?.bot?.first_name || 'Bot aniqlanmadi'}
                            </p>
                            {botInfoQ.data?.username ? (
                              <a
                                href={`https://t.me/${botInfoQ.data.username}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-[#0088cc] hover:underline"
                              >
                                @{botInfoQ.data.username}
                                <Icon paths={I.externalLink} size={12} />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">Token kiritilmagan</span>
                            )}
                          </div>
                        </div>

                        {/* 2. Active Delivery Mode */}
                        <div className="flex flex-col justify-between rounded-xl border border-black/[0.06] bg-black/[0.02] p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Aloqa Rejimi</span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                webhookInfoQ.data?.mode === 'POLLING'
                                  ? 'border border-purple-500/30 bg-purple-500/15 text-purple-600 dark:text-purple-300'
                                  : webhookInfoQ.data?.mode === 'WEBHOOK'
                                  ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                                  : 'border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                              }`}
                            >
                              {webhookInfoQ.data?.mode === 'POLLING'
                                ? '⚡ Long-Polling'
                                : webhookInfoQ.data?.mode === 'WEBHOOK'
                                ? '🟢 Webhook'
                                : '⚠️ Sozlanmagan'}
                            </span>
                          </div>
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {webhookInfoQ.data?.mode === 'POLLING'
                                ? 'Lokal Development (Lokal PC)'
                                : webhookInfoQ.data?.mode === 'WEBHOOK'
                                ? 'Production (Jonli Server)'
                                : 'Rejim faol emas'}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {webhookInfoQ.data?.mode === 'POLLING'
                                ? 'HTTPS/Tunnel shart emas'
                                : webhookInfoQ.data?.mode === 'WEBHOOK'
                                ? "Telegram to'g'ridan-to'g'ri uzatadi"
                                : 'Token kiritish lozim'}
                            </p>
                          </div>
                        </div>

                        {/* 3. Latency / Ping */}
                        <div className="flex flex-col justify-between rounded-xl border border-black/[0.06] bg-black/[0.02] p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Telegram API Ping</span>
                            <span className="font-mono text-[11px] text-slate-400">Real-time</span>
                          </div>
                          <div className="mt-2">
                            <div className="flex items-baseline gap-2">
                              <span
                                className={`font-mono text-base font-bold ${
                                  pingLatency !== null
                                    ? pingLatency < 300
                                      ? 'text-emerald-500'
                                      : pingLatency < 700
                                      ? 'text-amber-500'
                                      : 'text-rose-500'
                                    : 'text-slate-400'
                                }`}
                              >
                                {pingLatency !== null ? `${pingLatency} ms` : '—'}
                              </span>
                              {pingLatency !== null && (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {pingLatency < 300 ? "A'lo darajada" : pingLatency < 700 ? 'Normal' : 'Kechikish bor'}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {pingLatency !== null ? 'Telegram serveri javob vaqti' : 'Sinash uchun "Ping" tugmasini bosing'}
                            </p>
                          </div>
                        </div>

                        {/* 4. Queue / Updates Flow */}
                        <div className="flex flex-col justify-between rounded-xl border border-black/[0.06] bg-black/[0.02] p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Yangilanishlar Holati</span>
                            <Icon paths={I.sparkles} size={14} className="text-amber-400" />
                          </div>
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {webhookInfoQ.data?.mode === 'POLLING'
                                ? `Offset: ${webhookInfoQ.data?.polling?.currentOffset || 0}`
                                : `Navbat: ${webhookInfoQ.data?.webhook?.pending_update_count ?? 0} ta xabar`}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {webhookInfoQ.data?.mode === 'POLLING'
                                ? webhookInfoQ.data?.polling?.lastPollAt
                                  ? `Oxirgi: ${new Date(webhookInfoQ.data.polling.lastPollAt).toLocaleTimeString('uz-UZ')}`
                                  : 'Faol qidirilmoqda...'
                                : webhookInfoQ.data?.webhook?.url || "URL yo'q"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Mode Switcher Action Banner */}
                      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-black/[0.06] bg-gradient-to-r from-purple-500/[0.06] via-blue-500/[0.04] to-emerald-500/[0.06] p-4 dark:border-white/[0.08] dark:from-purple-900/20 dark:via-blue-900/10 dark:to-emerald-900/20 sm:flex-row sm:items-center">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800 dark:text-white">
                              {webhookInfoQ.data?.mode === 'POLLING'
                                ? '⚡ Long-Polling rejimi faol (Lokal Dev)'
                                : webhookInfoQ.data?.mode === 'WEBHOOK'
                                ? '🌐 Webhook rejimi faol (Production)'
                                : '⚠️ Bot sozlanmagan'}
                            </span>
                            <span className="rounded bg-black/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-600 dark:bg-white/10 dark:text-slate-300">
                              1-Click Rejim Switcher
                            </span>
                          </div>
                          <p className="max-w-xl text-xs text-slate-600 dark:text-slate-300">
                            {webhookInfoQ.data?.mode === 'POLLING'
                              ? "Bot hozir Telegram serverlaridan xabarlarni to'g'ridan-to'g'ri qabul qilmoqda. Lokal kompyuteringizda ngrok yoki tashqi HTTPS domeni shart emas. Production serverga o'tganda Webhook rejimini yoqing."
                              : "Telegram serverlari xabarlarni belgilangan URL manzilga yetkazadi. Agar lokal kompyuteringizda (localhost) botni test qilmoqchi bo'lsangiz, Long-Polling rejimiga o'ting."}
                          </p>
                        </div>

                        <div className="shrink-0">
                          {webhookInfoQ.data?.mode === 'POLLING' ? (
                            <GlassButton
                              variant="primary"
                              size="sm"
                              onClick={() => toggleModeMut.mutate('WEBHOOK')}
                              disabled={toggleModeMut.isPending}
                              className="bg-emerald-600 text-white shadow-md hover:bg-emerald-700"
                            >
                              <Icon paths={I.radio} className="mr-1.5 h-4 w-4" />
                              {toggleModeMut.isPending ? 'Ulanmoqda...' : "Webhook rejimiga o'tish"}
                            </GlassButton>
                          ) : (
                            <GlassButton
                              variant="primary"
                              size="sm"
                              onClick={() => toggleModeMut.mutate('POLLING')}
                              disabled={toggleModeMut.isPending}
                              className="bg-purple-600 text-white shadow-md hover:bg-purple-700"
                            >
                              <Icon paths={I.bolt} className="mr-1.5 h-4 w-4" />
                              {toggleModeMut.isPending ? "O'tkazilmoqda..." : "Long-Polling ga o'tish (Dev)"}
                            </GlassButton>
                          )}
                        </div>
                      </div>

                      {/* Webhook Error Alert if any */}
                      {webhookInfoQ.data?.webhook?.last_error_message && (
                        <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                          <Icon paths={I.alertCircle} size={16} className="shrink-0" />
                          <div>
                            <span className="font-semibold">Telegram Webhook xatosi: </span>
                            <span>{webhookInfoQ.data.webhook.last_error_message}</span>
                            {webhookInfoQ.data.webhook.last_error_date && (
                              <span className="ml-2 text-[10px] opacity-75">
                                ({new Date(webhookInfoQ.data.webhook.last_error_date * 1000).toLocaleTimeString('uz-UZ')})
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </SectionPanel>

                {/* Admin Overview Stats */}
                <SectionPanel
                  icon={I.shieldCheck}
                  tone="emerald"
                  title={t('telegram.adminOverviewTitle', 'Boshqaruv va Yetkazib Berish Statistikasi')}
                  subtitle={t(
                    'telegram.adminOverviewSubtitle',
                    "Tashkilot bo'yicha ulangan hisoblar va oxirgi 24 soatlik xabarlar oqimi.",
                  )}
                >
                  {adminOverviewQ.isLoading ? (
                    <div className="space-y-2.5 p-5">
                      {[1, 2, 3].map((i) => (
                        <Shimmer key={i} className="h-20" radius="1rem" />
                      ))}
                    </div>
                  ) : adminOverviewQ.isError ? (
                    <div className="p-8">
                      <GlassErrorState
                        title={t('telegram.adminStatsError', 'Statistikani yuklashda xatolik')}
                        message={getErrorMessage(adminOverviewQ.error as Error)}
                        onRetry={() => void adminOverviewQ.refetch()}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4 p-5">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <AdminStat
                          label={t('telegram.totalLinkedAccounts', 'Jami Ulangan Hisoblar')}
                          value={adminOverviewQ.data?.accounts?.total ?? 0}
                          subtext="Ota-onalar, o'quvchilar va xodimlar"
                          icon={I.users}
                          tone="blue"
                        />
                        <AdminStat
                          label={t('telegram.activeBots', 'Faol Qabul Qiluvchilar')}
                          value={adminOverviewQ.data?.accounts?.active ?? 0}
                          subtext="Botni bloklamagan faol foydalanuvchilar"
                          icon={I.bot}
                          tone="emerald"
                        />
                        <AdminStat
                          label={t('telegram.messagesSent24h', '24 Soatda Yuborilgan')}
                          value={deliveryStats.sent}
                          subtext={`Muvaffaqiyat ko'rsatkichi: ${deliveryStats.rate}%`}
                          icon={I.activity}
                          tone="telegram"
                        />
                      </div>

                      {/* Delivery Health Bar */}
                      <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                            24 soatlik xabar yetkazib berish salomatligi (SLA)
                          </span>
                          <span className="text-emerald-500">{deliveryStats.rate}% muvaffaqiyatli</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${deliveryStats.rate}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-[#64748B]">
                          <span>Yetkazildi: {deliveryStats.sent} ta</span>
                          <span>Xatoliklar: {deliveryStats.failed} ta</span>
                        </div>
                      </div>
                    </div>
                  )}
                </SectionPanel>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Unlink confirm */}
        <ConfirmDialog
          open={confirmUnlinkOpen}
          onClose={() => setConfirmUnlinkOpen(false)}
          onConfirm={() => unlinkMut.mutate()}
          title={t('telegram.disconnectTitle', 'Telegram hisobini uzish')}
          description={t(
            'telegram.disconnectDesc',
            "Haqiqatan ham Telegram hisobingizni uzmoqchimisiz? Shundan so'ng davomat, baholar va to'lov xabarnomalari Telegramingizga bormaydi.",
          )}
          loading={unlinkMut.isPending}
        />
      </motion.div>
    </div>
  );
}

export default TelegramPage;