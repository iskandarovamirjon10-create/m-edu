/**
 * M-EDU SettingsPage — v19 "Aurora Command Center"
 *
 * 🎯 v18 → v19 Complete Visual Rearchitecture:
 *  ✅ Split-Pane Layout — Sticky left nav rail + right content pane (macOS System Settings style).
 *  ✅ Aurora Backdrop — Fixed full-page atmospheric canvas with breathing orbs + grid.
 *  ✅ Scroll-Spy Navigation — Active nav item auto-highlights based on viewport position.
 *  ✅ Editorial Section Numbers — 01 → 07 ghost numerals on every section header.
 *  ✅ Floating Command Bar — Sticky pill: breadcrumb · account chip · ⌘K hint.
 *  ✅ iOS-Style Rows — Devices & whitelist as compact list rows (not nested cards).
 *  ✅ Inline Access Toggles — Platform switches as label/toggle rows (no bulky cards).
 *  ✅ Mobile-First — Nav rail becomes horizontal scroll pills on small screens.
 *  ✅ Preserved — All queries, mutations, forms, validation, a11y, and i18n intact.
 */

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { organizationsApi, usersApi, authApi } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import {
  GlassPageHeader,
  GlassErrorState,
  GlassField,
  GlassInput,
  GlassSelect,
  useToasts,
  GlassButton,
  GlassSwitch,
  ConfirmDialog,
  AcousticSoundStudio,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import { isPlatformRole } from '@/lib/roles';
import { TelegramIntegration } from '@/components/TelegramIntegration';
import type { Organization, User } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { useSafeI18n, isLocale } from '@/i18n/I18nProvider';
import { usePrefersReducedMotion } from '@/layouts/core/singletons';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 32, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.06 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS
 * ════════════════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  volume: [
    'M11 5L6 9H2v6h4l5 4V5z',
    'M15.54 8.46a5 5 0 0 1 0 7.07',
    'M19.07 4.93a10 10 0 0 1 0 14.14',
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  sun: [
    'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M12 1v2', 'M12 21v2',
    'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42',
    'M1 12h2', 'M21 12h2',
    'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42',
  ],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  oled: ['M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z', 'M12 2v20'],
  sepia: ['M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z', 'M6 6h10', 'M6 10h10'],
  monitor: [
    'M20 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
    'M8 21h8', 'M12 17v4',
  ],
  building: [
    'M3 21h18', 'M5 21V7l8-4v18', 'M19 21V11l-6-4',
    'M9 9v.01', 'M9 12v.01', 'M9 15v.01', 'M9 18v.01',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
  ],
  lock: [
    'M5 11h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z',
    'M7 11V7a5 5 0 0 1 10 0v4',
  ],
  telegram: [
    'M21.5 3.5 2.8 10.6l5.2 1.6 1.6 5.2 3-3.6 4.9 3.4z',
    'M8 12.2 16.9 6.4l-5 8.2',
  ],
  palette: [
    'M12 22a10 10 0 1 1 0-20c5.5 0 10 3.6 10 8 0 2.2-1.8 4-4 4h-1.5a1.5 1.5 0 0 0-1.06 2.56c.13.13.2.3.2.48C15.64 19.8 14.03 22 12 22z',
    'M6.5 11.5h.01', 'M9.5 8h.01', 'M14.5 8h.01', 'M17.5 11.5h.01',
  ],
  globe: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M2 12h20',
    'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  ],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  mail: [
    'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M22 6 12 13 2 6',
  ],
  phone: [
    'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z',
  ],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  check: ['M20 6 9 17l-5-5'],
  eye: [
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  eyeOff: [
    'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94',
    'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19',
    'M14.12 14.12a3 3 0 1 1-4.24-4.24',
    'M1 1l22 22',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  key: [
    'M21 2l-2 2',
    'M15.5 7.5l3 3L22 7l-3-3z',
    'M15.5 7.5 9 14a3.5 3.5 0 1 1-3-3l6.5-6.5',
  ],
  save: [
    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
    'M17 21v-8H7v8', 'M7 3v5h8',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  ],
  laptop: [
    'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z',
    'M2 18h20v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1z',
  ],
  smartphone: [
    'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z',
    'M11 18h2',
  ],
  logOut: [
    'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
    'M16 17l5-5-5-5',
    'M21 12H9',
  ],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  userCheck: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M17 11l2 2 4-4',
  ],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  alert: [
    'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
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

function getDeviceIcon(deviceType?: string, os?: string) {
  if (deviceType === 'mobile' || (os && /iOS|Android/i.test(os))) return I.smartphone;
  if (deviceType === 'tablet' || (os && /iPad/i.test(os))) return I.smartphone;
  return I.laptop;
}

/* ══════════════════════════════════════════════════════════════════════════
 * TONE PALETTE
 * ════════════════════════════════════════════════════════════════════════ */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate' | 'amber';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)',  glow: 'rgba(37,99,235,0.28)',  border: 'rgba(37,99,235,0.20)'  },
  green:  { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
  orange: { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.28)', border: 'rgba(245,158,11,0.20)' },
  red:    { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',  glow: 'rgba(239,68,68,0.28)',  border: 'rgba(239,68,68,0.20)'  },
  purple: { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)', glow: 'rgba(99,102,241,0.28)', border: 'rgba(99,102,241,0.20)' },
  slate:  { fg: '#0F172A', bg: 'rgba(15,23,42,0.10)',  glow: 'rgba(15,23,42,0.32)',  border: 'rgba(15,23,42,0.25)'  },
  amber:  { fg: '#B45309', bg: 'rgba(180,83,9,0.10)',  glow: 'rgba(180,83,9,0.28)',  border: 'rgba(180,83,9,0.22)'  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES & CONSTANTS
 * ════════════════════════════════════════════════════════════════════════ */

interface OrgFormState {
  name: string;
  email: string;
  phone: string;
}

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirm: string;
}

interface SettingsFormState {
  language: string;
  timezone: string;
}

const INITIAL_PASSWORD_FORM: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirm: '',
};

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Asia/Tashkent', label: 'Asia/Tashkent' },
  { value: 'America/New_York', label: 'America/New_York' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'uz', label: 'O\'zbekcha' },
  { value: 'ru', label: 'Русский' },
];

/* ══════════════════════════════════════════════════════════════════════════
 * PASSWORD UTILS
 * ════════════════════════════════════════════════════════════════════════ */

function validatePassword(password: string): string | undefined {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return undefined;
}

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  tone: Tone;
}

function getPasswordStrength(pwd: string): PasswordStrength {
  if (!pwd) return { score: 0, label: '', tone: 'red' };
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  const score = Math.min(4, s) as PasswordStrength['score'];
  const map: Record<number, { label: string; tone: Tone }> = {
    0: { label: 'settings.password.tooWeak', tone: 'red' },
    1: { label: 'settings.password.weak', tone: 'red' },
    2: { label: 'settings.password.fair', tone: 'orange' },
    3: { label: 'settings.password.good', tone: 'blue' },
    4: { label: 'settings.password.strong', tone: 'green' },
  };
  return { score, ...map[score] };
}

/* ══════════════════════════════════════════════════════════════════════════
 * AVATAR HELPERS
 * ════════════════════════════════════════════════════════════════════════ */

const AVATAR_PALETTES: ReadonlyArray<readonly [string, string]> = [
  ['#2563EB', '#6366F1'],
  ['#6366F1', '#FF2D55'],
  ['#10B981', '#0284C7'],
  ['#F59E0B', '#FF2D55'],
];

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
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

/* ══════════════════════════════════════════════════════════════════════════
 * AURORA BACKDROP — full-page atmospheric canvas
 * ════════════════════════════════════════════════════════════════════════ */

function AuroraBackdrop() {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-[#04060C] dark:via-[#0A0F1A] dark:to-[#080A14]" />
      <div className="absolute -left-40 -top-40 h-[580px] w-[580px] rounded-full bg-blue-400/10 blur-[140px] dark:bg-sky-500/10" />
      <div className="absolute -right-32 top-1/3 h-[520px] w-[520px] rounded-full bg-violet-400/10 blur-[140px] dark:bg-violet-500/10" />
      <div className="absolute -bottom-32 left-1/3 h-[460px] w-[460px] rounded-full bg-emerald-400/08 blur-[140px] dark:bg-emerald-500/08" />
      {!reduced && (
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.55, 0.85, 0.55] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/2 h-[700px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/[0.03] via-violet-500/[0.02] to-emerald-500/[0.03] blur-[160px]"
        />
      )}
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
 * SCROLL SPY HOOK
 * ════════════════════════════════════════════════════════════════════════ */

function useScrollSpy(ids: string[]) {
  const [activeId, setActiveId] = useState(ids[0] || '');

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActiveId(id);
          });
        },
        { rootMargin: '-100px 0px -60% 0px', threshold: 0 },
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [ids.join('|')]);

  return activeId;
}

/* ══════════════════════════════════════════════════════════════════════════
 * SETTINGS SECTION — editorial numbered card
 * ════════════════════════════════════════════════════════════════════════ */

function SettingsSection({
  id,
  number,
  title,
  subtitle,
  icon,
  tone = 'blue',
  footer,
  children,
}: {
  id: string;
  number: string;
  title: string;
  subtitle?: string;
  icon: string[];
  tone?: Tone;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const c = TONES[tone];
  return (
    <motion.section
      id={id}
      variants={cardVariants}
      className="relative scroll-mt-32 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/[0.18]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-8 left-0 w-px bg-gradient-to-b from-transparent via-blue-400/12 to-transparent dark:via-sky-400/18"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-8 right-0 w-px bg-gradient-to-b from-transparent via-violet-400/12 to-transparent dark:via-violet-400/18"
      />

      <header className="flex items-center gap-3.5 border-b border-slate-200/70 px-5 py-4 dark:border-white/[0.06]">
        <span
          className="text-[26px] font-black leading-none tracking-[-0.02em] tabular-nums text-slate-900/15 dark:text-white/[0.12]"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {number}
        </span>
        <div
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.55), 0 4px 12px -6px ${c.glow}`,
          }}
        >
          <Icon paths={icon} size={15} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14.5px] font-bold tracking-tight text-[var(--text-primary)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11.5px] font-medium text-[var(--text-muted)]">
              {subtitle}
            </p>
          )}
        </div>
      </header>

      <div className="p-5">{children}</div>

      {footer && (
        <footer className="flex items-center justify-end border-t border-slate-200/70 px-5 py-3.5 dark:border-white/[0.06]">
          {footer}
        </footer>
      )}
    </motion.section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * NAV RAIL
 * ════════════════════════════════════════════════════════════════════════ */

interface NavItem {
  id: string;
  label: string;
  icon: string[];
  tone: Tone;
  number: string;
}

function NavRail({
  items,
  activeId,
  onJump,
}: {
  items: NavItem[];
  activeId: string;
  onJump: (id: string) => void;
}) {
  return (
    <nav aria-label="Sozlamalar navigatsiyasi" className="space-y-1">
      {items.map((item) => {
        const active = item.id === activeId;
        const c = TONES[item.tone];
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onJump(item.id)}
            className={[
              'group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-all',
              active
                ? 'bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_14px_-4px_rgba(15,23,42,0.10)] dark:bg-white/[0.08]'
                : 'hover:bg-white/60 dark:hover:bg-white/[0.04]',
            ].join(' ')}
          >
            {active && (
              <motion.span
                layoutId="nav-active-indicator"
                transition={SPRING.snappy}
                className="absolute inset-y-1.5 left-0 w-1 rounded-r-full"
                style={{
                  background: c.fg,
                  boxShadow: `0 0 8px ${c.glow}`,
                }}
              />
            )}
            <span
              className={[
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all',
                active ? '' : 'opacity-70',
              ].join(' ')}
              style={
                active
                  ? { background: c.bg, color: c.fg }
                  : { background: 'rgba(0,0,0,0.035)', color: '#64748B' }
              }
            >
              <Icon paths={item.icon} size={13} strokeWidth={2.2} />
            </span>
            <span
              className={[
                'flex-1 truncate text-[12.5px] font-semibold transition-colors',
                active
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {item.label}
            </span>
            <span className="shrink-0 text-[10px] font-bold tabular-nums text-[var(--text-muted)] opacity-50">
              {item.number}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * THEME SWITCHER
 * ════════════════════════════════════════════════════════════════════════ */

function ThemeSwitcher() {
  const { t } = useSafeI18n();
  const { theme, setTheme } = useTheme();
  const persist = usePersistSettings();

  const choose = useCallback(
    (next: Theme) => {
      setTheme(next);
      persist({ theme: next });
    },
    [setTheme, persist],
  );

  const options: { value: Theme; label: string; desc: string; icon: string[]; tone: Tone }[] = useMemo(
    () => [
      { value: 'light', label: t('settings.themeLight'), desc: 'Alabaster', icon: I.sun, tone: 'orange' },
      { value: 'dark', label: t('settings.themeDark'), desc: 'Sapphire', icon: I.moon, tone: 'purple' },
      { value: 'oled', label: t('settings.themeOled'), desc: 'Pure 0% Black', icon: I.oled, tone: 'slate' },
      { value: 'sepia', label: t('settings.themeSepia'), desc: 'Parchment', icon: I.sepia, tone: 'amber' },
      { value: 'system', label: t('common.system'), desc: 'Auto OS Sync', icon: I.monitor, tone: 'blue' },
    ],
    [t],
  );

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
      role="radiogroup"
      aria-label={t('a11y.themeSelection')}
    >
      {options.map((opt) => {
        const active = theme === opt.value;
        const c = TONES[opt.tone];
        return (
          <motion.button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(opt.value)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING.snappy}
            className="relative flex flex-col items-center gap-1.5 overflow-hidden rounded-2xl border px-3 py-3.5 outline-none transition-all"
            style={{
              borderColor: active ? c.border : 'rgba(15,23,42,0.08)',
              background: active ? c.bg : 'rgba(255,255,255,0.45)',
              boxShadow: active
                ? `inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 20px -10px ${c.glow}`
                : 'none',
            }}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
              style={{
                background: active ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.04)',
                color: active ? c.fg : '#64748B',
              }}
            >
              <Icon paths={opt.icon} size={18} strokeWidth={2} />
            </span>
            <span
              className="text-[12px] font-bold tracking-tight text-center"
              style={{ color: active ? c.fg : '#64748B' }}
            >
              {opt.label}
            </span>
            <span
              className="text-[10px] font-medium opacity-70 tracking-tight text-center"
              style={{ color: active ? c.fg : '#94A3B8' }}
            >
              {opt.desc}
            </span>
            <AnimatePresence>
              {active && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={SPRING.snappy}
                  className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full text-white"
                  style={{ background: c.fg }}
                  aria-hidden="true"
                >
                  <Icon paths={I.check} size={10} strokeWidth={3} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * PASSWORD INPUT
 * ════════════════════════════════════════════════════════════════════════ */

function PasswordInput({
  value,
  onChange,
  autoComplete,
  disabled,
  invalid,
  describedBy,
  ariaLabel,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <GlassInput
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        className="pr-10"
      />
      <motion.button
        type="button"
        onClick={() => setShow((v) => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={SPRING.snappy}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] hover:bg-black/[0.04] hover:text-[#1D1D1F] dark:hover:bg-white/[0.06] dark:hover:text-[#F5F5F7]"
      >
        <Icon paths={show ? I.eyeOff : I.eye} size={14} strokeWidth={2} />
      </motion.button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * PASSWORD STRENGTH METER
 * ════════════════════════════════════════════════════════════════════════ */

function PasswordStrengthMeter({ value }: { value: string }) {
  const { t } = useSafeI18n();
  const { score, label, tone } = getPasswordStrength(value);
  const translatedLabel = t(label) || label;
  const c = TONES[tone];

  return (
    <AnimatePresence initial={false}>
      {value.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={SPRING.smooth}
          className="mt-2 overflow-hidden"
        >
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => {
                const active = i < score;
                return (
                  <motion.span
                    key={i}
                    className="h-1 flex-1 rounded-full"
                    animate={{
                      backgroundColor: active ? c.fg : 'rgba(0,0,0,0.08)',
                    }}
                    transition={{ duration: 0.25 }}
                  />
                );
              })}
            </div>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ color: c.fg }}
            >
              {translatedLabel}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * SKELETON
 * ════════════════════════════════════════════════════════════════════════ */

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`skeleton-shimmer relative overflow-hidden border border-white/60 dark:border-white/[0.06] ${className}`}
      style={{ borderRadius: radius }}
    />
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="space-y-3">
        <Shimmer className="h-[88px] w-full" radius="1rem" />
        <Shimmer className="h-[280px] w-full" radius="1rem" />
      </div>
      <div className="space-y-5">
        <Shimmer className="h-[180px] w-full" radius="1rem" />
        <Shimmer className="h-[220px] w-full" radius="1rem" />
        <Shimmer className="h-[240px] w-full" radius="1rem" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN PAGE
 * ════════════════════════════════════════════════════════════════════════ */

export function SettingsPage() {
  const { setLocale, locale, t } = useSafeI18n();
  usePageTitle(t('settings.title'));
  const { push, toastNode } = useToasts();
  const { user, setUser, hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole('SUPER_ADMIN', 'ORG_ADMIN');
  const isPlatformAdmin = isPlatformRole(user?.role);
  const qc = useQueryClient();

  const [orgForm, setOrgForm] = useState<OrgFormState | null>(null);
  const [orgErrors, setOrgErrors] = useState<Partial<Record<keyof OrgFormState, string>>>({});
  const [pwdForm, setPwdForm] = useState<PasswordFormState>(INITIAL_PASSWORD_FORM);
  const [pwdErrors, setPwdErrors] = useState<Partial<Record<keyof PasswordFormState, string>>>({});
  const [confirmRevokeOthersOpen, setConfirmRevokeOthersOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>({
    language: locale,
    timezone: user?.settings?.timezone || 'UTC',
  });

  /* ── Server language adoption ───────────────────────────────── */
  const adoptedServerLang = useRef(false);
  useEffect(() => {
    if (adoptedServerLang.current) return;
    const lang = user?.settings?.language;
    if (!lang || !isLocale(lang)) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem('medu-lang');
    } catch {
      stored = null;
    }
    if (stored) {
      adoptedServerLang.current = true;
      return;
    }
    adoptedServerLang.current = true;
    setLocale(lang);
    setSettingsForm((prev) => ({ ...prev, language: lang }));
  }, [user?.settings?.language, setLocale]);

  useEffect(() => {
    setSettingsForm((prev) =>
      prev.language === locale ? prev : { ...prev, language: locale },
    );
  }, [locale]);

  useEffect(() => {
    if (user?.settings) {
      setSettingsForm((prev) => ({
        language: locale,
        timezone: user.settings?.timezone || prev.timezone,
      }));
    }
  }, [user, locale]);

  /* ── Org query ─────────────────────────────────────────────── */
  const org = useQuery({
    queryKey: ['org-me'],
    queryFn: organizationsApi.me,
    enabled: isAdmin,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (org.data && !orgForm) {
      const orgData = org.data as Organization;
      setOrgForm({
        name: orgData.name,
        email: orgData.email,
        phone: orgData.phone || '',
      });
    }
  }, [org.data, orgForm]);

  /* ── Mutations ─────────────────────────────────────────────── */
  const saveOrg = useMutation({
    mutationFn: () => {
      if (!orgForm) throw new Error('Organization form not initialized');
      return organizationsApi.update(orgForm);
    },
    onSuccess: async () => {
      push('success', t('settings.orgUpdated'));
      qc.invalidateQueries({ queryKey: ['org-me'] });
      try {
        const me = (await authApi.me()) as User;
        setUser(me);
      } catch {
        /* noop */
      }
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      usersApi.changePassword({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      }),
    onSuccess: () => {
      push('success', t('settings.passwordChanged'));
      setPwdForm(INITIAL_PASSWORD_FORM);
      setPwdErrors({});
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const saveSettings = useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error('User not authenticated');
      return usersApi.updateSettings(user.id, settingsForm);
    },
    onSuccess: () => {
      push('success', t('settings.saved'));
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      qc.invalidateQueries({ queryKey: ['user', 'settings'] });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ── Whitelist ─────────────────────────────────────────────── */
  const whitelistQuery = useQuery({
    queryKey: ['access-whitelist'],
    queryFn: authApi.getWhitelist,
    enabled: isAdmin,
  });

  const [newWhitelistEmail, setNewWhitelistEmail] = useState('');
  const [newWhitelistNote, setNewWhitelistNote] = useState('');

  const addWhitelistMutation = useMutation({
    mutationFn: (data: { email: string; note?: string }) => authApi.addToWhitelist(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-whitelist'] });
      setNewWhitelistEmail('');
      setNewWhitelistNote('');
      push('success', t('settings.whitelist.addedSuccess'));
    },
    onError: (err) => push('error', getErrorMessage(err as Error)),
  });

  const removeWhitelistMutation = useMutation({
    mutationFn: (id: string) => authApi.removeFromWhitelist(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-whitelist'] });
      push('success', t('settings.whitelist.removedSuccess'));
    },
    onError: (err) => push('error', getErrorMessage(err as Error)),
  });

  const approveUserMutation = useMutation({
    mutationFn: (id: string) => authApi.approveUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-whitelist'] });
      push('success', t('settings.whitelist.approvedSuccess'));
    },
    onError: (err) => push('error', getErrorMessage(err as Error)),
  });

  const rejectUserMutation = useMutation({
    mutationFn: (id: string) => authApi.rejectUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-whitelist'] });
      push('success', t('settings.whitelist.rejectedSuccess'));
    },
    onError: (err) => push('error', getErrorMessage(err as Error)),
  });

  const updateAccessSettingsMutation = useMutation({
    mutationFn: (settings: { inviteOnly?: boolean; requireApproval?: boolean }) =>
      authApi.updateAccessSettings(settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-whitelist'] });
      push('success', t('settings.whitelist.settingsUpdated'));
    },
    onError: (err) => push('error', getErrorMessage(err as Error)),
  });

  /* ── Sessions ──────────────────────────────────────────────── */
  const sessionsQuery = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: authApi.getSessions,
    refetchInterval: 30000,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      push('success', t('settings.devices.sessionRevoked', 'Qurilma sessiyasi yakunlandi'));
    },
    onError: (err) => push('error', getErrorMessage(err as Error)),
  });

  const revokeOtherSessionsMutation = useMutation({
    mutationFn: () => authApi.revokeOtherSessions(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      push(
        'success',
        t('settings.devices.otherSessionsRevoked', `Boshqa qurilmalar yakunlandi (${data.revokedCount} ta)`),
      );
    },
    onError: (err) => push('error', getErrorMessage(err as Error)),
  });

  /* ── Validators ────────────────────────────────────────────── */
  const validateOrgForm = useCallback((): boolean => {
    if (!orgForm) return false;
    const errors: Partial<Record<keyof OrgFormState, string>> = {};
    if (!orgForm.name.trim()) errors.name = t('settings.orgNameRequired');
    if (!orgForm.email.trim()) errors.email = t('settings.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgForm.email.trim()))
      errors.email = t('common.emailInvalid');
    setOrgErrors(errors);
    return Object.keys(errors).length === 0;
  }, [orgForm, t]);

  const validatePasswordForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof PasswordFormState, string>> = {};
    if (!pwdForm.currentPassword) errors.currentPassword = t('settings.currentPasswordRequired');
    const passwordError = validatePassword(pwdForm.newPassword);
    if (passwordError) errors.newPassword = passwordError;
    if (pwdForm.newPassword !== pwdForm.confirm) errors.confirm = t('auth.passwordsDoNotMatch');
    setPwdErrors(errors);
    return Object.keys(errors).length === 0;
  }, [pwdForm, t]);

  /* ── Handlers ──────────────────────────────────────────────── */
  const handleOrgChange = useCallback(
    (field: keyof OrgFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setOrgForm((prev) => (prev ? { ...prev, [field]: e.target.value } : prev));
      setOrgErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [],
  );

  const handlePwdChange = useCallback(
    (field: keyof PasswordFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setPwdForm((prev) => ({ ...prev, [field]: e.target.value }));
      setPwdErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [],
  );

  const handleSettingsChange = useCallback(
    (field: keyof SettingsFormState) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      setSettingsForm((prev) => ({ ...prev, [field]: value }));
      if (field === 'language' && isLocale(value)) {
        setLocale(value);
      }
    },
    [setLocale],
  );

  const handleOrgSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateOrgForm()) return;
      saveOrg.mutate();
    },
    [validateOrgForm, saveOrg],
  );

  const handlePasswordSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validatePasswordForm()) return;
      changePassword.mutate();
    },
    [validatePasswordForm, changePassword],
  );

  const handleSettingsSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      saveSettings.mutate();
    },
    [saveSettings],
  );

  const { refetch: refetchOrg } = org;
  const handleRetry = useCallback(() => void refetchOrg(), [refetchOrg]);

  /* ── Derived ───────────────────────────────────────────────── */
  const displayName = useMemo(() => {
    if (!user) return '—';
    const fn = user.firstName || '';
    const ln = user.lastName || '';
    const full = `${fn} ${ln}`.trim();
    return full || user.email || '—';
  }, [user]);

  const displayRole = useMemo(() => {
    if (!user?.role) return 'User';
    return user.role.replace(/_/g, ' ');
  }, [user]);

  /* ── Sections & scroll spy ─────────────────────────────────── */
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { id: 'section-appearance', number: '01', label: t('settings.appearance'), icon: I.palette, tone: 'purple' },
      { id: 'section-sound',      number: '02', label: 'Ovoz va Akustika',       icon: I.volume,  tone: 'purple' },
      { id: 'section-account',    number: '03', label: t('settings.account'),    icon: I.user,    tone: 'green'  },
      { id: 'section-security',   number: '04', label: t('settings.changePassword'), icon: I.lock, tone: 'red'   },
      { id: 'section-devices',    number: '05', label: t('settings.devices.title', 'Qurilmalar'), icon: I.laptop, tone: 'blue' },
      { id: 'section-telegram',   number: '06', label: t('settings.telegram.title'), icon: I.telegram, tone: 'blue' },
    ];
    if (isAdmin) {
      items.push({ id: 'section-organization', number: '07', label: t('settings.organization'), icon: I.building, tone: 'orange' });
      items.push({ id: 'section-access',       number: '08', label: t('settings.accessControl.title'), icon: I.shield, tone: 'blue' });
    }
    return items;
  }, [t, isAdmin]);

  const sectionIds = useMemo(() => navItems.map((i) => i.id), [navItems]);
  const activeId = useScrollSpy(sectionIds);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  /* ── Loading ───────────────────────────────────────────────── */
  if (isAdmin && org.isLoading && !org.data) {
    return (
      <div className="page-container relative z-10 mx-auto max-w-6xl">
        <AuroraBackdrop />
        <div className="mb-6 h-16" />
        <SettingsSkeleton />
      </div>
    );
  }

  /* ── Error ─────────────────────────────────────────────────── */
  if (isAdmin && org.isError) {
    return (
      <div className="page-container relative z-10 mx-auto max-w-3xl space-y-5">
        <AuroraBackdrop />
        <GlassPageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
        <div className="rounded-2xl border border-black/[0.06] bg-white/80 p-8 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card">
          <GlassErrorState
            title={t('settings.loadFailed')}
            message={getErrorMessage(org.error as Error)}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  /* ── Main Render ───────────────────────────────────────────── */
  return (
    <div className="page-container relative z-10 mx-auto max-w-6xl pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraBackdrop />

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
        {/* ═══ FLOATING COMMAND BAR ═══ */}
        <motion.div variants={cardVariants} className="sticky top-4 z-30 mt-4">
          <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/80 px-3 py-2.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-sm"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#6366F1] text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.5)]"
            >
              <Icon paths={I.settings} size={16} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <span>M-EDU</span>
                <span className="opacity-50">/</span>
                <span className="text-[#2563EB] dark:text-[#38BDF8]">Settings</span>
              </div>
              <h1 className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
                {t('settings.title')}
              </h1>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Online
                </span>
              </span>
            </div>
          </div>
        </motion.div>

        {/* ═══ SPLIT PANE ═══ */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          {/* ── NAV RAIL ── */}
          <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
            <div className="space-y-3">
              {/* Profile card */}
              <div
                className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-white shadow-md ring-2 ring-white/50 dark:ring-slate-900/50"
                    style={{
                      background: avatarGradient(displayName),
                      fontSize: '13px',
                    }}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.4),transparent_55%)]"
                    />
                    <span className="relative">{getInitials(displayName)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
                      {displayName}
                    </p>
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      {displayRole}
                    </p>
                  </div>
                </div>
              </div>

              {/* Nav items */}
              <div
                className="rounded-2xl border border-slate-200/85 bg-white/72 p-2 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03]"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)' }}
              >
                <NavRail items={navItems} activeId={activeId} onJump={scrollTo} />
              </div>
            </div>
          </aside>

          {/* ── CONTENT ── */}
          <div className="min-w-0 space-y-5">
            {/* Mobile nav */}
            <div className="lg:hidden">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {navItems.map((item) => {
                  const active = item.id === activeId;
                  const c = TONES[item.tone];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollTo(item.id)}
                      className={[
                        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-all',
                        active
                          ? 'shadow-sm'
                          : 'border border-slate-200/80 bg-white/60 text-[var(--text-secondary)] dark:border-white/[0.08] dark:bg-white/[0.04]',
                      ].join(' ')}
                      style={
                        active
                          ? {
                              background: c.bg,
                              color: c.fg,
                              border: `1px solid ${c.border}`,
                            }
                          : undefined
                      }
                    >
                      <Icon paths={item.icon} size={12} strokeWidth={2.2} />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ═══ SECTIONS ═══ */}

            {/* 01 · Appearance */}
            <SettingsSection
              id="section-appearance"
              number="01"
              title={t('settings.appearance')}
              subtitle={t('settings.appearanceHint')}
              icon={I.palette}
              tone="purple"
            >
              <div className="space-y-3">
                <p className="text-[12px] font-medium text-[var(--text-muted)]">
                  {t('settings.themeHint')}
                </p>
                <ThemeSwitcher />
              </div>
            </SettingsSection>

            {/* 02 · Sound & Acoustics */}
            <SettingsSection
              id="section-sound"
              number="02"
              title="Ovoz va Akustika"
              subtitle="Apple VisionOS va Taptic standartidagi fazoviy mikro-tovushlar va haptik effektlar"
              icon={I.volume}
              tone="purple"
            >
              <AcousticSoundStudio />
            </SettingsSection>

            {/* 03 · Account */}
            <SettingsSection
              id="section-account"
              number="03"
              title={t('settings.account')}
              subtitle={t('settings.accountHint')}
              icon={I.user}
              tone="green"
            >
              <form onSubmit={handleSettingsSubmit} noValidate className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <GlassField label={t('settings.language')}>
                    <GlassSelect
                      value={settingsForm.language}
                      onChange={handleSettingsChange('language')}
                      aria-label={t('settings.language')}
                      disabled={saveSettings.isPending}
                    >
                      {LANGUAGES.map((language) => (
                        <option key={language.value} value={language.value}>
                          {language.label}
                        </option>
                      ))}
                    </GlassSelect>
                  </GlassField>

                  <GlassField label={t('settings.timezone')}>
                    <GlassSelect
                      value={settingsForm.timezone}
                      onChange={handleSettingsChange('timezone')}
                      aria-label={t('settings.timezone')}
                      disabled={saveSettings.isPending}
                    >
                      {TIMEZONES.map((timezone) => (
                        <option key={timezone.value} value={timezone.value}>
                          {timezone.label}
                        </option>
                      ))}
                    </GlassSelect>
                  </GlassField>
                </div>

                <div className="flex justify-end pt-1">
                  <GlassButton type="submit" variant="primary" disabled={saveSettings.isPending}>
                    <span className="inline-flex items-center gap-2">
                      {saveSettings.isPending ? (
                        <>
                          <motion.span
                            className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                          />
                          {t('common.saving')}
                        </>
                      ) : (
                        <>
                          <Icon paths={I.check} size={14} strokeWidth={2.5} />
                          {t('settings.save')}
                        </>
                      )}
                    </span>
                  </GlassButton>
                </div>
              </form>
            </SettingsSection>

            {/* 04 · Security */}
            <SettingsSection
              id="section-security"
              number="04"
              title={t('settings.changePassword')}
              subtitle={t('settings.changePasswordHint')}
              icon={I.lock}
              tone="red"
            >
              <form onSubmit={handlePasswordSubmit} noValidate className="space-y-4">
                <GlassField
                  label={t('settings.currentPassword')}
                  required
                  error={pwdErrors.currentPassword}
                >
                  <PasswordInput
                    value={pwdForm.currentPassword}
                    onChange={handlePwdChange('currentPassword')}
                    autoComplete="current-password"
                    disabled={changePassword.isPending}
                    invalid={Boolean(pwdErrors.currentPassword)}
                    describedBy={pwdErrors.currentPassword ? 'current-password-error' : undefined}
                    ariaLabel={t('settings.currentPassword')}
                  />
                  {pwdErrors.currentPassword && (
                    <span
                      id="current-password-error"
                      className="mt-1 text-xs"
                      style={{ color: 'var(--state-error)' }}
                    >
                      {pwdErrors.currentPassword}
                    </span>
                  )}
                </GlassField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <GlassField
                    label={t('settings.newPassword')}
                    required
                    error={pwdErrors.newPassword}
                  >
                    <PasswordInput
                      value={pwdForm.newPassword}
                      onChange={handlePwdChange('newPassword')}
                      autoComplete="new-password"
                      disabled={changePassword.isPending}
                      invalid={Boolean(pwdErrors.newPassword)}
                      describedBy={pwdErrors.newPassword ? 'new-password-error' : undefined}
                      ariaLabel={t('settings.newPassword')}
                    />
                    {pwdErrors.newPassword && (
                      <span
                        id="new-password-error"
                        className="mt-1 text-xs"
                        style={{ color: 'var(--state-error)' }}
                      >
                        {pwdErrors.newPassword}
                      </span>
                    )}
                    <PasswordStrengthMeter value={pwdForm.newPassword} />
                  </GlassField>

                  <GlassField
                    label={t('settings.confirmPassword')}
                    required
                    error={pwdErrors.confirm}
                  >
                    <PasswordInput
                      value={pwdForm.confirm}
                      onChange={handlePwdChange('confirm')}
                      autoComplete="new-password"
                      disabled={changePassword.isPending}
                      invalid={Boolean(pwdErrors.confirm)}
                      describedBy={pwdErrors.confirm ? 'confirm-password-error' : undefined}
                      ariaLabel={t('settings.confirmPassword')}
                    />
                    {pwdErrors.confirm && (
                      <span
                        id="confirm-password-error"
                        className="mt-1 text-xs"
                        style={{ color: 'var(--state-error)' }}
                      >
                        {pwdErrors.confirm}
                      </span>
                    )}
                  </GlassField>
                </div>

                <div className="flex justify-end pt-1">
                  <GlassButton
                    type="submit"
                    variant="primary"
                    disabled={changePassword.isPending}
                  >
                    <span className="inline-flex items-center gap-2">
                      {changePassword.isPending ? (
                        <>
                          <motion.span
                            className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                          />
                          {t('common.saving')}
                        </>
                      ) : (
                        <>
                          <Icon paths={I.key} size={14} strokeWidth={2.2} />
                          {t('settings.changePasswordAction')}
                        </>
                      )}
                    </span>
                  </GlassButton>
                </div>
              </form>
            </SettingsSection>

            {/* 05 · Devices */}
            <SettingsSection
              id="section-devices"
              number="05"
              title={t('settings.devices.title', 'Faol qurilmalar')}
              subtitle={t('settings.devices.subtitle', 'Bitta hisob ostida ulangan barcha qurilmalar')}
              icon={I.laptop}
              tone="blue"
              footer={
                (sessionsQuery.data?.length ?? 0) > 1 ? (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
                      {t('settings.devices.syncActive', 'Real-vaqt sinxronizatsiyasi faol')}
                    </span>
                    <GlassButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      disabled={revokeOtherSessionsMutation.isPending}
                      onClick={() => setConfirmRevokeOthersOpen(true)}
                    >
                      <Icon paths={I.logOut} size={13} className="mr-1.5" />
                      {revokeOtherSessionsMutation.isPending
                        ? t('common.saving')
                        : t('settings.devices.revokeOthers', 'Boshqa qurilmalardan chiqish')}
                    </GlassButton>
                  </div>
                ) : undefined
              }
            >
              <div>
                {sessionsQuery.isLoading ? (
                  <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                    {t('common.loading', 'Yuklanmoqda…')}
                  </div>
                ) : (sessionsQuery.data?.length ?? 0) === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300/80 py-6 text-center text-xs text-[var(--text-muted)] dark:border-white/[0.10]">
                    {t('settings.devices.noSessions', 'Faol sessiyalar topilmadi')}
                  </div>
                ) : (
                  <div className="-mx-2 divide-y divide-slate-200/70 dark:divide-white/[0.06]">
                    {sessionsQuery.data?.map((session) => {
                      const isCurrent = session.isCurrentSession;
                      const iconPaths = getDeviceIcon(session.deviceType, session.os);
                      return (
                        <div
                          key={session.id}
                          className="flex flex-col gap-3 px-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div
                              className={[
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                isCurrent
                                  ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-slate-500/[0.08] text-[var(--text-secondary)]',
                              ].join(' ')}
                            >
                              <Icon paths={iconPaths} size={18} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-[13px] text-[var(--text-primary)]">
                                  {session.deviceName || session.browser || 'Noma\'lum qurilma'}
                                </span>
                                {isCurrent && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                    {t('settings.devices.currentBadge', 'Joriy')}
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                <span>{session.browser || 'Brauzer'} · {session.os || 'OS'}</span>
                                <span className="opacity-40">·</span>
                                <span className="font-mono">{session.ipAddress}</span>
                              </div>
                              <div className="mt-0.5 text-[10.5px] text-[var(--text-muted)]">
                                {t('settings.devices.lastActive', 'Oxirgi faollik:')}{' '}
                                {session.lastActiveAt
                                  ? new Date(session.lastActiveAt).toLocaleString()
                                  : new Date(session.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>

                          {!isCurrent && (
                            <div className="self-end sm:self-center">
                              <GlassButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                disabled={revokeSessionMutation.isPending}
                                onClick={() => revokeSessionMutation.mutate(session.id)}
                              >
                                <Icon paths={I.trash} size={13} className="mr-1" />
                                {t('settings.devices.revoke', 'Chiqarish')}
                              </GlassButton>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </SettingsSection>

            {/* 06 · Telegram */}
            <SettingsSection
              id="section-telegram"
              number="06"
              title={t('settings.telegram.title')}
              subtitle={t('settings.telegram.subtitle')}
              icon={I.telegram}
              tone="blue"
            >
              <TelegramIntegration />
            </SettingsSection>

            {/* 07 · Organization (admin) */}
            {isAdmin && (
              <SettingsSection
                id="section-organization"
                number="07"
                title={t('settings.organization')}
                subtitle={t('settings.organizationHint')}
                icon={I.building}
                tone="orange"
              >
                {orgForm && (
                  <form onSubmit={handleOrgSubmit} noValidate className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <GlassField label={t('settings.orgName')} required error={orgErrors.name}>
                        <GlassInput
                          value={orgForm.name}
                          onChange={handleOrgChange('name')}
                          required
                          aria-invalid={Boolean(orgErrors.name)}
                          aria-describedby={orgErrors.name ? 'org-name-error' : undefined}
                          disabled={saveOrg.isPending}
                        />
                        {orgErrors.name && (
                          <span
                            id="org-name-error"
                            className="mt-1 text-xs"
                            style={{ color: 'var(--state-error)' }}
                          >
                            {orgErrors.name}
                          </span>
                        )}
                      </GlassField>

                      <GlassField
                        label={t('settings.contactEmail')}
                        required
                        error={orgErrors.email}
                      >
                        <GlassInput
                          type="email"
                          value={orgForm.email}
                          onChange={handleOrgChange('email')}
                          required
                          aria-invalid={Boolean(orgErrors.email)}
                          aria-describedby={orgErrors.email ? 'org-email-error' : undefined}
                          disabled={saveOrg.isPending}
                        />
                        {orgErrors.email && (
                          <span
                            id="org-email-error"
                            className="mt-1 text-xs"
                            style={{ color: 'var(--state-error)' }}
                          >
                            {orgErrors.email}
                          </span>
                        )}
                      </GlassField>

                      <GlassField label={t('settings.phone')}>
                        <GlassInput
                          type="tel"
                          value={orgForm.phone}
                          onChange={handleOrgChange('phone')}
                          disabled={saveOrg.isPending}
                        />
                      </GlassField>
                    </div>

                    <div className="flex justify-end pt-1">
                      <GlassButton type="submit" variant="primary" disabled={saveOrg.isPending}>
                        <span className="inline-flex items-center gap-2">
                          <Icon paths={I.save} size={14} strokeWidth={2} />
                          {saveOrg.isPending ? t('common.saving') : t('settings.saveOrg')}
                        </span>
                      </GlassButton>
                    </div>
                  </form>
                )}
              </SettingsSection>
            )}

            {/* 08 · Access Control (admin) */}
            {isAdmin && (
              <SettingsSection
                id="section-access"
                number="08"
                title={t('settings.accessControl.title')}
                subtitle={t('settings.accessControl.subtitle')}
                icon={I.shield}
                tone="blue"
              >
                <div className="space-y-6">
                  {/* Platform toggles */}
                  {isPlatformAdmin && (
                    <div className="overflow-hidden rounded-xl border border-slate-200/85 dark:border-white/[0.08]">
                      <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 bg-white/40 px-4 py-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-bold text-[var(--text-primary)]">
                            {t('settings.accessControl.inviteOnly')}
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                            {t('settings.accessControl.inviteOnlyDesc')}
                          </p>
                        </div>
                        <GlassSwitch
                          id="inviteOnlyToggle"
                          aria-label={t('settings.inviteOnlyMode')}
                          checked={Boolean(whitelistQuery.data?.settings?.inviteOnly)}
                          disabled={updateAccessSettingsMutation.isPending || whitelistQuery.isLoading}
                          onChange={(checked) =>
                            updateAccessSettingsMutation.mutate({ inviteOnly: checked })
                          }
                        />
                      </div>

                      <div className="flex items-start justify-between gap-4 bg-white/40 px-4 py-3.5 dark:bg-white/[0.02]">
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-bold text-[var(--text-primary)]">
                            {t('settings.accessControl.requireApproval')}
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                            {t('settings.accessControl.requireApprovalDesc')}
                          </p>
                        </div>
                        <GlassSwitch
                          id="requireApprovalToggle"
                          aria-label={t('settings.requireApprovalMode')}
                          checked={Boolean(whitelistQuery.data?.settings?.requireApproval)}
                          disabled={updateAccessSettingsMutation.isPending || whitelistQuery.isLoading}
                          onChange={(checked) =>
                            updateAccessSettingsMutation.mutate({ requireApproval: checked })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Pending users */}
                  {(whitelistQuery.data?.pendingUsers?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <h3 className="text-[12px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          {t('settings.accessControl.pendingRequests')} ({whitelistQuery.data?.pendingUsers.length})
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {whitelistQuery.data?.pendingUsers.map((pendingUser) => (
                          <div
                            key={pendingUser.id}
                            className="flex flex-col gap-2 rounded-lg border border-amber-500/15 bg-white/60 p-3 sm:flex-row sm:items-center sm:justify-between dark:bg-white/[0.03]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[12.5px] font-bold text-[var(--text-primary)]">
                                {pendingUser.firstName} {pendingUser.lastName}
                              </p>
                              <p className="truncate text-[10.5px] text-[var(--text-muted)]">
                                {pendingUser.email} · {pendingUser.organizationName || "—"} ·{' '}
                                {new Date(pendingUser.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <GlassButton
                                type="button"
                                variant="primary"
                                size="sm"
                                disabled={approveUserMutation.isPending}
                                onClick={() => approveUserMutation.mutate(pendingUser.id)}
                              >
                                <Icon paths={I.check} size={12} className="mr-1" />
                                {t('common.approve')}
                              </GlassButton>
                              <GlassButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600"
                                disabled={rejectUserMutation.isPending}
                                onClick={() => rejectUserMutation.mutate(pendingUser.id)}
                              >
                                <Icon paths={I.trash} size={12} className="mr-1" />
                                {t('common.reject')}
                              </GlassButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add to whitelist */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newWhitelistEmail.trim()) return;
                      addWhitelistMutation.mutate({
                        email: newWhitelistEmail.trim().toLowerCase(),
                        note: newWhitelistNote.trim() || undefined,
                      });
                    }}
                    className="rounded-xl border border-slate-200/85 bg-white/40 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.02]"
                  >
                    <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t('settings.accessControl.addToWhitelist')}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <GlassInput
                        type="email"
                        placeholder="email@example.com"
                        value={newWhitelistEmail}
                        onChange={(e) => setNewWhitelistEmail(e.target.value)}
                        required
                        disabled={addWhitelistMutation.isPending}
                        aria-label={t('settings.whitelistEmail')}
                        className="flex-1"
                      />
                      <GlassInput
                        placeholder={t('settings.accessControl.notePlaceholder')}
                        value={newWhitelistNote}
                        onChange={(e) => setNewWhitelistNote(e.target.value)}
                        disabled={addWhitelistMutation.isPending}
                        aria-label={t('settings.whitelistNote')}
                        className="sm:w-48"
                      />
                      <GlassButton
                        type="submit"
                        variant="primary"
                        disabled={!newWhitelistEmail.trim() || addWhitelistMutation.isPending}
                      >
                        <Icon paths={I.plus} size={13} className="mr-1" />
                        {addWhitelistMutation.isPending ? t('common.saving') : t('common.add')}
                      </GlassButton>
                    </div>
                  </form>

                  {/* Whitelist table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {t('settings.accessControl.whitelistedEmails')} (
                        {whitelistQuery.data?.whitelist?.length ?? 0})
                      </h3>
                    </div>

                    {whitelistQuery.isLoading ? (
                      <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                        {t('common.loading')}
                      </div>
                    ) : (whitelistQuery.data?.whitelist?.length ?? 0) === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300/80 py-6 text-center text-xs text-[var(--text-muted)] dark:border-white/[0.10]">
                        {t('settings.accessControl.noWhitelist')}
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200/85 dark:border-white/[0.08]">
                        <div className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
                          {whitelistQuery.data?.whitelist.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.03]"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-[12.5px] font-bold text-[var(--text-primary)]">
                                    {item.email}
                                  </span>
                                  {item.role && (
                                    <span className="rounded bg-slate-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-[var(--text-secondary)]">
                                      {item.role}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[var(--text-muted)]">
                                  {item.note && <span>{item.note} ·</span>}
                                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                                  {item.addedByName && <span>({item.addedByName})</span>}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeWhitelistMutation.mutate(item.id)}
                                disabled={removeWhitelistMutation.isPending}
                                className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-500/10"
                                title={t('common.delete')}
                                aria-label={`Remove ${item.email}`}
                              >
                                <Icon paths={I.trash} size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </SettingsSection>
            )}
          </div>
        </div>
      </motion.div>

      <ConfirmDialog
        open={confirmRevokeOthersOpen}
        title={t('settings.devices.revokeOthers', 'Boshqa barcha qurilmalardan chiqish')}
        description={t(
          'settings.devices.revokeOthersConfirm',
          'Rostdan ham barcha boshqa faol qurilmalarni tizimdan chiqarmoqchimisiz?',
        )}
        confirmLabel={t('settings.devices.revokeOthers', 'Chiqarish')}
        tone="danger"
        loading={revokeOtherSessionsMutation.isPending}
        onConfirm={() => {
          revokeOtherSessionsMutation.mutate();
          setConfirmRevokeOthersOpen(false);
        }}
        onClose={() => setConfirmRevokeOthersOpen(false)}
      />

      {toastNode}
    </div>
  );
}