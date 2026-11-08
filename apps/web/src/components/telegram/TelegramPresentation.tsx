/**
 * ============================================================================
 *  M-EDU Telegram Presentation Layer (v6.5 — Chromatic Liquid Glass Engine)
 *  Spatial Primitives, Motion Physics, SF Symbols 7 & Timezone-Safe Formatters
 * ============================================================================
 */

import React, {
  useId,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type SVGProps,
} from 'react';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
  type HTMLMotionProps,
} from 'framer-motion';

/* ============================================================================
 * 1. TYPES & DOMAIN CONTRACTS
 * ========================================================================== */

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type TabId = 'parent' | 'student' | 'teacher' | 'admin' | 'ai' | 'badge';
export type Tone = 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'slate';

/* ============================================================================
 * 2. MOTION PHYSICS — Apple iOS 27 ProMotion (120Hz GPU-Safe Springs)
 * ========================================================================== */

export const SPRING_SNAPPY = {
  type: 'spring',
  stiffness: 460,
  damping: 34,
  mass: 0.75,
} as const;

export const SPRING_SMOOTH = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.85,
} as const;

export const SPRING_SHEET = {
  type: 'spring',
  stiffness: 380,
  damping: 38,
  mass: 0.8,
} as const;

export const STAGGER_CONTAINER: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.01 },
  },
};

/**
 * GPU-SAFE STAGGER: Uses only transform & opacity to avoid dual-pass
 * backdrop-filter re-rasterization lag on 120Hz mobile displays.
 */
export const STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.984 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING_SMOOTH,
  },
};

/* ============================================================================
 * 3. SF SYMBOLS 7 ICON SYSTEM (Precision Vector Paths)
 * ========================================================================== */

export const ICON_STROKE = 1.95;

export const I: Readonly<Record<string, readonly string[]>> = {
  chart: ['M18 20V10', 'M12 20V4', 'M6 20v-6'],
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  check: ['M20 6 9 17l-5-5'],
  xCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  alertCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v4', 'M12 16h.01'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  calendar: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  wallet: [
    'M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4',
    'M21 12H17a2 2 0 0 0 0 4h4',
  ],
  shieldCheck: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  graduationCap: ['M22 9 12 4 2 9l10 5z', 'M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5'],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3',
    'M20 5h-3',
    'M5.5 18v2.5',
    'M6.75 19.25h-2.5',
  ],
  heart: [
    'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  ],
  messageSquare: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  bookOpen: [
    'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z',
    'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  ],
  chevronRight: ['M9 6l6 6-6 6'],
  chevronDown: ['M6 9l6 6 6-6'],
  star: [
    'M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z',
  ],
  sun: [
    'M12 1v2',
    'M12 21v2',
    'M4.22 4.22l1.42 1.42',
    'M18.36 18.36l1.42 1.42',
    'M1 12h2',
    'M21 12h2',
    'M4.22 19.78l1.42-1.42',
    'M18.36 5.64l1.42-1.42',
    'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  ],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  coins: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  gift: [
    'M20 12v10H4V12',
    'M2 7h20v5H2z',
    'M12 22V7',
    'M7.5 7a2.5 2.5 0 0 1 0-5C10 2 12 7 12 7s2-5 4.5-5a2.5 2.5 0 0 1 0 5',
  ],
  award: ['M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M8.21 13.89 7 23l5-3 5 3-1.21-9.12'],
  wifiOff: [
    'M1 1l22 22',
    'M16.72 11.06A10.94 10.94 0 0 1 19 12.55',
    'M5 12.55a10.94 10.94 0 0 1 5.17-2.39',
    'M10.71 5.05A16 16 0 0 1 22.58 9',
    'M1.42 9a15.91 15.91 0 0 1 4.7-2.88',
    'M8.53 16.11a6 6 0 0 1 6.95 0',
    'M12 20h.01',
  ],
  send: ['M22 2 11 13', 'M22 2 15 22 11 13 2 9z'],
  qrCode: [
    'M3 3h6v6H3z',
    'M15 3h6v6h-6z',
    'M3 15h6v6H3z',
    'M14 14h2v2h-2z',
    'M18 14h3v3h-3z',
    'M14 18h3v3h-3z',
    'M18 18h3v3h-3z',
    'M5 5h2v2H5z',
    'M17 5h2v2h-2z',
    'M5 17h2v2H5z',
  ],
  creditCard: ['M1 4h22v16H1z', 'M1 10h22'],
  copy: [
    'M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2z',
    'M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2',
  ],
  building: [
    'M3 21h18',
    'M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16',
    'M9 9h1',
    'M9 13h1',
    'M9 17h1',
    'M14 9h1',
    'M14 13h1',
    'M14 17h1',
  ],
  fileText: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8',
    'M16 17H8',
    'M10 9H8',
  ],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
  bolt: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  trendUp: ['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
};

export function Icon({
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
} & SVGProps<SVGSVGElement>) {
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
      className={`shrink-0 select-none ${className}`}
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
 * 4. HIGH-PERFORMANCE FORMATTERS & DATE ENGINE (Timezone-Safe)
 * ========================================================================== */

export const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

const UZS_FORMATTER = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 });
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short' });
const TIME_FORMATTER = new Intl.DateTimeFormat('uz-UZ', { hour: '2-digit', minute: '2-digit' });

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayKey(): string {
  return toLocalDateKey(new Date());
}

export function todayDayOfWeek(): string {
  return DAY_NAMES[new Date().getDay()];
}

/**
 * Date-only ("YYYY-MM-DD") satrlarni UTC emas, lokal vaqt mintaqasida
 * yarim tun sifatida xavfsiz o'qiydi.
 */
export function parseDateSafe(iso?: string | null): Date | null {
  if (!iso) return null;
  const trimmed = iso.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    const localDate = new Date(year, month, day);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function sameDayStr(iso?: string | null): boolean {
  const d = parseDateSafe(iso);
  if (!d) return false;
  return toLocalDateKey(d) === todayKey();
}

export function itemsOf<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const items = (data as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

export function normalizeChildren<T = Record<string, unknown>>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const nested = (data as { children?: unknown } | null)?.children;
  return Array.isArray(nested) ? (nested as T[]) : [];
}

export function formatUZS(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${UZS_FORMATTER.format(safeAmount)} so'm`;
}

export function formatNum(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatDateShort(iso?: string | null): string {
  const d = parseDateSafe(iso);
  if (!d) return '—';
  return SHORT_DATE_FORMATTER.format(d);
}

/**
 * XATO TUZATILDI: Agar iso faqat sanadan ("YYYY-MM-DD") iborat bo'lsa,
 * soxta ", 00:00" vaqtini qo'shmasdan faqat kunni ko'rsatadi.
 */
export function formatDue(iso?: string | null): string {
  if (!iso) return '';
  const trimmed = iso.trim();
  const d = parseDateSafe(trimmed);
  if (!d) return '';

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const targetKey = toLocalDateKey(d);
  let dayLabel = SHORT_DATE_FORMATTER.format(d);
  if (targetKey === toLocalDateKey(today)) dayLabel = 'Bugun';
  else if (targetKey === toLocalDateKey(tomorrow)) dayLabel = 'Ertaga';
  else if (targetKey === toLocalDateKey(yesterday)) dayLabel = 'Kecha';

  if (isDateOnly) return dayLabel;
  return `${dayLabel}, ${TIME_FORMATTER.format(d)}`;
}

export function formatRelative(iso?: string | null): string {
  const d = parseDateSafe(iso);
  if (!d) return '';

  const diffMs = Date.now() - d.getTime();
  if (diffMs < -60_000) {
    return formatDateShort(iso);
  }
  const mins = Math.max(0, Math.floor(diffMs / 60_000));

  if (mins < 1) return 'hozirgina';
  if (mins < 60) return `${mins} daq. oldin`;

  const hours = Math.floor(mins / 60);
  if (hours < 24 && toLocalDateKey(d) === todayKey()) {
    return `${hours} soat oldin`;
  }
  return formatDateShort(iso);
}

export function getTimeGreeting(): { greeting: string; icon: readonly string[] } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return { greeting: 'Xayrli tong', icon: I.sun };
  if (hour >= 11 && hour < 18) return { greeting: 'Xayrli kun', icon: I.sun };
  return { greeting: 'Xayrli oqshom', icon: I.moon };
}

/**
 * XATO TUZATILDI: O'zbek digraflari (Sh, Ch, O', G') bir va ikki so'zli
 * ismlarda ham to'g'ri ajratiladi.
 */
export function getInitials(name?: string | null): string {
  const cleaned = (name ?? '')
    .replace(/[^\p{L}\p{N}\s'ʻ’`-]/gu, ' ')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';

  const extractToken = (word: string): string => {
    const upper = word.toUpperCase();
    if (upper.startsWith('SH')) return 'Sh';
    if (upper.startsWith('CH')) return 'Ch';
    const chars = Array.from(word);
    if (chars.length >= 2 && (chars[1] === "'" || chars[1] === 'ʻ' || chars[1] === '’')) {
      return `${chars[0].toUpperCase()}ʻ`;
    }
    return (chars[0] ?? '').toUpperCase();
  };

  if (parts.length === 1) {
    const tok = extractToken(parts[0]);
    if (tok.length > 1) return tok;
    const chars = Array.from(parts[0]);
    return ((chars[0] ?? '') + (chars[1] ?? '')).toUpperCase() || 'M';
  }

  const first = extractToken(parts[0]);
  const second = extractToken(parts[1]);
  const combined = `${first}${second}`;
  // Agar 2 ta digraf qo'shilib 4 belgiga yetsa, ixchamroq ko'rinish uchun bosh harflarni oladi
  if (combined.length > 3) {
    return `${Array.from(parts[0])[0] ?? ''}${Array.from(parts[1])[0] ?? ''}`.toUpperCase() || 'M';
  }
  return combined || 'M';
}

/* ============================================================================
 * 5. LOCALIZED DOMAIN DICTIONARIES
 * ========================================================================== */

export const RELATION_LABELS: Readonly<Record<string, string>> = {
  FATHER: 'Ota',
  MOTHER: 'Ona',
  GUARDIAN: 'Vasiy',
  GRANDMOTHER: 'Buvi',
  GRANDFATHER: 'Buva',
  RELATIVES: 'Yaqini',
};

export const INVOICE_STATUS: Readonly<Record<string, { label: string; tone: Tone }>> = {
  ISSUED: { label: 'Chiqarilgan', tone: 'blue' },
  PENDING: { label: 'Kutilmoqda', tone: 'orange' },
  PARTIALLY_PAID: { label: "Qisman to'langan", tone: 'orange' },
  PAID: { label: "To'langan", tone: 'green' },
  OVERDUE: { label: "Muddati o'tgan", tone: 'red' },
  REFUNDED: { label: 'Qaytarilgan', tone: 'slate' },
  CANCELLED: { label: 'Bekor qilingan', tone: 'slate' },
};

export const ASSIGNMENT_LABELS: Readonly<Record<string, string>> = {
  DRAFT: 'Qoralama',
  PUBLISHED: 'Faol',
  SUBMITTED: 'Topshirilgan',
  GRADED: 'Baholangan',
  CLOSED: 'Yopilgan',
  ARCHIVED: 'Arxivlangan',
};

export const XP_TYPE_LABELS: Readonly<Record<string, string>> = {
  ATTENDANCE_ON_TIME: 'Vaqtida davomat',
  HOMEWORK_ON_TIME_GOOD_GRADE: "A'lo uy vazifasi",
  EXAM_HIGH_SCORE: 'Yuqori imtihon natijasi',
  STREAK_BONUS: 'Uzluksiz qatnashuv bonusi',
  QUIZ_PERFECT: 'Testda 100% natija',
  ACTIVE_PARTICIPATION: 'Darsda faol ishtirok',
  MANUAL_AWARD: 'Ustoz rag‘batlantirishi',
  DAILY_LOGIN: 'Kunlik faollik',
};

export const STATUS_META: Readonly<
  Record<AttendanceStatus, { label: string; tone: Tone; color: string; icon: readonly string[] }>
> = {
  PRESENT: { label: 'Keldi', tone: 'green', color: '#10B981', icon: I.checkCircle },
  ABSENT: { label: 'Kelmadi', tone: 'red', color: '#FF453A', icon: I.xCircle },
  LATE: { label: 'Kechikdi', tone: 'orange', color: '#F59E0B', icon: I.clock },
  EXCUSED: { label: 'Sababli', tone: 'blue', color: '#0A84FF', icon: I.shieldCheck },
};

export const ROLE_LABELS: Readonly<Record<string, string>> = {
  SUPER_ADMIN: 'Bosh administrator',
  PLATFORM_OWNER: 'Platforma egasi',
  ORG_ADMIN: 'Markaz admini',
  ADMIN: 'Administrator',
  MANAGER: 'Menejer',
  TEACHER: "O'qituvchi",
  ASSISTANT: 'Asistent',
  PARENT: 'Ota-ona',
  STUDENT: "O'quvchi",
};

/* ============================================================================
 * 6. iOS 27 SPATIAL LIQUID GLASS v6.5 ENGINE (Chromatic & Specular Physics)
 * ========================================================================== */

export function tgThemeStyle(scheme: 'light' | 'dark'): CSSProperties {
  const light = scheme === 'light';
  const pageBg = light ? '#F2F6FC' : '#060911';
  const surfaceBg = light ? '#FFFFFF' : '#0F1624';
  const textPrimary = light ? '#0B1120' : '#F8FAFC';

  return {
    colorScheme: scheme,
    background: pageBg,
    color: textPrimary,
    ['--bg-page' as string]: pageBg,
    ['--bg-surface' as string]: surfaceBg,
    ['--glass-surface' as string]: light
      ? 'rgba(255, 255, 255, 0.76)'
      : 'rgba(15, 23, 42, 0.58)',
    ['--text-primary' as string]: textPrimary,
    ['--text-secondary' as string]: light ? '#334155' : '#CBD5E1',
    ['--text-tertiary' as string]: light ? '#64748B' : '#94A3B8',
    ['--glass-bg' as string]: light
      ? 'linear-gradient(145deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.62) 100%)'
      : 'linear-gradient(145deg, rgba(30,41,59,0.66) 0%, rgba(15,23,42,0.46) 100%)',
    ['--glass-border' as string]: light
      ? 'rgba(255,255,255,0.92)'
      : 'rgba(255,255,255,0.14)',
    ['--glass-specular' as string]: light
      ? 'rgba(255,255,255,1)'
      : 'rgba(255,255,255,0.34)',
    ['--glass-shadow' as string]: light
      ? '0 22px 48px -14px rgba(15,23,42,0.09), 0 4px 14px -2px rgba(15,23,42,0.04)'
      : '0 28px 56px -12px rgba(0,0,0,0.65), 0 6px 20px -4px rgba(0,0,0,0.45)',
    ['--border-subtle' as string]: light
      ? 'rgba(15,23,42,0.075)'
      : 'rgba(255,255,255,0.085)',
  } as CSSProperties;
}

export const LIQUID_GLASS_CSS = `
  [data-tg-theme] {
    --lg-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --lg-blur: 38px;
    --lg-sat: 195%;
    --lg-spec: rgba(255,255,255,0.52);
    --lg-edge: rgba(255,255,255,0.22);
    --lg-edge-soft: rgba(255,255,255,0.08);
    --lg-fill-a: rgba(255,255,255,0.14);
    --lg-fill-b: rgba(255,255,255,0.035);
    --tone-glow: transparent;
  }
  [data-tg-theme='light'] {
    --lg-spec: rgba(255,255,255,0.96);
    --lg-edge: rgba(255,255,255,0.84);
    --lg-edge-soft: rgba(15,23,42,0.07);
    --lg-fill-a: rgba(255,255,255,0.82);
    --lg-fill-b: rgba(255,255,255,0.48);
  }

  /* Apple iOS 27 / visionOS 4 Spatial Liquid Glass */
  .liquid-glass {
    position: relative;
    isolation: isolate;
    border-radius: 30px;
    background:
      radial-gradient(125% 105% at 12% -18%, var(--tone-glow), transparent 62%),
      linear-gradient(150deg, var(--lg-fill-a) 0%, var(--lg-fill-b) 100%),
      color-mix(in srgb, var(--bg-surface) 58%, transparent);
    backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat));
    -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat));
    border: 1px solid var(--lg-edge-soft);
    box-shadow:
      var(--glass-shadow),
      inset 0 1px 0 0 var(--lg-spec),
      inset 0 -1px 0 0 rgba(255, 255, 255, 0.05);
    overflow: hidden;
    transform: translateZ(0);
    transition: transform .5s var(--lg-ease), box-shadow .5s var(--lg-ease), background .5s var(--lg-ease), border-color .5s var(--lg-ease);
  }

  /* Specular Top-Left Caustic Reflection (z-index: -1 keeps children layout intact) */
  .liquid-glass::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    z-index: -1;
    background:
      radial-gradient(120% 70% at 12% -8%, rgba(255,255,255,0.28), transparent 52%),
      radial-gradient(90% 60% at 100% 110%, rgba(255,255,255,0.08), transparent 60%);
    opacity: .9;
  }

  /* Chromatic Masked Rim Border */
  .liquid-glass::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    pointer-events: none;
    z-index: -1;
    background: linear-gradient(160deg, rgba(255,255,255,0.55), rgba(255,255,255,0.04) 38%, rgba(255,255,255,0.02) 62%, rgba(255,255,255,0.28));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: .75;
  }
  [data-tg-theme='light'] .liquid-glass::after { opacity: .92; }

  /* Sub-surface Chromatic Caustic Refractions */
  .liquid-tone-green  { --tone-glow: rgba(16, 185, 129, 0.22); }
  .liquid-tone-red    { --tone-glow: rgba(255, 69, 58, 0.20); }
  .liquid-tone-orange { --tone-glow: rgba(245, 158, 11, 0.20); }
  .liquid-tone-blue   { --tone-glow: rgba(10, 132, 255, 0.22); }
  .liquid-tone-purple { --tone-glow: rgba(139, 92, 246, 0.22); }
  .liquid-tone-slate  { --tone-glow: rgba(148, 163, 184, 0.16); }

  /* Carved Inner Glass Well */
  .liquid-inset {
    position: relative;
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025));
    border: 1px solid var(--lg-edge-soft);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.16),
      inset 0 -8px 18px -14px rgba(0,0,0,0.24);
    -webkit-backdrop-filter: blur(14px) saturate(155%);
    backdrop-filter: blur(14px) saturate(155%);
    transition: transform .4s var(--lg-ease), background .4s var(--lg-ease), border-color .4s var(--lg-ease);
  }
  [data-tg-theme='light'] .liquid-inset {
    background: linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,255,255,0.58));
    box-shadow: inset 0 1px 0 #fff, 0 1px 2px rgba(15,23,42,0.05);
  }

  /* Floating Spatial Tab Dock */
  .liquid-dock {
    background:
      linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05)),
      color-mix(in srgb, var(--bg-surface) 56%, transparent);
    backdrop-filter: blur(44px) saturate(220%);
    -webkit-backdrop-filter: blur(44px) saturate(220%);
    border: 1px solid var(--lg-edge);
    box-shadow:
      0 20px 44px -14px rgba(0, 0, 0, 0.48),
      0 2px 6px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 var(--lg-spec),
      inset 0 -1px 0 rgba(255, 255, 255, 0.06);
  }
  [data-tg-theme='light'] .liquid-dock {
    box-shadow:
      0 18px 38px -12px rgba(15, 23, 42, 0.18),
      0 2px 6px rgba(15, 23, 42, 0.06),
      inset 0 1px 0 #fff;
  }

  /* iOS 27 Fluid Iridescent Primary, Ghost & Danger Buttons */
  .liquid-btn-primary {
    background: linear-gradient(135deg, #0A84FF 0%, #4F46E5 52%, #7C3AED 100%);
    border: 1px solid rgba(255, 255, 255, 0.24);
    box-shadow:
      0 12px 28px -8px rgba(79, 70, 229, 0.62),
      inset 0 1.25px 0 0 rgba(255, 255, 255, 0.45),
      inset 0 -1px 0 0 rgba(0, 0, 0, 0.25);
  }

  .liquid-btn, .liquid-btn-ghost {
    position: relative;
    border: 1px solid var(--lg-edge-soft);
    background: linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04));
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 2px 8px -3px rgba(0,0,0,0.24);
    -webkit-backdrop-filter: blur(16px) saturate(170%);
    backdrop-filter: blur(16px) saturate(170%);
    transition: transform .32s var(--lg-ease), box-shadow .32s var(--lg-ease), background .32s var(--lg-ease), border-color .32s var(--lg-ease);
  }
  [data-tg-theme='light'] .liquid-btn, [data-tg-theme='light'] .liquid-btn-ghost {
    background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.68));
    box-shadow: inset 0 1px 0 #fff, 0 2px 6px -2px rgba(15,23,42,0.08);
  }

  .liquid-btn-danger {
    position: relative;
    border: 1px solid rgba(255, 69, 58, 0.34);
    background: linear-gradient(180deg, rgba(255, 69, 58, 0.18), rgba(255, 69, 58, 0.08));
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 16px -6px rgba(255, 69, 58, 0.32);
    -webkit-backdrop-filter: blur(16px) saturate(170%);
    backdrop-filter: blur(16px) saturate(170%);
    transition: transform .32s var(--lg-ease), box-shadow .32s var(--lg-ease), background .32s var(--lg-ease);
  }

  .liquid-btn:active:not(:disabled),
  .liquid-btn-ghost:active:not(:disabled),
  .liquid-btn-danger:active:not(:disabled) {
    transform: scale(0.965);
  }
  .liquid-btn:disabled,
  .liquid-btn-ghost:disabled,
  .liquid-btn-danger:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  /* Native Search Input Double-Clear Fix */
  input[type="search"]::-webkit-search-decoration,
  input[type="search"]::-webkit-search-cancel-button,
  input[type="search"]::-webkit-search-results-button,
  input[type="search"]::-webkit-search-results-decoration {
    -webkit-appearance: none;
    appearance: none;
    display: none;
  }

  /* Eyebrow & Sheen Utilities */
  .lg-eyebrow {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }
  .lg-sheen { position: relative; overflow: hidden; }
  .lg-sheen::after {
    content: '';
    position: absolute;
    inset: -30% auto -30% -60%;
    width: 45%;
    transform: skewX(-18deg);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.34), transparent);
    animation: lg-sheen 6.5s var(--lg-ease) infinite;
    pointer-events: none;
  }

  /* iOS 27 Specular Shimmer Skeleton */
  @keyframes liquidShimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .liquid-shimmer {
    position: relative;
    overflow: hidden;
    background: color-mix(in srgb, var(--text-primary) 6%, transparent);
    border: 1px solid var(--border-subtle);
  }
  .liquid-shimmer::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--text-primary) 9%, transparent) 50%,
      transparent 100%
    );
    animation: liquidShimmer 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  /* Ambient Spatial Orbs */
  .lg-orb { position: absolute; border-radius: 9999px; filter: blur(10px); will-change: transform; }
  .lg-orb-1, .ambient-orb-1 { animation: lg-float-a 24s ease-in-out infinite; }
  .lg-orb-2, .ambient-orb-2 { animation: lg-float-b 30s ease-in-out infinite; }
  .lg-orb-3 { animation: lg-float-a 36s ease-in-out infinite reverse; }

  @keyframes lg-float-a { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-24px,30px,0) scale(1.08); } }
  @keyframes lg-float-b { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(28px,-26px,0) scale(1.06); } }
  @keyframes lg-sheen { 0% { left: -60%; } 55%,100% { left: 130%; } }

  /* Clean Scrollbars */
  .no-scrollbar, .medu-scroll-x {
    scrollbar-width: none;
    -ms-overflow-style: none;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }
  .no-scrollbar::-webkit-scrollbar, .medu-scroll-x::-webkit-scrollbar { display: none; }
  .medu-scroll-x > * { scroll-snap-align: start; }

  /* Accessibility & Fallback Guards */
  button:focus-visible, [role='tab']:focus-visible, [role='button']:focus-visible, input:focus-visible, textarea:focus-visible {
    outline: 2px solid rgba(10,132,255,0.85);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .lg-orb, .lg-sheen::after, .liquid-shimmer::after { animation: none !important; }
    .liquid-glass, .liquid-inset, .liquid-btn, .liquid-btn-ghost, .liquid-btn-danger { transition: none !important; }
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .liquid-glass, .liquid-dock { background: color-mix(in srgb, var(--bg-surface) 94%, transparent); }
  }
`;

/* ============================================================================
 * 7. SPATIAL GLASS PRIMITIVES
 * ========================================================================== */

export const TONE_COLORS: Readonly<Record<Tone, { bg: string; fg: string; border: string }>> = {
  green: { bg: 'rgba(16,185,129,0.15)', fg: '#10B981', border: 'rgba(16,185,129,0.34)' },
  red: { bg: 'rgba(255,69,58,0.15)', fg: '#FF453A', border: 'rgba(255,69,58,0.34)' },
  orange: { bg: 'rgba(245,158,11,0.15)', fg: '#F59E0B', border: 'rgba(245,158,11,0.34)' },
  blue: { bg: 'rgba(10,132,255,0.15)', fg: '#0A84FF', border: 'rgba(10,132,255,0.34)' },
  purple: { bg: 'rgba(139,92,246,0.16)', fg: '#8B5CF6', border: 'rgba(139,92,246,0.34)' },
  slate: {
    bg: 'color-mix(in srgb, var(--text-secondary, #64748B) 14%, transparent)',
    fg: 'var(--text-secondary, #64748B)',
    border: 'color-mix(in srgb, var(--text-secondary, #64748B) 28%, transparent)',
  },
};

export const RING_GRADIENTS: Readonly<Record<Tone, readonly [string, string]>> = {
  green: ['#10B981', '#34D399'],
  red: ['#FF453A', '#FB7185'],
  orange: ['#F59E0B', '#FBBF24'],
  blue: ['#0A84FF', '#38BDF8'],
  purple: ['#8B5CF6', '#C084FC'],
  slate: ['#64748B', '#94A3B8'],
};

/**
 * XATO TUZATILDI: Ortiqcha ichki <div className="relative z-10"> olib tashlandi.
 * Endi Surface'ga uzatilgan flex, grid va space-y-* klasslari bevosita children'ga ishlaydi.
 */
export function Surface({
  children,
  className = '',
  tone,
  interactive = false,
  style,
  onClick,
  onKeyDown,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
  interactive?: boolean;
  style?: CSSProperties;
} & Omit<HTMLMotionProps<'div'>, 'style'>) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      if (interactive && onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
      }
    },
    [interactive, onClick, onKeyDown],
  );

  return (
    <motion.div
      variants={STAGGER_ITEM}
      whileTap={interactive ? { scale: 0.982 } : undefined}
      transition={SPRING_SNAPPY}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : onKeyDown}
      className={`liquid-glass ${tone ? `liquid-tone-${tone}` : ''} ${
        interactive ? 'cursor-pointer select-none' : ''
      } ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Pill({
  tone = 'slate',
  icon,
  children,
  className = '',
}: {
  tone?: Tone;
  icon?: readonly string[];
  children: ReactNode;
  className?: string;
}) {
  const c = TONE_COLORS[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide backdrop-blur-md ${className}`}
      style={{
        background: c.bg,
        color: c.fg,
        borderColor: c.border,
        boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.22)',
      }}
    >
      {icon && <Icon paths={icon} size={11} strokeWidth={2.4} />}
      <span className="leading-none">{children}</span>
    </span>
  );
}

export function Btn({
  children,
  tone = 'primary',
  loading = false,
  disabled,
  className = '',
  type = 'button',
  ...rest
}: {
  children: ReactNode;
  tone?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'tap-target relative inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-bold tracking-tight transition-all duration-150 active:scale-[0.96] active:brightness-110 disabled:pointer-events-none disabled:opacity-45 overflow-hidden select-none cursor-pointer';
  const cls =
    tone === 'primary'
      ? 'liquid-btn-primary text-white'
      : tone === 'danger'
        ? 'liquid-btn-danger text-[#FF453A]'
        : 'liquid-btn-ghost text-[var(--text-primary)]';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`${base} ${cls} ${className}`}
      {...rest}
    >
      {loading && (
        <Icon paths={I.refresh} size={14} strokeWidth={2.3} className="animate-spin" />
      )}
      {children}
    </button>
  );
}

export function Skeleton({ className = '', height = 80 }: { className?: string; height?: number }) {
  return (
    <div
      className={`liquid-shimmer rounded-[24px] ${className}`}
      style={{ height }}
      aria-hidden="true"
    />
  );
}

export function EmptyState({
  icon = I.calendar,
  tone = 'blue',
  title,
  message,
  children,
}: {
  icon?: readonly string[];
  tone?: Tone;
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  const c = TONE_COLORS[tone];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={SPRING_SMOOTH}
      className="flex flex-col items-center px-4 py-10 text-center"
    >
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px]"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `0 12px 28px -8px ${c.bg}, inset 0 1.25px 0 0 rgba(255,255,255,0.28)`,
        }}
      >
        <Icon paths={icon} size={28} strokeWidth={2} />
      </div>
      <h3 className="text-[16px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {message && (
        <p
          className="mx-auto mt-1.5 max-w-xs text-[12.5px] leading-relaxed"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {message}
        </p>
      )}
      {children && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">{children}</div>
      )}
    </motion.div>
  );
}

export function ErrorState({
  message = "Ma'lumot yuklanmadi. Internet aloqasi yoki server holatini tekshiring.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState icon={I.alertCircle} tone="red" title="Ma'lumot yuklanmadi" message={message}>
      {onRetry && (
        <Btn onClick={onRetry}>
          <Icon paths={I.refresh} size={14} strokeWidth={2.2} />
          Qayta urinish
        </Btn>
      )}
    </EmptyState>
  );
}

/**
 * Proporsional masshtablanuvchi ProgressRing:
 * size=34 (kichik KPI) yoki size=68+ (asosiy) bo'lganda shrift o'lchamini avtomatik moslaydi.
 */
export function ProgressRing({
  value,
  size = 68,
  stroke = 6.5,
  tone = 'green',
  center,
  sub,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  center?: ReactNode;
  sub?: string;
}) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gid = `ring-grad-${uid}`;
  const r = Math.max(4, (size - stroke) / 2);
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const [from, to] = RING_GRADIENTS[tone];

  const valueFontSize = Math.max(8, Math.round(size * (sub ? 0.22 : 0.24)));
  const subFontSize = Math.max(7, Math.round(size * 0.13));
  const showCenterText = size >= 42 || center !== undefined;

  return (
    <div
      className="relative shrink-0 select-none"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${Math.round(pct)} foiz`}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 overflow-visible"
        style={{ filter: `drop-shadow(0 0 6px ${from}40)` }}
      >
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="color-mix(in srgb, var(--text-tertiary, #94A3B8) 18%, transparent)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduced ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 75, damping: 19, mass: 0.95 }}
        />
      </svg>
      {showCenterText && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
          <span
            className="font-black leading-none tracking-tight tabular-nums"
            style={{ color: 'var(--text-primary)', fontSize: valueFontSize }}
          >
            {center ?? `${Math.round(pct)}%`}
          </span>
          {sub && size >= 52 && (
            <span
              className="mt-0.5 font-bold uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)', fontSize: subFontSize }}
            >
              {sub}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function Avatar({
  name,
  photo,
  size = 42,
  active = false,
}: {
  name?: string | null;
  photo?: string | null;
  size?: number;
  active?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [photo]);

  const initials = getInitials(name);
  const radius = Math.round(size * 0.34);
  const baseFontSize = Math.max(10, Math.round(size * (initials.length > 2 ? 0.29 : 0.34)));

  return (
    <div
      className="relative shrink-0 select-none overflow-hidden transition-shadow duration-300"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: active
          ? 'linear-gradient(135deg, #10B981 0%, #0A84FF 100%)'
          : 'linear-gradient(135deg, #475569 0%, #1E293B 100%)',
        boxShadow: active
          ? '0 0 0 2.5px rgba(16,185,129,0.45), 0 6px 16px -4px rgba(10,132,255,0.4), inset 0 1px 0 0 rgba(255,255,255,0.45)'
          : 'inset 0 1px 0 0 rgba(255,255,255,0.25)',
      }}
    >
      {photo && !imgFailed ? (
        <img
          src={photo}
          alt={name ?? 'Avatar'}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-bold tracking-tight text-white"
          style={{ fontSize: baseFontSize }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

export function CardHead({
  icon,
  tone = 'blue',
  title,
  meta,
}: {
  icon: readonly string[];
  tone?: Tone;
  title: string;
  meta?: ReactNode;
}) {
  const c = TONE_COLORS[tone];
  return (
    <div className="mb-3.5 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px]"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.24)',
          }}
        >
          <Icon paths={icon} size={17} strokeWidth={2.1} />
        </div>
        <h4
          className="truncate text-[15px] font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h4>
      </div>
      {meta && <div className="shrink-0">{meta}</div>}
    </div>
  );
}

/* ============================================================================
 * 8. SENIOR v6.5 EXTRA PRIMITIVES
 * ========================================================================== */

export function StatusDot({
  tone = 'green',
  pulse = true,
  label,
}: {
  tone?: Tone;
  pulse?: boolean;
  label?: string;
}) {
  const color = TONE_COLORS[tone].fg;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color }}>
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      </span>
      {label && <span>{label}</span>}
    </span>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  tone = 'blue',
  className = '',
}: {
  options: readonly { id: T; label: string; count?: number }[];
  value: T;
  onChange: (next: T) => void;
  tone?: Tone;
  className?: string;
}) {
  const uid = useId();
  const c = TONE_COLORS[tone];
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (options.length < 2) return;
    let nextIdx = -1;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % options.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + options.length) % options.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = options.length - 1;

    if (nextIdx !== -1) {
      e.preventDefault();
      const target = options[nextIdx];
      if (target) {
        onChange(target.id);
        btnRefs.current[nextIdx]?.focus();
      }
    }
  };

  return (
    <div
      role="tablist"
      className={`medu-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5 ${className}`}
    >
      {options.map((opt, idx) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              btnRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            tabIndex={active ? 0 : -1}
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className="liquid-btn relative shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors"
            style={{
              color: active ? c.fg : 'var(--text-tertiary)',
              borderColor: active ? c.border : undefined,
              background: active ? c.bg : undefined,
            }}
          >
            {active && (
              <motion.span
                layoutId={`seg-pill-${uid}`}
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  border: `1px solid ${c.border}`,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)',
                }}
                transition={SPRING_SNAPPY}
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              <span>{opt.label}</span>
              {opt.count != null && (
                <span className="rounded-full px-1.5 py-0.5 text-[9.5px] opacity-80">
                  {opt.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Qidirish…',
  className = '',
  ...rest
}: {
  value: string;
  onChange: (val: string) => void;
  onClear?: () => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div className={`liquid-inset relative flex items-center px-3.5 py-2 ${className}`}>
      <Icon
        paths={I.search}
        size={15}
        strokeWidth={2.2}
        style={{ color: 'var(--text-tertiary)' }}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent px-2.5 text-[12.5px] font-medium outline-none"
        style={{ color: 'var(--text-primary)' }}
        {...rest}
      />
      <AnimatePresence>
        {value.length > 0 && (
          <motion.button
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.14 }}
            type="button"
            onClick={() => {
              onChange('');
              onClear?.();
            }}
            aria-label="Qidiruvni tozalash"
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full opacity-75 transition hover:opacity-100"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Icon paths={I.close} size={12} strokeWidth={2.4} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export function StatTile({
  label,
  value,
  subValue,
  footer,
  icon,
  tone = 'blue',
  rightSlot,
}: {
  label: string;
  value: ReactNode;
  subValue?: ReactNode;
  footer?: ReactNode;
  icon?: readonly string[];
  tone?: Tone;
  rightSlot?: ReactNode;
}) {
  const c = TONE_COLORS[tone];
  return (
    <Surface tone={tone} className="p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
          {label}
        </span>
        {icon && (
          <span style={{ color: c.fg }}>
            <Icon paths={icon} size={16} strokeWidth={2.1} />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span
            className="truncate text-[20px] font-black tracking-tight tabular-nums"
            style={{ color: 'var(--text-primary)' }}
          >
            {value}
          </span>
          {subValue && (
            <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
              {subValue}
            </span>
          )}
        </div>
        {rightSlot}
      </div>
      {footer && (
        <div className="mt-1 truncate text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
          {footer}
        </div>
      )}
    </Surface>
  );
}

/**
 * YANGI PRIMITIV: Silliq bahor (spring) animatsiyali gorizontal progress chizig'i
 */
export function ProgressBar({
  value,
  max = 100,
  tone = 'blue',
  height = 8,
  labelLeft,
  labelRight,
  className = '',
}: {
  value: number;
  max?: number;
  tone?: Tone;
  height?: number;
  labelLeft?: ReactNode;
  labelRight?: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const safeMax = Math.max(1, Number.isFinite(max) ? max : 100);
  const safeVal = Math.max(0, Number.isFinite(value) ? value : 0);
  const pct = Math.max(0, Math.min(100, Math.round((safeVal / safeMax) * 100)));
  const [from, to] = RING_GRADIENTS[tone];

  return (
    <div className={className}>
      {(labelLeft || labelRight) && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold">
          <span style={{ color: 'var(--text-secondary)' }}>{labelLeft}</span>
          <span className="tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            {labelRight}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="overflow-hidden rounded-full"
        style={{
          height,
          background: 'color-mix(in srgb, var(--text-tertiary, #94A3B8) 18%, transparent)',
        }}
      >
        <motion.div
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 20 }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${from} 0%, ${to} 100%)`,
            boxShadow: `0 0 10px ${from}55`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * YANGI PRIMITIV: Ro'yxat elementlari uchun universal interaktiv qator
 */
export function ListRow({
  icon,
  tone = 'blue',
  title,
  subtitle,
  right,
  onClick,
  className = '',
}: {
  icon?: readonly string[];
  tone?: Tone;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const c = TONE_COLORS[tone];
  const Comp = onClick ? motion.button : motion.div;

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      onClick={onClick}
      className={`liquid-inset flex w-full items-center justify-between gap-3 p-3 text-left ${
        onClick ? 'cursor-pointer select-none' : ''
      } ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon && (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: c.bg,
              color: c.fg,
              border: `1px solid ${c.border}`,
            }}
          >
            <Icon paths={icon} size={16} strokeWidth={2.1} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </Comp>
  );
}

/**
 * YANGI PRIMITIV: Bir bosishda nusxa oluvchi interaktiv kapsula
 */
export function CopyChip({
  value,
  label,
  tone = 'green',
  onCopied,
  className = '',
}: {
  value: string;
  label?: string;
  tone?: Tone;
  onCopied?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const c = TONE_COLORS[tone];

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const handleCopy = () => {
    try {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(value);
      }
      setCopied(true);
      onCopied?.();
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`liquid-btn inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-bold ${className}`}
      style={{
        color: copied ? TONE_COLORS.green.fg : c.fg,
        borderColor: copied ? TONE_COLORS.green.border : c.border,
        background: copied ? TONE_COLORS.green.bg : undefined,
      }}
    >
      <Icon paths={copied ? I.checkCircle : I.copy} size={13} strokeWidth={2.3} />
      <span>{copied ? 'Nusxalandi!' : label ?? value}</span>
    </button>
  );
}

/**
 * YANGI PRIMITIV: Muhim eslatma va holat banneri
 */
export function InfoBanner({
  icon = I.info,
  tone = 'blue',
  title,
  description,
  action,
  className = '',
}: {
  icon?: readonly string[];
  tone?: Tone;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const c = TONE_COLORS[tone];
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-2xl p-3.5 ${className}`}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.18)',
      }}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.12)', color: c.fg }}
        >
          <Icon paths={icon} size={15} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold leading-snug" style={{ color: c.fg }}>
            {title}
          </p>
          {description && (
            <p className="mt-0.5 text-[11.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}