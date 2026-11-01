'use client';

/**
 * ============================================================================
 * M-EDU SpatialIdentityCard360 — v2 (Wallet-grade iOS pass)
 * ============================================================================
 *
 * Design intent
 *  • One calm material, one accent. Role colour appears only in the wash,
 *    the role label and the fallback avatar — never as a rainbow gradient.
 *  • SF type hierarchy (semibold, not 800/900), sentence-case labels,
 *    nothing below 12px, grouped-list back side like iOS Settings / Wallet.
 *  • Glass is a *surface treatment* (specular edge + moving sheen), not
 *    `backdrop-filter` — blur inside a 3D-transformed tree breaks in
 *    WKWebView (Telegram iOS) and is the #1 GPU cost of the old version.
 *
 * Interaction
 *  • Tap = spin forward 180° (two taps is a true 360°).
 *  • Drag horizontally = spin with the finger, release snaps to the nearest
 *    face with fling velocity.
 *  • Mouse hover = restrained tilt + sheen. Touch never tilts (scroll-safe).
 *  • Haptics via Telegram WebApp, falling back to navigator.vibrate.
 *
 * Props
 *  • `qr` — pass a REAL QR (e.g. <QRCodeSVG value={…} />). The previous
 *    version drew a random, non-scannable pattern that looked like a QR on
 *    an ID card. That is removed; without `qr` the tile is simply omitted.
 * ============================================================================
 */

import * as React from 'react';
import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { RealQrCode } from '../ui/RealQrCode';
import { AppleWalletPassModal } from './AppleWalletPassModal';

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ════════════════════════════════════════════════════════════════════════ */

export type IdentityRole =
  | 'STUDENT'
  | 'TEACHER'
  | 'ADMIN'
  | 'MANAGER'
  | 'STAFF'
  | 'USER'
  | 'PARENT';

type ResolvedRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'STAFF' | 'PARENT' | 'USER';

export interface IdentityCardData {
  id: string;
  fullName: string;
  role: IdentityRole | string;
  avatarUrl?: string | null;
  orgName?: string | null;
  organizationName?: string | null;
  phone?: string | null;
  email?: string | null;
  codeOrId?: string | null;
  joinedDate?: string | null;
  /* Student */
  attendanceRate?: number;
  gpaOrMastery?: number;
  groupName?: string | null;
  coursesCount?: number;
  /* Teacher */
  rating?: number;
  lessonsCount?: number;
  activeGroupsCount?: number;
  specialty?: string | null;
  /* Staff */
  department?: string | null;
  clearanceLevel?: string | null;
  status?: string | null;
  biometricVerified?: boolean;
  nfcEnabled?: boolean;
}

export interface SpatialIdentityCard360Props {
  data: IdentityCardData;
  className?: string;
  onShare?: () => void;
  /** A real, scannable QR element (SVG / canvas / img). If omitted, an authentic ISO/IEC 18004 QR is generated automatically. */
  qr?: React.ReactNode;
  /** Explicit payload or URL to encode in the real QR code. Defaults to `${origin}/verify/${data.codeOrId || data.id}` */
  qrValue?: string;
}

/* ══════════════════════════════════════════════════════════════════════════
 * UTILITIES
 * ════════════════════════════════════════════════════════════════════════ */

const isBrowser = typeof window !== 'undefined';

const clamp = (value: number, min = 0, max = 100): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Cumulative angle (multiple of 180) → which face is toward the viewer. */
const isBackSide = (angle: number): boolean => Math.abs(Math.round(angle / 180)) % 2 === 1;

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

interface TelegramHaptics {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
}

/** Best-effort haptics: Telegram WebApp → Vibration API → nothing. */
function haptic(kind: 'light' | 'success'): void {
  if (!isBrowser) return;
  try {
    const hf = (
      window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: TelegramHaptics } } }
    ).Telegram?.WebApp?.HapticFeedback;
    if (hf) {
      if (kind === 'success') hf.notificationOccurred('success');
      else hf.impactOccurred('light');
      return;
    }
    navigator.vibrate?.(kind === 'success' ? [10, 40, 10] : 8);
  } catch {
    /* haptics are optional */
  }
}

/** Clipboard with a fallback for WebViews / non-secure contexts. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * DESIGN TOKENS (iOS system palette, contrast-checked text variants)
 * ════════════════════════════════════════════════════════════════════════ */

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Segoe UI", Roboto, sans-serif';

const INK = 'text-[#1C1C1E] dark:text-white';
const SUB = 'text-[#636366] dark:text-[#98989D]';
const ACC_TEXT = 'text-[color:var(--acc-l)] dark:text-[color:var(--acc-d)]';
const HAIR_B = 'border-[rgba(60,60,67,0.14)] dark:border-[rgba(84,84,88,0.5)]';
const HAIR_DIVIDE = 'divide-[rgba(60,60,67,0.12)] dark:divide-[rgba(84,84,88,0.5)]';
const CELL = 'bg-white dark:bg-[#1C1C1E]';

const FACE =
  'absolute inset-0 overflow-hidden rounded-[36px] ' +
  'shadow-[0_0_0_0.5px_rgba(60,60,67,0.16),0_2px_4px_rgba(0,0,0,0.04),0_22px_44px_-14px_rgba(0,0,0,0.28)] ' +
  'dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.14),0_2px_4px_rgba(0,0,0,0.3),0_26px_52px_-14px_rgba(0,0,0,0.75)]';

const EDGE =
  'pointer-events-none absolute inset-0 rounded-[inherit] ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_0_0_0.5px_rgba(255,255,255,0.5)] ' +
  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_0_0_0.5px_rgba(255,255,255,0.05)]';

type Tone = 'ink' | 'good' | 'warn' | 'bad' | 'info' | 'muted';

const TONE: Record<Tone, { text: string; bar: string }> = {
  ink: { text: INK, bar: 'bg-[#1C1C1E] dark:bg-white' },
  good: { text: 'text-[#1E7B34] dark:text-[#30D158]', bar: 'bg-[#34C759]' },
  warn: { text: 'text-[#B25000] dark:text-[#FF9F0A]', bar: 'bg-[#FF9F0A]' },
  bad: { text: 'text-[#D70015] dark:text-[#FF453A]', bar: 'bg-[#FF453A]' },
  info: { text: 'text-[#0062CC] dark:text-[#409CFF]', bar: 'bg-[#0A84FF]' },
  muted: { text: SUB, bar: 'bg-[#8E8E93]' },
};

const PILL: Record<'good' | 'warn' | 'bad', { box: string; dot: string }> = {
  good: {
    box: 'bg-[#34C759]/15 text-[#1E7B34] dark:bg-[#30D158]/20 dark:text-[#30D158]',
    dot: 'bg-[#34C759]',
  },
  warn: {
    box: 'bg-[#FF9F0A]/15 text-[#B25000] dark:bg-[#FF9F0A]/20 dark:text-[#FF9F0A]',
    dot: 'bg-[#FF9F0A]',
  },
  bad: {
    box: 'bg-[#FF453A]/15 text-[#D70015] dark:bg-[#FF453A]/20 dark:text-[#FF453A]',
    dot: 'bg-[#FF453A]',
  },
};

interface RoleTheme {
  badge: string;
  accent: string; // fills
  textL: string; // text on light surfaces (≥4.5:1)
  textD: string; // text on dark surfaces
}

const ROLE_THEME: Record<ResolvedRole, RoleTheme> = {
  STUDENT: { badge: 'Talaba', accent: '#0A84FF', textL: '#0062CC', textD: '#409CFF' },
  TEACHER: { badge: "O'qituvchi", accent: '#AF52DE', textL: '#8E3FB8', textD: '#BF5AF2' },
  ADMIN: { badge: 'Administrator', accent: '#5E5CE6', textL: '#4B49C8', textD: '#7D7AFF' },
  STAFF: { badge: 'Xodim', accent: '#FF9F0A', textL: '#B25000', textD: '#FF9F0A' },
  PARENT: { badge: 'Ota-ona', accent: '#FF2D55', textL: '#C8123F', textD: '#FF6482' },
  USER: { badge: 'Foydalanuvchi', accent: '#8E8E93', textL: '#636366', textD: '#AEAEB2' },
};

function resolveRole(raw: unknown): ResolvedRole {
  // Strip every apostrophe variant so O'QITUVCHI / OʻQITUVCHI / OQITUVCHI all match.
  const r = String(raw ?? '')
    .toUpperCase()
    .replace(/[’'`ʻʼ‘]/g, '');
  if (/TEACHER|USTOZ|OQITUVCHI|MUALLIM/.test(r)) return 'TEACHER';
  if (/ADMIN|MANAGER|RAHBAR|DIREKTOR/.test(r)) return 'ADMIN';
  if (/STAFF|XODIM/.test(r)) return 'STAFF';
  if (/PARENT|OTA[\s_-]?ONA/.test(r)) return 'PARENT';
  if (/STUDENT|TALABA|OQUVCHI/.test(r)) return 'STUDENT';
  return 'USER';
}

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS (SF-Symbols-like, 1.8 stroke)
 * ════════════════════════════════════════════════════════════════════════ */

const svgBase = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function NfcWaveIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...svgBase} className={className}>
      <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" />
      <path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" />
      <path d="M12.91 4.1a15.91 15.91 0 0 1 .01 15.8" />
      <path d="M16.37 2a20.16 20.16 0 0 1 0 20" />
    </svg>
  );
}

function FlipIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...svgBase} className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function CopyIcon({ copied, className = 'h-4 w-4' }: { copied: boolean; className?: string }) {
  return copied ? (
    <svg {...svgBase} strokeWidth={2.4} className={`${className} text-[#34C759]`}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ) : (
    <svg {...svgBase} className={className}>
      <rect width="14" height="14" x="8" y="8" rx="3" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function ShareIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg {...svgBase} className={className}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * PRESENTATIONAL PIECES
 * ════════════════════════════════════════════════════════════════════════ */

interface Metric {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  progress?: number;
}

function MetricCell({ label, value, hint, tone = 'ink', progress }: Metric) {
  const t = TONE[tone];
  const size =
    value.length <= 6
      ? 'truncate text-[22px] leading-7'
      : value.length <= 12
        ? 'truncate text-[17px] leading-7'
        : 'line-clamp-2 text-[15px] leading-[18px]';

  return (
    <div className={`flex min-h-[80px] min-w-0 flex-col justify-between px-3.5 py-2.5 ${CELL}`}>
      <p className={`truncate text-[12px] font-medium leading-4 ${SUB}`}>{label}</p>
      <p className={`${size} font-semibold tabular-nums tracking-[-0.02em] ${t.text}`}>{value}</p>
      {progress !== undefined ? (
        <>
          <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(clamp(progress))}
            className="h-1 w-full overflow-hidden rounded-full bg-[rgba(120,120,128,0.18)]"
          >
            <div
              className={`h-full rounded-full ${t.bar}`}
              style={{ width: `${clamp(progress)}%` }}
            />
          </div>
          {hint && <span className="sr-only">{hint}</span>}
        </>
      ) : (
        hint && <p className={`truncate text-[12px] leading-4 ${SUB}`}>{hint}</p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[38px] items-center justify-between gap-4 px-3.5 py-2">
      <span className={`shrink-0 text-[14px] ${SUB}`}>{label}</span>
      <span className={`min-w-0 truncate text-[14px] font-medium ${INK}`}>{value}</span>
    </div>
  );
}

function DockButton({
  onClick,
  label,
  children,
  primary = false,
}: {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  label: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        'inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold ' +
        'transition-[background-color,transform] duration-150 active:scale-[0.96] motion-reduce:transition-none ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] ' +
        (primary
          ? 'bg-[#1C1C1E] text-white dark:bg-white dark:text-[#1C1C1E]'
          : `${INK} hover:bg-black/[0.05] dark:hover:bg-white/10`)
      }
    >
      {children}
    </button>
  );
}

/**
 * Specular & Holographic Diffraction Sheen.
 * Compositor-only: hardware-accelerated transform + opacity with spectral rainbow dispersal.
 */
const Sheen = React.memo(function Sheen({
  x,
  y,
  o,
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  o: MotionValue<number>;
}) {
  const tx = useTransform(x, (v) => `${(v - 0.5) * 110}%`);
  const ty = useTransform(y, (v) => `${(v - 0.5) * 110}%`);
  const rot = useTransform(x, (v) => `${(v - 0.5) * 45 + 30}deg`);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]"
    >
      {/* 1. Holographic Rainbow Dispersion Foil */}
      <motion.div
        className="absolute inset-[-50%] mix-blend-color-dodge opacity-50 dark:opacity-35 pointer-events-none"
        style={{
          x: tx,
          y: ty,
          rotate: rot,
          opacity: o,
          background:
            'linear-gradient(115deg, transparent 15%, rgba(255,0,128,0.25) 30%, rgba(255,215,0,0.3) 45%, rgba(0,255,180,0.3) 55%, rgba(0,180,255,0.3) 70%, rgba(180,0,255,0.25) 85%, transparent 95%)',
        }}
      />
      {/* 2. Specular Core Highlight */}
      <motion.div
        className="absolute inset-0 [--sheen:rgba(255,255,255,0.92)] dark:[--sheen:rgba(255,255,255,0.18)]"
        style={{
          x: tx,
          y: ty,
          opacity: o,
          background:
            'radial-gradient(ellipse 60% 45% at 50% 50%, var(--sheen), transparent 70%)',
        }}
      />
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ════════════════════════════════════════════════════════════════════════ */

const INTERACTIVE = 'button, a, input, [data-no-flip]';
const DEG_PER_PX = 0.55; // ≈ 330px of drag for a half turn on a 380px card
const HIDE_BACKFACE: React.CSSProperties = {
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
};

interface Gesture {
  down: boolean;
  moved: boolean;
  x0: number;
  y0: number;
  a0: number;
  lastX: number;
  lastT: number;
  v: number; // smoothed px/ms
}

function SpatialIdentityCard360Impl({
  data,
  className = '',
  onShare,
  qr,
  qrValue,
}: SpatialIdentityCard360Props) {
  /* ── refs ────────────────────────────────────────────────────────────── */
  const stageRef = React.useRef<HTMLDivElement>(null);
  const frontRef = React.useRef<HTMLDivElement>(null);
  const backRef = React.useRef<HTMLDivElement>(null);
  const rectRef = React.useRef<DOMRect | null>(null);
  const rectStale = React.useRef(true);
  const angleRef = React.useRef(0);
  const gesture = React.useRef<Gesture>({
    down: false,
    moved: false,
    x0: 0,
    y0: 0,
    a0: 0,
    lastX: 0,
    lastT: 0,
    v: 0,
  });
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── state ───────────────────────────────────────────────────────────── */
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [avatarFailed, setAvatarFailed] = React.useState(false);
  const [walletModalOpen, setWalletModalOpen] = React.useState(false);

  const reduceMotion = Boolean(useReducedMotion());

  /* ── motion values ───────────────────────────────────────────────────── */
  const flip = useSpring(0, {
    stiffness: reduceMotion ? 800 : 210,
    damping: reduceMotion ? 80 : 25,
    mass: reduceMotion ? 0.3 : 0.9,
  });
  const tiltX = useSpring(0, { stiffness: 220, damping: 26, mass: 0.6 });
  const tiltY = useSpring(0, { stiffness: 220, damping: 26, mass: 0.6 });
  const press = useSpring(1, { stiffness: 380, damping: 30 });
  const sheenX = useSpring(0.5, { stiffness: 180, damping: 24 });
  const sheenY = useSpring(0.5, { stiffness: 180, damping: 24 });
  const sheenO = useSpring(0, { stiffness: 200, damping: 28 });

  const rotateY = useTransform([flip, tiltY], (latest: number[]) => {
    const [f = 0, t = 0] = latest;
    return f + t;
  });

  /* ── derived data ────────────────────────────────────────────────────── */
  const role = React.useMemo(() => resolveRole(data.role), [data.role]);
  const theme = ROLE_THEME[role];

  const name = data.fullName?.trim() || 'Ism kiritilmagan';
  const safeId = String(data.id ?? '').trim();
  const orgName = data.organizationName || data.orgName || 'M-EDU';
  const isVerified = Boolean(data.biometricVerified);
  const nfcEnabled = Boolean(data.nfcEnabled);
  const showAvatar = Boolean(data.avatarUrl) && !avatarFailed;
  const joined = formatDate(data.joinedDate);

  const displayId = React.useMemo(() => {
    if (data.codeOrId) return data.codeOrId;
    const compact = safeId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
    return compact ? `ID-${compact}` : 'ID-—';
  }, [data.codeOrId, safeId]);

  const computedQrValue = React.useMemo(() => {
    if (qrValue) return qrValue;
    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://m-edu.uz';
    const cleanId = data.codeOrId || data.id;
    return `${origin}/verify/${encodeURIComponent(cleanId)}`;
  }, [qrValue, data.codeOrId, data.id]);

  const initials = React.useMemo(() => {
    const letters = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
    return letters || 'M';
  }, [name]);

  const subtitle = data.groupName
    ? `Guruh: ${data.groupName}`
    : data.specialty || data.department || data.email || undefined;

  const statusText = data.status?.trim() || 'Faol';
  const statusTone: 'good' | 'warn' | 'bad' = /blok|nofaol|inactive|suspend|arxiv|expired|tugagan/i.test(
    statusText,
  )
    ? 'bad'
    : /kut|pending|wait|tekshir/i.test(statusText)
      ? 'warn'
      : 'good';

  const themeVars = {
    '--acc': theme.accent,
    '--acc-l': theme.textL,
    '--acc-d': theme.textD,
  } as React.CSSProperties;

  /* ── metrics ─────────────────────────────────────────────────────────── */
  const metrics = React.useMemo<Metric[]>(() => {
    const faceId: Metric = {
      label: 'Face ID',
      value: isVerified ? 'Tasdiqlangan' : 'Kiritilmagan',
      hint: isVerified ? 'Biometriya faol' : 'Kutish holatida',
      tone: isVerified ? 'good' : 'muted',
    };

    if (role === 'STUDENT') {
      const att = isNum(data.attendanceRate) && data.attendanceRate >= 0 ? clamp(data.attendanceRate) : null;
      const mas = isNum(data.gpaOrMastery) && data.gpaOrMastery >= 0 ? clamp(data.gpaOrMastery) : null;
      const groups =
        isNum(data.coursesCount) && data.coursesCount >= 0
          ? Math.floor(data.coursesCount)
          : data.groupName
            ? 1
            : 0;

      return [
        {
          label: 'Davomat',
          value: att === null ? '—' : `${Math.round(att)}%`,
          hint:
            att === null
              ? 'Darslar kutilmoqda'
              : att >= 80
                ? "A'lo qatnashish"
                : att >= 60
                  ? "O'rtacha"
                  : 'Past davomat',
          tone: att === null ? 'muted' : att >= 80 ? 'good' : att >= 60 ? 'warn' : 'bad',
          progress: att ?? undefined,
        },
        {
          label: "O'zlashtirish",
          value: mas === null ? '—' : `${Math.round(mas)}%`,
          hint: mas === null ? 'Hali baholanmagan' : mas >= 85 ? "Yuqori ko'rsatkich" : 'Joriy natija',
          tone: mas === null ? 'muted' : mas >= 80 ? 'info' : 'warn',
          progress: mas ?? undefined,
        },
        { label: 'Guruhlar', value: `${groups} ta`, hint: data.groupName || 'Biriktirilgan kurslar' },
        faceId,
      ];
    }

    if (role === 'TEACHER') {
      const groups =
        isNum(data.activeGroupsCount) && data.activeGroupsCount >= 0
          ? Math.floor(data.activeGroupsCount)
          : 0;
      const lessons = isNum(data.lessonsCount) && data.lessonsCount >= 0 ? Math.floor(data.lessonsCount) : null;
      const rating = isNum(data.rating) && data.rating > 0 ? data.rating : null;

      const activity: Metric =
        lessons !== null
          ? { label: 'Darslar', value: `${lessons} ta`, hint: "O'tilgan darslar", tone: 'good' }
          : rating !== null
            ? { label: 'Reyting', value: rating.toFixed(1), hint: 'Talabalar bahosi', tone: 'warn' }
            : { label: 'Reyting', value: '—', hint: 'Baholanmagan', tone: 'muted' };

      return [
        { label: 'Faol guruhlar', value: `${groups} ta`, hint: 'Hozirgi yuklama', tone: 'info' },
        {
          label: 'Mutaxassislik',
          value: data.specialty || '—',
          hint: data.department || "Akademik yo'nalish",
          tone: data.specialty ? 'ink' : 'muted',
        },
        activity,
        faceId,
      ];
    }

    return [
      { label: 'Rol', value: theme.badge, hint: 'Tizimdagi huquq' },
      data.department || data.specialty
        ? {
            label: "Bo'lim",
            value: (data.department || data.specialty) as string,
            hint: 'Tashkiliy tuzilma',
          }
        : { label: 'Tashkilot', value: orgName, hint: 'Biriktirilgan' },
      data.clearanceLevel
        ? { label: 'Ruxsat darajasi', value: data.clearanceLevel, hint: 'Kirish huquqi' }
        : {
            label: 'Holat',
            value: statusText,
            hint: isVerified ? 'Xavfsiz autentifikatsiya' : 'Standart kirish',
            tone: statusTone === 'good' ? 'good' : statusTone,
          },
      faceId,
    ];
  }, [role, theme.badge, orgName, isVerified, statusText, statusTone, data]);

  /* ── effects ─────────────────────────────────────────────────────────── */
  React.useEffect(() => {
    setAvatarFailed(false);
  }, [data.avatarUrl]);

  // The hidden face must not be focusable or readable by assistive tech.
  React.useEffect(() => {
    frontRef.current?.toggleAttribute('inert', isFlipped);
    backRef.current?.toggleAttribute('inert', !isFlipped);
  }, [isFlipped]);

  // Rect cache: measured lazily from the UNROTATED stage, invalidated by scroll/resize.
  React.useEffect(() => {
    if (!isBrowser) return;
    const stale = () => {
      rectStale.current = true;
    };
    window.addEventListener('scroll', stale, { passive: true, capture: true });
    window.addEventListener('resize', stale, { passive: true });
    return () => {
      window.removeEventListener('scroll', stale, true);
      window.removeEventListener('resize', stale);
    };
  }, []);

  React.useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  /* ── interaction ─────────────────────────────────────────────────────── */
  const readRect = React.useCallback((): DOMRect | null => {
    if (rectStale.current && stageRef.current) {
      rectRef.current = stageRef.current.getBoundingClientRect();
      rectStale.current = false;
    }
    return rectRef.current;
  }, []);

  const resetHover = React.useCallback(() => {
    tiltX.set(0);
    tiltY.set(0);
    sheenO.set(0);
  }, [tiltX, tiltY, sheenO]);

  /** Single place that changes the face — keeps angle, state and spring in sync. */
  const commit = React.useCallback(
    (target: number) => {
      const before = isBackSide(angleRef.current);
      angleRef.current = target;
      flip.set(target);
      const after = isBackSide(target);
      if (after !== before) {
        setIsFlipped(after);
        haptic('light');
      }
    },
    [flip],
  );

  const spin = React.useCallback(() => {
    resetHover();
    commit(angleRef.current + 180);
  }, [commit, resetHover]);

  const track = React.useCallback(
    (e: React.PointerEvent, withTilt: boolean) => {
      const rect = readRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const px = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const py = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      sheenX.set(px);
      sheenY.set(py);
      sheenO.set(1);
      if (withTilt) {
        tiltX.set(-(py - 0.5) * 14);
        tiltY.set(-(px - 0.5) * 16);
      }
    },
    [readRect, sheenX, sheenY, sheenO, tiltX, tiltY],
  );

  const onPointerEnter = React.useCallback(() => {
    rectStale.current = true;
  }, []);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      rectStale.current = true;
      gesture.current = {
        down: true,
        moved: false,
        x0: e.clientX,
        y0: e.clientY,
        a0: angleRef.current,
        lastX: e.clientX,
        lastT: e.timeStamp,
        v: 0,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety */
      }
      if (!reduceMotion) press.set(0.985);
    },
    [press, reduceMotion],
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const g = gesture.current;

      if (g.down) {
        const dx = e.clientX - g.x0;
        const dy = e.clientY - g.y0;
        if (!g.moved && Math.hypot(dx, dy) > 6) g.moved = true;
        if (g.moved) {
          const dt = e.timeStamp - g.lastT;
          if (dt > 0) g.v = 0.8 * g.v + 0.2 * ((e.clientX - g.lastX) / dt);
          g.lastX = e.clientX;
          g.lastT = e.timeStamp;
          tiltX.set(0);
          tiltY.set(0);
          flip.set(g.a0 + dx * DEG_PER_PX);
          if (!reduceMotion) track(e, false);
        }
        return;
      }

      if (e.pointerType !== 'mouse' || reduceMotion) return;
      track(e, true);
    },
    [flip, reduceMotion, tiltX, tiltY, track],
  );

  const onPointerUp = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const g = gesture.current;
      if (!g.down) return;
      g.down = false;
      press.set(1);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }

      if (!g.moved) {
        spin(); // tap
        return;
      }

      const dx = e.clientX - g.x0;
      const projected = g.a0 + dx * DEG_PER_PX + g.v * DEG_PER_PX * 220; // ~220ms of fling
      const snapped = Math.round(projected / 180) * 180;
      commit(Math.min(g.a0 + 180, Math.max(g.a0 - 180, snapped)));
      if (e.pointerType !== 'mouse') sheenO.set(0);
    },
    [commit, press, sheenO, spin],
  );

  const onPointerCancel = React.useCallback(() => {
    // Browser took the gesture (vertical scroll) — return to the current face.
    const g = gesture.current;
    if (g.down) {
      g.down = false;
      flip.set(angleRef.current);
    }
    press.set(1);
    resetHover();
  }, [flip, press, resetHover]);

  const onPointerLeave = React.useCallback(() => {
    if (!gesture.current.down) resetHover();
  }, [resetHover]);

  const handleCopy = React.useCallback(
    async (event?: React.SyntheticEvent) => {
      event?.stopPropagation();
      const value = data.codeOrId || safeId;
      if (!value) return;
      if (await copyText(value)) {
        haptic('success');
        setCopied(true);
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 1800);
      }
    },
    [data.codeOrId, safeId],
  );

  const handleShare = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      haptic('light');
      onShare?.();
    },
    [onShare],
  );

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div
      className={`relative flex flex-col items-center p-2 antialiased ${className}`}
      style={{ fontFamily: FONT, ...themeVars }}
    >
      {/* 3D stage (never rotated — used for pointer measurements) */}
      <div
        ref={stageRef}
        style={{ perspective: 1400, perspectiveOrigin: '50% 50%' }}
        className="relative h-[520px] w-full max-w-[380px]"
      >
        <motion.div
          role="group"
          aria-roledescription="Ikki tomonlama identifikatsiya kartasi"
          aria-label={`${name} — ${theme.badge}`}
          onPointerEnter={onPointerEnter}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerLeave}
          style={{
            rotateX: tiltX,
            rotateY,
            scale: press,
            transformStyle: 'preserve-3d',
            touchAction: 'pan-y',
            WebkitTouchCallout: 'none',
          }}
          className="absolute inset-0 cursor-grab select-none active:cursor-grabbing"
        >
          {/* ═══════════════════════════ FRONT ═══════════════════════════ */}
          <div
            ref={frontRef}
            aria-hidden={isFlipped}
            className={`${FACE} bg-gradient-to-b from-white to-[#F3F4F8] dark:from-[#2C2C2E] dark:to-[#1C1C1E]`}
            style={HIDE_BACKFACE}
          >
            {/* Role wash — the only place the accent colours the surface */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(130% 55% at 0% 0%, ${theme.accent}26 0%, transparent 70%)`,
              }}
            />
            <div aria-hidden="true" className={EDGE} />
            <Sheen x={sheenX} y={sheenY} o={sheenO} />

            <div className="relative z-10 flex h-full flex-col p-6">
              {/* Brand row */}
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#1C1C1E] text-[15px] font-bold text-white dark:bg-white dark:text-[#1C1C1E]"
                  >
                    {orgName.charAt(0).toUpperCase()}
                  </div>
                  <span className={`truncate text-[15px] font-semibold tracking-[-0.01em] ${INK}`}>
                    {orgName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    title="Rasmiy Tasdiqlangan Guvohnoma"
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-yellow-500/10 px-2.5 text-[10.5px] font-bold tracking-tight text-amber-600 dark:text-amber-400 shadow-2xs"
                  >
                    ★ VERIFIED
                  </span>
                  {nfcEnabled && (
                    <span
                      title="NFC faol"
                      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-[rgba(120,120,128,0.12)] px-2 text-[11.5px] font-semibold ${SUB}`}
                    >
                      <NfcWaveIcon className="h-3.5 w-3.5" />
                      NFC
                    </span>
                  )}
                </div>
              </div>

              {/* Identity */}
              <div className="mt-auto">
                <div className="relative inline-block">
                  {showAvatar ? (
                    <img
                      src={data.avatarUrl as string}
                      alt={name}
                      width={112}
                      height={112}
                      loading="eager"
                      decoding="async"
                      draggable={false}
                      onError={() => setAvatarFailed(true)}
                      className="h-28 w-28 rounded-[32px] object-cover shadow-[0_10px_24px_-10px_rgba(0,0,0,0.4),0_0_0_0.5px_rgba(0,0,0,0.1)]"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className={`grid h-28 w-28 place-items-center rounded-[32px] text-[36px] font-semibold tracking-[-0.02em] shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)] ${ACC_TEXT}`}
                      style={{ background: `${theme.accent}22` }}
                    >
                      {initials}
                    </div>
                  )}
                  {isVerified && (
                    <div
                      title="Face ID bilan tasdiqlangan"
                      role="img"
                      aria-label="Face ID bilan tasdiqlangan"
                      className="absolute -bottom-1.5 -right-1.5 grid h-8 w-8 place-items-center rounded-full bg-[#34C759] text-white ring-[3px] ring-white dark:ring-[#222224]"
                    >
                      <svg {...svgBase} strokeWidth={2.6} className="h-4 w-4">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                  )}
                </div>

                <h2
                  className={`mt-5 line-clamp-2 text-[30px] font-semibold leading-[34px] tracking-[-0.022em] ${INK}`}
                >
                  {name}
                </h2>
                <p className={`mt-2 flex items-center gap-2 text-[15px] font-semibold ${ACC_TEXT}`}>
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-[color:var(--acc)]"
                  />
                  {theme.badge}
                </p>
                {subtitle && <p className={`mt-1 truncate text-[15px] ${SUB}`}>{subtitle}</p>}
              </div>

              {/* Details */}
              <div className={`mt-6 grid grid-cols-2 gap-4 border-t pt-4 ${HAIR_B}`}>
                <div className="min-w-0">
                  <p className={`text-[12px] font-medium ${SUB}`}>
                    {joined ? "Ro'yxatga olingan" : 'Holat'}
                  </p>
                  <p className={`mt-0.5 truncate text-[16px] font-semibold ${INK}`}>
                    {joined ?? statusText}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className={`text-[12px] font-medium ${SUB}`}>ID raqam</p>
                  <button
                    type="button"
                    data-no-flip
                    onClick={handleCopy}
                    aria-label={`ID ${displayId} ni nusxalash`}
                    className={`-my-1 flex max-w-full items-center gap-1.5 rounded-lg py-1 text-left text-[16px] font-semibold tabular-nums ${INK} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]`}
                  >
                    <span className="truncate">{displayId}</span>
                    <CopyIcon copied={copied} className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════ BACK ════════════════════════════ */}
          <div
            ref={backRef}
            aria-hidden={!isFlipped}
            className={`${FACE} bg-[#F2F2F7] dark:bg-[#0A0A0C]`}
            style={{ ...HIDE_BACKFACE, transform: 'rotateY(180deg)' }}
          >
            <div aria-hidden="true" className={EDGE} />
            <Sheen x={sheenX} y={sheenY} o={sheenO} />

            <div className="relative z-10 flex h-full flex-col gap-3 p-5">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                  <p className={`truncate text-[17px] font-semibold tracking-[-0.01em] ${INK}`}>
                    {name}
                  </p>
                  <p className={`truncate text-[13px] font-medium ${ACC_TEXT}`}>{theme.badge}</p>
                </div>
                <span
                  className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold ${PILL[statusTone].box}`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${PILL[statusTone].dot}`}
                  />
                  {statusText}
                </span>
              </div>

              {/* Metrics — hairline grid via 1px gaps over a separator colour */}
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[20px] bg-[rgba(60,60,67,0.12)] dark:bg-[rgba(84,84,88,0.5)]">
                {metrics.map((m) => (
                  <MetricCell key={m.label} {...m} />
                ))}
              </div>

              {/* Contact */}
              <div
                className={`divide-y overflow-hidden rounded-[20px] ${CELL} ${HAIR_DIVIDE}`}
              >
                <InfoRow label="Telefon" value={data.phone || '—'} />
                <InfoRow label="Email" value={data.email || '—'} />
                {joined && <InfoRow label="Ro'yxatga olingan" value={joined} />}
              </div>

              {/* Identifier & Real Scannable QR Code */}
              <div className={`mt-auto flex items-center gap-3 rounded-[20px] p-3.5 ${CELL}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
                    <p className={`text-[12px] font-medium ${SUB}`}>Haqiqiy QR pass</p>
                  </div>
                  <p
                    className={`mt-0.5 truncate font-mono text-[15px] font-semibold tracking-wide ${INK}`}
                  >
                    {displayId}
                  </p>
                  <p className={`mt-0.5 truncate text-[11px] ${SUB}`}>Skanerlash orqali tekshirish</p>
                </div>
                <div
                  className="group/qr relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/10 transition-transform hover:scale-105 active:scale-95 dark:ring-white/20"
                  title={`Skanerlash havolasi: ${computedQrValue}`}
                  data-no-flip
                >
                  {qr ? (
                    <div className="h-full w-full [&>*]:h-full [&>*]:w-full">{qr}</div>
                  ) : (
                    <RealQrCode
                      value={computedQrValue}
                      className="h-full w-full"
                      fgColor="#0A0A0C"
                      bgColor="#FFFFFF"
                      margin={1}
                      title={`Haqiqiy raqamli QR pass: ${displayId}`}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Control dock — 44pt targets, outside the 3D tree so blur is safe here */}
      <div className="mt-5 inline-flex items-center gap-0.5 rounded-full bg-white/75 p-1 shadow-[0_0_0_0.5px_rgba(60,60,67,0.16),0_10px_30px_-10px_rgba(0,0,0,0.25)] backdrop-blur-xl backdrop-saturate-150 dark:bg-[#1C1C1E]/75 dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.14),0_12px_32px_-10px_rgba(0,0,0,0.7)]">
        <DockButton
          onClick={spin}
          label={isFlipped ? "Kartaning old tomonini ko'rsatish" : "Kartaning orqa tomonini ko'rsatish"}
        >
          <FlipIcon className="h-4 w-4" />
          Aylantirish
        </DockButton>
        <DockButton onClick={(e) => void handleCopy(e)} label="ID raqamidan nusxa olish">
          <CopyIcon copied={copied} />
          {copied ? 'Nusxalandi' : 'Nusxalash'}
        </DockButton>
        <DockButton
          onClick={() => {
            haptic('light');
            setWalletModalOpen(true);
          }}
          label="Apple Wallet passini yuklab olish va ko'rish"
        >
          <span className="font-bold text-sm leading-none"></span>
          Wallet
        </DockButton>
        {onShare && (
          <DockButton onClick={handleShare} label="Kartani ulashish" primary>
            <ShareIcon />
            Ulashish
          </DockButton>
        )}
      </div>

      <AppleWalletPassModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        data={data}
      />

      <span aria-live="polite" className="sr-only">
        {copied ? 'ID raqami nusxalandi' : ''}
      </span>
    </div>
  );
}

export const SpatialIdentityCard360 = React.memo(SpatialIdentityCard360Impl);
SpatialIdentityCard360.displayName = 'SpatialIdentityCard360';

export default SpatialIdentityCard360;
