import {
  useId,
  useState,
  useEffect,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  type SVGProps,
} from 'react';
import { motion, type Variants, type HTMLMotionProps } from 'framer-motion';

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
    transition: { staggerChildren: 0.055, delayChildren: 0.015 },
  },
};

/**
 * GPU-SAFE STAGGER: Removed dynamic `filter: blur()` to prevent dual-pass
 * compositing lag when combined with `backdrop-filter: blur(32px)`.
 */
export const STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.982 },
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
  xCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  alertCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v4', 'M12 16h.01'],
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

// Singleton Intl formatters — avoids re-instantiating heavy ICU objects on every render
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
 * TIMEZONE-SAFE DAY CHECK:
 * Properly converts UTC ISO strings to local Uzbekistan time before comparing day boundaries.
 */
export function sameDayStr(iso?: string | null): boolean {
  if (!iso) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso === todayKey();
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
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
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return SHORT_DATE_FORMATTER.format(d);
}

export function formatDue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const time = TIME_FORMATTER.format(d);
  const targetKey = toLocalDateKey(d);

  if (targetKey === toLocalDateKey(today)) return `Bugun, ${time}`;
  if (targetKey === toLocalDateKey(tomorrow)) return `Ertaga, ${time}`;
  return `${SHORT_DATE_FORMATTER.format(d)}, ${time}`;
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);

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

export function getInitials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase() || 'M';
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
};

export const INVOICE_STATUS: Readonly<Record<string, { label: string; tone: Tone }>> = {
  ISSUED: { label: 'Chiqarilgan', tone: 'blue' },
  PARTIALLY_PAID: { label: "Qisman to'langan", tone: 'orange' },
  PAID: { label: "To'langan", tone: 'green' },
  OVERDUE: { label: "Muddati o'tgan", tone: 'red' },
  REFUNDED: { label: 'Qaytarilgan', tone: 'slate' },
};

export const ASSIGNMENT_LABELS: Readonly<Record<string, string>> = {
  DRAFT: 'Qoralama',
  PUBLISHED: 'Faol',
  CLOSED: 'Yopilgan',
  ARCHIVED: 'Arxivlangan',
};

export const XP_TYPE_LABELS: Readonly<Record<string, string>> = {
  ATTENDANCE_ON_TIME: "Vaqtida davomat",
  HOMEWORK_ON_TIME_GOOD_GRADE: "A'lo uy vazifasi",
  EXAM_HIGH_SCORE: 'Yuqori imtihon natijasi',
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
  MANAGER: 'Menejer',
  TEACHER: "O'qituvchi",
  ASSISTANT: 'Asistent',
  PARENT: 'Ota-ona',
  STUDENT: "O'quvchi",
};

/* ============================================================================
 * 6. iOS 27 SPATIAL LIQUID GLASS ENGINE (Chromatic & Specular Physics)
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
    ['--text-primary' as string]: textPrimary,
    ['--text-secondary' as string]: light ? '#334155' : '#CBD5E1',
    ['--text-tertiary' as string]: light ? '#64748B' : '#94A3B8',
    ['--glass-bg' as string]: light
      ? 'linear-gradient(145deg, rgba(255,255,255,0.84) 0%, rgba(255,255,255,0.56) 100%)'
      : 'linear-gradient(145deg, rgba(30,41,59,0.62) 0%, rgba(15,23,42,0.44) 100%)',
    ['--glass-border' as string]: light
      ? 'rgba(255,255,255,0.92)'
      : 'rgba(255,255,255,0.13)',
    ['--glass-specular' as string]: light
      ? 'rgba(255,255,255,1)'
      : 'rgba(255,255,255,0.26)',
    ['--glass-shadow' as string]: light
      ? '0 22px 48px -14px rgba(15,23,42,0.08), 0 4px 14px -2px rgba(15,23,42,0.04)'
      : '0 28px 56px -12px rgba(0,0,0,0.65), 0 6px 20px -4px rgba(0,0,0,0.45)',
    ['--border-subtle' as string]: light
      ? 'rgba(15,23,42,0.065)'
      : 'rgba(255,255,255,0.075)',
  } as CSSProperties;
}

export const LIQUID_GLASS_CSS = `
  /* Apple iOS 27 / visionOS 4 Spatial Liquid Glass */
  .liquid-glass {
    position: relative;
    border-radius: 30px;
    background: var(--glass-bg);
    backdrop-filter: blur(32px) saturate(200%);
    -webkit-backdrop-filter: blur(32px) saturate(200%);
    border: 1px solid var(--glass-border);
    box-shadow:
      var(--glass-shadow),
      inset 0 1.25px 0 0 var(--glass-specular),
      inset 1px 0 0 0 color-mix(in srgb, var(--glass-specular) 40%, transparent),
      inset 0 -1px 0 0 rgba(0, 0, 0, 0.16);
    overflow: hidden;
    transform: translateZ(0);
  }

  /* iOS 27 Refractive Rim Light */
  .liquid-glass::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      118deg,
      rgba(255, 255, 255, 0.25) 0%,
      rgba(255, 255, 255, 0.05) 30%,
      transparent 50%,
      rgba(255, 255, 255, 0.07) 100%
    );
    pointer-events: none;
    z-index: 0;
  }

  /* Sub-surface Chromatic Caustic Refractions */
  .liquid-tone-green { background-image: radial-gradient(125% 105% at 12% -18%, rgba(16,185,129,0.22), transparent 62%), var(--glass-bg); }
  .liquid-tone-red { background-image: radial-gradient(125% 105% at 12% -18%, rgba(255,69,58,0.20), transparent 62%), var(--glass-bg); }
  .liquid-tone-orange { background-image: radial-gradient(125% 105% at 12% -18%, rgba(245,158,11,0.20), transparent 62%), var(--glass-bg); }
  .liquid-tone-blue { background-image: radial-gradient(125% 105% at 12% -18%, rgba(10,132,255,0.22), transparent 62%), var(--glass-bg); }
  .liquid-tone-purple { background-image: radial-gradient(125% 105% at 12% -18%, rgba(139,92,246,0.22), transparent 62%), var(--glass-bg); }
  .liquid-tone-slate { background-image: radial-gradient(125% 105% at 12% -18%, rgba(148,163,184,0.16), transparent 62%), var(--glass-bg); }

  /* Carved Inner Glass Well */
  .liquid-inset {
    background: color-mix(in srgb, var(--text-primary) 4.8%, transparent);
    border: 1px solid var(--border-subtle);
    box-shadow:
      inset 0 1px 2px 0 rgba(0, 0, 0, 0.08),
      0 1px 0 0 rgba(255, 255, 255, 0.08);
    border-radius: 22px;
  }

  /* Floating Spatial Tab Dock */
  .liquid-dock {
    background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
    backdrop-filter: blur(40px) saturate(220%);
    -webkit-backdrop-filter: blur(40px) saturate(220%);
    border: 1px solid var(--glass-border);
    box-shadow:
      0 26px 64px -12px rgba(0, 0, 0, 0.55),
      inset 0 1.25px 0 0 var(--glass-specular);
  }

  /* iOS 27 Fluid Iridescent Primary Button */
  .liquid-btn-primary {
    background: linear-gradient(135deg, #0A84FF 0%, #4F46E5 52%, #7C3AED 100%);
    box-shadow:
      0 12px 28px -8px rgba(79, 70, 229, 0.65),
      inset 0 1.25px 0 0 rgba(255, 255, 255, 0.45),
      inset 0 -1px 0 0 rgba(0, 0, 0, 0.25);
  }

  .liquid-btn-ghost {
    background: color-mix(in srgb, var(--text-primary) 6.5%, transparent);
    border: 1px solid var(--glass-border);
    box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.16);
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
      color-mix(in srgb, var(--text-primary) 8%, transparent) 50%,
      transparent 100%
    );
    animation: liquidShimmer 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  /* Ambient Spatial Orbs */
  @keyframes orbFloat {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(-18px, 22px, 0) scale(1.08); }
  }
  .ambient-orb-1 { animation: orbFloat 14s ease-in-out infinite; will-change: transform; }
  .ambient-orb-2 { animation: orbFloat 18s ease-in-out infinite reverse; will-change: transform; }

  /* Clean Scrollbars */
  .medu-scroll-x { scrollbar-width: none; -ms-overflow-style: none; }
  .medu-scroll-x::-webkit-scrollbar { display: none; }
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

export function Surface({
  children,
  className = '',
  tone,
  interactive = false,
  style,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
  interactive?: boolean;
  style?: CSSProperties;
} & Omit<HTMLMotionProps<'div'>, 'style'>) {
  return (
    <motion.div
      variants={STAGGER_ITEM}
      whileTap={interactive ? { scale: 0.982 } : undefined}
      transition={SPRING_SNAPPY}
      className={`liquid-glass ${tone ? `liquid-tone-${tone}` : ''} ${
        interactive ? 'cursor-pointer select-none' : ''
      } ${className}`}
      style={style}
      {...rest}
    >
      <div className="relative z-10">{children}</div>
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
      <span className=" leading-none">{children}</span>
    </span>
  );
}

export function Btn({
  children,
  tone = 'primary',
  loading = false,
  disabled,
  className = '',
  ...rest
}: {
  children: ReactNode;
  tone?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'tap-target relative inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-bold tracking-tight transition-all duration-150 active:scale-[0.96] active:brightness-110 disabled:pointer-events-none disabled:opacity-45 overflow-hidden select-none';
  const cls =
    tone === 'primary'
      ? 'liquid-btn-primary text-white'
      : tone === 'danger'
        ? 'liquid-btn-ghost text-[#FF453A]'
        : 'liquid-btn-ghost text-[var(--text-primary)]';

  return (
    <button
      type="button"
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
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gid = `ring-grad-${uid}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const [from, to] = RING_GRADIENTS[tone];

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
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ type: 'spring', stiffness: 75, damping: 19, mass: 0.95 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-[15px] font-black leading-none tabular-nums tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {center ?? `${Math.round(pct)}%`}
        </span>
        {sub && (
          <span
            className="mt-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {sub}
          </span>
        )}
      </div>
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

  // STALE STATE FIX: Reset error state whenever photo URL changes (e.g. switching children)
  useEffect(() => {
    setImgFailed(false);
  }, [photo]);

  const radius = Math.round(size * 0.34);
  const fontSize = Math.max(11, Math.round(size * 0.34));

  return (
    <div
      className="relative shrink-0 overflow-hidden select-none transition-shadow duration-300"
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
          style={{ fontSize }}
        >
          {getInitials(name)}
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
      <div className="flex items-center gap-2.5 min-w-0">
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