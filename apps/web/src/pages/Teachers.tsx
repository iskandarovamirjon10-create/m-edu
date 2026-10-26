/**
 * M-EDU Teachers Page
 * Faculty roster management, salary configurations, workload monitoring, and teacher performance.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { teachersApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { openQuickLook, openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { useDebounce } from '@/hooks/useDebounce';
import {
  GlassPageHeader,
  GlassErrorState,
  GlassEmptyState,
  GlassModal,
  GlassField,
  GlassInput,
  GlassTextArea,
  GlassButton,
  GlassPagination,
  FloatingActionIsland,
  useToasts,
  ConfirmDialog,
} from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { getErrorMessage } from '@/lib/errorMessages';
import { fullName, formatCurrency } from '@/lib/format';
import type { Paginated, Teacher } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePrefersReducedMotion } from '@/layouts/core/singletons';
import { SpatialIdentityCard360 } from '@/components/cards/SpatialIdentityCard360';
import { AuroraMesh } from '@/components/ui/AuroraMesh';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 520, damping: 34, mass: 0.65 },
  smooth: { type: 'spring' as const, stiffness: 360, damping: 30, mass: 0.85 },
  liquid: { type: 'spring' as const, stiffness: 260, damping: 26, mass: 0.95 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const tileVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.liquid },
};

/* ══════════════════════════════════════════════════════════════════════════
 * SVG GLYPH ICONS (Two-tone Duotone System)
 * ════════════════════════════════════════════════════════════════════════ */

interface GlyphDef {
  readonly s: readonly string[];
  readonly f?: readonly string[];
}

const G = {
  teachers: {
    f: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
    s: [
      'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
      'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      'M23 21v-2a4 4 0 0 0-3-3.9',
      'M16 3.1a4 4 0 0 1 0 7.8',
    ],
  },
  userPlus: {
    s: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      'M19 8v6',
      'M22 11h-6',
    ],
  },
  checkCircle: {
    f: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'],
    s: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'm8.2 12.4 2.6 2.6 5-5.4'],
  },
  pause: {
    s: ['M10 4H6v16h4z', 'M18 4h-4v16h4z'],
  },
  wallet: {
    f: ['M20 12V8H6a2 2 0 0 1 0-4h12v4'],
    s: ['M4 6v12c0 1.1.9 2 2 2h14v-4', 'M18 12a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'],
  },
  mail: {
    s: [
      'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
      'M22 6 12 13 2 6',
    ],
  },
  phone: {
    s: [
      'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z',
    ],
  },
  award: {
    f: ['M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z'],
    s: ['M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M8.2 13.9 7 22l5-3 5 3-1.2-8.1'],
  },
  book: {
    f: ['M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z'],
    s: ['M12 7v14', 'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'],
  },
  user: {
    f: ['M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
    s: ['M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 21v-1a8 8 0 0 0-16 0v1'],
  },
  note: {
    s: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h5'],
  },
  search: {
    s: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'm21 21-4.35-4.35'],
  },
  close: {
    s: ['M18 6 6 18', 'm6 6 12 12'],
  },
  export: {
    s: ['M12 3.5v12', 'm7.5 11.5 4.5 4.5 4.5-4.5', 'M4.5 15.5v2a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-2'],
  },
  eye: {
    f: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    s: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  },
  sidecar: {
    s: ['M4 4h16v16H4z', 'M15 4v16'],
  },
  edit: {
    s: [
      'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
      'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
    ],
  },
  trash: {
    s: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  },
  more: {
    f: ['M5 12a2 2 0 1 0 0-.01M12 12a2 2 0 1 0 0-.01M19 12a2 2 0 1 0 0-.01'],
    s: ['M5 12a2 2 0 1 0 0-.01', 'M12 12a2 2 0 1 0 0-.01', 'M19 12a2 2 0 1 0 0-.01'],
  },
  list: {
    s: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  },
  grid: {
    s: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  },
  card: {
    s: ['M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M1 10h22', 'M7 15h3'],
  },
  key: {
    s: ['m21 2-2 2m-1.5 1.5L14 9a5 5 0 1 0 4 4l3.5-3.5', 'm15.5 7.5 3 3'],
  },
  sparkles: {
    s: ['m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z'],
  },
} as const;

type GlyphName = keyof typeof G;

const Glyph = memo(function Glyph({
  name,
  size = 18,
  weight = 1.9,
  className = '',
}: {
  name: GlyphName;
  size?: number;
  weight?: number;
  className?: string;
}) {
  const def: GlyphDef = G[name] ?? G.teachers;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      shapeRendering="geometricPrecision"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {def.f?.map((d, i) => (
        <path key={`f-${i}`} d={d} fill="currentColor" fillOpacity={0.16} stroke="none" />
      ))}
      {def.s.map((d, i) => (
        <path key={`s-${i}`} d={d} />
      ))}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * TONES & SQUIRCLE PALETTES
 * ════════════════════════════════════════════════════════════════════════ */

type Tone = 'blue' | 'green' | 'orange' | 'purple' | 'slate';

const TONES: Record<Tone, { from: string; to: string; hex: string; bg: string; fg: string; border: string }> = {
  blue: {
    from: '#5AB0FF',
    to: '#0A68F0',
    hex: '#0A84FF',
    bg: 'rgba(10,132,255,0.10)',
    fg: '#0A84FF',
    border: 'rgba(10,132,255,0.22)',
  },
  green: {
    from: '#5EE17F',
    to: '#1FAE4B',
    hex: '#30D158',
    bg: 'rgba(48,209,88,0.10)',
    fg: '#30D158',
    border: 'rgba(48,209,88,0.22)',
  },
  orange: {
    from: '#FFB340',
    to: '#FF6B00',
    hex: '#FF9500',
    bg: 'rgba(255,149,0,0.10)',
    fg: '#FF9500',
    border: 'rgba(255,149,0,0.22)',
  },
  purple: {
    from: '#C39BFF',
    to: '#7C4DFF',
    hex: '#BF5AF2',
    bg: 'rgba(191,90,242,0.10)',
    fg: '#BF5AF2',
    border: 'rgba(191,90,242,0.22)',
  },
  slate: {
    from: '#94A3B8',
    to: '#475569',
    hex: '#64748B',
    bg: 'rgba(100,116,139,0.10)',
    fg: '#64748B',
    border: 'rgba(100,116,139,0.22)',
  },
};

const SPEC_PALETTES = [
  { bg: 'bg-blue-500/10 dark:bg-blue-400/10', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500/20' },
  { bg: 'bg-purple-500/10 dark:bg-purple-400/10', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-500/20' },
  { bg: 'bg-emerald-500/10 dark:bg-emerald-400/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/20' },
  { bg: 'bg-amber-500/10 dark:bg-amber-400/10', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/20' },
  { bg: 'bg-rose-500/10 dark:bg-rose-400/10', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-500/20' },
];

function stringHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
}

const AVATAR_GRADIENTS = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
  ['#30D158', '#34C759'],
];

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_GRADIENTS[stringHash(name) % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function formatTeacherName(teacher: Teacher | null | undefined): string {
  if (!teacher) return '—';
  return fullName(teacher.user?.firstName, teacher.user?.lastName);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isPlaceholderEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith('@placeholder.local');
}

function displayEmail(email?: string | null): string {
  if (!email || isPlaceholderEmail(email)) return '';
  return email;
}

function generateSecurePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  let pwd = '';
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoObj?.getRandomValues) {
    const vals = new Uint8Array(10);
    cryptoObj.getRandomValues(vals);
    for (let i = 0; i < 10; i++) pwd += chars[vals[i] % chars.length];
  } else {
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

/* ══════════════════════════════════════════════════════════════════════════
 * AVATAR & METRIC PILL SUBCOMPONENTS
 * ════════════════════════════════════════════════════════════════════════ */

const TeacherAvatar = memo(function TeacherAvatar({
  name,
  size = 40,
  isActive = true,
  showStatusIndicator = false,
}: {
  name: string;
  size?: number;
  isActive?: boolean;
  showStatusIndicator?: boolean;
}) {
  return (
    <div className="relative shrink-0 select-none">
      <div
        className="relative flex items-center justify-center rounded-2xl font-bold text-white shadow-sm ring-1 ring-white/35 dark:ring-white/15 overflow-hidden transition-transform duration-200 group-hover:scale-105"
        style={{
          width: size,
          height: size,
          background: avatarGradient(name),
          fontSize: Math.round(size * 0.36),
        }}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 to-transparent h-[45%]" />
        <span className="relative drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.35)]">{getInitials(name)}</span>
      </div>
      {showStatusIndicator && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${
            isActive ? 'bg-emerald-500 shadow-sm shadow-emerald-500/40' : 'bg-slate-400'
          }`}
        />
      )}
    </div>
  );
});

const MetricPill = memo(function MetricPill({
  label,
  hint,
  value,
  total = 0,
  glyph,
  tone = 'blue',
  active = false,
  onClick,
  showPercent = true,
}: {
  label: string;
  hint: string;
  value: number;
  total?: number;
  glyph: GlyphName;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
  showPercent?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const { hex } = TONES[tone];
  const ratio = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const radius = 14;
  const circumference = 2 * Math.PI * radius; // ~87.96

  return (
    <motion.button
      type="button"
      data-testid={`teachers-metric-${tone}`}
      variants={tileVariants}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      onClick={onClick}
      aria-pressed={active}
      className={`group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 border ${
        active
          ? 'bg-white/95 dark:bg-white/15 border-blue-500 shadow-md shadow-blue-500/10'
          : 'bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.07] hover:bg-white/90 dark:hover:bg-white/[0.08] shadow-sm hover:-translate-y-0.5'
      } backdrop-blur-xl`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
          style={{ background: TONES[tone].bg, color: TONES[tone].fg, border: `1px solid ${TONES[tone].border}` }}
        >
          <Glyph name={glyph} size={20} weight={2.2} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/50 truncate">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {value.toLocaleString()}
            </span>
            {showPercent && total > 0 && (
              <span className="text-[11.5px] font-medium text-slate-400 dark:text-white/40">
                ({ratio}%)
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-white/40 truncate">{hint}</p>
        </div>
      </div>

      {showPercent && total > 0 && (
        <div className="relative shrink-0 hidden sm:flex items-center justify-center w-9 h-9">
          <svg className="w-9 h-9 -rotate-90 transform" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-white/10" />
            <motion.circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              stroke={hex}
              strokeWidth="3.2"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (circumference * ratio) / 100}
              strokeLinecap="round"
              transition={SPRING.smooth}
            />
          </svg>
        </div>
      )}
    </motion.button>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * SKELETON LOADER (Glass Shimmer)
 * ════════════════════════════════════════════════════════════════════════ */

const TeachersSkeleton = memo(function TeachersSkeleton({ viewMode }: { viewMode: 'list' | 'grid' }) {
  return (
    <div className="space-y-4 animate-pulse">
      {viewMode === 'list' ? (
        <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
          {[1, 2, 3, 4, 5].map((key) => (
            <div key={key} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <div className="h-4.5 w-4.5 rounded-full bg-slate-200/70 dark:bg-white/10 shrink-0" />
                <div className="h-10 w-10 rounded-2xl bg-slate-200/70 dark:bg-white/10 shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="h-4 w-36 rounded-md bg-slate-200/80 dark:bg-white/15" />
                  <div className="h-3 w-56 rounded-md bg-slate-100 dark:bg-white/[0.06]" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-20 rounded-lg bg-slate-100 dark:bg-white/[0.06]" />
                <div className="h-9 w-9 rounded-xl bg-slate-200/70 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
          {[1, 2, 3, 4, 5, 6].map((key) => (
            <div key={key} className="p-4.5 rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-28 rounded-md bg-slate-200/80 dark:bg-white/15" />
                  <div className="h-3 w-40 rounded-md bg-slate-100 dark:bg-white/[0.06]" />
                </div>
              </div>
              <div className="h-3 w-full rounded-md bg-slate-100 dark:bg-white/[0.06]" />
              <div className="flex justify-between items-center pt-2">
                <div className="h-6 w-24 rounded-lg bg-slate-200/60 dark:bg-white/10" />
                <div className="h-8 w-20 rounded-xl bg-slate-200/70 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * FORM STATE
 * ════════════════════════════════════════════════════════════════════════ */

type SalaryType = 'MONTHLY' | 'HOURLY' | 'PER_LESSON';

interface TeacherFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  specializations: string;
  salaryType: SalaryType;
  hourlyRate: string;
  lessonRate: string;
  bio: string;
  experience: string;
}

const INITIAL_FORM: TeacherFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  specializations: '',
  salaryType: 'MONTHLY',
  hourlyRate: '',
  lessonRate: '',
  bio: '',
  experience: '',
};

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ════════════════════════════════════════════════════════════════════════ */

export function TeachersPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('teachers.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const sound = usePremiumSound();
  const haptics = useHaptics();
  const { id: routeTeacherId } = useParams<{ id?: string }>();

  /* ── Filter & Search State ─────────────────────────────────────────── */
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  /* ── Modals & Popovers ─────────────────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [cardTeacher, setCardTeacher] = useState<Teacher | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── Form State ────────────────────────────────────────────────────── */
  const [form, setForm] = useState<TeacherFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof TeacherFormState, string>>>({});

  /* ── Query ─────────────────────────────────────────────────────────── */
  const params = useMemo(
    () => ({
      page,
      limit: 24,
      search: debouncedSearch || undefined,
    }),
    [page, debouncedSearch],
  );

  const teachers = useQuery({
    queryKey: queryKeys.teachers.list(params),
    queryFn: () => teachersApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const data = teachers.data as Paginated<Teacher> | undefined;
  const teacherList = useMemo(() => data?.items || [], [data]);

  /* ── Derived Filtering & Stats ─────────────────────────────────────── */
  const filteredTeachers = useMemo(() => {
    let list = teacherList;
    if (statusFilter === 'ACTIVE') list = list.filter((t) => t.user?.isActive !== false);
    else if (statusFilter === 'INACTIVE') list = list.filter((t) => t.user?.isActive === false);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => {
        const name = formatTeacherName(t).toLowerCase();
        const email = displayEmail(t.user?.email).toLowerCase();
        const phone = (t.user?.phone || '').toLowerCase();
        const specs = (t.specializations || []).join(' ').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q) || specs.includes(q);
      });
    }

    return list;
  }, [teacherList, statusFilter, search]);

  const stats = useMemo(() => {
    const active = teacherList.filter((t) => t.user?.isActive !== false).length;
    const inactive = teacherList.length - active;
    const rates = teacherList.map((t) => Number(t.hourlyRate) || 0).filter((n) => n > 0);
    const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    return {
      total: data?.total ?? teacherList.length,
      active,
      inactive,
      avgRate,
    };
  }, [teacherList, data?.total]);

  /* ── Mutations ─────────────────────────────────────────────────────── */
  const create = useMutation({
    mutationFn: () => {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password.trim() || undefined,
        specializations: form.specializations
          ? form.specializations.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        salaryType: form.salaryType || undefined,
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
        lessonRate: form.lessonRate ? parseFloat(form.lessonRate) : undefined,
        bio: form.bio.trim() || undefined,
        experience: form.experience ? parseInt(form.experience, 10) : undefined,
      };
      return editingId ? teachersApi.update(editingId, payload) : teachersApi.create(payload);
    },
    onSuccess: () => {
      sound.playSuccess?.();
      haptics.success();
      push('success', editingId ? t('teachers.updated') : t('teachers.created'));
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.teachers.all() });
      qc.invalidateQueries({ queryKey: queryKeys.teachers.selectors() });
    },
    onError: (e: Error) => {
      haptics.error();
      push('error', getErrorMessage(e));
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => teachersApi.remove(id),
    onSuccess: () => {
      sound.playSuccess?.();
      haptics.success();
      push('success', t('teachers.deleted'));
      qc.invalidateQueries({ queryKey: queryKeys.teachers.all() });
      qc.invalidateQueries({ queryKey: queryKeys.teachers.selectors() });
    },
    onError: (e: Error) => {
      haptics.error();
      push('error', getErrorMessage(e));
    },
  });

  /* ── Quick Look & Sidecar ──────────────────────────────────────────── */
  const handleOpenTeacherSidecar = useCallback(
    (teacher: Teacher) => {
      sound.playPop?.();
      haptics.light();
      const name = formatTeacherName(teacher);
      const isAct = teacher.user?.isActive !== false;

      const sidecarData: QuickLookData = {
        id: teacher.id,
        type: 'teacher',
        title: name,
        subtitle: displayEmail(teacher.user?.email) || teacher.user?.phone || t('teachers.sidecar.title'),
        badge: {
          text: isAct ? t('teachers.sidecar.badgeActive') : t('teachers.sidecar.badgeInactive'),
          tone: isAct ? 'emerald' : 'slate',
        },
        avatar: {
          text: name.slice(0, 2).toUpperCase(),
          color: '#6366F1',
        },
        metrics: [
          {
            label: t('teachers.sidecar.hourlyRateMetric'),
            value: teacher.hourlyRate ? formatCurrency(teacher.hourlyRate) : '—',
            subtext: t('teachers.sidecar.hourlyRateSubtext'),
          },
          {
            label: t('teachers.sidecar.experienceMetric'),
            value: teacher.experience != null ? `${teacher.experience} y` : '—',
            subtext: t('teachers.sidecar.experienceSubtext'),
          },
          {
            label: t('teachers.sidecar.statusMetric'),
            value: isAct ? t('teachers.sidecar.badgeActive') : t('teachers.sidecar.badgeInactive'),
          },
        ],
        details: [
          { label: t('teachers.sidecar.fullName'), value: name, copyable: true },
          { label: t('common.email'), value: displayEmail(teacher.user?.email) || '—', copyable: Boolean(displayEmail(teacher.user?.email)) },
          { label: t('teachers.form.phone'), value: teacher.user?.phone || '—', copyable: Boolean(teacher.user?.phone) },
          {
            label: t('teachers.sidecar.specializations'),
            value: (teacher.specializations || []).join(', ') || t('teachers.sidecar.generalSpecialization'),
            copyable: true,
          },
          { label: t('teachers.sidecar.bio'), value: teacher.bio || t('teachers.sidecar.noBio') },
        ],
        tags: teacher.specializations || [],
        primaryAction: {
          label: t('teachers.actions.edit'),
          onExecute: () => handleEdit(teacher),
        },
      };
      openSidecar(sidecarData);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sound, haptics, t],
  );

  const handleQuickLook = useCallback(
    (teacher: Teacher) => {
      sound.playPop?.();
      haptics.light();
      const name = formatTeacherName(teacher);
      const isAct = teacher.user?.isActive !== false;

      openQuickLook({
        title: name,
        subtitle: (teacher.specializations || []).join(' • ') || t('teachers.quickLook.title'),
        status: {
          label: isAct ? t('teachers.sidecar.badgeActive') : t('teachers.sidecar.badgeInactive'),
          tone: isAct ? 'emerald' : 'slate',
        },
        details: [
          { label: t('teachers.quickLook.status'), value: isAct ? t('teachers.sidecar.badgeActive') : t('teachers.sidecar.badgeInactive') },
          { label: t('teachers.form.hourlyRate'), value: teacher.hourlyRate ? formatCurrency(teacher.hourlyRate) : '—' },
          { label: t('teachers.form.experience'), value: teacher.experience ? `${teacher.experience} y` : '—' },
          { label: t('teachers.form.phone'), value: teacher.user?.phone || '—' },
          { label: t('common.email'), value: displayEmail(teacher.user?.email) || '—' },
        ],
      });
    },
    [sound, haptics, t],
  );

  /* ── Deep link resolution ──────────────────────────────────────────── */
  useEffect(() => {
    if (routeTeacherId && teacherList.length > 0) {
      const match = teacherList.find((t) => t.id === routeTeacherId);
      if (match) {
        handleOpenTeacherSidecar(match);
      }
    }
  }, [routeTeacherId, teacherList, handleOpenTeacherSidecar]);

  /* ── Form Actions ──────────────────────────────────────────────────── */
  const handleOpenCreateModal = useCallback(() => {
    sound.playPop?.();
    haptics.light();
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setShowPassword(false);
    setModalOpen(true);
  }, [sound, haptics]);

  const handleEdit = useCallback(
    (teacher: Teacher) => {
      sound.playTick?.();
      haptics.light();
      setEditingId(teacher.id);
      setForm({
        firstName: teacher.user?.firstName || '',
        lastName: teacher.user?.lastName || '',
        email: displayEmail(teacher.user?.email),
        phone: teacher.user?.phone || '',
        password: '',
        specializations: (teacher.specializations || []).join(', '),
        salaryType: (teacher.salaryType as SalaryType) || 'MONTHLY',
        hourlyRate: teacher.hourlyRate != null ? String(teacher.hourlyRate) : '',
        lessonRate: teacher.lessonRate != null ? String(teacher.lessonRate) : '',
        bio: teacher.bio || '',
        experience: teacher.experience != null ? String(teacher.experience) : '',
      });
      setFormErrors({});
      setShowPassword(false);
      setModalOpen(true);
    },
    [sound, haptics],
  );

  const handleCloseModal = useCallback(() => {
    sound.playTick?.();
    haptics.light();
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setShowPassword(false);
  }, [sound, haptics]);

  const handleFieldChange = useCallback((field: keyof TeacherFormState, value: string) => {
    setForm((prev) => (prev[field] === value ? prev : { ...prev, [field]: value }));
    setFormErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof TeacherFormState, string>> = {};
    if (!form.firstName.trim()) errors.firstName = t('teachers.form.firstNameRequired');
    if (!form.lastName.trim()) errors.lastName = t('teachers.form.lastNameRequired');
    if (form.email && !validateEmail(form.email)) errors.email = t('teachers.form.emailInvalid');
    if (form.password && form.password.trim().length > 0 && form.password.trim().length < 6)
      errors.password = t('teachers.form.passwordMin');
    if (form.hourlyRate && parseFloat(form.hourlyRate) < 0)
      errors.hourlyRate = t('teachers.form.hourlyRateNumber');
    if (form.lessonRate && parseFloat(form.lessonRate) < 0)
      errors.lessonRate = t('teachers.form.lessonRateNumber');
    if (form.experience && parseInt(form.experience, 10) < 0)
      errors.experience = t('teachers.form.experienceNumber');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) {
        haptics.error();
        return;
      }
      create.mutate();
    },
    [validateForm, create, haptics],
  );

  /* ── Delete Confirmation ───────────────────────────────────────────── */
  const handleDeleteClick = useCallback(
    (id: string) => {
      sound.playTick?.();
      haptics.medium();
      setDeleteTarget(id);
      setActionMenuId(null);
    },
    [sound, haptics],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  /* ── 360° Spatial ID Card ──────────────────────────────────────────── */
  const handleOpenSpatialCard = useCallback(
    (teacher: Teacher) => {
      sound.playPop?.();
      haptics.light();
      setCardTeacher(teacher);
      setActionMenuId(null);
    },
    [sound, haptics],
  );

  /* ── Keyboard Navigation ───────────────────────────────────────────── */
  const {
    focusedIndex,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelection,
    clearSelection,
  } = useListKeyboardNavigation<Teacher>({
    items: filteredTeachers,
    enabled: !modalOpen && !cardTeacher && !deleteTarget,
    getItemId: (t) => t.id,
    rowIdPrefix: 'teacher-row-',
    onSelect: (t) => handleOpenTeacherSidecar(t),
    onQuickLook: (t) => handleQuickLook(t),
    onEdit: (t) => handleEdit(t),
  });

  /* ── CSV Export (Formula-safe + UTF-8 BOM) ─────────────────────────── */
  const handleExportCSV = useCallback(
    (teachersToExport?: Teacher[]) => {
      const rows = teachersToExport ?? (selectedCount > 0 ? teacherList.filter((t) => isSelected(t.id)) : filteredTeachers);
      if (!rows.length) return;

      sound.playSuccess?.();
      haptics.success();

      const headers = [
        t('teachers.csv.id'),
        t('teachers.csv.name'),
        t('teachers.csv.email'),
        t('teachers.csv.phone'),
        t('teachers.csv.specializations'),
        t('teachers.csv.hourlyRate'),
        t('teachers.csv.experience'),
        t('teachers.csv.status'),
      ];

      const csvRows = [
        headers.map(csvCell).join(','),
        ...rows.map((teacherItem) =>
          [
            teacherItem.id,
            formatTeacherName(teacherItem),
            displayEmail(teacherItem.user?.email),
            teacherItem.user?.phone || '',
            (teacherItem.specializations || []).join('; '),
            teacherItem.hourlyRate ? String(teacherItem.hourlyRate) : '',
            teacherItem.experience != null ? String(teacherItem.experience) : '',
            teacherItem.user?.isActive !== false ? t('enum.status.ACTIVE') : t('enum.status.INACTIVE'),
          ]
            .map(csvCell)
            .join(','),
        ),
      ];

      const UTF8_BOM = '\uFEFF';
      const blob = new Blob([UTF8_BOM + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${t('teachers.csv.fileName')}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      if (selectedCount > 0) clearSelection();
      push('success', t('teachers.bulk.exported', { count: rows.length }));
    },
    [filteredTeachers, selectedCount, teacherList, isSelected, clearSelection, sound, haptics, t, push],
  );

  /* ── Batch Toggle Status ───────────────────────────────────────────── */
  const handleBatchToggleStatus = useCallback(async () => {
    sound.playTick?.();
    haptics.medium();
    let count = 0;
    for (const id of selectedIds) {
      try {
        const item = teacherList.find((t) => t.id === id);
        if (item) {
          const nextActive = item.user?.isActive === false;
          await teachersApi.update(id, { isActive: nextActive });
          count++;
        }
      } catch {
        // continue
      }
    }
    qc.invalidateQueries({ queryKey: queryKeys.teachers.all() });
    clearSelection();
    sound.playSuccess?.();
    haptics.success();
    push('success', t('teachers.bulk.statusUpdated', { count }));
  }, [selectedIds, teacherList, qc, clearSelection, sound, haptics, t, push]);

  /* ── Close action popover on outside click or Escape ──────────────── */
  useEffect(() => {
    if (!actionMenuId) return;
    const handleOutside = () => setActionMenuId(null);
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setActionMenuId(null);
    };
    window.addEventListener('click', handleOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionMenuId]);

  /* ── Global ⌘K focus ───────────────────────────────────────────────── */
  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const hasActiveFilters = Boolean(search || statusFilter !== 'ALL');

  return (
    <div className="page-container relative z-10 space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))] max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px]">
      <AuroraMesh variant="corporate" opacity={0.65} />

      {toastNode}

      {/* ═══ 1 · UNIFIED APPLE COMMAND CENTER HEADER ═══ */}
      <GlassPageHeader
        title={t('teachers.title')}
        description={t('teachers.pageSubtitle')}
        actions={
          <div className="flex items-center gap-2.5">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => handleExportCSV()}
              title={t('teachers.bulk.exportCsv')}
              className="!rounded-full border-slate-200/80 dark:border-white/10"
            >
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Glyph name="export" size={15} weight={2} />
                <span className="hidden sm:inline">{t('teachers.bulk.exportCsv')}</span>
              </span>
            </GlassButton>

            <GlassButton
              type="button"
              variant="primary"
              onClick={handleOpenCreateModal}
              className="!rounded-full shadow-lg shadow-blue-500/20"
            >
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Glyph name="userPlus" size={16} weight={2.2} />
                <span>{t('teachers.add')}</span>
              </span>
            </GlassButton>
          </div>
        }
      />

      {/* ═══ METRIC PILLS CONSOLE ═══ */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        <MetricPill
          label={t('teachers.stats.total')}
          hint={t('teachers.stats.totalHint')}
          value={stats.total}
          total={Math.max(1, stats.total)}
          glyph="teachers"
          tone="blue"
          active={statusFilter === 'ALL'}
          onClick={() => {
            sound.playTick?.();
            haptics.light();
            setStatusFilter('ALL');
          }}
        />
        <MetricPill
          label={t('teachers.stats.active')}
          hint={t('teachers.stats.activeHint')}
          value={stats.active}
          total={Math.max(1, stats.total)}
          glyph="checkCircle"
          tone="green"
          active={statusFilter === 'ACTIVE'}
          onClick={() => {
            sound.playTick?.();
            haptics.light();
            setStatusFilter((p) => (p === 'ACTIVE' ? 'ALL' : 'ACTIVE'));
          }}
        />
        <MetricPill
          label={t('teachers.stats.inactive')}
          hint={t('teachers.stats.inactiveHint')}
          value={stats.inactive}
          total={Math.max(1, stats.total)}
          glyph="pause"
          tone="orange"
          active={statusFilter === 'INACTIVE'}
          onClick={() => {
            sound.playTick?.();
            haptics.light();
            setStatusFilter((p) => (p === 'INACTIVE' ? 'ALL' : 'INACTIVE'));
          }}
        />
        <MetricPill
          label={t('teachers.stats.avgRate')}
          hint={t('teachers.stats.avgRateHint')}
          value={Math.round(stats.avgRate)}
          total={Math.max(1, Math.round(stats.avgRate))}
          glyph="wallet"
          tone="purple"
          showPercent={false}
          active={false}
          onClick={() => {
            sound.playTick?.();
            haptics.light();
          }}
        />
      </motion.div>

      {/* ═══ 2 · SEARCH & FILTER TOOLBAR ═══ */}
      <div className="p-3.5 sm:p-4 rounded-3xl bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl border border-slate-200/70 dark:border-white/[0.08] shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 min-w-[240px]">
            <GlassInput
              ref={searchInputRef}
              data-testid="teachers-search-input"
              placeholder={t('teachers.searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label={t('teachers.searchPlaceholder')}
              type="search"
              inputPrefix={<Glyph name="search" size={16} className="text-slate-400 dark:text-white/40" weight={2} />}
            />
            {!search && (
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md bg-slate-200/80 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-white/60 sm:inline-flex border border-slate-300/50 dark:border-white/10"
              >
                ⌘K
              </kbd>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 lg:justify-end">
            <div
              role="tablist"
              aria-label={t('teachers.filterStatusLabel')}
              className="inline-flex p-1 rounded-xl bg-slate-200/60 dark:bg-white/[0.08] backdrop-blur-md border border-slate-300/40 dark:border-white/[0.08]"
            >
              {[
                { id: 'ALL' as const, label: t('teachers.filter.all') },
                { id: 'ACTIVE' as const, label: t('teachers.filter.active') },
                { id: 'INACTIVE' as const, label: t('teachers.filter.inactive') },
              ].map((opt) => {
                const sel = statusFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={sel}
                    data-testid={`teachers-status-${opt.id}`}
                    onClick={() => {
                      if (!sel) {
                        sound.playTick?.();
                        haptics.light();
                        setStatusFilter(opt.id);
                      }
                    }}
                    className={`relative px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      sel ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {sel && (
                      <motion.span
                        layoutId="teachers-status-thumb"
                        transition={SPRING.snappy}
                        className="absolute inset-0 rounded-lg bg-white dark:bg-white/20 shadow-sm border border-black/[0.04] dark:border-white/10"
                      />
                    )}
                    <span className="relative z-10">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    sound.playTick?.();
                    haptics.light();
                    setSearch('');
                    setStatusFilter('ALL');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/12 px-3 py-1.5 text-[12px] font-semibold text-blue-600 dark:text-blue-400 outline-none transition-colors hover:bg-blue-500/20 focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Glyph name="close" size={12} weight={2.6} />
                  {t('teachers.clearFilters')}
                </button>
              )}

              {/* View Switcher: List vs Grid */}
              <div
                role="tablist"
                aria-label={t('teachers.view.aria')}
                className="inline-flex p-1 rounded-xl bg-slate-200/60 dark:bg-white/[0.08] backdrop-blur-md border border-slate-300/40 dark:border-white/[0.08]"
              >
                {[
                  { id: 'list' as const, label: t('teachers.view.list'), glyph: 'list' as GlyphName },
                  { id: 'grid' as const, label: t('teachers.view.grid'), glyph: 'grid' as GlyphName },
                ].map((v) => {
                  const sel = viewMode === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="tab"
                      aria-selected={sel}
                      data-testid={`teachers-view-${v.id}`}
                      title={v.label}
                      aria-label={v.label}
                      onClick={() => {
                        if (!sel) {
                          sound.playTick?.();
                          haptics.light();
                          setViewMode(v.id);
                        }
                      }}
                      className={`relative p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        sel ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {sel && (
                        <motion.span
                          layoutId="teachers-view-thumb"
                          transition={SPRING.snappy}
                          className="absolute inset-0 rounded-lg bg-white dark:bg-white/20 shadow-sm border border-black/[0.04] dark:border-white/10"
                        />
                      )}
                      <span className="relative z-10">
                        <Glyph name={v.glyph} size={15} weight={2.2} />
                      </span>
                    </button>
                  );
                })}
              </div>

              <div aria-live="polite" className="text-slate-500 dark:text-white/60 text-[12.5px] font-semibold tabular-nums pl-1">
                {filteredTeachers.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 3 · TEACHERS DATA CONTAINER ═══ */}
      <div className={`rounded-3xl bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl border border-slate-200/70 dark:border-white/[0.08] shadow-sm overflow-hidden ${teachers.isPlaceholderData ? 'opacity-70 transition-opacity' : 'transition-opacity'}`}>
        <AnimatePresence mode="wait">
          {teachers.isError ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8">
              <GlassErrorState
                title={t('teachers.loadError')}
                message={getErrorMessage(teachers.error as Error)}
                onRetry={() => teachers.refetch()}
              />
            </motion.div>
          ) : teachers.isLoading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 sm:p-6">
              <TeachersSkeleton viewMode={viewMode} />
            </motion.div>
          ) : teacherList.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-8 sm:p-12">
              <GlassEmptyState
                title={t('teachers.emptyTitle')}
                message={t('teachers.emptyMessage')}
                action={
                  <GlassButton type="button" variant="primary" onClick={handleOpenCreateModal} className="!rounded-full">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <Glyph name="userPlus" size={15} />
                      {t('teachers.add')}
                    </span>
                  </GlassButton>
                }
              />
            </motion.div>
          ) : filteredTeachers.length === 0 ? (
            <motion.div key="empty-filtered" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-8 sm:p-12">
              <GlassEmptyState
                title={t('teachers.emptySearch')}
                message={t('teachers.emptySearchHint')}
                action={
                  <GlassButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      sound.playTick?.();
                      haptics.light();
                      setSearch('');
                      setStatusFilter('ALL');
                    }}
                    className="!rounded-full"
                  >
                    {t('teachers.clearFilters')}
                  </GlassButton>
                }
              />
            </motion.div>
          ) : viewMode === 'list' ? (
            /* LIST VIEW */
            <motion.div
              key="list"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="divide-y divide-slate-100 dark:divide-white/[0.04]"
            >
              {filteredTeachers.map((teacher, idx) => {
                const name = formatTeacherName(teacher);
                const isActive = teacher.user?.isActive !== false;
                const isRowSelected = isSelected(teacher.id);
                const isRowFocused = focusedIndex === idx;
                const isMenuOpen = actionMenuId === teacher.id;
                const specs = teacher.specializations || [];

                return (
                  <motion.div
                    key={teacher.id}
                    id={`teacher-row-${teacher.id}`}
                    variants={rowVariants}
                    onClick={() => handleOpenTeacherSidecar(teacher)}
                    tabIndex={0}
                    role="link"
                    aria-label={t('teachers.viewAria', { name })}
                    onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                      if (e.key === ' ') {
                        e.preventDefault();
                        handleQuickLook(teacher);
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        handleOpenTeacherSidecar(teacher);
                      }
                    }}
                    className={`group relative flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 sm:px-5 py-3.5 cursor-pointer outline-none transition-all ${
                      isRowFocused
                        ? 'bg-blue-50/90 dark:bg-blue-900/25 ring-2 ring-inset ring-blue-500'
                        : isRowSelected
                        ? 'bg-blue-50/60 dark:bg-blue-900/15'
                        : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        onChange={() => {
                          sound.playTick?.();
                          haptics.light();
                          toggleSelection(teacher.id);
                        }}
                        onClick={(e: MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                        aria-label={t('teachers.selectTeacher', { name })}
                        className="h-4.5 w-4.5 rounded-full border border-slate-300 dark:border-white/30 text-blue-500 focus:ring-2 focus:ring-blue-500 cursor-pointer mt-1 sm:mt-0"
                      />

                      <TeacherAvatar name={name} size={42} isActive={isActive} showStatusIndicator />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[14px] font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {name}
                          </p>
                          {teacher.experience != null && teacher.experience > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              <Glyph name="award" size={11} weight={2} />
                              {t('teachers.experienceYears', { count: teacher.experience })}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {isActive ? t('teachers.sidecar.badgeActive') : t('teachers.sidecar.badgeInactive')}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {displayEmail(teacher.user?.email) && (
                            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-white/50">
                              <Glyph name="mail" size={12} className="opacity-60" />
                              <span className="truncate max-w-[14rem]">{displayEmail(teacher.user?.email)}</span>
                            </span>
                          )}
                          {teacher.user?.phone && (
                            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-white/50 tabular-nums">
                              <Glyph name="phone" size={12} className="opacity-60" />
                              {teacher.user.phone}
                            </span>
                          )}
                        </div>

                        {specs.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {specs.slice(0, 4).map((s, sIdx) => {
                              const p = SPEC_PALETTES[sIdx % SPEC_PALETTES.length];
                              return (
                                <span
                                  key={s}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium border ${p.bg} ${p.text} ${p.border}`}
                                >
                                  {s}
                                </span>
                              );
                            })}
                            {specs.length > 4 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60">
                                +{specs.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Hourly rate & Apple HIG Action Console */}
                    <div
                      className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t border-slate-100 dark:border-white/[0.04] md:border-0 shrink-0"
                      onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                    >
                      {teacher.hourlyRate ? (
                        <div className="flex flex-col items-start md:items-end shrink-0 pr-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40">
                            {t('teachers.form.hourlyRate')}
                          </span>
                          <span className="text-[13.5px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(teacher.hourlyRate)}
                            <span className="text-[11px] font-normal text-slate-400 dark:text-white/40 ml-0.5">
                              {t('teachers.perHour')}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-slate-400 dark:text-white/40 pr-2">—</span>
                      )}

                      {/* Action Console Buttons */}
                      <div className="flex items-center gap-1 relative">
                        {/* Quick Look */}
                        <button
                          type="button"
                          onClick={() => handleQuickLook(teacher)}
                          title={`${t('teachers.actions.quickLook')} (Space)`}
                          aria-label={t('teachers.actions.quickLook')}
                          className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl inline-flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <Glyph name="eye" size={15} weight={2.2} />
                        </button>

                        {/* Sidecar */}
                        <button
                          type="button"
                          onClick={() => handleOpenTeacherSidecar(teacher)}
                          title={t('teachers.actions.sidecar')}
                          aria-label={t('teachers.actions.sidecar')}
                          className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl inline-flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <Glyph name="sidecar" size={15} weight={2.2} />
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleEdit(teacher)}
                          title={t('teachers.actions.edit')}
                          aria-label={t('teachers.actions.edit')}
                          className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl inline-flex items-center justify-center text-slate-500 hover:text-blue-600 dark:text-white/60 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <Glyph name="edit" size={15} weight={2.2} />
                        </button>

                        {/* More Popover */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e: MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation();
                              setActionMenuId(isMenuOpen ? null : teacher.id);
                            }}
                            title={t('teachers.actions.more')}
                            aria-label={t('teachers.actions.more')}
                            aria-expanded={isMenuOpen}
                            className={`h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl inline-flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                              isMenuOpen
                                ? 'bg-slate-200 dark:bg-white/15 text-slate-900 dark:text-white'
                                : 'text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10'
                            }`}
                          >
                            <Glyph name="more" size={15} weight={2.4} />
                          </button>

                          <AnimatePresence>
                            {isMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                transition={SPRING.snappy}
                                className="absolute right-0 top-full mt-1.5 w-52 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-xl py-1.5 z-30"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleOpenSpatialCard(teacher)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                >
                                  <Glyph name="card" size={15} weight={2} />
                                  <span>{t('teachers.actions.spatialCard')}</span>
                                </button>
                                <div className="my-1 border-t border-slate-100 dark:border-white/10" />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(teacher.id)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                >
                                  <Glyph name="trash" size={15} weight={2} />
                                  <span>{t('teachers.actions.delete')}</span>
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            /* GRID VIEW */
            <motion.div
              key="grid"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4"
            >
              {filteredTeachers.map((teacher) => {
                const name = formatTeacherName(teacher);
                const isActive = teacher.user?.isActive !== false;
                const isRowSelected = isSelected(teacher.id);
                const specs = teacher.specializations || [];

                return (
                  <motion.div
                    key={teacher.id}
                    id={`teacher-card-${teacher.id}`}
                    variants={tileVariants}
                    onClick={() => handleOpenTeacherSidecar(teacher)}
                    tabIndex={0}
                    role="link"
                    aria-label={t('teachers.viewAria', { name })}
                    className={`group relative flex flex-col justify-between p-4.5 rounded-2xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-200 border ${
                      isRowSelected
                        ? 'bg-blue-50/80 dark:bg-blue-900/15 border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-white/60 dark:bg-white/[0.03] border-slate-200/60 dark:border-white/[0.06] hover:bg-white/90 dark:hover:bg-white/[0.07] hover:-translate-y-0.5 shadow-sm'
                    } backdrop-blur-xl`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isRowSelected}
                            onChange={() => {
                              sound.playTick?.();
                              haptics.light();
                              toggleSelection(teacher.id);
                            }}
                            onClick={(e: MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                            aria-label={t('teachers.selectTeacher', { name })}
                            className="h-4.5 w-4.5 rounded-full border border-slate-300 dark:border-white/30 text-blue-500 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          />
                          <TeacherAvatar name={name} size={44} isActive={isActive} showStatusIndicator />
                          <div className="min-w-0">
                            <h3 className="truncate text-[14.5px] font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {name}
                            </h3>
                            {teacher.user?.email && (
                              <span className="truncate text-[11.5px] text-slate-400 dark:text-white/40 block">
                                {displayEmail(teacher.user.email)}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {isActive ? t('teachers.sidecar.badgeActive') : t('teachers.sidecar.badgeInactive')}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-white/[0.04] pt-3">
                        <div className="flex items-center gap-1.5">
                          {teacher.experience != null && teacher.experience > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              <Glyph name="award" size={11} weight={2} />
                              {t('teachers.experienceYears', { count: teacher.experience })}
                            </span>
                          )}
                        </div>
                        {teacher.hourlyRate ? (
                          <span className="text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(teacher.hourlyRate)}
                            <span className="text-[10.5px] font-normal text-slate-400 dark:text-white/40 ml-0.5">
                              {t('teachers.perHour')}
                            </span>
                          </span>
                        ) : null}
                      </div>

                      {specs.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {specs.slice(0, 3).map((s, sIdx) => {
                            const p = SPEC_PALETTES[sIdx % SPEC_PALETTES.length];
                            return (
                              <span
                                key={s}
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium border ${p.bg} ${p.text} ${p.border}`}
                              >
                                {s}
                              </span>
                            );
                          })}
                          {specs.length > 3 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60">
                              +{specs.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-white/[0.04] pt-3"
                      onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenSpatialCard(teacher)}
                          title={t('teachers.actions.spatialCard')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-semibold transition-all min-h-[36px]"
                        >
                          <Glyph name="card" size={13} weight={2} />
                          <span className="text-[11px]">{t('teachers.spatialCard.badge')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTeacherSidecar(teacher)}
                          title={t('teachers.actions.sidecar')}
                          aria-label={t('teachers.actions.sidecar')}
                          className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-xl inline-flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
                        >
                          <Glyph name="sidecar" size={14} weight={2.2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(teacher)}
                          title={t('teachers.actions.edit')}
                          aria-label={t('teachers.actions.edit')}
                          className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-xl inline-flex items-center justify-center text-slate-500 hover:text-blue-600 dark:text-white/60 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        >
                          <Glyph name="edit" size={14} weight={2.2} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteClick(teacher.id)}
                        title={t('teachers.actions.delete')}
                        aria-label={t('teachers.actions.delete')}
                        className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-xl inline-flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition-colors"
                      >
                        <Glyph name="trash" size={14} weight={2.2} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pagination */}
        {teacherList.length > 0 && (data?.totalPages ?? 1) > 1 && (
          <div className="border-t border-slate-100 dark:border-white/[0.04] p-4 flex justify-center">
            <GlassPagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* ═══ CREATE / EDIT TEACHER MODAL ═══ */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingId ? t('teachers.modal.editTitle') : t('teachers.modal.addTitle')}
        wide
      >
        <div>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <Glyph name="teachers" size={18} weight={2.2} />
              </div>
              <p className="text-[12.5px] font-medium leading-snug text-slate-700 dark:text-white/80">
                {editingId ? t('teachers.modal.editHint') : t('teachers.modal.addHint')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label={t('teachers.form.firstName')} required error={formErrors.firstName} htmlFor="teacher-firstName">
                <GlassInput
                  id="teacher-firstName"
                  name="firstName"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange('firstName', e.target.value)}
                  required
                  placeholder="Ali"
                  disabled={create.isPending}
                  inputPrefix={<Glyph name="user" size={15} className="text-slate-400" />}
                />
              </GlassField>

              <GlassField label={t('teachers.form.lastName')} required error={formErrors.lastName} htmlFor="teacher-lastName">
                <GlassInput
                  id="teacher-lastName"
                  name="lastName"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange('lastName', e.target.value)}
                  required
                  placeholder="Valiyev"
                  disabled={create.isPending}
                  inputPrefix={<Glyph name="user" size={15} className="text-slate-400" />}
                />
              </GlassField>

              <GlassField label={t('teachers.form.email')} error={formErrors.email} htmlFor="teacher-email">
                <GlassInput
                  id="teacher-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange('email', e.target.value)}
                  placeholder="ali.valiyev@example.com"
                  disabled={create.isPending}
                  inputPrefix={<Glyph name="mail" size={15} className="text-slate-400" />}
                />
              </GlassField>

              <GlassField label={t('teachers.form.phone')} htmlFor="teacher-phone">
                <GlassInput
                  id="teacher-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange('phone', e.target.value)}
                  placeholder="+998 90 123 4567"
                  disabled={create.isPending}
                  inputPrefix={<Glyph name="phone" size={15} className="text-slate-400" />}
                />
              </GlassField>
            </div>

            {/* Login Password Field */}
            <GlassField
              label={t('teachers.form.password')}
              hint={editingId ? t('teachers.form.passwordEditHint') : t('teachers.form.passwordCreateHint')}
              error={formErrors.password}
              htmlFor="teacher-password"
            >
              <div className="relative flex items-center">
                <GlassInput
                  id="teacher-password"
                  name="password"
                  autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange('password', e.target.value)}
                  placeholder={editingId ? '••••••••' : 'Medu@2026!'}
                  disabled={create.isPending}
                  inputPrefix={<Glyph name="key" size={15} className="text-slate-400" />}
                  className="pr-28"
                />
                <div className="absolute right-2 flex items-center gap-1.5 z-10">
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    title={showPassword ? t('teachers.form.hidePassword') : t('teachers.form.showPassword')}
                    aria-label={showPassword ? t('teachers.form.hidePassword') : t('teachers.form.showPassword')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                  >
                    <Glyph name="eye" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const generated = generateSecurePassword();
                      setForm((p) => ({ ...p, password: generated }));
                      setShowPassword(true);
                      sound.playPop?.();
                      haptics.light();
                    }}
                    title={t('teachers.form.generatePasswordTitle')}
                    className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-semibold hover:bg-blue-500/20 transition-colors"
                  >
                    {t('teachers.form.generatePassword')}
                  </button>
                </div>
              </div>
            </GlassField>

            {/* Salary Type & Rate Configuration */}
            <div className="p-3.5 rounded-2xl bg-slate-500/5 border border-slate-200/60 dark:border-white/10 space-y-3">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/50 block">
                {t('teachers.form.salaryType')}
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'MONTHLY' as const, label: t('teachers.salaryType.monthly') },
                  { id: 'HOURLY' as const, label: t('teachers.salaryType.hourly') },
                  { id: 'PER_LESSON' as const, label: t('teachers.salaryType.perLesson') },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      sound.playTick?.();
                      haptics.light();
                      setForm((p) => ({ ...p, salaryType: st.id }));
                    }}
                    className={`px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all text-center ${
                      form.salaryType === st.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                        : 'bg-white/80 dark:bg-white/[0.04] text-slate-700 dark:text-white/70 border-slate-200/70 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {form.salaryType === 'HOURLY' && (
                <GlassField label={t('teachers.form.hourlyRate')} error={formErrors.hourlyRate} htmlFor="teacher-hourlyRate">
                  <GlassInput
                    id="teacher-hourlyRate"
                    name="hourlyRate"
                    type="number"
                    step="5000"
                    min="0"
                    value={form.hourlyRate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange('hourlyRate', e.target.value)}
                    placeholder="150000"
                    disabled={create.isPending}
                    inputPrefix={<Glyph name="wallet" size={15} className="text-slate-400" />}
                  />
                </GlassField>
              )}

              {form.salaryType === 'PER_LESSON' && (
                <GlassField label={t('teachers.form.lessonRate')} error={formErrors.lessonRate} htmlFor="teacher-lessonRate">
                  <GlassInput
                    id="teacher-lessonRate"
                    name="lessonRate"
                    type="number"
                    step="5000"
                    min="0"
                    value={form.lessonRate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange('lessonRate', e.target.value)}
                    placeholder="60000"
                    disabled={create.isPending}
                    inputPrefix={<Glyph name="wallet" size={15} className="text-slate-400" />}
                  />
                </GlassField>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField
                label={t('teachers.form.specializations')}
                hint={t('teachers.form.specializationsHint')}
                htmlFor="teacher-specializations"
              >
                <GlassInput
                  id="teacher-specializations"
                  name="specializations"
                  value={form.specializations}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange('specializations', e.target.value)}
                  placeholder="Matematika, Fizika, React"
                  disabled={create.isPending}
                  inputPrefix={<Glyph name="book" size={15} className="text-slate-400" />}
                />
              </GlassField>

              <GlassField label={t('teachers.form.experience')} error={formErrors.experience} htmlFor="teacher-experience">
                <GlassInput
                  id="teacher-experience"
                  name="experience"
                  type="number"
                  min="0"
                  value={form.experience}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleFieldChange('experience', e.target.value)}
                  placeholder="5"
                  disabled={create.isPending}
                  inputPrefix={<Glyph name="award" size={15} className="text-slate-400" />}
                />
              </GlassField>
            </div>

            <GlassField label={t('teachers.form.bio')} htmlFor="teacher-bio">
              <GlassTextArea
                id="teacher-bio"
                name="bio"
                rows={3}
                value={form.bio}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleFieldChange('bio', e.target.value)}
                placeholder={t('teachers.form.bioPlaceholder')}
                disabled={create.isPending}
              />
            </GlassField>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200/60 dark:border-white/10">
              <GlassButton type="button" variant="secondary" onClick={handleCloseModal} disabled={create.isPending}>
                {t('common.cancel')}
              </GlassButton>
              <GlassButton type="submit" variant="primary" disabled={create.isPending}>
                {create.isPending ? t('common.saving') : editingId ? t('common.save') : t('common.create')}
              </GlassButton>
            </div>
          </form>
        </div>
      </GlassModal>

      {/* ═══ 360° SPATIAL IDENTITY CARD MODAL ═══ */}
      {cardTeacher && (
        <GlassModal
          open={Boolean(cardTeacher)}
          onClose={() => setCardTeacher(null)}
          title={t('teachers.spatialCard.modalTitle', { name: formatTeacherName(cardTeacher) })}
          size="md"
        >
          <div className="py-2 flex flex-col items-center">
            <SpatialIdentityCard360
              data={{
                id: cardTeacher.id,
                fullName: formatTeacherName(cardTeacher),
                role: 'TEACHER',
                email: cardTeacher.user?.email || undefined,
                phone: cardTeacher.user?.phone || undefined,
                specialty: cardTeacher.specializations?.[0] || undefined,
                activeGroupsCount: cardTeacher.groups?.length ?? 0,
                status: cardTeacher.user?.isActive !== false ? t('teachers.sidecar.badgeActive') : t('teachers.sidecar.badgeInactive'),
                biometricVerified: Boolean((cardTeacher as unknown as Record<string, unknown>).faceEnrolled || (cardTeacher.user as unknown as Record<string, unknown>)?.faceEnrolled),
                nfcEnabled: false,
              }}
            />
          </div>
        </GlassModal>
      )}

      {/* ═══ DELETE CONFIRM DIALOG ═══ */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        description={t('teachers.deleteConfirm')}
        loading={remove.isPending}
      />

      {/* ═══ FLOATING ACTION ISLAND (BULK ACTIONS) ═══ */}
      <FloatingActionIsland
        selectedCount={selectedCount}
        onClearSelection={() => {
          sound.playTick?.();
          haptics.light();
          clearSelection();
        }}
        entityName={t('teachers.bulk.itemLabel')}
        actions={[
          {
            label: t('teachers.bulk.toggleStatus'),
            icon: <Glyph name="teachers" size={15} weight={2.2} />,
            variant: 'primary',
            onClick: handleBatchToggleStatus,
          },
          {
            label: t('teachers.bulk.exportCsv'),
            icon: <Glyph name="export" size={15} weight={2.2} />,
            onClick: () => handleExportCSV(),
          },
        ]}
      />
    </div>
  );
}

export default TeachersPage;
