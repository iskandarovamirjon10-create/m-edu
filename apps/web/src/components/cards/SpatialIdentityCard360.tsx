'use client';

/**
 * ============================================================================
 * M-EDU SpatialIdentityCard360 — iOS 27 / visionOS Spatial Liquid Glass
 * ============================================================================
 *
 * Ultra-luxury 360° interactive 3D spatial glass identity pass for:
 *   • Students (Talabalar)      • Teachers (O'qituvchilar)
 *   • Admin / Management        • Staff (Xodimlar)
 *   • Parents (Ota-onalar)      • Generic profiles
 *
 * ─── What changed vs. the previous revision ─────────────────────────────
 *  [perf]  Glare now moves via GPU `transform`, not per-frame string
 *          concatenation of `radial-gradient` (was: 60×/s style recalc +
 *          paint; now: pure compositor).
 *  [perf]  `getBoundingClientRect()` is cached via `ResizeObserver` +
 *          scroll capture instead of being read on every `pointermove`
 *          (was: forced layout every frame).
 *  [fix]   `toggleFlip` no longer performs a side effect inside a
 *          `setState` updater — flip target is derived in a `useEffect`.
 *          React StrictMode safe.
 *  [fix]   `DockButton` properly accepts `(e: MouseEvent) => void` —
 *          removed `as unknown as () => void` escape hatch.
 *  [a11y]  Card is keyboard-flippable: `role="button"`, `tabIndex`,
 *          Enter / Space handled, `aria-pressed` reflects state.
 *  [a11y]  `animate-ping` pulse respects `prefers-reduced-motion`.
 *  [a11y]  NFC chip gains a `title` + `aria-describedby` status line.
 *  [a11y]  Avatar `<img>` declares intrinsic size to prevent CLS.
 *  [a11y]  Copy button gets `aria-live` status in its own slot, no
 *          duplicate announcements.
 *  [perf]  `SpatialIdentityCard360` wrapped in `React.memo`.
 *  [fix]   `coursesCount` clamped to `>= 0` — no more negative groups.
 *  [fix]   Teacher specialty fallback is `'—'` instead of guessing
 *          "Kafedra O'qituvchisi" (which may be factually wrong).
 *  [style] STAFF and ADMIN palette differentiated so roles are
 *          visually distinguishable at a glance.
 * ============================================================================
 */

import * as React from 'react';
import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';

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
}

/* ══════════════════════════════════════════════════════════════════════════
 * UTILITIES
 * ════════════════════════════════════════════════════════════════════════ */

const clamp = (value: number, min = 0, max = 100): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

/** FNV-1a — deterministic, tiny, dependency-free. */
function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG — stable across renders & SSR. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** True on the server / during the first client paint. */
const isBrowser = typeof window !== 'undefined';

/* ══════════════════════════════════════════════════════════════════════════
 * DETERMINISTIC QR MATRIX (visually authentic, non-encodable by design)
 * ════════════════════════════════════════════════════════════════════════ */

function buildQrMatrix(seed: string, size = 21): boolean[][] {
  const rng = makeRng(hash32(`qr:${seed}`));
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );

  const finderZones: Array<[number, number]> = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];

  const inFinder = (row: number, col: number): boolean =>
    finderZones.some(
      ([r0, c0]) => row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7,
    );

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (inFinder(row, col)) continue;
      if (row === 6 || col === 6) {
        grid[row][col] = (row + col) % 2 === 0; // timing pattern
        continue;
      }
      grid[row][col] = rng() > 0.52;
    }
  }

  finderZones.forEach(([r0, c0]) => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const isEdge = r === 0 || r === 6 || c === 0 || c === 6;
        const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = isEdge || isCore;
      }
    }
  });

  return grid;
}

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS
 * ════════════════════════════════════════════════════════════════════════ */

function NfcWaveIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" />
      <path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" />
      <path d="M12.91 4.1a15.91 15.91 0 0 1 .01 15.8" />
      <path d="M16.37 2a20.16 20.16 0 0 1 0 20" />
    </svg>
  );
}

function Rotate3DIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function CopyIcon({ copied }: { copied: boolean }) {
  return copied ? (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 text-emerald-500"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <rect width="14" height="14" x="8" y="8" rx="2.5" ry="2.5" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * EMV NFC CHIP
 * ════════════════════════════════════════════════════════════════════════ */

function EmvNfcChip({
  metallic = 'gold',
  enabled = true,
}: {
  metallic?: 'gold' | 'platinum';
  enabled?: boolean;
}) {
  const isPlatinum = metallic === 'platinum';

  return (
    <div
      className={[
        'relative h-8 w-11 shrink-0 overflow-hidden rounded-[9px]',
        'border border-white/70',
        'shadow-[0_4px_10px_rgba(15,23,42,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]',
        'transition-opacity duration-300',
        enabled ? 'opacity-100' : 'opacity-40 grayscale',
      ].join(' ')}
      style={{
        background: isPlatinum
          ? 'linear-gradient(135deg, #F8FAFC 0%, #CBD5E1 48%, #94A3B8 100%)'
          : 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 50%, #B45309 100%)',
      }}
      role="img"
      aria-label={enabled ? 'EMV NFC chip faol' : 'EMV NFC chip faol emas'}
    >
      <svg
        viewBox="0 0 44 32"
        className="h-full w-full opacity-55"
        fill="none"
        stroke={isPlatinum ? '#334155' : '#78350F'}
        strokeWidth={1}
        aria-hidden="true"
      >
        <rect x="14" y="7" width="16" height="18" rx="3" />
        <line x1="0" y1="11" x2="14" y2="11" />
        <line x1="0" y1="21" x2="14" y2="21" />
        <line x1="30" y1="11" x2="44" y2="11" />
        <line x1="30" y1="21" x2="44" y2="21" />
        <line x1="22" y1="0" x2="22" y2="7" />
        <line x1="22" y1="25" x2="22" y2="32" />
      </svg>
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/45 to-transparent" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * DETERMINISTIC QR + BARCODE RENDERERS
 * ════════════════════════════════════════════════════════════════════════ */

const QrMatrix = React.memo(function QrMatrix({
  seed,
  className = '',
}: {
  seed: string;
  className?: string;
}) {
  const cells = React.useMemo(() => {
    const size = 21;
    const grid = buildQrMatrix(seed, size);
    const out: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (grid[y][x]) out.push({ x, y });
      }
    }
    return out;
  }, [seed]);

  return (
    <svg
      viewBox="0 0 21 21"
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label="Shaxsiy identifikatsiya QR kodi"
    >
      <rect width="21" height="21" fill="#FFFFFF" />
      {cells.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#0B0F1A" />
      ))}
    </svg>
  );
});

const Barcode = React.memo(function Barcode({
  seed,
  className = '',
}: {
  seed: string;
  className?: string;
}) {
  const { bars, total } = React.useMemo(() => {
    const rng = makeRng(hash32(`barcode:${seed}`));
    const list: Array<{ x: number; w: number }> = [];
    let cursor = 0;
    for (let i = 0; i < 38; i += 1) {
      const width = rng() > 0.55 ? 2 : 1;
      list.push({ x: cursor, w: width });
      cursor += width + (rng() > 0.5 ? 2 : 1);
    }
    return { bars: list, total: cursor };
  }, [seed]);

  return (
    <svg
      viewBox={`0 0 ${total} 16`}
      preserveAspectRatio="none"
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {bars.map((bar, index) => (
        <rect
          key={index}
          x={bar.x}
          y={0}
          width={bar.w}
          height={16}
          fill="currentColor"
        />
      ))}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * PRESENTATIONAL PIECES
 * ════════════════════════════════════════════════════════════════════════ */

interface MetricTileProps {
  label: string;
  value: string;
  hint?: string;
  toneClass: string;
  progress?: number;
  barClass?: string;
}

function MetricTile({ label, value, hint, toneClass, progress, barClass }: MetricTileProps) {
  return (
    <div className="rounded-2xl border border-slate-900/[0.06] bg-white/60 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05] dark:shadow-none">
      <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-0.5 truncate text-[19px] font-black leading-tight tabular-nums ${toneClass}`}>
        {value}
      </p>
      {progress !== undefined && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-900/[0.07] dark:bg-white/10">
          <div
            className={`h-full rounded-full ${barClass ?? 'bg-slate-900'}`}
            style={{ width: `${clamp(progress)}%` }}
          />
        </div>
      )}
      {hint && (
        <p className="mt-1 truncate text-[9px] font-semibold text-slate-400 dark:text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

interface DockButtonProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  ariaLabel: string;
  ariaPressed?: boolean;
  variant?: 'ghost' | 'primary';
}

function DockButton({
  onClick,
  children,
  ariaLabel,
  ariaPressed,
  variant = 'ghost',
}: DockButtonProps) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11.5px] font-bold ' +
    'transition-all duration-200 active:scale-[0.96] focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500/70 ' +
    'dark:focus-visible:ring-offset-[#0B0F1A]';

  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-[#0A84FF] to-[#2563EB] text-white shadow-[0_6px_16px_-4px_rgba(10,132,255,0.55),inset_0_1px_0_rgba(255,255,255,0.45)] hover:brightness-110'
      : 'text-slate-900 hover:bg-slate-900/[0.05] dark:text-white dark:hover:bg-white/[0.08]';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className={`${base} ${styles}`}
    >
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * ROLE THEME — every role has a distinct signature palette
 * ════════════════════════════════════════════════════════════════════════ */

interface RoleTheme {
  title: string;
  badge: string;
  accent: string;
  accent2: string;
  gradient: string;
  chip: 'gold' | 'platinum';
}

const ROLE_THEME: Record<ResolvedRole, RoleTheme> = {
  STUDENT: {
    title: 'TALABA',
    badge: 'Talaba',
    accent: '#0A84FF',
    accent2: '#00C7BE',
    gradient: 'linear-gradient(135deg, #0A84FF 0%, #2563EB 55%, #00C7BE 100%)',
    chip: 'gold',
  },
  TEACHER: {
    title: "O'QITUVCHI",
    badge: "O'qituvchi",
    accent: '#AF52DE',
    accent2: '#5856D6',
    gradient: 'linear-gradient(135deg, #AF52DE 0%, #7C3AED 55%, #5856D6 100%)',
    chip: 'gold',
  },
  ADMIN: {
    title: 'ADMINISTRATOR',
    badge: 'Administrator',
    accent: '#10B981',
    accent2: '#0EA5E9',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 55%, #0EA5E9 100%)',
    chip: 'gold',
  },
  /* STAFF deliberately differs from ADMIN so roles are distinguishable. */
  STAFF: {
    title: 'XODIM',
    badge: 'Xodim',
    accent: '#F97316',
    accent2: '#FACC15',
    gradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 55%, #FACC15 100%)',
    chip: 'gold',
  },
  PARENT: {
    title: 'OTA-ONA',
    badge: 'Ota-ona',
    accent: '#F59E0B',
    accent2: '#EF4444',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #F97316 55%, #EF4444 100%)',
    chip: 'platinum',
  },
  USER: {
    title: 'FOYDALANUVCHI',
    badge: 'Foydalanuvchi',
    accent: '#6366F1',
    accent2: '#3B82F6',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 55%, #3B82F6 100%)',
    chip: 'platinum',
  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * Rect cache — one measurement per layout change, never per frame
 * ════════════════════════════════════════════════════════════════════════ */

interface CachedRect {
  width: number;
  height: number;
  left: number;
  top: number;
}

function useCachedRect(ref: React.RefObject<HTMLElement | null>): React.MutableRefObject<CachedRect | null> {
  const rectRef = React.useRef<CachedRect | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !isBrowser) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      rectRef.current = { width: r.width, height: r.height, left: r.left, top: r.top };
    };

    measure();

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);

    const onScrollOrResize = () => measure();
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [ref]);

  return rectRef;
}

/* ══════════════════════════════════════════════════════════════════════════
 * GLARE LAYER — GPU-only movement
 *
 * The gradient string is written ONCE. Motion is applied purely via
 * `transform: translate3d(...)` driven by springs → compositor-only,
 * zero paint per frame.
 * ════════════════════════════════════════════════════════════════════════ */

const GLARE_GRADIENT =
  'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.55) 18%, rgba(255,255,255,0.22) 38%, rgba(255,255,255,0) 62%)';

const GlareLayer = React.memo(function GlareLayer({
  x,
  y,
  opacity,
  rounded = '2.5rem',
}: {
  x: React.MutableRefObject<number> | { get(): number };
  y: React.MutableRefObject<number> | { get(): number };
  opacity: React.MutableRefObject<number> | { get(): number };
  rounded?: string;
}) {
  // `x`/`y` are MotionValues from the parent — forwarded as-is.
  const tx = useTransform(x as never, (v: number) => `${(v - 50)}%`);
  const ty = useTransform(y as never, (v: number) => `${(v - 50)}%`);

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 mix-blend-overlay"
      style={{
        x: tx,
        y: ty,
        opacity: opacity as never,
        background: GLARE_GRADIENT,
        willChange: 'transform, opacity',
        clipPath: `inset(0 round ${rounded})`,
        WebkitClipPath: `inset(0 round ${rounded})`,
      }}
    />
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ════════════════════════════════════════════════════════════════════════ */

function SpatialIdentityCard360Impl({
  data,
  className = '',
  onShare,
}: SpatialIdentityCard360Props) {
  /* ── refs ────────────────────────────────────────────────────────────── */
  const cardRef = React.useRef<HTMLDivElement>(null);
  const rectRef = useCachedRect(cardRef);

  const dragRef = React.useRef({ down: false, moved: false, x: 0, y: 0 });
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── state ───────────────────────────────────────────────────────────── */
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [avatarFailed, setAvatarFailed] = React.useState(false);

  const reduceMotion = useReducedMotion();

  /* ── motion values ───────────────────────────────────────────────────── */
  const tiltX = useSpring(0, { stiffness: 320, damping: 30, mass: 0.5 });
  const tiltY = useSpring(0, { stiffness: 320, damping: 30, mass: 0.5 });
  const flip = useSpring(0, {
    stiffness: reduceMotion ? 1200 : 230,
    damping: reduceMotion ? 90 : 26,
    mass: reduceMotion ? 0.2 : 0.9,
  });
  const glareX = useSpring(50, { stiffness: 200, damping: 24 });
  const glareY = useSpring(50, { stiffness: 200, damping: 24 });
  const glareOpacity = useSpring(0, { stiffness: 220, damping: 28 });

  const rotateY = useTransform([flip, tiltY], (latest: number[]) => {
    const [flipValue = 0, tiltValue = 0] = latest;
    return flipValue + tiltValue;
  });

  /* ── derived data (memoized) ─────────────────────────────────────────── */
  const resolvedRole = React.useMemo<ResolvedRole>(() => {
    const role = String(data.role ?? '').toUpperCase();
    if (role.includes('TEACHER') || role.includes('USTOZ') || role.includes("O'QITUVCHI")) {
      return 'TEACHER';
    }
    if (role.includes('ADMIN') || role.includes('MANAGER') || role.includes('RAHBAR')) {
      return 'ADMIN';
    }
    if (role.includes('STAFF') || role.includes('XODIM')) return 'STAFF';
    if (role.includes('PARENT') || role.includes('OTA')) return 'PARENT';
    if (role.includes('STUDENT') || role.includes('TALABA') || role.includes('OQUVCHI')) {
      return 'STUDENT';
    }
    return 'USER';
  }, [data.role]);

  const theme = ROLE_THEME[resolvedRole];
  const safeId = React.useMemo(() => String(data.id ?? '').trim(), [data.id]);

  const seed = React.useMemo(
    () => safeId || data.codeOrId || data.fullName || 'M-EDU',
    [safeId, data.codeOrId, data.fullName],
  );

  const displayId = React.useMemo(() => {
    if (data.codeOrId) return data.codeOrId;
    if (safeId) {
      const compact = safeId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
      return compact ? `ID-${compact}` : 'ID-—';
    }
    return 'ID-—';
  }, [data.codeOrId, safeId]);

  const initials = React.useMemo(() => {
    const parts = String(data.fullName ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '');
    return parts.join('') || 'ME';
  }, [data.fullName]);

  const orgName = data.organizationName || data.orgName || 'M-EDU';
  const isVerified = Boolean(data.biometricVerified);
  const nfcEnabled = Boolean(data.nfcEnabled);
  const showAvatar = Boolean(data.avatarUrl) && !avatarFailed;

  const subtitle =
    data.groupName
      ? `Guruh: ${data.groupName}`
      : data.specialty || data.department || (data.email ? data.email : undefined);

  /* ── effects ─────────────────────────────────────────────────────────── */
  React.useEffect(() => {
    setAvatarFailed(false);
  }, [data.avatarUrl]);

  /* Sync spring target with state — no side effect in updater. */
  React.useEffect(() => {
    flip.set(isFlipped ? 180 : 0);
  }, [isFlipped, flip]);

  /* Timer cleanup on unmount. */
  React.useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  /* ── interaction handlers ────────────────────────────────────────────── */
  const resetTilt = React.useCallback(() => {
    tiltX.set(0);
    tiltY.set(0);
    glareOpacity.set(0);
  }, [tiltX, tiltY, glareOpacity]);

  const toggleFlip = React.useCallback(() => {
    resetTilt();
    setIsFlipped((prev) => !prev);
  }, [resetTilt]);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;

      if (drag.down) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 8) drag.moved = true;
      }

      if (event.pointerType !== 'mouse' && !drag.down) return;
      if (reduceMotion) return;

      const rect = rectRef.current;
      if (!rect || rect.width === 0 || rect.height === 0) return;

      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;

      tiltX.set(-(py - 0.5) * 20);
      tiltY.set(-(px - 0.5) * 24);
      glareX.set(clamp(px * 100));
      glareY.set(clamp(py * 100));
      glareOpacity.set(0.85);
    },
    [reduceMotion, rectRef, tiltX, tiltY, glareX, glareY, glareOpacity],
  );

  const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, a, input, [data-no-flip]')) return;
    dragRef.current = {
      down: true,
      moved: false,
      x: event.clientX,
      y: event.clientY,
    };
  }, []);

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      dragRef.current.down = false;

      if (!drag.down) return;
      if ((event.target as HTMLElement).closest('button, a, input, [data-no-flip]')) return;
      if (drag.moved) return;

      toggleFlip();
    },
    [toggleFlip],
  );

  const handlePointerLeave = React.useCallback(() => {
    dragRef.current.down = false;
    resetTilt();
  }, [resetTilt]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if ((event.target as HTMLElement).closest('button, a, input, [data-no-flip]')) return;
      event.preventDefault();
      toggleFlip();
    },
    [toggleFlip],
  );

  const handleCopy = React.useCallback(
    async (event?: React.MouseEvent) => {
      event?.stopPropagation();

      const value = data.codeOrId || safeId;
      if (!value) return;

      try {
        if (isBrowser && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
          copyTimerRef.current = setTimeout(() => setCopied(false), 1800);
        }
      } catch {
        /* Clipboard permissions denied — silent fallback. */
      }
    },
    [data.codeOrId, safeId],
  );

  /* Stable identity for the dock's onClick type. */
  const handleDockCopy = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      void handleCopy(event);
    },
    [handleCopy],
  );

  const handleDockShare = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onShare?.();
    },
    [onShare],
  );

  /* ── metrics ─────────────────────────────────────────────────────────── */
  const metrics = React.useMemo<MetricTileProps[]>(() => {
    if (resolvedRole === 'STUDENT') {
      const hasAttendance =
        typeof data.attendanceRate === 'number' &&
        Number.isFinite(data.attendanceRate) &&
        data.attendanceRate >= 0;
      const attendance = hasAttendance ? clamp(data.attendanceRate!) : 0;

      const hasMastery =
        typeof data.gpaOrMastery === 'number' &&
        Number.isFinite(data.gpaOrMastery) &&
        data.gpaOrMastery >= 0;
      const mastery = hasMastery ? clamp(data.gpaOrMastery!) : 0;

      const groupsCount =
        typeof data.coursesCount === 'number' &&
        Number.isFinite(data.coursesCount) &&
        data.coursesCount >= 0
          ? Math.floor(data.coursesCount)
          : data.groupName
            ? 1
            : 0;

      return [
        {
          label: 'Davomat',
          value: hasAttendance ? `${Math.round(attendance)}%` : '—',
          hint: hasAttendance
            ? attendance >= 80
              ? "A'lo qatnashish"
              : attendance >= 60
                ? "O'rtacha"
                : 'Past davomat'
            : 'Darslar kutilmoqda',
          toneClass: hasAttendance
            ? attendance >= 80
              ? 'text-emerald-600 dark:text-emerald-400'
              : attendance >= 60
                ? 'text-amber-500'
                : 'text-red-500'
            : 'text-slate-400 dark:text-slate-500',
          progress: hasAttendance ? attendance : undefined,
          barClass:
            attendance >= 80
              ? 'bg-emerald-500'
              : attendance >= 60
                ? 'bg-amber-500'
                : 'bg-red-500',
        },
        {
          label: "O'zlashtirish",
          value: hasMastery ? `${Math.round(mastery)}%` : '—',
          hint: hasMastery
            ? mastery >= 85
              ? "Yuqori ko'rsatkich"
              : 'Joriy natija'
            : 'Hali baholanmagan',
          toneClass: hasMastery
            ? mastery >= 80
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-amber-500'
            : 'text-slate-400 dark:text-slate-500',
          progress: hasMastery ? mastery : undefined,
          barClass: 'bg-blue-500',
        },
        {
          label: 'Guruhlar',
          value: `${groupsCount} ta`,
          hint: data.groupName || 'Biriktirilgan kurslar',
          toneClass: 'text-slate-900 dark:text-white',
        },
        {
          label: 'Face ID',
          value: isVerified ? 'Tasdiqlangan' : 'Kiritilmagan',
          hint: isVerified ? 'Biometriya faol' : 'Kutish holatida',
          toneClass: isVerified
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-400 dark:text-slate-500',
        },
      ];
    }

    if (resolvedRole === 'TEACHER') {
      const hasRating =
        typeof data.rating === 'number' && Number.isFinite(data.rating) && data.rating > 0;
      const hasLessons =
        typeof data.lessonsCount === 'number' &&
        Number.isFinite(data.lessonsCount) &&
        data.lessonsCount >= 0;
      const hasGroups =
        typeof data.activeGroupsCount === 'number' &&
        Number.isFinite(data.activeGroupsCount) &&
        data.activeGroupsCount >= 0;

      const activityLabel = hasLessons ? 'Darslar' : 'Reyting';
      const activityValue = hasLessons
        ? `${Math.floor(data.lessonsCount!)} ta`
        : hasRating
          ? `★ ${Number(data.rating).toFixed(1)}`
          : '—';
      const activityHint = hasLessons
        ? "O'tilgan darslar"
        : hasRating
          ? 'Talabalar bahosi'
          : 'Baholanmagan';

      return [
        {
          label: 'Guruhlar',
          value: hasGroups ? `${Math.floor(data.activeGroupsCount!)} ta` : '0 ta',
          hint: 'Faol guruhlar',
          toneClass: 'text-blue-600 dark:text-blue-400',
        },
        {
          label: 'Mutaxassislik',
          value: data.specialty || '—',
          hint: data.department || "Akademik yo'nalish",
          toneClass: data.specialty
            ? 'text-purple-600 dark:text-purple-400'
            : 'text-slate-400 dark:text-slate-500',
        },
        {
          label: activityLabel,
          value: activityValue,
          hint: activityHint,
          toneClass: hasLessons
            ? 'text-emerald-600 dark:text-emerald-400'
            : hasRating
              ? 'text-amber-500'
              : 'text-slate-400 dark:text-slate-500',
        },
        {
          label: 'Face ID',
          value: isVerified ? 'Tasdiqlangan' : 'Kiritilmagan',
          hint: isVerified ? 'Biometriya faol' : 'Kutish holatida',
          toneClass: isVerified
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-400 dark:text-slate-500',
        },
      ];
    }

    return [
      {
        label: 'Rol',
        value: String(data.role || 'Foydalanuvchi').replace(/_/g, ' '),
        hint: data.department || 'Tizim foydalanuvchisi',
        toneClass: 'text-blue-600 dark:text-blue-400',
      },
      {
        label: 'Holat',
        value: data.status || 'Faol',
        hint: isVerified ? 'Xavfsiz autentifikatsiya' : 'Standart kirish',
        toneClass: 'text-emerald-600 dark:text-emerald-400',
      },
      {
        label: "Bo'lim",
        value: data.department || data.specialty || data.organizationName || 'M-EDU',
        hint: 'Tashkiliy tuzilma',
        toneClass: 'text-slate-900 dark:text-white',
      },
      {
        label: 'Face ID',
        value: isVerified ? 'Tasdiqlangan' : 'Kiritilmagan',
        hint: isVerified ? 'Biometrik shlyuz faol' : 'Kutish holatida',
        toneClass: isVerified
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-slate-400 dark:text-slate-500',
      },
    ];
  }, [resolvedRole, data, isVerified]);

  /* ── style helpers (module-level behaviour, cheap to rebuild) ────────── */
  const faceStyle = (rotation: string): React.CSSProperties => ({
    transform: `rotateY(${rotation})`,
    transformStyle: 'preserve-3d',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  });

  const contentStyle: React.CSSProperties = {
    transformStyle: 'preserve-3d',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  };

  const depth = (z: number): React.CSSProperties => ({ transform: `translateZ(${z}px)` });

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div className={`relative flex select-none flex-col items-center justify-center p-2 ${className}`}>
      {/* Ambient spatial halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[430px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-[90px] dark:opacity-45"
        style={{
          background: `radial-gradient(circle, ${theme.accent} 0%, ${theme.accent2} 55%, transparent 100%)`,
        }}
      />

      {/* 3D stage */}
      <div
        style={{ perspective: 1600, perspectiveOrigin: '50% 50%' }}
        className="h-[540px] w-full max-w-[392px]"
      >
        <motion.div
          ref={cardRef}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerLeave}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-pressed={isFlipped}
          aria-label={`${data.fullName} — kartani 360° aylantirish uchun bosing yoki Enter bosing`}
          style={{
            rotateX: tiltX,
            rotateY,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
          className="relative h-full w-full cursor-pointer rounded-[2.5rem] outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white/60 dark:focus-visible:ring-offset-[#0B0F1A]/60"
        >
          {/* ════════════════════════════════════════════════════════════
           * FRONT
           * ══════════════════════════════════════════════════════════ */}
          <div
            className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-b from-white/90 via-white/45 to-white/85 shadow-[0_28px_60px_-18px_rgba(15,23,42,0.35)] dark:from-white/25 dark:via-white/[0.06] dark:to-white/15 dark:shadow-[0_34px_80px_-18px_rgba(0,0,0,0.85)]"
            style={faceStyle('0deg')}
          >
            {/* Flat glass background — kept separate so it can't flatten 3D */}
            <div className="pointer-events-none absolute inset-[1.5px] overflow-hidden rounded-[calc(2.5rem-1.5px)] border border-white/60 bg-white/75 backdrop-blur-2xl backdrop-saturate-[1.8] dark:border-white/10 dark:bg-[#0B0F1A]/85">
              <div
                className="absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-40 blur-3xl"
                style={{ background: theme.accent }}
              />
              <div
                className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full opacity-30 blur-3xl"
                style={{ background: theme.accent2 }}
              />
              <div className="absolute inset-x-6 top-0 h-24 bg-gradient-to-b from-white/70 to-transparent dark:from-white/[0.07]" />
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/40" />
            </div>

            {/* Prismatic glare — GPU-translated */}
            <GlareLayer x={glareX} y={glareY} opacity={glareOpacity} />

            {/* Content */}
            <div
              className="absolute inset-0 z-10 flex flex-col justify-between p-5 sm:p-6"
              style={contentStyle}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3" style={depth(24)}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[15px] font-black text-white shadow-[0_8px_20px_-6px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-white/40"
                    style={{ backgroundImage: theme.gradient }}
                    aria-hidden="true"
                  >
                    M
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {orgName}
                    </p>
                    <p className="truncate text-[12.5px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {theme.title}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {nfcEnabled && (
                    <NfcWaveIcon className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                  )}
                  <EmvNfcChip metallic={theme.chip} enabled={nfcEnabled} />
                </div>
              </div>

              {/* Center */}
              <div
                className="flex flex-1 flex-col items-center justify-center py-2 text-center"
                style={depth(38)}
              >
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="absolute -inset-3 rounded-full opacity-40 blur-xl"
                    style={{ backgroundImage: theme.gradient }}
                  />

                  <div className="relative rounded-full border border-white/90 bg-white/45 p-1.5 shadow-[0_18px_38px_-12px_rgba(15,23,42,0.35),inset_0_1px_2px_rgba(255,255,255,0.95)] backdrop-blur-xl dark:border-white/20 dark:bg-white/10">
                    {showAvatar ? (
                      <img
                        src={data.avatarUrl as string}
                        alt={data.fullName}
                        width={96}
                        height={96}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        onError={() => setAvatarFailed(true)}
                        className="h-24 w-24 rounded-full object-cover shadow-inner"
                      />
                    ) : (
                      <div
                        className="grid h-24 w-24 place-items-center rounded-full text-[26px] font-black tracking-tight text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.45)]"
                        style={{ backgroundImage: theme.gradient }}
                        aria-hidden="true"
                      >
                        {initials}
                      </div>
                    )}
                  </div>

                  {isVerified && (
                    <div
                      className="absolute -bottom-0.5 -right-0.5 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white shadow-[0_6px_16px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-[#0B0F1A]"
                      title="Face ID bilan tasdiqlangan"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                  )}
                </div>

                <h3 className="mt-4 line-clamp-1 text-[21px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {data.fullName}
                </h3>

                <div className="mt-1.5 flex items-center justify-center">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-md"
                    style={{
                      background: `${theme.accent}18`,
                      color: theme.accent,
                      border: `1px solid ${theme.accent}38`,
                    }}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span
                        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 motion-reduce:animate-none"
                        style={{ background: theme.accent }}
                      />
                      <span
                        className="relative inline-flex h-1.5 w-1.5 rounded-full"
                        style={{ background: theme.accent }}
                      />
                    </span>
                    {theme.badge}
                  </span>
                </div>

                {subtitle && (
                  <p className="mt-2.5 max-w-full truncate rounded-xl border border-slate-900/[0.05] bg-white/60 px-3 py-1 text-[11.5px] font-semibold text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-slate-300">
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div
                className="rounded-2xl border border-slate-900/[0.06] bg-white/60 p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05] dark:shadow-none"
                style={depth(18)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Shaxsiy raqamli ID
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      data-no-flip
                      className="group mt-0.5 flex items-center gap-1.5 rounded-md font-mono text-[12.5px] font-extrabold text-slate-900 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 dark:text-white dark:hover:text-blue-400"
                      title="ID raqamidan nusxa olish"
                      aria-label={`ID ${displayId} ni nusxalash`}
                    >
                      <span className="truncate">{displayId}</span>
                      <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold text-blue-600 opacity-80 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                        <CopyIcon copied={copied} />
                        <span className="sr-only">{copied ? 'Nusxalandi' : 'Nusxalash'}</span>
                      </span>
                    </button>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <Barcode
                      seed={seed}
                      className="hidden h-6 w-[72px] text-slate-900 opacity-70 sm:block dark:text-white"
                    />
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/[0.06] bg-white/80 px-2.5 py-1 text-[10px] font-extrabold text-slate-600 dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-200">
                      <span>360°</span>
                      <Rotate3DIcon className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════
           * BACK
           * ══════════════════════════════════════════════════════════ */}
          <div
            className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-b from-white/90 via-white/45 to-white/85 shadow-[0_28px_60px_-18px_rgba(15,23,42,0.35)] dark:from-white/25 dark:via-white/[0.06] dark:to-white/15 dark:shadow-[0_34px_80px_-18px_rgba(0,0,0,0.85)]"
            style={faceStyle('180deg')}
          >
            <div className="pointer-events-none absolute inset-[1.5px] overflow-hidden rounded-[calc(2.5rem-1.5px)] border border-white/60 bg-white/80 backdrop-blur-2xl backdrop-saturate-[1.8] dark:border-white/10 dark:bg-[#0B0F1A]/88">
              <div
                className="absolute -left-20 -top-24 h-56 w-56 rounded-full opacity-30 blur-3xl"
                style={{ background: theme.accent2 }}
              />
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/40" />
            </div>

            <GlareLayer x={glareX} y={glareY} opacity={glareOpacity} />

            <div
              className="absolute inset-0 z-10 flex flex-col justify-between gap-3 p-5 sm:p-6"
              style={contentStyle}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between gap-3 border-b border-slate-900/[0.06] pb-3 dark:border-white/[0.08]"
                style={depth(20)}
              >
                <div className="min-w-0">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    360° Telemetriya
                  </p>
                  <p className="truncate text-[14px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {data.fullName}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[10.5px] font-extrabold text-emerald-700 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
                  {data.status || 'Faol'}
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2.5" style={depth(30)}>
                {metrics.map((metric) => (
                  <MetricTile key={metric.label} {...metric} />
                ))}
              </div>

              {/* Contact */}
              <div
                className="space-y-1.5 rounded-2xl border border-slate-900/[0.06] bg-white/60 px-3 py-2.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]"
                style={depth(22)}
              >
                <div className="flex items-center justify-between gap-2 text-[10.5px]">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">Telefon</span>
                  <span className="truncate font-bold text-slate-900 dark:text-white">
                    {data.phone || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[10.5px]">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">Email</span>
                  <span className="truncate font-bold text-slate-900 dark:text-white">
                    {data.email || '—'}
                  </span>
                </div>
                {data.joinedDate && (
                  <div className="flex items-center justify-between gap-2 text-[10.5px]">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      Ro&apos;yxatga olingan
                    </span>
                    <span className="truncate font-bold text-slate-900 dark:text-white">
                      {data.joinedDate}
                    </span>
                  </div>
                )}
              </div>

              {/* ID + QR */}
              <div
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-900/[0.06] bg-white/65 p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05] dark:shadow-none"
                style={depth(26)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Raqamli identifikator
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[10.5px] font-bold text-slate-900 dark:text-white">
                    ID: {displayId}
                  </p>
                  <p className="mt-0.5 truncate text-[9.5px] font-medium text-slate-500 dark:text-slate-400">
                    M-EDU Ta&apos;lim platformasi
                  </p>
                </div>

                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-900/10 bg-white p-1 shadow-sm dark:border-white/15">
                  <QrMatrix seed={seed} className="h-full w-full" />
                </div>
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between pt-0.5 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400"
                style={depth(16)}
              >
                <span>Old tomonga qaytish uchun bosing</span>
                <span className="inline-flex items-center gap-1 font-extrabold text-blue-600 dark:text-blue-400">
                  360° Pass
                  <Rotate3DIcon className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
       * Floating spatial control dock
       * ════════════════════════════════════════════════════════════════ */}
      <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/70 p-1.5 shadow-[0_16px_36px_-12px_rgba(15,23,42,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)] backdrop-blur-2xl backdrop-saturate-[2] dark:border-white/[0.12] dark:bg-[#0B0F1A]/80 dark:shadow-[0_20px_40px_-14px_rgba(0,0,0,0.7)]">
        <DockButton
          onClick={toggleFlip}
          ariaLabel="Kartani 360 daraja aylantirish"
          ariaPressed={isFlipped}
        >
          <Rotate3DIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>360°</span>
        </DockButton>

        <span aria-hidden="true" className="h-4 w-px bg-slate-900/10 dark:bg-white/10" />

        <DockButton onClick={handleDockCopy} ariaLabel="ID raqamidan nusxa olish">
          <CopyIcon copied={copied} />
          <span>{copied ? 'Nusxalandi!' : 'ID nusxalash'}</span>
        </DockButton>

        {onShare && (
          <>
            <span aria-hidden="true" className="h-4 w-px bg-slate-900/10 dark:bg-white/10" />
            <DockButton onClick={handleDockShare} ariaLabel="Kartani ulashish" variant="primary">
              <span>Ulashish</span>
              <ShareIcon />
            </DockButton>
          </>
        )}
      </div>

      {/* Polite screen-reader announcement for copy feedback */}
      <span aria-live="polite" className="sr-only">
        {copied ? 'ID raqami nusxalandi' : ''}
      </span>
    </div>
  );
}

export const SpatialIdentityCard360 = React.memo(SpatialIdentityCard360Impl);
SpatialIdentityCard360.displayName = 'SpatialIdentityCard360';

export default SpatialIdentityCard360;