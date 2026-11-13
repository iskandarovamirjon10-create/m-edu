/**
 * M-EDU Student Detail Page
 * Comprehensive student 360 profile, academic history, groups, attendance, and financial breakdown.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { studentsApi, groupsApi, faceApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassErrorState,
  GlassEmptyState,
  GlassModal,
  ConfirmDialog,
  GlassSelect,
  useToasts,
  statusColor,
  GlassField,
  GlassBadge,
  GlassButton,
  GlassInput,
  GlassCard,
} from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { useAuth } from '@/auth/AuthContext';
import { fullName, formatDate, formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Student, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { queryKeys } from '@/lib/query-keys.factory';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { SpatialIdentityCard360 } from '@/components/cards/SpatialIdentityCard360';
import { AiStudentDiagnosticWidget, AiParentMessageModal } from '@/components/ai';
import { OfficialStudentContractModal } from '@/components/students/OfficialStudentContractModal';

/* ══════════════════════════════════════════════════════════════════════════
 * 120Hz PROMOTION SPRING PHYSICS & CHOREOGRAPHY
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 540, damping: 34, mass: 0.65 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 28, mass: 0.85 },
  soft:   { type: 'spring' as const, stiffness: 220, damping: 26, mass: 1.0 },
  bouncy: { type: 'spring' as const, stiffness: 460, damping: 22, mass: 0.7 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.048, delayChildren: 0.03 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING.smooth,
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ════════════════════════════════════════════════════════════════════════ */

export interface FaceEnrollmentItem {
  id: string;
  status: string;
  enrolledAt: string;
}

export interface ParentLink {
  id: string;
  parentId: string;
  parent?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    isActive?: boolean;
  };
  relationship?: string;
  isPrimary?: boolean;
  canViewGrades?: boolean;
  canViewPayments?: boolean;
  canViewAttendance?: boolean;
}

type DetailTab = 'all' | 'academic' | 'finance';

/* ══════════════════════════════════════════════════════════════════════════
 * PRECISION SF-PROPORTION VECTOR ICONS
 * ════════════════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.85;

const I = {
  userCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M6.2 18.4c.9-1.4 2.4-2.4 5.8-2.4s4.9 1 5.8 2.4',
  ],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  userPlus: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M19 8v6',
    'M22 11h-6',
  ],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  usersRound: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  calendar: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  calendarCheck: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M9 15l2 2 4-4',
  ],
  creditCard: [
    'M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z',
    'M1 10h22',
    'M6 15h2',
  ],
  face: [
    'M9 3H5a2 2 0 0 0-2 2v4',
    'M15 3h4a2 2 0 0 1 2 2v4',
    'M21 15v4a2 2 0 0 1-2 2h-4',
    'M9 21H5a2 2 0 0 1-2-2v-4',
    'M9.5 10v.5',
    'M14.5 10v.5',
    'M9 15a4 4 0 0 0 6 0',
  ],
  phone: [
    'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z',
  ],
  mail: [
    'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M22 6 12 13 2 6',
  ],
  mapPin: [
    'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z',
    'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6',
    'M14 11v6',
  ],
  link: [
    'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
    'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  ],
  unlink: [
    'M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.71 1.71',
    'M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71',
  ],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  award: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3',
    'M20 5h-3',
    'M5.5 18v2.5',
    'M6.75 19.25h-2.5',
  ],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  info: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 16v-4',
    'M12 8h.01',
  ],
  copy: [
    'M9 9h10v10H9z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
  check: ['M20 6 9 17l-5-5'],
  contract: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8',
    'M16 17H8',
    'M10 9H8',
  ],
  idCard: [
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z',
    'M9 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M15 8h2',
    'M15 12h2',
    'M7 16h10',
  ],
  sidebar: [
    'M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M9 3v18',
  ],
  messageSquare: [
    'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  ],
};

const Icon = memo(function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  ...rest
}: {
  paths: readonly string[];
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
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      {(paths || []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * PURE HELPER FUNCTIONS (Preserved & Exported for Tests)
 * ════════════════════════════════════════════════════════════════════════ */

export function formatStudentStatus(isActive: boolean | undefined): {
  color: string;
  label: string;
} {
  return isActive === false
    ? { color: 'red', label: 'enum.status.INACTIVE' }
    : { color: 'green', label: 'enum.status.ACTIVE' };
}

export function formatGroupStatus(isActive: boolean): {
  color: string;
  label: string;
} {
  return isActive
    ? { color: 'green', label: 'enum.status.ACTIVE' }
    : { color: 'slate', label: 'enum.status.INACTIVE' };
}

export function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
}

export function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const AVATAR_PALETTES = [
  ['#0066FF', '#5856D6'],
  ['#9333EA', '#EC4899'],
  ['#16B853', '#00C7BE'],
  ['#FF9500', '#FF2D55'],
  ['#4F46E5', '#9333EA'],
  ['#00C7BE', '#0066FF'],
  ['#FF2D55', '#FF9500'],
  ['#10B981', '#059669'],
];

export function avatarGradient(name: string): string {
  const palette =
    AVATAR_PALETTES[Math.abs(nameHash(name || '')) % AVATAR_PALETTES.length] ||
    AVATAR_PALETTES[0];
  const [a, b] = palette;
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * CHROMATIC TONE PALETTES
 * ════════════════════════════════════════════════════════════════════════ */

type ChromaticTone = 'blue' | 'green' | 'orange' | 'red' | 'purple';

const TONE_STYLES: Record<
  ChromaticTone,
  { fg: string; bg: string; border: string; glow: string; gradient: string }
> = {
  blue: {
    fg: 'var(--tone-blue-fg, #0066FF)',
    bg: 'var(--tone-blue-bg, rgba(0, 102, 255, 0.11))',
    border: 'var(--tone-blue-border, rgba(0, 102, 255, 0.25))',
    glow: 'var(--tone-blue-glow, rgba(0, 102, 255, 0.28))',
    gradient: 'linear-gradient(135deg, #0066FF 0%, #3B49DF 100%)',
  },
  green: {
    fg: 'var(--tone-green-fg, #16B853)',
    bg: 'var(--tone-green-bg, rgba(22, 184, 83, 0.11))',
    border: 'var(--tone-green-border, rgba(22, 184, 83, 0.25))',
    glow: 'var(--tone-green-glow, rgba(22, 184, 83, 0.28))',
    gradient: 'linear-gradient(135deg, #16B853 0%, #0D9488 100%)',
  },
  orange: {
    fg: 'var(--tone-orange-fg, #FF9500)',
    bg: 'var(--tone-orange-bg, rgba(255, 149, 0, 0.12))',
    border: 'var(--tone-orange-border, rgba(255, 149, 0, 0.26))',
    glow: 'var(--tone-orange-glow, rgba(255, 149, 0, 0.28))',
    gradient: 'linear-gradient(135deg, #FF9500 0%, #F97316 100%)',
  },
  red: {
    fg: 'var(--tone-red-fg, #FF3B30)',
    bg: 'var(--tone-red-bg, rgba(255, 59, 48, 0.11))',
    border: 'var(--tone-red-border, rgba(255, 59, 48, 0.25))',
    glow: 'var(--tone-red-glow, rgba(255, 59, 48, 0.28))',
    gradient: 'linear-gradient(135deg, #FF3B30 0%, #E11D48 100%)',
  },
  purple: {
    fg: 'var(--tone-purple-fg, #9333EA)',
    bg: 'var(--tone-purple-bg, rgba(147, 51, 234, 0.11))',
    border: 'var(--tone-purple-border, rgba(147, 51, 234, 0.25))',
    glow: 'var(--tone-purple-glow, rgba(147, 51, 234, 0.28))',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)',
  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * SUB-COMPONENTS (Chromatic Liquid Glass v2)
 * ════════════════════════════════════════════════════════════════════════ */

function CountUp({
  value,
  duration = 1.0,
  suffix = '',
  decimals = 0,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  decimals?: number;
}) {
  const isTest =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const safeValue = Number.isFinite(value) ? value : 0;
  const [n, setN] = useState(isTest ? safeValue : 0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (isTest) return;
    let raf = 0;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 5);
      setN(safeValue * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [safeValue, duration, isTest]);

  const valToUse = isTest ? safeValue : n;
  const shown =
    decimals > 0
      ? valToUse.toFixed(decimals)
      : Math.round(valToUse).toLocaleString();
  return (
    <span className="tabular-nums">
      {shown}
      {suffix}
    </span>
  );
}

/** 3D Spatial Hero Avatar with Rotating Conic Halo & Live Radar Beacon */
export function HeroAvatar({
  name,
  isActive,
  size = 96,
}: {
  name: string;
  isActive: boolean | undefined;
  size?: number;
}) {
  const active = isActive !== false;

  return (
    <div
      className="group relative shrink-0 select-none"
      style={{ width: size, height: size }}
    >
      {/* Ambient Chromatic Aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2 rounded-full opacity-40 blur-xl transition-opacity duration-500 group-hover:opacity-70"
        style={{ background: avatarGradient(name) }}
      />

      {/* Rotating Conic Specular Ring */}
      <motion.div
        className="absolute inset-[-4px] rounded-full p-[3px]"
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      >
        <span
          className="absolute inset-0 rounded-full opacity-80 blur-[1px]"
          style={{
            background:
              'var(--gradient-conic, conic-gradient(from 0deg, #0066FF, #00C7BE, #5856D6, #AF52DE, #FF2D55, #0066FF))',
          }}
          aria-hidden="true"
        />
      </motion.div>

      {/* Inner Specular Glass Orb */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.03 }}
        transition={SPRING.bouncy}
        className="relative flex h-full w-full items-center justify-center rounded-full font-extrabold text-white shadow-2xl ring-2 ring-white/90 dark:ring-[#070B14]"
        style={{
          background: avatarGradient(name),
          fontSize: size * 0.32,
          letterSpacing: '-0.02em',
          boxShadow:
            '0 16px 36px -8px rgba(15, 23, 42, 0.38), inset 0 2px 2px rgba(255, 255, 255, 0.55)',
        }}
      >
        {/* Top Dome Specular Reflection */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.50) 0%, transparent 55%)',
          }}
        />
        <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.22)]">
          {getInitials(name)}
        </span>
      </motion.div>

      {/* Live Status Beacon */}
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ ...SPRING.bouncy, delay: 0.2 }}
        className="absolute bottom-0 right-0 z-20 flex h-7 w-7 items-center justify-center rounded-full ring-[3px] ring-white dark:ring-[#070B14]"
        style={{
          background: active
            ? 'linear-gradient(135deg, #16B853 0%, #059669 100%)'
            : 'linear-gradient(135deg, #FF3B30 0%, #E11D48 100%)',
          boxShadow: `0 4px 12px -2px ${
            active ? 'rgba(22, 184, 83, 0.65)' : 'rgba(255, 59, 48, 0.65)'
          }`,
        }}
        aria-label={active ? 'Active' : 'Inactive'}
      >
        {active && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className="relative h-2 w-2 rounded-full bg-white shadow-2xs" />
      </motion.span>
    </div>
  );
}

/** Chromatic Liquid Glass Stat Tile */
export function StatTile({
  label,
  value,
  icon,
  tone = 'blue',
  format = 'number',
}: {
  label: string;
  value: number | string;
  icon: string[];
  tone?: ChromaticTone;
  format?: 'number' | 'percent' | 'string';
}) {
  const c = TONE_STYLES[tone] || TONE_STYLES.blue;

  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3, scale: 1.01 }}
      transition={SPRING.snappy}
      className="glass-card glass-card--interactive group relative flex items-center gap-3.5 px-4 py-3.5 select-none"
    >
      {/* Corner Chromatic Caustic */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-25 blur-2xl transition-opacity duration-300 group-hover:opacity-55"
        style={{ background: c.fg }}
      />

      <div
        className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px -6px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={20} strokeWidth={2.05} className="relative" />
      </div>

      <div className="relative z-10 min-w-0 flex-1">
        <div className="text-[22px] font-extrabold leading-none tracking-tight text-[var(--text-primary)] tabular-nums">
          {typeof value === 'number' ? (
            format === 'percent' ? (
              <CountUp value={value} suffix="%" />
            ) : (
              <CountUp value={value} />
            )
          ) : (
            value
          )}
        </div>
        <div className="mt-1.5 truncate text-[11px] font-bold uppercase tracking-[0.11em] text-[var(--text-secondary)]">
          {label}
        </div>
      </div>
    </motion.div>
  );
}


/** Info Row with Tone-Aware Specular Tile & Optional Copy Action */
function InfoRow({
  icon,
  label,
  value,
  tone = 'blue',
  copyValue,
}: {
  icon: string[];
  label: string;
  value: React.ReactNode;
  tone?: 'blue' | 'green' | 'orange' | 'purple';
  copyValue?: string;
}) {
  const c = TONE_STYLES[tone] || TONE_STYLES.blue;
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!copyValue || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }, [copyValue]);

  return (
    <div className="group flex items-start justify-between gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.035]">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
          }}
        >
          <Icon paths={icon} size={16} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <dt className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-[var(--text-tertiary)]">
            {label}
          </dt>
          <dd className="mt-0.5 break-words text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
            {value}
          </dd>
        </div>
      </div>

      {copyValue && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy"
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] opacity-0 transition-all hover:bg-slate-500/10 hover:text-[var(--primary)] group-hover:opacity-100 focus:opacity-100"
        >
          <Icon paths={copied ? I.check : I.copy} size={13} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

/** Attendance Heatmap Mini-Strip (Visualizes Recent Sessions at a Glance) */
const AttendanceHeatmapStrip = memo(function AttendanceHeatmapStrip({
  records,
  locale,
}: {
  records: ReadonlyArray<{ id?: string; status?: string; date?: string }>;
  locale: string;
}) {
  if (!records.length) return null;
  const recent = records.slice(0, 14).reverse();

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-slate-900/[0.015] px-5 py-2.5 dark:bg-white/[0.015]">
      <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
        {locale === 'uz'
          ? `So‘nggi ${recent.length} dars dinamikasi`
          : locale === 'ru'
            ? `Динамика (${recent.length} зан.)`
            : `Last ${recent.length} sessions`}
      </span>
      <div className="flex items-center gap-1.5">
        {recent.map((att, idx) => {
          const st = String(att.status || '').toUpperCase();
          const bg =
            st === 'PRESENT'
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]'
              : st === 'LATE'
                ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.45)]'
                : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.45)]';
          return (
            <span
              key={att.id || idx}
              title={`${formatDate(att.date)} — ${st}`}
              className={`h-2.5 w-2.5 rounded-full transition-transform hover:scale-125 ${bg}`}
            />
          );
        })}
      </div>
    </div>
  );
});

/** Anatomical Shimmer Skeleton */
function Shimmer({
  className = '',
  radius = '1.25rem',
}: {
  className?: string;
  radius?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`glass-card skeleton-shimmer relative overflow-hidden ${className}`}
      style={{ borderRadius: radius }}
    />
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-44 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-20" radius="1.25rem" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Shimmer className="h-80" radius="1.5rem" />
        <div className="lg:col-span-2">
          <Shimmer className="h-80" radius="1.5rem" />
        </div>
      </div>
    </div>
  );
}

/** Switch Card for Parent Portal Permissions */
function PermissionToggle({
  checked,
  onChange,
  icon,
  label,
  description,
  tone = 'blue',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: string[];
  label: string;
  description: string;
  tone?: 'blue' | 'green' | 'purple';
}) {
  const c = TONE_STYLES[tone] || TONE_STYLES.blue;

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      whileHover={{ scale: 1.008 }}
      whileTap={{ scale: 0.988 }}
      transition={SPRING.snappy}
      className={[
        'flex min-h-[56px] w-full items-center gap-3.5 rounded-2xl border px-4 py-3 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]',
        checked
          ? 'border-transparent'
          : 'border-[var(--border-subtle)] bg-white/50 hover:bg-white/80 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]',
      ].join(' ')}
      style={
        checked
          ? {
              background: c.bg,
              borderColor: c.border,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 16px -6px ${c.glow}`,
            }
          : undefined
      }
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all"
        style={{
          background: checked ? c.gradient : 'var(--bg-glass)',
          color: checked ? '#FFFFFF' : 'var(--text-tertiary)',
          boxShadow: checked ? `0 4px 10px -2px ${c.glow}` : undefined,
        }}
      >
        <Icon paths={icon} size={16} strokeWidth={2.1} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13.5px] font-bold tracking-tight text-[var(--text-primary)]">
            {label}
          </p>
          <AnimatePresence initial={false}>
            {checked && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={SPRING.bouncy}
                className="flex h-4 w-4 items-center justify-center rounded-full text-white"
                style={{ background: c.fg }}
              >
                <Icon paths={I.check} size={10} strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-[var(--text-secondary)]">
          {description}
        </p>
      </div>

      {/* Tactile iOS Switch Track */}
      <div
        aria-hidden="true"
        className="relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200"
        style={{
          background: checked ? c.gradient : 'rgba(148, 163, 184, 0.28)',
        }}
      >
        <motion.span
          layout
          transition={SPRING.bouncy}
          className="h-5 w-5 rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.22)]"
          style={{ marginLeft: checked ? 'auto' : 0 }}
        />
      </div>
    </motion.button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN STUDENT DETAIL PAGE COMPONENT
 * ════════════════════════════════════════════════════════════════════════ */

export function StudentDetailPage() {
  const { t, locale } = useSafeI18n();
  usePageTitle(
    t('students.detailsTitle') ||
      t('studentDetail.detailsSubtitle') ||
      'Student Profile',
  );
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const { playTick, playPop } = usePremiumSound();

  // Segmented Spatial View Tab
  const [activeTab, setActiveTab] = useState<DetailTab>('all');

  // Group Assignment Modal State
  const [assignOpen, setAssignOpen] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const student = useQuery({
    queryKey: queryKeys.students.detail(id!),
    queryFn: () => studentsApi.get(id!),
    enabled: !!id,
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 500 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });

  const enrollments = useQuery({
    queryKey: queryKeys.face.studentEnrollments(id),
    queryFn: () => faceApi.enrollments({ studentId: id }),
    enabled: !!id,
    placeholderData: (previousData) => previousData,
  });

  const { user } = useAuth();
  const canManageParents = ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'].includes(
    user?.role || '',
  );

  // 360° Card & Parent Management State
  const [card360Open, setCard360Open] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [parentModalOpen, setParentModalOpen] = useState(false);
  const [editLinkModalOpen, setEditLinkModalOpen] = useState(false);
  const [unlinkParentTarget, setUnlinkParentTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Deep AI Parent Message Modal State
  const [isAiMessageModalOpen, setIsAiMessageModalOpen] = useState(false);
  const [aiMessageTopic, setAiMessageTopic] = useState<
    'attendance' | 'debt' | 'praise' | 'exam' | 'custom'
  >('attendance');
  const [aiMessageDetails, setAiMessageDetails] = useState('');
  const [editingLink, setEditingLink] = useState<{
    id: string;
    parentId: string;
    relationship?: string;
    isPrimary?: boolean;
    canViewGrades?: boolean;
    canViewPayments?: boolean;
    canViewAttendance?: boolean;
  } | null>(null);

  const [parentFirstName, setParentFirstName] = useState('');
  const [parentLastName, setParentLastName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentRelationship, setParentRelationship] = useState('parent');
  const [parentPassword, setParentPassword] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [canViewGrades, setCanViewGrades] = useState(true);
  const [canViewPayments, setCanViewPayments] = useState(true);
  const [canViewAttendance, setCanViewAttendance] = useState(true);

  const [editRelationship, setEditRelationship] = useState('parent');
  const [editIsPrimary, setEditIsPrimary] = useState(false);
  const [editCanViewGrades, setEditCanViewGrades] = useState(true);
  const [editCanViewPayments, setEditCanViewPayments] = useState(true);
  const [editCanViewAttendance, setEditCanViewAttendance] = useState(true);

  const parentsQuery = useQuery({
    queryKey: queryKeys.students.parents(id!),
    queryFn: () => studentsApi.getParents(id!),
    enabled: !!id,
  });

  const linkedParents = useMemo(
    () => parentsQuery.data || [],
    [parentsQuery.data],
  ) as ParentLink[];

  const addParentMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        firstName: parentFirstName.trim(),
        lastName: parentLastName.trim(),
        email: parentEmail.trim().toLowerCase(),
        phone: parentPhone.trim() || undefined,
        relationship: parentRelationship,
        isPrimary,
        canViewGrades,
        canViewPayments,
        canViewAttendance,
      };
      if (parentPassword.trim()) payload.password = parentPassword.trim();
      return studentsApi.addParent(id!, payload);
    },
    onSuccess: () => {
      push(
        'success',
        t('student.parents.linkSuccess') ||
          'Parent account linked successfully',
      );
      setParentModalOpen(false);
      setParentFirstName('');
      setParentLastName('');
      setParentEmail('');
      setParentPhone('');
      setParentPassword('');
      setIsPrimary(false);
      void qc.invalidateQueries({ queryKey: queryKeys.students.parents(id!) });
      void qc.invalidateQueries({ queryKey: queryKeys.students.detail(id!) });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const updateParentLinkMutation = useMutation({
    mutationFn: async () => {
      if (!editingLink) throw new Error('No parent link selected');
      return studentsApi.updateParent(id!, editingLink.parentId, {
        relationship: editRelationship,
        isPrimary: editIsPrimary,
        canViewGrades: editCanViewGrades,
        canViewPayments: editCanViewPayments,
        canViewAttendance: editCanViewAttendance,
      });
    },
    onSuccess: () => {
      push(
        'success',
        t('student.parents.updateSuccess') ||
          'Parent permissions updated successfully',
      );
      setEditLinkModalOpen(false);
      setEditingLink(null);
      void qc.invalidateQueries({ queryKey: queryKeys.students.parents(id!) });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const unlinkParentMutation = useMutation({
    mutationFn: (parentId: string) => studentsApi.unlinkParent(id!, parentId),
    onSuccess: () => {
      push(
        'success',
        t('student.parents.unlinkSuccess') || 'Parent unlinked successfully',
      );
      setUnlinkParentTarget(null);
      void qc.invalidateQueries({ queryKey: queryKeys.students.parents(id!) });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const openEditParentModal = useCallback((link: ParentLink) => {
    setEditingLink({
      id: link.id,
      parentId: link.parentId,
      relationship: link.relationship,
      isPrimary: link.isPrimary,
      canViewGrades: link.canViewGrades,
      canViewPayments: link.canViewPayments,
      canViewAttendance: link.canViewAttendance,
    });
    setEditRelationship(link.relationship || 'parent');
    setEditIsPrimary(link.isPrimary ?? false);
    setEditCanViewGrades(link.canViewGrades ?? true);
    setEditCanViewPayments(link.canViewPayments ?? true);
    setEditCanViewAttendance(link.canViewAttendance ?? true);
    setEditLinkModalOpen(true);
  }, []);

  const studentData = student.data as Student | undefined;
  const allGroups = useMemo(() => {
    if (Array.isArray(groups.data)) return groups.data;
    if (
      groups.data &&
      typeof groups.data === 'object' &&
      'items' in groups.data
    ) {
      return (groups.data as { items: Group[] }).items || [];
    }
    return [];
  }, [groups.data]);

  const activeGroups = useMemo(
    () => allGroups.filter((g) => g.isActive !== false),
    [allGroups],
  );

  const myEnrollments = useMemo(
    () =>
      (enrollments.data as unknown as { items?: FaceEnrollmentItem[] })
        ?.items || [],
    [enrollments.data],
  );

  const studentGroups = useMemo(() => studentData?.groups || [], [studentData]);
  const studentAttendance = useMemo(
    () => studentData?.attendance || [],
    [studentData],
  );
  const studentPayments = useMemo(
    () => studentData?.payments || [],
    [studentData],
  );

  // Set of already-assigned active group IDs so the modal selector can mark them
  const enrolledGroupIds = useMemo(() => {
    const s = new Set<string>();
    for (const ge of studentGroups) {
      if (ge?.isActive === false) continue;
      const gId = ge?.group?.id || ge?.groupId || ge?.id;
      if (gId) s.add(String(gId));
    }
    return s;
  }, [studentGroups]);

  // Derived Telemetry Stats
  const stats = useMemo(() => {
    const presentCount = studentAttendance.filter(
      (a) => a.status === 'PRESENT' || a.status === 'LATE',
    ).length;
    const attendanceRate = studentAttendance.length
      ? Math.round((presentCount / studentAttendance.length) * 100)
      : 100;
    const activeGroupsCount = studentGroups.filter(
      (g) => g.isActive !== false,
    ).length;
    const totalPaid = studentPayments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const pendingAmount = studentPayments
      .filter((p) => p.status === 'PENDING' || p.status === 'OVERDUE')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return {
      attendanceRate,
      activeGroupsCount,
      totalPaid,
      pendingAmount,
      faceEnrolled: myEnrollments.length,
    };
  }, [studentAttendance, studentGroups, studentPayments, myEnrollments]);

  // Group Mutations
  const assign = useMutation({
    mutationFn: () => studentsApi.assignGroup(id!, groupId),
    onSuccess: () => {
      push('success', t('studentDetail.assigned'));
      setAssignOpen(false);
      setGroupId('');
      void qc.invalidateQueries({ queryKey: queryKeys.students.detail(id!) });
      void qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.groups.selectors() });
      void qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const removeFromGroup = useMutation({
    mutationFn: (gId: string) => studentsApi.removeGroup(id!, gId),
    onSuccess: () => {
      push('success', t('studentDetail.removed'));
      void qc.invalidateQueries({ queryKey: queryKeys.students.detail(id!) });
      void qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const { refetch: refetchStudent } = student;
  const handleRetry = useCallback(() => {
    void refetchStudent();
  }, [refetchStudent]);

  const handleOpenAssign = useCallback(() => {
    setGroupId('');
    setAssignOpen(true);
    void groups.refetch();
  }, [groups]);

  const handleCloseAssign = useCallback(() => {
    setAssignOpen(false);
    setGroupId('');
  }, []);

  const handleAssign = useCallback(() => {
    if (!groupId) return;
    assign.mutate();
  }, [groupId, assign]);

  const handleRemoveFromGroup = useCallback(
    (gId: string) => setRemoveTarget(gId),
    [],
  );

  const confirmRemoveFromGroup = useCallback(() => {
    if (!removeTarget) return;
    removeFromGroup.mutate(removeTarget);
    setRemoveTarget(null);
  }, [removeTarget, removeFromGroup]);

  const handleEdit = useCallback(
    () => navigate(`/students/${id}/edit`),
    [navigate, id],
  );
  const handleEnrollFace = useCallback(
    () => navigate('/face/enroll'),
    [navigate],
  );

  const studentName = fullName(
    studentData?.user?.firstName,
    studentData?.user?.lastName,
  );

  const handleOpenStudentSidecar = useCallback(() => {
    if (!studentData) return;
    playPop();
    const sidecarData: QuickLookData = {
      type: 'student',
      id: studentData.id,
      title: studentName,
      subtitle:
        studentData.user?.email ||
        studentData.user?.phone ||
        (locale === 'uz'
          ? 'Talaba profili'
          : locale === 'ru'
            ? 'Профиль ученика'
            : 'Student Profile'),
      status: {
        label: studentData.user?.isActive
          ? t('common.active') || 'Faol'
          : t('common.inactive') || 'Nofaol',
        tone: studentData.user?.isActive ? 'green' : 'amber',
      },
      metrics: [
        {
          label: t('dashboard.attendance') || 'Davomat',
          value: `${stats.attendanceRate}%`,
        },
        {
          label: t('groups.title') || 'Guruhlar',
          value: String(stats.activeGroupsCount),
        },
        {
          label: t('payments.title') || "To‘lovlar",
          value: formatCurrency(stats.totalPaid),
        },
        {
          label: 'Face ID',
          value:
            stats.faceEnrolled > 0
              ? t('common.active') || 'Faol'
              : locale === 'uz'
                ? "Yo‘q"
                : locale === 'ru'
                  ? 'Нет'
                  : 'None',
        },
      ],
      details: [
        { label: 'ID', value: studentData.id, copyable: true },
        { label: t('common.name') || 'F.I.SH.', value: studentName },
        {
          label: t('common.email') || 'Elektron pochta',
          value: studentData.user?.email || '—',
          copyable: Boolean(studentData.user?.email),
        },
        {
          label: t('common.phone') || 'Telefon',
          value: studentData.user?.phone || '—',
          copyable: Boolean(studentData.user?.phone),
        },
        {
          label: t('studentForm.dateOfBirth') || "Tug‘ilgan sana",
          value: formatDate(studentData.dateOfBirth),
        },
        {
          label: t('studentForm.gender') || 'Jinsi',
          value: studentData.gender || '—',
        },
        {
          label: t('hr.form.address') || 'Manzil',
          value: studentData.address || '—',
        },
        {
          label: t('groups.title') || 'Guruhlar soni',
          value: String(stats.activeGroupsCount),
        },
        {
          label: t('payments.title') || "Jami to‘langan",
          value: formatCurrency(stats.totalPaid),
        },
        {
          label: t('studentDetail.recentAttendance') || 'Davomat',
          value: `${stats.attendanceRate}%`,
        },
        {
          label: t('studentDetail.faceEnrollment') || 'Face ID',
          value:
            stats.faceEnrolled > 0
              ? locale === 'uz'
                ? 'Biometrik yozuv mavjud'
                : locale === 'ru'
                  ? 'Биометрия активна'
                  : 'Biometric active'
              : t('studentDetail.notEnrolled') || "Ro‘yxatdan o‘tmagan",
        },
        {
          label: t('studentForm.parentSection') || 'Ota-onalar',
          value: linkedParents.length > 0 ? `${linkedParents.length}` : '—',
        },
      ],
    };
    openSidecar(sidecarData);
  }, [studentData, playPop, studentName, stats, linkedParents, locale, t]);

  const handleAiAnalyze = useCallback(() => {
    playPop();
    window.dispatchEvent(
      new CustomEvent('open-ai-copilot', {
        detail: {
          prompt: `${studentName}ning davomati (${stats.attendanceRate}%), to‘lovlari (${stats.totalPaid.toLocaleString()} so‘m) va guruhlar bo‘yicha to‘liq tahlilini ber.`,
        },
      }),
    );
  }, [studentName, stats, playPop]);

  // Pause global keyboard shortcuts when any dialog/modal is active
  const anyModalOpen =
    assignOpen ||
    removeTarget !== null ||
    parentModalOpen ||
    editLinkModalOpen ||
    unlinkParentTarget !== null ||
    card360Open ||
    contractModalOpen ||
    isAiMessageModalOpen;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        playTick();
        handleOpenStudentSidecar();
      } else if (key === 'e') {
        e.preventDefault();
        playTick();
        handleEdit();
      } else if (key === 'a') {
        e.preventDefault();
        playTick();
        handleOpenAssign();
      } else if (key === 'c') {
        e.preventDefault();
        playPop();
        setCard360Open(true);
      } else if (key === 'k') {
        e.preventDefault();
        playPop();
        setContractModalOpen(true);
      } else if (key === 'i') {
        e.preventDefault();
        handleAiAnalyze();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    anyModalOpen,
    handleEdit,
    handleOpenAssign,
    handleOpenStudentSidecar,
    handleAiAnalyze,
    playTick,
    playPop,
  ]);

  /* ── LOADING STATE ── */
  if (student.isLoading && !studentData) {
    return (
      <div className="page-container space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <GlassPageHeader
          title={t('enum.badge.STUDENT')}
          subtitle={t('studentDetail.loadingSubtitle')}
        />
        <DetailSkeleton />
      </div>
    );
  }

  /* ── ERROR STATE ── */
  if (student.isError || !studentData) {
    return (
      <div className="page-container space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <GlassPageHeader
          title={t('enum.badge.STUDENT')}
          subtitle={t('studentDetail.detailsSubtitle')}
        />
        <div className="glass-card p-8">
          <GlassErrorState
            title={t('studentDetail.notFound')}
            message={getErrorMessage(student.error as Error)}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  const studentStatus = formatStudentStatus(studentData.user?.isActive);

  const tabs: { id: DetailTab; label: string; count?: number }[] = [
    {
      id: 'all',
      label:
        locale === 'uz'
          ? "To‘liq ko‘rinish"
          : locale === 'ru'
            ? 'Обзор 360°'
            : 'Full Overview',
    },
    {
      id: 'academic',
      label:
        locale === 'uz'
          ? 'Guruhlar va Davomat'
          : locale === 'ru'
            ? 'Группы и Посещаемость'
            : 'Groups & Attendance',
      count: stats.activeGroupsCount,
    },
    {
      id: 'finance',
      label:
        locale === 'uz'
          ? "To‘lovlar va Face ID"
          : locale === 'ru'
            ? 'Оплаты и Face ID'
            : 'Payments & Face ID',
      count: studentPayments.length,
    },
  ];

  /* ── MAIN CONTENT ── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container space-y-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))]"
    >
      <AuroraMesh variant="corporate" opacity={0.65} />
      {/* ══════════════════════════════════════════════════════════════════
          1 · HERO SPATIAL IDENTITY CARD
      ══════════════════════════════════════════════════════════════════ */}
      <motion.div variants={cardVariants}>
        <GlassCard
          className="relative overflow-hidden p-6 sm:p-7 border-white/40 dark:border-white/10"
          interactive
        >
          {/* Ambient Chromatic Mesh Backdrop */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl dark:opacity-35"
            style={{ background: avatarGradient(studentName) }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#0066FF]/10 blur-3xl dark:bg-[#2997FF]/15"
          />

          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            {/* Left Identity Cluster: Avatar + Badges + Name + Quick-Copy Pills */}
            <div className="flex min-w-0 flex-1 flex-col items-center gap-5 sm:flex-row sm:items-center">
              <HeroAvatar
                name={studentName}
                isActive={studentData.user?.isActive}
              />

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <GlassBadge color={studentStatus.color}>
                    {t(studentStatus.label)}
                  </GlassBadge>
                  {stats.faceEnrolled > 0 && (
                    <GlassBadge color="purple">
                      <span className="inline-flex items-center gap-1">
                        <Icon paths={I.face} size={11} strokeWidth={2.5} />
                        Face ID
                      </span>
                    </GlassBadge>
                  )}
                  {stats.activeGroupsCount > 0 && (
                    <GlassBadge color="blue">
                      <span className="inline-flex items-center gap-1">
                        <Icon paths={I.usersRound} size={11} strokeWidth={2.5} />
                        {stats.activeGroupsCount}{' '}
                        {stats.activeGroupsCount === 1
                          ? locale === 'uz'
                            ? 'ta guruh'
                            : locale === 'ru'
                              ? 'группа'
                              : 'group'
                          : locale === 'uz'
                            ? 'ta guruh'
                            : locale === 'ru'
                              ? 'групп'
                              : 'groups'}
                      </span>
                    </GlassBadge>
                  )}
                </div>

                <h1 className="mt-2.5 break-words text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl lg:text-[34px]">
                  {studentName}
                </h1>

                {studentData.user?.email && (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--text-secondary)] max-w-full">
                    <Icon paths={I.mail} size={14} strokeWidth={2} className="opacity-70 shrink-0" />
                    <span className="truncate">{studentData.user?.email}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Right Tactile Action Cluster (Apple Pro Glass Utility Bar) */}
            <div className="action-bar action-bar--stack shrink-0 justify-center border-t border-[var(--border-subtle)] pt-4 sm:justify-start xl:justify-end xl:border-t-0 xl:pt-0">
              {/* Pro Utilities Segmented Glass Bar */}
              <div
                data-action="secondary"
                className="flex items-center gap-0.5 rounded-xl border border-black/[0.06] bg-black/10 p-0.5 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]"
              >
                {/* 360° Pass */}
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <GlassButton
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      playPop();
                      setCard360Open(true);
                    }}
                    title="360° Shaffof Karta (C)"
                    aria-label="360° Karta"
                    className="h-10 min-h-10 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-emerald-600 shadow-xs hover:bg-emerald-500/20 dark:text-emerald-400"
                  >
                    <span className="inline-flex items-center gap-1.5 font-bold text-xs">
                      <Icon paths={I.idCard} size={15} strokeWidth={2.2} />
                      <span className="font-mono text-[11px]">360°</span>
                      <span className="sr-only">360° Karta</span>
                      <kbd aria-hidden="true" className="hidden 2xl:inline-block rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.2 font-mono text-[9px]">
                        C
                      </kbd>
                    </span>
                  </GlassButton>
                </motion.div>

                {/* Shartnoma */}
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <GlassButton
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      playPop();
                      setContractModalOpen(true);
                    }}
                    title="Talaba Shartnomasi (K)"
                    aria-label="Shartnoma"
                    className="min-h-10 px-2.5 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 shadow-xs"
                  >
                    <span className="inline-flex items-center gap-1.5 font-bold text-xs">
                      <Icon paths={I.contract} size={15} strokeWidth={2.2} />
                      <span className="sr-only">Shartnoma</span>
                      <kbd aria-hidden="true" className="hidden 2xl:inline-block rounded border border-purple-500/30 bg-purple-500/10 px-1 py-0.2 font-mono text-[9px]">
                        K
                      </kbd>
                    </span>
                  </GlassButton>
                </motion.div>

                {/* Sidecar */}
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <GlassButton
                    type="button"
                    variant="ghost"
                    onClick={handleOpenStudentSidecar}
                    title="Yon Panel — Sidecar (S)"
                    aria-label="Sidecar"
                    className="min-h-10 px-2.5 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-[#0066FF] dark:text-[#52ADFF] hover:bg-blue-500/20 shadow-xs"
                  >
                    <span className="inline-flex items-center gap-1.5 font-bold text-xs">
                      <Icon paths={I.sidebar} size={15} strokeWidth={2.2} />
                      <span className="sr-only">Sidecar</span>
                      <kbd aria-hidden="true" className="hidden 2xl:inline-block rounded border border-blue-500/30 bg-blue-500/10 px-1 py-0.2 font-mono text-[9px]">
                        S
                      </kbd>
                    </span>
                  </GlassButton>
                </motion.div>

                {/* AI Tahlil */}
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <GlassButton
                    type="button"
                    variant="ghost"
                    onClick={handleAiAnalyze}
                    title="AI Chuqur Tahlili (I)"
                    aria-label="AI Tahlil"
                    className="min-h-10 px-2.5 py-1.5 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 hover:bg-fuchsia-500/20 shadow-xs"
                  >
                    <span className="inline-flex items-center gap-1.5 font-bold text-xs">
                      <Icon paths={I.sparkles} size={15} strokeWidth={2.2} />
                      <span className="font-mono text-[11px]">AI</span>
                      <span className="sr-only">AI Tahlil</span>
                      <kbd aria-hidden="true" className="hidden 2xl:inline-block rounded border border-fuchsia-500/30 bg-fuchsia-500/10 px-1 py-0.2 font-mono text-[9px]">
                        I
                      </kbd>
                    </span>
                  </GlassButton>
                </motion.div>

                {/* Tahrirlash */}
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <GlassButton
                    type="button"
                    variant="ghost"
                    onClick={handleEdit}
                    title={`${t('common.edit')} (E)`}
                    aria-label={t('common.edit')}
                    className="min-h-10 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-white/10 shadow-xs"
                  >
                    <span className="inline-flex items-center gap-1.5 font-medium text-xs">
                      <Icon paths={I.edit} size={15} strokeWidth={2} />
                      <span className="sr-only">{t('common.edit')}</span>
                      <kbd aria-hidden="true" className="hidden 2xl:inline-block rounded border border-slate-400/30 bg-slate-500/10 px-1 py-0.2 font-mono text-[9px]">
                        E
                      </kbd>
                    </span>
                  </GlassButton>
                </motion.div>
              </div>

              {/* Primary Action Button */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={handleOpenAssign}
                  className="min-h-10 px-4 rounded-xl shadow-sm font-bold text-xs sm:text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                    <span>{t('studentDetail.assignToGroup')}</span>
                    <kbd aria-hidden="true" className="hidden xl:inline-block rounded border border-white/30 bg-white/15 px-1.5 py-0.2 font-mono text-[10px]">
                      A
                    </kbd>
                  </span>
                </GlassButton>
              </motion.div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════
          2 · KPI TELEMETRY RIBBON
      ══════════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
      >
        <StatTile
          label={t('dashboard.attendance')}
          value={stats.attendanceRate}
          icon={I.calendarCheck}
          tone={
            stats.attendanceRate >= 80
              ? 'green'
              : stats.attendanceRate >= 60
                ? 'orange'
                : 'red'
          }
          format="percent"
        />
        <StatTile
          label={t('groups.title')}
          value={stats.activeGroupsCount}
          icon={I.usersRound}
          tone="blue"
        />
        <StatTile
          label={t('payments.title')}
          value={formatCurrency(stats.totalPaid)}
          icon={I.creditCard}
          tone="green"
        />
        <StatTile
          label={t('studentDetail.faceEnrollment')}
          value={
            stats.faceEnrolled > 0
              ? locale === 'uz'
                ? 'Faol'
                : locale === 'ru'
                  ? 'Активен'
                  : 'Active'
              : t('studentDetail.notEnrolled') || "Yo‘q"
          }
          icon={I.face}
          tone={stats.faceEnrolled > 0 ? 'purple' : 'orange'}
        />
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════
          3 · SEGMENTED VIEW DOCK
      ══════════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={cardVariants}
        className="flex items-center justify-between gap-4 overflow-x-auto no-scrollbar"
      >
        <div
          role="tablist"
          aria-label="Student profile sections"
          className="glass-subtle inline-flex items-center gap-1 rounded-2xl p-1.5"
        >
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  playTick();
                  setActiveTab(tab.id);
                }}
                className={[
                  'relative inline-flex min-h-[36px] items-center gap-2 rounded-xl px-4 py-1.5 text-[12.5px] font-bold tracking-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]',
                  isSelected
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                {isSelected && (
                  <motion.span
                    layoutId="student-detail-tab-pill"
                    transition={SPRING.snappy}
                    className="absolute inset-0 rounded-xl border border-white/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.08)] dark:border-white/15 dark:bg-white/[0.10]"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={[
                      'relative z-10 rounded-full px-1.5 py-0.2 text-[10px] font-extrabold tabular-nums',
                      isSelected
                        ? 'bg-[#0066FF]/15 text-[#0066FF] dark:bg-[#2997FF]/25 dark:text-[#7CC2FF]'
                        : 'bg-slate-500/10 text-[var(--text-tertiary)]',
                    ].join(' ')}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════
          4 · PROFILE + PARENTS ROW (Visible in 'all')
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'all' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Personal Profile & AI Diagnostic Widget */}
          <motion.div variants={cardVariants} className="space-y-5 lg:col-span-1">
            <GlassCard
              className="overflow-hidden p-0 border-white/30 dark:border-white/10"
              interactive
            >
              <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-gradient-to-r from-white/50 to-transparent px-5 py-4 dark:from-white/[0.03]">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{
                    background: TONE_STYLES.blue.bg,
                    color: TONE_STYLES.blue.fg,
                    border: `1px solid ${TONE_STYLES.blue.border}`,
                  }}
                >
                  <Icon paths={I.userCircle} size={17} strokeWidth={2} />
                </div>
                <h2 className="text-[14.5px] font-bold tracking-tight text-[var(--text-primary)]">
                  {t('studentDetail.profile')}
                </h2>
              </div>

              <dl className="space-y-1 p-3.5">
                <InfoRow
                  icon={I.calendar}
                  label={t('studentForm.dateOfBirth')}
                  value={formatDate(studentData.dateOfBirth)}
                  tone="blue"
                />
                <InfoRow
                  icon={I.userCircle}
                  label={t('studentForm.gender')}
                  value={studentData.gender || '—'}
                  tone="purple"
                />
                <InfoRow
                  icon={I.mapPin}
                  label={t('hr.form.address')}
                  value={studentData.address || '—'}
                  tone="orange"
                  copyValue={studentData.address || undefined}
                />
                <InfoRow
                  icon={I.phone}
                  label={t('common.phone')}
                  value={studentData.user?.phone || '—'}
                  tone="green"
                  copyValue={studentData.user?.phone || undefined}
                />
                {studentData.notes && (
                  <div className="mt-2.5 rounded-2xl border border-[var(--border-subtle)] bg-slate-900/[0.02] p-3.5 dark:bg-white/[0.03]">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      {t('common.notes')}
                    </p>
                    <p className="mt-1 text-[13px] font-medium leading-relaxed text-[var(--text-primary)]">
                      {studentData.notes}
                    </p>
                  </div>
                )}
              </dl>
            </GlassCard>

            {/* Deep AI Pedagogical & Behavioral Diagnostic */}
            <AiStudentDiagnosticWidget
              studentId={id!}
              studentName={studentName}
              onOpenMessageModal={(opts) => {
                if (typeof opts === 'object' && opts) {
                  if (opts.topic) setAiMessageTopic(opts.topic);
                  if (opts.initialDraft) setAiMessageDetails(opts.initialDraft);
                } else if (typeof opts === 'string') {
                  setAiMessageDetails(opts);
                }
                setIsAiMessageModalOpen(true);
              }}
            />
          </motion.div>

          {/* Parents & Guardians Management */}
          <motion.div variants={cardVariants} className="lg:col-span-2">
            <GlassCard
              className="overflow-hidden p-0 border-white/30 dark:border-white/10"
              interactive
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-gradient-to-r from-white/50 to-transparent px-5 py-4 dark:from-white/[0.03]">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: TONE_STYLES.purple.bg,
                      color: TONE_STYLES.purple.fg,
                      border: `1px solid ${TONE_STYLES.purple.border}`,
                    }}
                  >
                    <Icon paths={I.users} size={17} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[14.5px] font-bold tracking-tight text-[var(--text-primary)]">
                      {t('studentForm.parentSection')}
                    </h2>
                    <p className="truncate text-[11.5px] font-medium text-[var(--text-secondary)]">
                      {t('student.parents.linkHint') ||
                        'Manage linked parent portal accounts and access permissions'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Direct AI Parent Drafter Shortcut */}
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                    <GlassButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        playPop();
                        setIsAiMessageModalOpen(true);
                      }}
                      className="min-h-[44px] px-3.5 !border-purple-500/30"
                    >
                      <span className="inline-flex items-center gap-1.5 font-semibold text-purple-600 dark:text-purple-400">
                        <Icon paths={I.messageSquare} size={14} strokeWidth={2.2} />
                        <span>
                          {locale === 'uz'
                            ? 'AI Xabar'
                            : locale === 'ru'
                              ? 'AI Сообщение'
                              : 'AI Message'}
                        </span>
                      </span>
                    </GlassButton>
                  </motion.div>

                  {canManageParents && (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                      <GlassButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setParentModalOpen(true)}
                        className="min-h-[44px] px-3.5 shadow-sm"
                      >
                        <span className="inline-flex items-center gap-1.5 font-bold">
                          <Icon paths={I.userPlus} size={14} strokeWidth={2.5} />
                          <span>
                            {t('student.parents.addTitle') || 'Add Parent'}
                          </span>
                        </span>
                      </GlassButton>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5">
                {parentsQuery.isLoading ? (
                  <div className="space-y-2.5">
                    {[1, 2].map((i) => (
                      <Shimmer key={i} className="h-20" radius="1rem" />
                    ))}
                  </div>
                ) : parentsQuery.isError ? (
                  <GlassErrorState
                    title={
                      t('student.parents.loadError') ||
                      'Failed to load parent accounts'
                    }
                    message={getErrorMessage(parentsQuery.error)}
                    onRetry={() => parentsQuery.refetch()}
                  />
                ) : linkedParents.length > 0 ? (
                  <div className="space-y-3">
                    {linkedParents.map((link, idx) => {
                      const p = link.parent;
                      const name = p
                        ? `${p.firstName || ''} ${p.lastName || ''}`.trim()
                        : locale === 'uz'
                          ? 'Ota-ona foydalanuvchisi'
                          : locale === 'ru'
                            ? 'Родитель'
                            : 'Parent User';
                      return (
                        <motion.div
                          key={link.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...SPRING.smooth, delay: idx * 0.05 }}
                          className="group flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-slate-900/[0.015] p-4 transition-all hover:border-purple-500/30 hover:bg-purple-500/[0.03] sm:flex-row sm:items-center dark:bg-white/[0.025]"
                        >
                          {/* Parent Avatar & Details */}
                          <div className="flex min-w-0 flex-1 items-center gap-3.5">
                            <div
                              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-extrabold text-white ring-2 ring-white/70 dark:ring-white/15"
                              style={{
                                background: avatarGradient(name),
                                fontSize: '14px',
                                boxShadow:
                                  '0 6px 14px -4px rgba(15,23,42,0.25), inset 0 1px 0 rgba(255,255,255,0.45)',
                              }}
                            >
                              <span className="relative select-none">
                                {getInitials(name)}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-[14.5px] font-bold tracking-tight text-[var(--text-primary)]">
                                  {name}
                                </p>
                                {link.isPrimary && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FF9500]/15 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#C93400] ring-1 ring-[#FF9500]/30 dark:text-[#FFB340]">
                                    <Icon
                                      paths={I.award}
                                      size={10}
                                      strokeWidth={2.5}
                                    />
                                    {t('student.parents.primaryBadge')}
                                  </span>
                                )}
                                <span className="rounded-md bg-slate-500/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                  {link.relationship
                                    ? t(
                                        `student.relationship.${link.relationship.toLowerCase()}`,
                                      ) || link.relationship
                                    : t('student.relationship.parent')}
                                </span>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] font-medium text-[var(--text-secondary)]">
                                {p?.email && (
                                  <span className="inline-flex items-center gap-1">
                                    <Icon
                                      paths={I.mail}
                                      size={12}
                                      strokeWidth={2}
                                      className="opacity-70"
                                    />
                                    <span className="truncate">{p.email}</span>
                                  </span>
                                )}
                                {p?.phone && (
                                  <span className="inline-flex items-center gap-1">
                                    <Icon
                                      paths={I.phone}
                                      size={12}
                                      strokeWidth={2}
                                      className="opacity-70"
                                    />
                                    <span className="tabular-nums">{p.phone}</span>
                                  </span>
                                )}
                              </div>

                              {/* Permission Badges */}
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {link.canViewGrades && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#0066FF]/10 px-2.5 py-0.5 text-[10.5px] font-bold text-[#0066FF] dark:bg-[#2997FF]/18 dark:text-[#7CC2FF]">
                                    <Icon
                                      paths={I.checkCircle}
                                      size={10}
                                      strokeWidth={3}
                                    />
                                    {t('student.parents.gradesBadge')}
                                  </span>
                                )}
                                {link.canViewAttendance && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#16B853]/10 px-2.5 py-0.5 text-[10.5px] font-bold text-[#129E46] dark:bg-[#30D158]/18 dark:text-[#4AE06E]">
                                    <Icon
                                      paths={I.checkCircle}
                                      size={10}
                                      strokeWidth={3}
                                    />
                                    {t('student.parents.attendanceBadge')}
                                  </span>
                                )}
                                {link.canViewPayments && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#9333EA]/10 px-2.5 py-0.5 text-[10.5px] font-bold text-[#7E3AF2] dark:bg-[#BF5AF2]/18 dark:text-[#DF9EFF]">
                                    <Icon
                                      paths={I.checkCircle}
                                      size={10}
                                      strokeWidth={3}
                                    />
                                    {t('student.parents.paymentsBadge')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Status & Action Controls */}
                          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:pt-0">
                            <GlassBadge color={p?.isActive ? 'green' : 'slate'}>
                              {p?.isActive
                                ? t('common.active')
                                : t('common.inactive')}
                            </GlassBadge>
                            {canManageParents && (
                              <div className="flex items-center gap-2">
                                <motion.button
                                  type="button"
                                  onClick={() => openEditParentModal(link)}
                                  whileHover={{ scale: 1.06 }}
                                  whileTap={{ scale: 0.94 }}
                                  transition={SPRING.snappy}
                                  aria-label={t('common.edit')}
                                  title={t('common.edit')}
                                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                                  style={{
                                    background: TONE_STYLES.blue.bg,
                                    color: TONE_STYLES.blue.fg,
                                    border: `1px solid ${TONE_STYLES.blue.border}`,
                                  }}
                                >
                                  <Icon
                                    paths={I.edit}
                                    size={15}
                                    strokeWidth={2.1}
                                  />
                                </motion.button>

                                <motion.button
                                  type="button"
                                  onClick={() =>
                                    setUnlinkParentTarget({
                                      id: link.parentId,
                                      name,
                                    })
                                  }
                                  whileHover={{ scale: 1.06 }}
                                  whileTap={{ scale: 0.94 }}
                                  transition={SPRING.snappy}
                                  aria-label={
                                    t('student.parents.unlinkAction') ||
                                    'Unlink parent'
                                  }
                                  title={
                                    t('student.parents.unlinkAction') ||
                                    'Unlink parent'
                                  }
                                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
                                  style={{
                                    background: TONE_STYLES.red.bg,
                                    color: TONE_STYLES.red.fg,
                                    border: `1px solid ${TONE_STYLES.red.border}`,
                                  }}
                                >
                                  <Icon
                                    paths={I.unlink}
                                    size={15}
                                    strokeWidth={2.1}
                                  />
                                </motion.button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border-medium)] p-7 text-center">
                    <div
                      className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{
                        background: TONE_STYLES.purple.bg,
                        color: TONE_STYLES.purple.fg,
                      }}
                    >
                      <Icon paths={I.users} size={22} strokeWidth={2} />
                    </div>
                    <p className="mt-3 text-[14.5px] font-bold text-[var(--text-primary)]">
                      {locale === 'uz'
                        ? 'Biriktirilgan ota-ona hisoblari mavjud emas'
                        : locale === 'ru'
                          ? 'Нет привязанных родителей'
                          : 'No parent accounts linked yet'}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-[12.5px] font-medium text-[var(--text-secondary)]">
                      {t('student.parents.linkHint') ||
                        'Link a parent or guardian to grant secure access to attendance, progress, and payments.'}
                    </p>
                    {canManageParents && (
                      <div className="mt-4 flex justify-center">
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <GlassButton
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={() => setParentModalOpen(true)}
                            className="min-h-[44px] px-4 shadow-sm"
                          >
                            <span className="inline-flex items-center gap-1.5 font-bold">
                              <Icon
                                paths={I.userPlus}
                                size={14}
                                strokeWidth={2.5}
                              />
                              <span>
                                {t('student.parents.addTitle') || 'Add Parent'}
                              </span>
                            </span>
                          </GlassButton>
                        </motion.div>
                      </div>
                    )}
                  </div>
                )}

                {/* Emergency Contact on File */}
                {(studentData.parentName ||
                  studentData.parentPhone ||
                  studentData.parentEmail) && (
                  <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-slate-900/[0.02] p-4 dark:bg-white/[0.03]">
                    <div className="mb-3 flex items-center gap-2">
                      <Icon
                        paths={I.info}
                        size={14}
                        strokeWidth={2}
                        className="text-[var(--text-tertiary)]"
                      />
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                        {locale === 'uz'
                          ? "Favqulodda aloqa maʼlumoti"
                          : locale === 'ru'
                            ? 'Экстренный контакт в анкете'
                            : 'Emergency Contact on File'}
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                          {t('common.name')}
                        </div>
                        <div className="mt-0.5 text-[13.5px] font-semibold text-[var(--text-primary)]">
                          {studentData.parentName || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                          {t('common.phone')}
                        </div>
                        <div className="mt-0.5 text-[13.5px] font-semibold tabular-nums text-[var(--text-primary)]">
                          {studentData.parentPhone || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                          {t('common.email')}
                        </div>
                        <div className="mt-0.5 truncate text-[13.5px] font-semibold text-[var(--text-primary)]">
                          {studentData.parentEmail || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          5 · GROUPS + ATTENDANCE (Visible in 'all' & 'academic')
      ══════════════════════════════════════════════════════════════════ */}
      {(activeTab === 'all' || activeTab === 'academic') && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Enrolled Groups Card */}
          <motion.div variants={cardVariants}>
            <GlassCard
              className="overflow-hidden p-0 border-white/30 dark:border-white/10"
              interactive
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-gradient-to-r from-white/50 to-transparent px-5 py-4 dark:from-white/[0.03]">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: TONE_STYLES.blue.bg,
                      color: TONE_STYLES.blue.fg,
                      border: `1px solid ${TONE_STYLES.blue.border}`,
                    }}
                  >
                    <Icon paths={I.usersRound} size={17} strokeWidth={2} />
                  </div>
                  <h2 className="text-[14.5px] font-bold tracking-tight text-[var(--text-primary)]">
                    {t('groups.title')}
                  </h2>
                </div>

                <motion.button
                  type="button"
                  onClick={handleOpenAssign}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING.snappy}
                  className="flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[12px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                  style={{
                    background: TONE_STYLES.blue.bg,
                    color: TONE_STYLES.blue.fg,
                    border: `1px solid ${TONE_STYLES.blue.border}`,
                  }}
                >
                  <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                  <span>{t('studentDetail.assign')}</span>
                </motion.button>
              </div>

              {studentGroups.length === 0 ? (
                <div className="p-8">
                  <GlassEmptyState
                    title={t('studentDetail.noGroups')}
                    message={t('studentDetail.noGroupsHint')}
                  />
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {studentGroups.map((ge, idx) => {
                    const gObj = ge?.group || ge;
                    const gId = gObj?.id || ge?.groupId || ge?.id;
                    const gName = gObj?.name || 'Group';
                    const gRoom = gObj && 'room' in gObj ? gObj.room : undefined;
                    const isActive = ge?.isActive !== false;
                    const gStatus = formatGroupStatus(isActive);
                    const isRemoving =
                      removeFromGroup.isPending &&
                      removeFromGroup.variables === gId;

                    return (
                      <motion.div
                        key={gId}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                        className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-[#0066FF]/[0.03]"
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/groups/${gId}`)}
                          className="flex min-w-0 flex-1 items-center gap-3.5 text-left outline-none"
                        >
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-white transition-transform duration-200 group-hover:scale-105"
                            style={{
                              background: avatarGradient(gName),
                              boxShadow:
                                '0 6px 14px -4px rgba(15,23,42,0.25), inset 0 1px 0 rgba(255,255,255,0.4)',
                            }}
                          >
                            <Icon paths={I.book} size={18} strokeWidth={2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                              {gName}
                            </p>
                            {gRoom && (
                              <p className="text-[12px] font-medium text-[var(--text-secondary)]">
                                {t('groups.col.room')} {gRoom}
                              </p>
                            )}
                          </div>
                        </button>

                        <GlassBadge color={gStatus.color}>
                          {t(gStatus.label)}
                        </GlassBadge>

                        {isActive && (
                          <motion.button
                            type="button"
                            onClick={() => {
                              if (gId) handleRemoveFromGroup(gId);
                            }}
                            disabled={isRemoving}
                            whileHover={{ scale: 1.06 }}
                            whileTap={{ scale: 0.94 }}
                            transition={SPRING.snappy}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl outline-none transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-red-500"
                            style={{
                              background: TONE_STYLES.red.bg,
                              color: TONE_STYLES.red.fg,
                              border: `1px solid ${TONE_STYLES.red.border}`,
                            }}
                            aria-label={t('common.remove')}
                            title={t('common.remove')}
                          >
                            {isRemoving ? (
                              <motion.span
                                className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current"
                                animate={{ rotate: 360 }}
                                transition={{
                                  duration: 0.9,
                                  repeat: Infinity,
                                  ease: 'linear',
                                }}
                              />
                            ) : (
                              <Icon
                                paths={I.trash}
                                size={15}
                                strokeWidth={2.1}
                              />
                            )}
                          </motion.button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </motion.div>

          {/* Attendance Telemetry Card with Heatmap Strip */}
          <motion.div variants={cardVariants}>
            <GlassCard
              className="overflow-hidden p-0 border-white/30 dark:border-white/10"
              interactive
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-gradient-to-r from-white/50 to-transparent px-5 py-4 dark:from-white/[0.03]">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: TONE_STYLES.green.bg,
                      color: TONE_STYLES.green.fg,
                      border: `1px solid ${TONE_STYLES.green.border}`,
                    }}
                  >
                    <Icon paths={I.calendarCheck} size={17} strokeWidth={2} />
                  </div>
                  <h2 className="text-[14.5px] font-bold tracking-tight text-[var(--text-primary)]">
                    {t('studentDetail.recentAttendance')}
                  </h2>
                </div>
                <GlassBadge
                  color={
                    stats.attendanceRate >= 80
                      ? 'green'
                      : stats.attendanceRate >= 60
                        ? 'amber'
                        : 'red'
                  }
                >
                  <CountUp value={stats.attendanceRate} suffix="%" />
                </GlassBadge>
              </div>

              <AttendanceHeatmapStrip
                records={studentAttendance}
                locale={locale}
              />

              {studentAttendance.length === 0 ? (
                <div className="p-8">
                  <GlassEmptyState
                    title={t('attendance.empty')}
                    message={t('studentDetail.attendanceEmptyHint')}
                  />
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {studentAttendance
                    .slice(0, activeTab === 'academic' ? 12 : 6)
                    .map((att, idx: number) => (
                      <motion.div
                        key={att.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                        className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-emerald-500/[0.03]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900/[0.04] text-[var(--text-secondary)] dark:bg-white/[0.06]">
                          <Icon paths={I.calendar} size={15} strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-bold tracking-tight text-[var(--text-primary)]">
                            {formatDate(att.date)}
                          </p>
                          <p className="text-[11.5px] font-medium text-[var(--text-secondary)]">
                            {att.source}
                          </p>
                        </div>
                        <GlassBadge color={statusColor(att.status)}>
                          {t(`attendance.${att.status.toLowerCase()}`)}
                        </GlassBadge>
                      </motion.div>
                    ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          6 · PAYMENTS + FACE ENROLLMENT (Visible in 'all' & 'finance')
      ══════════════════════════════════════════════════════════════════ */}
      {(activeTab === 'all' || activeTab === 'finance') && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Payments Card */}
          <motion.div variants={cardVariants}>
            <GlassCard
              className="overflow-hidden p-0 border-white/30 dark:border-white/10"
              interactive
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-gradient-to-r from-white/50 to-transparent px-5 py-4 dark:from-white/[0.03]">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: TONE_STYLES.green.bg,
                      color: TONE_STYLES.green.fg,
                      border: `1px solid ${TONE_STYLES.green.border}`,
                    }}
                  >
                    <Icon paths={I.creditCard} size={17} strokeWidth={2} />
                  </div>
                  <h2 className="text-[14.5px] font-bold tracking-tight text-[var(--text-primary)]">
                    {t('payments.title')}
                  </h2>
                </div>
                <div className="text-right">
                  <span
                    className="text-[13.5px] font-extrabold tabular-nums"
                    style={{ color: TONE_STYLES.green.fg }}
                  >
                    {formatCurrency(stats.totalPaid)}
                  </span>
                  {stats.pendingAmount > 0 && (
                    <p className="text-[10.5px] font-bold tabular-nums text-amber-500">
                      +{formatCurrency(stats.pendingAmount)} kutilmoqda
                    </p>
                  )}
                </div>
              </div>

              {studentPayments.length === 0 ? (
                <div className="p-8">
                  <GlassEmptyState
                    title={t('payments.empty')}
                    message={t('studentDetail.paymentsEmptyHint')}
                  />
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {studentPayments
                    .slice(0, activeTab === 'finance' ? 12 : 5)
                    .map((p, idx: number) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                        className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-emerald-500/[0.03]"
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            background: TONE_STYLES.green.bg,
                            color: TONE_STYLES.green.fg,
                          }}
                        >
                          <Icon
                            paths={I.creditCard}
                            size={15}
                            strokeWidth={2}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-bold tracking-tight text-[var(--text-primary)]">
                            {formatDate(p.createdAt)}
                          </p>
                          <p className="text-[11.5px] font-medium text-[var(--text-secondary)]">
                            {t(`payments.status.${p.status}`)}
                          </p>
                        </div>
                        <span className="text-[14px] font-extrabold tabular-nums tracking-tight text-[var(--text-primary)]">
                          {formatCurrency(p.amount)}
                        </span>
                      </motion.div>
                    ))}
                </div>
              )}
            </GlassCard>
          </motion.div>

          {/* Face Biometric Enrollment Card */}
          <motion.div variants={cardVariants}>
            <GlassCard
              className="overflow-hidden p-0 border-white/30 dark:border-white/10"
              interactive
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-gradient-to-r from-white/50 to-transparent px-5 py-4 dark:from-white/[0.03]">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: TONE_STYLES.purple.bg,
                      color: TONE_STYLES.purple.fg,
                      border: `1px solid ${TONE_STYLES.purple.border}`,
                    }}
                  >
                    <Icon paths={I.face} size={17} strokeWidth={2} />
                  </div>
                  <h2 className="text-[14.5px] font-bold tracking-tight text-[var(--text-primary)]">
                    {t('studentDetail.faceEnrollment')}
                  </h2>
                </div>
                {stats.faceEnrolled > 0 && (
                  <GlassBadge color="green">
                    <span className="inline-flex items-center gap-1">
                      <Icon
                        paths={I.checkCircle}
                        size={11}
                        strokeWidth={2.5}
                      />
                      Enrolled
                    </span>
                  </GlassBadge>
                )}
              </div>

              {myEnrollments.length === 0 ? (
                <div className="p-6 sm:p-8">
                  <div className="rounded-2xl border border-dashed border-[var(--border-medium)] p-6 text-center">
                    <div
                      className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{
                        background: TONE_STYLES.purple.bg,
                        color: TONE_STYLES.purple.fg,
                      }}
                    >
                      <Icon paths={I.face} size={22} strokeWidth={2} />
                    </div>
                    <p className="mt-3 text-[14.5px] font-bold text-[var(--text-primary)]">
                      {t('studentDetail.notEnrolled')}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-[12.5px] font-medium text-[var(--text-secondary)]">
                      {t('studentDetail.enrollHint')}
                    </p>
                    <div className="mt-4 flex justify-center">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <GlassButton
                          type="button"
                          variant="primary"
                          size="md"
                          onClick={handleEnrollFace}
                          className="min-h-[44px] px-4 shadow-sm"
                        >
                          <span className="inline-flex items-center gap-2 font-bold">
                            <Icon paths={I.face} size={16} strokeWidth={2} />
                            <span>{t('studentDetail.enrollFace')}</span>
                          </span>
                        </GlassButton>
                      </motion.div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {myEnrollments.map((e, idx) => (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                      className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-purple-500/[0.03]"
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: TONE_STYLES.purple.bg,
                          color: TONE_STYLES.purple.fg,
                        }}
                      >
                        <Icon paths={I.face} size={15} strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-bold tracking-tight text-[var(--text-primary)]">
                          {t('studentDetail.enrollment')}
                        </p>
                        <p className="text-[11.5px] font-medium text-[var(--text-secondary)]">
                          {formatDate(e.enrolledAt)}
                        </p>
                      </div>
                      <GlassBadge color={statusColor(e.status)}>
                        {t(`enum.status.${e.status}`)}
                      </GlassBadge>
                    </motion.div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          7 · MODALS & CONFIRMATION DIALOGS
      ══════════════════════════════════════════════════════════════════ */}

      {/* Assign to Group Modal (Smart-filters already enrolled groups) */}
      <GlassModal
        open={assignOpen}
        onClose={handleCloseAssign}
        title={t('studentDetail.assignToGroup')}
      >
        <div className="space-y-4">
          <GlassField label={t('exams.form.group')} required>
            <GlassSelect
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              aria-label={t('studentDetail.selectGroupAria')}
              className="min-h-[44px]"
            >
              <option value="">
                {t('studentDetail.selectGroupPlaceholder')}
              </option>
              {activeGroups.map((g) => {
                const alreadyIn = enrolledGroupIds.has(String(g.id));
                return (
                  <option key={g.id} value={g.id} disabled={alreadyIn}>
                    {g.name}
                    {alreadyIn ? ' (✓ Biriktirilgan)' : ''}
                  </option>
                );
              })}
            </GlassSelect>
          </GlassField>
          <div className="mt-5 flex justify-end gap-2.5">
            <GlassButton
              type="button"
              variant="secondary"
              size="md"
              onClick={handleCloseAssign}
              disabled={assign.isPending}
              className="min-h-[44px] px-4"
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              size="md"
              disabled={!groupId || assign.isPending}
              onClick={handleAssign}
              className="min-h-[44px] px-4"
            >
              {assign.isPending
                ? t('studentDetail.assigning')
                : t('studentDetail.assign')}
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Remove from Group Confirm Dialog */}
      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemoveFromGroup}
        title={t('studentDetail.remove')}
        confirmLabel={t('studentDetail.remove')}
        description={t('studentDetail.removeConfirm')}
        loading={removeFromGroup.isPending}
      />

      {/* Add / Link Parent Modal */}
      <GlassModal
        open={parentModalOpen}
        onClose={() => setParentModalOpen(false)}
        title={t('student.parents.addTitle')}
        wide
      >
        <div className="space-y-5">
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{
              background: TONE_STYLES.purple.bg,
              border: `1px solid ${TONE_STYLES.purple.border}`,
            }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: TONE_STYLES.purple.gradient,
                color: '#FFFFFF',
              }}
            >
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12.5px] font-medium leading-snug text-[var(--text-primary)]">
              {t('student.parents.linkHint')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <GlassField label={t('common.firstName')} required>
              <GlassInput
                type="text"
                placeholder="e.g. Rustam"
                value={parentFirstName}
                onChange={(e) => setParentFirstName(e.target.value)}
              />
            </GlassField>
            <GlassField label={t('common.lastName')} required>
              <GlassInput
                type="text"
                placeholder="e.g. Karimov"
                value={parentLastName}
                onChange={(e) => setParentLastName(e.target.value)}
              />
            </GlassField>
          </div>

          <GlassField label={t('student.parents.emailLabel')} required>
            <GlassInput
              type="email"
              placeholder="e.g. parent@example.com"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
            />
          </GlassField>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <GlassField label={t('common.phone')}>
              <GlassInput
                type="tel"
                placeholder="+998..."
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
              />
            </GlassField>
            <GlassField label={t('student.parents.relationshipLabel')}>
              <GlassSelect
                value={parentRelationship}
                onChange={(e) => setParentRelationship(e.target.value)}
                className="min-h-[44px]"
              >
                <option value="parent">
                  {t('student.relationship.parent')}
                </option>
                <option value="father">
                  {t('student.relationship.father')}
                </option>
                <option value="mother">
                  {t('student.relationship.mother')}
                </option>
                <option value="guardian">
                  {t('student.relationship.guardian')}
                </option>
                <option value="other">{t('student.relationship.other')}</option>
              </GlassSelect>
            </GlassField>
          </div>

          <GlassField
            label={t('student.parents.tempPassword')}
            hint={t('student.parents.tempPasswordHint')}
          >
            <GlassInput
              type="password"
              placeholder="Minimum 6 characters"
              value={parentPassword}
              onChange={(e) => setParentPassword(e.target.value)}
            />
          </GlassField>

          <div className="space-y-2.5 border-t border-[var(--border-subtle)] pt-4">
            <div className="flex items-center gap-2">
              <Icon
                paths={I.shield}
                size={14}
                strokeWidth={2}
                className="text-[var(--text-tertiary)]"
              />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                {t('student.parents.permissionsTitle')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <PermissionToggle
                checked={isPrimary}
                onChange={setIsPrimary}
                icon={I.award}
                label={t('student.parents.primaryGuardian')}
                description={t('student.parents.primaryGuardianDesc')}
                tone="purple"
              />
              <PermissionToggle
                checked={canViewGrades}
                onChange={setCanViewGrades}
                icon={I.book}
                label={t('student.parents.academicGrades')}
                description={t('student.parents.academicGradesDesc')}
                tone="blue"
              />
              <PermissionToggle
                checked={canViewAttendance}
                onChange={setCanViewAttendance}
                icon={I.calendarCheck}
                label={t('student.parents.attendanceLogs')}
                description={t('student.parents.attendanceLogsDesc')}
                tone="green"
              />
              <PermissionToggle
                checked={canViewPayments}
                onChange={setCanViewPayments}
                icon={I.creditCard}
                label={t('student.parents.tuitionInvoices')}
                description={t('student.parents.attendanceLogsDesc')}
                tone="purple"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-[var(--border-subtle)] pt-4">
            <GlassButton
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setParentModalOpen(false)}
              disabled={addParentMutation.isPending}
              className="min-h-[44px] px-4"
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              size="md"
              disabled={
                !parentFirstName.trim() ||
                !parentLastName.trim() ||
                !parentEmail.trim() ||
                addParentMutation.isPending
              }
              onClick={() => addParentMutation.mutate()}
              className="min-h-[44px] px-4"
            >
              {addParentMutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <motion.span
                    className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />
                  <span>{t('common.saving')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 font-bold">
                  <Icon paths={I.link} size={16} strokeWidth={2} />
                  <span>{t('student.parents.addTitle')}</span>
                </span>
              )}
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Edit Parent Permissions Modal */}
      <GlassModal
        open={editLinkModalOpen}
        onClose={() => setEditLinkModalOpen(false)}
        title={t('student.parents.editPermissionsTitle')}
        wide
      >
        <div className="space-y-5">
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{
              background: TONE_STYLES.blue.bg,
              border: `1px solid ${TONE_STYLES.blue.border}`,
            }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: TONE_STYLES.blue.gradient,
                color: '#FFFFFF',
              }}
            >
              <Icon paths={I.shield} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12.5px] font-medium leading-snug text-[var(--text-primary)]">
              {t('student.parents.linkHint')}
            </p>
          </div>

          <GlassField label={t('student.parents.relationshipLabel')}>
            <GlassSelect
              value={editRelationship}
              onChange={(e) => setEditRelationship(e.target.value)}
              className="min-h-[44px]"
            >
              <option value="parent">{t('student.relationship.parent')}</option>
              <option value="father">{t('student.relationship.father')}</option>
              <option value="mother">{t('student.relationship.mother')}</option>
              <option value="guardian">
                {t('student.relationship.guardian')}
              </option>
              <option value="other">{t('student.relationship.other')}</option>
            </GlassSelect>
          </GlassField>

          <div className="space-y-2.5 border-t border-[var(--border-subtle)] pt-4">
            <div className="flex items-center gap-2">
              <Icon
                paths={I.shield}
                size={14}
                strokeWidth={2}
                className="text-[var(--text-tertiary)]"
              />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                {t('student.parents.permissionsTitle')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <PermissionToggle
                checked={editIsPrimary}
                onChange={setEditIsPrimary}
                icon={I.award}
                label={t('student.parents.primaryGuardian')}
                description={t('student.parents.primaryGuardianDesc')}
                tone="purple"
              />
              <PermissionToggle
                checked={editCanViewGrades}
                onChange={setEditCanViewGrades}
                icon={I.book}
                label={t('student.parents.academicGrades')}
                description={t('student.parents.academicGradesDesc')}
                tone="blue"
              />
              <PermissionToggle
                checked={editCanViewAttendance}
                onChange={setEditCanViewAttendance}
                icon={I.calendarCheck}
                label={t('student.parents.attendanceLogs')}
                description={t('student.parents.attendanceLogsDesc')}
                tone="green"
              />
              <PermissionToggle
                checked={editCanViewPayments}
                onChange={setEditCanViewPayments}
                icon={I.creditCard}
                label={t('student.parents.tuitionInvoices')}
                description={t('student.parents.attendanceLogsDesc')}
                tone="purple"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-[var(--border-subtle)] pt-4">
            <GlassButton
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setEditLinkModalOpen(false)}
              disabled={updateParentLinkMutation.isPending}
              className="min-h-[44px] px-4"
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              size="md"
              disabled={updateParentLinkMutation.isPending}
              onClick={() => updateParentLinkMutation.mutate()}
              className="min-h-[44px] px-4"
            >
              {updateParentLinkMutation.isPending
                ? t('common.saving')
                : t('common.save')}
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Unlink Parent Confirm Dialog */}
      <ConfirmDialog
        open={unlinkParentTarget !== null}
        onClose={() => setUnlinkParentTarget(null)}
        onConfirm={() => {
          if (unlinkParentTarget) {
            unlinkParentMutation.mutate(unlinkParentTarget.id);
          }
        }}
        title={t('student.parents.unlinkTitle')}
        description={`${
          locale === 'uz'
            ? 'Haqiqatan ham ushbu ota-onani talabadan uzmoqchimisiz?'
            : locale === 'ru'
              ? 'Вы уверены, что хотите отвязать этого родителя?'
              : 'Are you sure you want to unlink'
        } ${
          unlinkParentTarget?.name ||
          (locale === 'uz' ? 'bu ota-ona' : 'this parent')
        }?`}
        confirmLabel={t('student.parents.unlinkAction')}
        loading={unlinkParentMutation.isPending}
      />

      {/* 360° Spatial Glass ID Card Modal */}
      <GlassModal
        open={card360Open}
        onClose={() => setCard360Open(false)}
        title={
          locale === 'uz'
            ? '360° Shaffof Karta — Talaba Identifikatori'
            : locale === 'ru'
              ? '360° Прозрачная ID Карта — Ученик'
              : '360° Spatial ID Card — Student'
        }
        wide
      >
        {studentData && (
          <div className="flex flex-col items-center py-3">
            <SpatialIdentityCard360
              data={{
                id: studentData.id,
                fullName: studentName,
                role: 'STUDENT',
                phone:
                  studentData.user?.phone ||
                  studentData.parentPhone ||
                  undefined,
                email: studentData.user?.email || undefined,
                attendanceRate:
                  studentAttendance.length > 0
                    ? stats.attendanceRate
                    : undefined,
                groupName:
                  studentGroups[0]?.group?.name ||
                  studentGroups[0]?.name ||
                  activeGroups[0]?.name ||
                  undefined,
                coursesCount: studentGroups.length,
                status: studentData.user?.isActive
                  ? t('common.active') || 'Faol'
                  : t('common.inactive') || 'Nofaol',
                biometricVerified: stats.faceEnrolled > 0,
                nfcEnabled: true,
                codeOrId: studentData.id,
              }}
              qrValue={typeof window !== 'undefined' ? `${window.location.origin}/students/${studentData.id}` : undefined}
            />
          </div>
        )}
      </GlassModal>

      {/* Deep AI Parent Message Drafter Modal */}
      <AiParentMessageModal
        open={isAiMessageModalOpen}
        onClose={() => setIsAiMessageModalOpen(false)}
        studentName={studentName}
        initialTopic={aiMessageTopic}
        initialDetails={aiMessageDetails}
        balanceDue={
          studentData?.balance
            ? Math.abs(studentData.balance)
            : undefined
        }
      />

      {/* Official Student Education Contract Modal */}
      {studentData && (
        <OfficialStudentContractModal
          open={contractModalOpen}
          onClose={() => setContractModalOpen(false)}
          student={{
            id: studentData.id,
            balance: studentData.balance,
            user: studentData.user
              ? {
                  firstName: studentData.user.firstName,
                  lastName: studentData.user.lastName,
                  phone: studentData.user.phone ?? undefined,
                  email: studentData.user.email ?? undefined,
                }
              : undefined,
            parentName: studentData.parentName ?? undefined,
            parentPhone: studentData.parentPhone ?? undefined,
            birthDate: studentData.dateOfBirth ?? undefined,
            address: studentData.address ?? undefined,
            groupEnrollments: (studentData.groups ?? []).map((g) => ({
              group: g.group ? { id: g.group.id, name: g.group.name } : undefined,
            })),
          }}
        />
      )}

      {toastNode}
    </motion.div>
  );
}