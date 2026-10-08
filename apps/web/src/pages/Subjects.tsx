/**
 * M-EDU SubjectsPage â€” Apple Design Award Edition v2
 *
 * v2 yangiliklari:
 *  âœ… Modal focus trap + ESC + autofocus (WCAG 2.4.3)
 *  âœ… Sliding layoutId pill (iOS segmented control)
 *  âœ… Stat tile â†’ filter (bir bosishda)
 *  âœ… Inline edit + Sort dropdown + View toggle
 *  âœ… Search debounce + highlight + âŒ˜K
 *  âœ… Toast + Undo archive (5s)
 *  âœ… Liquid Glass 3-qatlam
 *  âœ… Reduced-motion hamma joyda
 *  âœ… CountUp prev value'dan boshlaydi
 *  âœ… Optimistic delete
 */

import React, {
  useState, useCallback, useMemo, useEffect, useRef,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { subjectsApi } from '../lib/api';
import { useI18n } from '../i18n/I18nProvider';
import { useToast } from '@/components/ui/GlassToast';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * MOTION TOKENS
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
  bouncy: { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 },
} as const;

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
  exit: { opacity: 0, x: 20, transition: { duration: 0.22, ease: EASE_OUT_EXPO } },
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * HOOKS
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  initialFocus?: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    const selector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(selector))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);

    const target = initialFocus?.current ?? getFocusable()[0];
    target?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = getFocusable();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, ref, initialFocus]);
}

function useEscapeKey(active: boolean, handler: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handler(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, handler]);
}

function usePersistedState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch { return initial; }
  });
  const update = useCallback((v: T) => {
    setValue(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* noop */ }
  }, [key]);
  return [value, update];
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * TYPES
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

interface Subject {
  id: string;
  code: string;
  name: string;
  department?: string | null;
  isActive: boolean;
}

type FilterKey = 'ALL' | 'ACTIVE' | 'ARCHIVED';
type SortKey = 'name' | 'code' | 'department' | 'status';
type ViewMode = 'list' | 'grid';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * TONE PALETTES
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';

const TONE: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',  glow: 'rgba(0,122,255,0.28)',  border: 'rgba(0,122,255,0.22)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)',   border: 'rgba(52,199,89,0.22)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',   glow: 'rgba(255,149,0,0.28)',   border: 'rgba(255,149,0,0.22)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',   glow: 'rgba(255,59,48,0.28)',   border: 'rgba(255,59,48,0.22)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)',  glow: 'rgba(175,82,222,0.28)',  border: 'rgba(175,82,222,0.22)' },
  slate:  { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.28)', border: 'rgba(142,142,147,0.22)' },
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * ICONS
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const ICON_STROKE = 1.75;

const I = {
  book: ['M12 7v14','M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'],
  bookOpen: ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z','M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'],
  layers: ['M12 2 2 7l10 5 10-5-10-5z','M2 17l10 5 10-5','M2 12l10 5 10-5'],
  building: ['M4 22h16','M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18','M10 6h4','M10 10h4','M10 14h4','M10 18h4'],
  archive: ['M21 8v13H3V8','M1 3h22v5H1z','M10 12h4'],
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14','M22 4 12 14.01l-3-3'],
  plus: ['M12 5v14','M5 12h14'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M21 21l-4.3-4.3'],
  x: ['M18 6 6 18','M6 6l12 12'],
  refresh: ['M23 4v6h-6','M1 20v-6h6','M3.51 9a9 9 0 0 1 14.85-3.36L23 10','M20.49 15a9 9 0 0 1-14.85 3.36L1 14'],
  alertTriangle: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z','M12 9v4','M12 17h.01'],
  sparkles: ['M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z','M18.5 3.5v3','M20 5h-3','M5.5 18v2.5','M6.75 19.25h-2.5'],
  edit: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7','M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'],
  grid: ['M3 3h7v7H3z','M14 3h7v7h-7z','M14 14h7v7h-7z','M3 14h7v7H3z'],
  list: ['M8 6h13','M8 12h13','M8 18h13','M3 6h.01','M3 12h.01','M3 18h.01'],
  arrowUpDown: ['M21 16l-4 4-4-4','M17 20V4','M3 8l4-4 4 4','M7 4v16'],
  check: ['M20 6 9 17l-5-5'],
  undo: ['M3 7v6h6','M21 17a9 9 0 0 0-15-6.7L3 13'],
  more: ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z','M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z','M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
};

function Icon({
  paths, size = 18, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * HELPERS
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function codeHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const CODE_PALETTES: Tone[] = ['blue', 'purple', 'green', 'orange', 'red'];

function codeTone(code: string): Tone {
  return CODE_PALETTES[codeHash(code) % CODE_PALETTES.length];
}

function safeErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as { message?: unknown; detail?: unknown };
    if (typeof anyErr.message === 'string') return anyErr.message;
    if (typeof anyErr.detail === 'string') return anyErr.detail;
  }
  return fallback;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * PRIMITIVES
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

interface LiquidGlassProps {
  children: React.ReactNode;
  className?: string;
  radius?: string;
  tint?: string;
  elevated?: boolean;
  spotlight?: boolean;
}

function LiquidGlass({
  children, className = '', radius = '1.5rem', tint = 'transparent',
  elevated = false, spotlight = true,
}: LiquidGlassProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 50, y: 0, active: false });

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!spotlight || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
      active: true,
    });
  }, [spotlight]);

  const onLeave = useCallback(() => setPos((p) => ({ ...p, active: false })), []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius: radius,
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        backdropFilter: 'blur(30px) saturate(180%)',
        background:
          'linear-gradient(145deg, rgba(255,255,255,0.85), rgba(255,255,255,0.65))',
        boxShadow: elevated
          ? 'inset 0 1px 0 rgba(255,255,255,0.9), 0 24px 60px -20px rgba(15,23,42,0.14)'
          : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 12px 40px -15px rgba(15,23,42,0.10)',
      }}
    >
      {/* Chromatic fringe */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          borderRadius: radius,
          background: 'linear-gradient(120deg, rgba(255,0,80,0.04) 0%, transparent 14%, transparent 86%, rgba(0,120,255,0.04) 100%)',
        }} />
      {/* Specular */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: radius,
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.9),' +
            'inset 0 -1px 0 rgba(255,255,255,0.2),' +
            'inset 1px 0 0 rgba(255,255,255,0.35),' +
            'inset -1px 0 0 rgba(255,255,255,0.35)',
        }} />
      {/* Tint */}
      {tint !== 'transparent' && (
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{ borderRadius: radius, background: tint }} />
      )}
      {/* Spotlight */}
      {spotlight && (
        <div aria-hidden className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{
            borderRadius: radius,
            opacity: pos.active ? 1 : 0,
            background: `radial-gradient(520px circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.55), transparent 42%)`,
            mixBlendMode: 'overlay',
          }} />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

/* â”€â”€ CountUp â€” prev qiymatdan davom etadi â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function CountUp({
  value, duration = 0.9, suffix = '',
}: { value: number; duration?: number; suffix?: string }) {
  const [n, setN] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) return;

    const startedAt = performance.now();
    const step = (ts: number) => {
      const p = Math.min(1, (ts - startedAt) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      setN(start + (end - start) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = end;
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      prevRef.current = end;
    };
  }, [value, duration]);

  return <span className="tabular-nums">{Math.round(n).toLocaleString()}{suffix}</span>;
}

/* â”€â”€ Shimmer â€” reduced motion aware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      className={`relative overflow-hidden bg-[#E5E5EA]/60 dark:bg-[#2C2C2E]/60 ${className}`}
      style={{ borderRadius: radius }}
    >
      {!reduced && (
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
          }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

/* â”€â”€ Highlight â€” search so'zini yorqin qiladi â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-[#FFD60A]/40 px-0.5 text-inherit">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * SKELETON
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function SubjectsSkeleton() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      <motion.div variants={cardVariants}>
        <Shimmer className="h-40 w-full" radius="2rem" />
      </motion.div>
      <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <motion.div key={i} variants={cardVariants}>
            <Shimmer className="h-[68px]" radius="1rem" />
          </motion.div>
        ))}
      </motion.div>
      <motion.div variants={cardVariants}>
        <Shimmer className="h-16" radius="1rem" />
      </motion.div>
      <motion.div variants={containerVariants} className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div key={i} variants={cardVariants}>
            <Shimmer className="h-16" radius="1rem" />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * STAT TILE â€” bosiladigan, filter bilan bog'langan
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function StatTile({
  label, value, icon, tone = 'blue', active = false, onClick,
}: {
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
}) {
  const c = TONE[tone];

  return (
    <motion.button
      type="button"
      variants={rowVariants}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING.snappy}
      onClick={onClick}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50"
      style={{
        borderColor: active ? c.border : 'rgba(255,255,255,0.6)',
        background: active
          ? `linear-gradient(135deg, ${c.bg}, rgba(255,255,255,0.8))`
          : 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: active
          ? `inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 16px -6px ${c.glow}`
          : 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px -8px rgba(0,0,0,0.06)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-t-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent)' }}
      />
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={18} strokeWidth={2} />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
          {label}
        </div>
      </div>
      {active && (
        <motion.span
          layoutId="statTileActive"
          className="absolute inset-0 rounded-2xl"
          style={{ boxShadow: `inset 0 0 0 1.5px ${c.fg}55` }}
          transition={SPRING.smooth}
          aria-hidden
        />
      )}
    </motion.button>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * SEGMENTED FILTER â€” sliding layoutId pill
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function SegmentedFilter({
  value, onChange, options, counts,
}: {
  value: FilterKey;
  onChange: (v: FilterKey) => void;
  options: { key: FilterKey; label: string; icon: string[]; tone: Tone }[];
  counts: Record<FilterKey, number>;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex flex-wrap gap-1 rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-1 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        const c = TONE[opt.tone];
        const count = counts[opt.key] ?? 0;

        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className="relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50"
            style={{ color: active ? c.fg : '#86868B' }}
          >
            {active && (
              <motion.span
                layoutId="segmentedPill"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: c.bg,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 8px -4px ${c.glow}`,
                }}
                transition={SPRING.smooth}
                aria-hidden
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon paths={opt.icon} size={12} strokeWidth={2.2} />
              <span className="tracking-tight">{opt.label}</span>
              {count > 0 && (
                <span
                  className="ml-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums"
                  style={{
                    background: active ? `${c.fg}25` : 'rgba(142,142,147,0.15)',
                    color: active ? c.fg : '#86868B',
                  }}
                >
                  {count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * SORT DROPDOWN
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function SortDropdown({
  value, onChange,
}: { value: SortKey; onChange: (v: SortKey) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const options: { key: SortKey; label: string }[] = [
    { key: 'name',       label: t('subjects.sort.name') || 'Name' },
    { key: 'code',       label: t('subjects.sort.code') || 'Code' },
    { key: 'department', label: t('subjects.sort.department') || 'Department' },
    { key: 'status',     label: t('subjects.sort.status') || 'Status' },
  ];

  const current = options.find((o) => o.key === value);

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={SPRING.snappy}
        className="inline-flex items-center gap-2 rounded-xl border border-[#00000010] bg-[#ffffff80] px-3 py-2.5 text-[12.5px] font-semibold text-[#1D1D1F] outline-none backdrop-blur-xl transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:border-[#ffffff10] dark:bg-[#1c1c1e80] dark:text-[#F5F5F7]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon paths={I.arrowUpDown} size={13} strokeWidth={2.2} className="opacity-60" />
        <span>{current?.label}</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={SPRING.snappy}
            className="absolute right-0 top-[calc(100%+0.4rem)] z-30 w-48 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/95 p-1.5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#1c1c1e]/95"
          >
            {options.map((opt) => {
              const active = opt.key === value;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="menuitem"
                  onClick={() => { onChange(opt.key); setOpen(false); }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[12.5px] font-medium text-[#1D1D1F] outline-none transition-colors hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:text-[#F5F5F7] dark:hover:bg-white/[0.06]"
                >
                  <span>{opt.label}</span>
                  {active && (
                    <Icon paths={I.check} size={13} strokeWidth={2.4} className="text-[#007AFF]" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * VIEW TOGGLE
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const { t } = useI18n();
  const options: { key: ViewMode; icon: string[]; label: string }[] = [
    { key: 'list', icon: I.list, label: t('subjects.view.list') || 'List' },
    { key: 'grid', icon: I.grid, label: t('subjects.view.grid') || 'Grid' },
  ];

  return (
    <div
      role="group"
      aria-label={t('subjects.view.toggleAria') || 'View mode'}
      className="inline-flex gap-1 rounded-xl border border-[#ffffff60] bg-[#ffffff80] p-1 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-label={opt.label}
            aria-pressed={active}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50"
            style={{ color: active ? '#007AFF' : '#86868B' }}
          >
            {active && (
              <motion.span
                layoutId="viewTogglePill"
                className="absolute inset-0 rounded-lg bg-[#007AFF]/10"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(0,122,255,0.25)' }}
                transition={SPRING.snappy}
                aria-hidden
              />
            )}
            <span className="relative z-10">
              <Icon paths={opt.icon} size={13} strokeWidth={2.2} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * SUBJECT ROW
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function SubjectRow({
  subject, onEdit, onArchive, isArchiving, searchQuery,
}: {
  subject: Subject;
  onEdit: (s: Subject) => void;
  onArchive: (s: Subject) => void;
  isArchiving: boolean;
  searchQuery: string;
}) {
  const { t } = useI18n();
  const tone = codeTone(subject.code || subject.name);
  const c = TONE[tone];
  const statusTone: Tone = subject.isActive ? 'green' : 'slate';
  const sc = TONE[statusTone];

  const codeLabel = subject.code && subject.code.trim()
    ? subject.code.toUpperCase().slice(0, 4)
    : subject.name.charAt(0).toUpperCase() || 'Â·';

  return (
    <motion.div
      layout
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.snappy}
      className="group relative flex flex-col gap-3 rounded-2xl border border-[#00000008] bg-[#00000002] p-3.5 transition-all hover:border-[#007AFF]/25 hover:bg-[#007AFF]/[0.02] dark:border-[#ffffff08] dark:bg-[#ffffff04] sm:flex-row sm:items-center"
    >
      {/* Code tile */}
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
        style={{
          background: `linear-gradient(135deg, ${c.fg} 0%, ${c.fg}CC 100%)`,
          boxShadow: `0 6px 16px -6px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)' }}
        />
        <span className="relative text-[12px] font-bold tracking-tight">
          {codeLabel}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            <Highlight text={subject.name} query={searchQuery} />
          </h3>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: sc.bg,
              color: sc.fg,
              border: `1px solid ${sc.border}`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: sc.fg, boxShadow: `0 0 6px ${sc.glow}` }}
            />
            {subject.isActive ? t('subjects.status.active') : t('subjects.status.archived')}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-[#86868B]">
          <span className="inline-flex items-center gap-1">
            <Icon paths={I.bookOpen} size={11} strokeWidth={2} className="opacity-70" />
            <Highlight text={subject.code || 'â€”'} query={searchQuery} />
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon paths={I.building} size={11} strokeWidth={2} className="opacity-70" />
            {subject.department
              ? <Highlight text={subject.department} query={searchQuery} />
              : t('subjects.noDepartment')}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-1.5 opacity-100 sm:opacity-60 sm:transition-opacity sm:group-hover:opacity-100">
        <motion.button
          type="button"
          onClick={() => onEdit(subject)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING.snappy}
          aria-label={t('subjects.edit') || 'Edit'}
          title={t('subjects.edit') || 'Edit'}
          className="flex h-8 w-8 items-center justify-center rounded-lg outline-none"
          style={{
            background: 'rgba(0,122,255,0.10)',
            color: '#007AFF',
            border: '1px solid rgba(0,122,255,0.22)',
          }}
        >
          <Icon paths={I.edit} size={13} strokeWidth={2} />
        </motion.button>

        <motion.button
          type="button"
          onClick={() => onArchive(subject)}
          disabled={isArchiving || !subject.isActive}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING.snappy}
          aria-label={subject.isActive ? t('subjects.deactivateAria') : t('subjects.alreadyArchived')}
          title={subject.isActive ? t('subjects.deactivate') : t('subjects.alreadyArchived')}
          className="flex h-8 w-8 items-center justify-center rounded-lg outline-none disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: subject.isActive ? 'rgba(255,59,48,0.10)' : 'rgba(142,142,147,0.10)',
            color: subject.isActive ? '#FF3B30' : '#8E8E93',
            border: `1px solid ${subject.isActive ? 'rgba(255,59,48,0.22)' : 'rgba(142,142,147,0.22)'}`,
          }}
        >
          {isArchiving ? (
            <motion.span
              className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <Icon paths={I.archive} size={13} strokeWidth={2} />
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * SUBJECT GRID CARD
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function SubjectCard({
  subject, onEdit, onArchive, isArchiving, searchQuery, index,
}: {
  subject: Subject;
  onEdit: (s: Subject) => void;
  onArchive: (s: Subject) => void;
  isArchiving: boolean;
  searchQuery: string;
  index: number;
}) {
  const { t } = useI18n();
  const tone = codeTone(subject.code || subject.name);
  const c = TONE[tone];
  const sc = TONE[subject.isActive ? 'green' : 'slate'];

  const codeLabel = subject.code && subject.code.trim()
    ? subject.code.toUpperCase().slice(0, 4)
    : subject.name.charAt(0).toUpperCase() || 'Â·';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ ...SPRING.smooth, delay: Math.min(index * 0.03, 0.3) }}
      whileHover={{ y: -4 }}
    >
      <LiquidGlass radius="1.5rem" className="h-full p-5">
        <div className="flex items-start justify-between mb-4">
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-white"
            style={{
              background: `linear-gradient(135deg, ${c.fg} 0%, ${c.fg}CC 100%)`,
              boxShadow: `0 8px 20px -8px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)' }}
            />
            <span className="relative text-[14px] font-bold tracking-tight">{codeLabel}</span>
          </div>

          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: sc.bg, color: sc.fg, border: `1px solid ${sc.border}` }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: sc.fg, boxShadow: `0 0 6px ${sc.glow}` }}
            />
            {subject.isActive ? t('subjects.status.active') : t('subjects.status.archived')}
          </span>
        </div>

        <h3 className="text-[15px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] line-clamp-2 min-h-[2.4em]">
          <Highlight text={subject.name} query={searchQuery} />
        </h3>

        <div className="mt-2 space-y-1 text-[11.5px] font-medium text-[#86868B]">
          <div className="inline-flex items-center gap-1.5">
            <Icon paths={I.bookOpen} size={11} strokeWidth={2} className="opacity-70" />
            <Highlight text={subject.code || 'â€”'} query={searchQuery} />
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Icon paths={I.building} size={11} strokeWidth={2} className="opacity-70" />
            {subject.department
              ? <Highlight text={subject.department} query={searchQuery} />
              : t('subjects.noDepartment')}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-1.5 border-t border-black/[0.06] dark:border-white/[0.08] pt-3">
          <motion.button
            type="button"
            onClick={() => onEdit(subject)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={SPRING.snappy}
            aria-label={t('subjects.edit') || 'Edit'}
            className="flex h-8 w-8 items-center justify-center rounded-lg outline-none"
            style={{
              background: 'rgba(0,122,255,0.10)',
              color: '#007AFF',
              border: '1px solid rgba(0,122,255,0.22)',
            }}
          >
            <Icon paths={I.edit} size={13} strokeWidth={2} />
          </motion.button>
          <motion.button
            type="button"
            onClick={() => onArchive(subject)}
            disabled={isArchiving || !subject.isActive}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={SPRING.snappy}
            aria-label={t('subjects.deactivate')}
            className="flex h-8 w-8 items-center justify-center rounded-lg outline-none disabled:opacity-40"
            style={{
              background: subject.isActive ? 'rgba(255,59,48,0.10)' : 'rgba(142,142,147,0.10)',
              color: subject.isActive ? '#FF3B30' : '#8E8E93',
              border: `1px solid ${subject.isActive ? 'rgba(255,59,48,0.22)' : 'rgba(142,142,147,0.22)'}`,
            }}
          >
            {isArchiving ? (
              <motion.span
                className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <Icon paths={I.archive} size={13} strokeWidth={2} />
            )}
          </motion.button>
        </div>
      </LiquidGlass>
    </motion.div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * SUBJECT FORM MODAL
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

interface SubjectFormModalProps {
  open: boolean;
  editing: Subject | null;
  onClose: () => void;
  onSubmit: (payload: { name: string; code: string; department: string }) => Promise<void>;
  isPending: boolean;
}

function SubjectFormModal({
  open, editing, onClose, onSubmit, isPending,
}: SubjectFormModalProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState('');
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({});

  useFocusTrap(dialogRef, open, nameRef);
  useEscapeKey(open, onClose);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setCode(editing.code);
      setDepartment(editing.department ?? '');
    } else {
      setName('');
      setCode('');
      setDepartment('');
    }
    setErrors({});
  }, [open, editing]);

  const validate = useCallback(() => {
    const e: { name?: string; code?: string } = {};
    if (!name.trim()) e.name = t('subjects.validation.nameRequired');
    if (!code.trim()) e.code = t('subjects.validation.codeRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [name, code, t]);

  const handleSubmit = useCallback(async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    await onSubmit({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      department: department.trim(),
    });
  }, [validate, onSubmit, name, code, department]);

  const isEdit = Boolean(editing);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[200] grid place-items-center p-4"
          style={{
            background: 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={isEdit ? t('subjects.editAria') || 'Edit subject' : t('subjects.createAria')}
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={SPRING.smooth}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffffF2] p-6 backdrop-blur-2xl dark:border-[#ffffff15] dark:bg-[#1c1c1eF2]"
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 32px 80px -20px rgba(15,23,42,0.35)',
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
            />

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close') || 'Close'}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[#86868B] outline-none transition-colors hover:bg-black/[0.06] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:hover:bg-white/[0.08]"
            >
              <Icon paths={I.x} size={14} strokeWidth={2.4} />
            </button>

            {/* Header hint */}
            <div className="flex items-center gap-3 rounded-2xl border border-[#007AFF33] bg-[#007AFF]/[0.06] px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15 text-[#007AFF]">
                <Icon paths={I.sparkles} size={18} strokeWidth={2} />
              </div>
              <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
                {isEdit
                  ? (t('subjects.editHint') || 'Update the subject details below.')
                  : t('subjects.createHint')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              <div>
                <label htmlFor="sf-name" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  {t('subjects.form.name')} <span className="text-[#FF3B30]">*</span>
                </label>
                <input
                  ref={nameRef}
                  id="sf-name"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
                  placeholder={t('subjects.form.namePlaceholder')}
                  aria-invalid={Boolean(errors.name)}
                  className="w-full rounded-xl border bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium text-[#1D1D1F] outline-none transition-all placeholder:text-[#86868B] focus:border-[#007AFF]/40 focus:shadow-[0_0_0_4px_rgba(0,122,255,0.1)] dark:bg-[#1c1c1e80] dark:text-[#F5F5F7]"
                  style={{ borderColor: errors.name ? '#FF3B30' : 'rgba(0,0,0,0.10)' }}
                />
                {errors.name && <p className="mt-1 text-[11.5px] font-medium text-[#FF3B30]">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="sf-code" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                    {t('subjects.form.code')} <span className="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    id="sf-code"
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setErrors((p) => ({ ...p, code: undefined })); }}
                    placeholder={t('subjects.form.codePlaceholder')}
                    aria-invalid={Boolean(errors.code)}
                    className="w-full rounded-xl border bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium uppercase tracking-tight text-[#1D1D1F] outline-none transition-all placeholder:text-[#86868B] focus:border-[#007AFF]/40 focus:shadow-[0_0_0_4px_rgba(0,122,255,0.1)] dark:bg-[#1c1c1e80] dark:text-[#F5F5F7]"
                    style={{ borderColor: errors.code ? '#FF3B30' : 'rgba(0,0,0,0.10)' }}
                  />
                  {errors.code && <p className="mt-1 text-[11.5px] font-medium text-[#FF3B30]">{errors.code}</p>}
                </div>
                <div>
                  <label htmlFor="sf-dept" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                    {t('subjects.form.department')}
                  </label>
                  <input
                    id="sf-dept"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder={t('subjects.form.departmentPlaceholder')}
                    className="w-full rounded-xl border border-[#00000010] bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium text-[#1D1D1F] outline-none transition-all placeholder:text-[#86868B] focus:border-[#007AFF]/40 focus:shadow-[0_0_0_4px_rgba(0,122,255,0.1)] dark:border-[#ffffff10] dark:bg-[#1c1c1e80] dark:text-[#F5F5F7]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING.snappy}
                  disabled={isPending}
                  className="rounded-xl border border-[#00000010] bg-[#00000004] px-4 py-2.5 text-[13px] font-semibold text-[#1D1D1F] outline-none transition-colors hover:bg-[#00000008] disabled:opacity-50 dark:border-[#ffffff10] dark:bg-[#ffffff06] dark:text-[#F5F5F7]"
                >
                  {t('common.cancel')}
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING.snappy}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white outline-none disabled:opacity-70"
                  style={{
                    background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                    boxShadow: '0 8px 24px -8px rgba(0,122,255,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
                  }}
                >
                  {isPending ? (
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
                      <Icon paths={isEdit ? I.check : I.plus} size={14} strokeWidth={2.5} />
                      {isEdit ? (t('common.save') || 'Save') : t('subjects.form.create')}
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * ERROR STATE
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="flex flex-col items-center gap-4 rounded-3xl border p-10 text-center"
      style={{ borderColor: 'rgba(255,59,48,0.2)', background: 'rgba(255,59,48,0.04)' }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(255,59,48,0.12)', color: '#FF3B30' }}
      >
        <Icon paths={I.alertTriangle} size={26} strokeWidth={2} />
      </div>
      <div>
        <h3 className="text-[17px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          {t('subjects.loadErrorTitle')}
        </h3>
        <p className="mt-1 text-[13px] font-medium text-[#86868B]">{message}</p>
      </div>
      <motion.button
        type="button"
        onClick={onRetry}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={SPRING.snappy}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white outline-none"
        style={{
          background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
          boxShadow: '0 8px 24px -8px rgba(0,122,255,0.5)',
        }}
      >
        <Icon paths={I.refresh} size={14} strokeWidth={2.4} />
        {t('common.retry')}
      </motion.button>
    </motion.div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * MAIN PAGE
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export default function SubjectsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const reduced = usePrefersReducedMotion();
  const { push } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [filterKey, setFilterKey] = useState<FilterKey>('ALL');
  const [sortKey, setSortKey] = usePersistedState<SortKey>('m-edu.subjects.sort', 'name');
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('m-edu.subjects.view', 'list');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  /* â”€â”€ Data â”€â”€ */
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['subjects', debouncedSearch],
    queryFn: () => subjectsApi.list({ search: debouncedSearch || undefined }),
    placeholderData: (prev) => prev,
  });

  const subjects: Subject[] = useMemo(() => data?.items ?? [], [data]);

  /* â”€â”€ Derived â”€â”€ */
  const stats = useMemo(() => {
    const total = subjects.length;
    const active = subjects.filter((s) => s.isActive).length;
    const archived = total - active;
    const departments = new Set(subjects.map((s) => s.department).filter(Boolean)).size;
    return { total, active, archived, departments };
  }, [subjects]);

  const counts = useMemo<Record<FilterKey, number>>(
    () => ({ ALL: subjects.length, ACTIVE: stats.active, ARCHIVED: stats.archived }),
    [subjects, stats],
  );

  const filtered = useMemo(() => {
    if (filterKey === 'ACTIVE') return subjects.filter((s) => s.isActive);
    if (filterKey === 'ARCHIVED') return subjects.filter((s) => !s.isActive);
    return subjects;
  }, [subjects, filterKey]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'code':
          return (a.code || '').localeCompare(b.code || '');
        case 'department':
          return (a.department || '').localeCompare(b.department || '');
        case 'status':
          return Number(b.isActive) - Number(a.isActive);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return arr;
  }, [filtered, sortKey]);

  const filterOptions = useMemo(
    () => [
      { key: 'ALL' as FilterKey,      label: t('subjects.filter.all'),      icon: I.layers,      tone: 'blue'  as Tone },
      { key: 'ACTIVE' as FilterKey,   label: t('subjects.filter.active'),   icon: I.checkCircle, tone: 'green' as Tone },
      { key: 'ARCHIVED' as FilterKey, label: t('subjects.filter.archived'), icon: I.archive,     tone: 'slate' as Tone },
    ],
    [t],
  );

  /* â”€â”€ Mutations â”€â”€ */
  const createMutation = useMutation({
    mutationFn: (payload: { name: string; code: string; department: string }) =>
      subjectsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      push('success', t('subjects.toast.created') || 'Subject created');
      setModalOpen(false);
      setEditing(null);
    },
    onError: (err) => {
      push('error', safeErrorMessage(err, t('common.error') || 'Error'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; code: string; department: string } }) =>
       //  assuming subjectsApi.update exists
      subjectsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      push('success', t('subjects.toast.updated') || 'Subject updated');
      setModalOpen(false);
      setEditing(null);
    },
    onError: (err) => {
      push('error', safeErrorMessage(err, t('common.error') || 'Error'));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => subjectsApi.delete(id),
    onMutate: async (id: string) => {
      // Optimistic
      await queryClient.cancelQueries({ queryKey: ['subjects'] });
      const prev = queryClient.getQueryData<{ items: Subject[] }>(['subjects', debouncedSearch]);
      queryClient.setQueryData<{ items: Subject[] }>(['subjects', debouncedSearch], (old) => {
        if (!old) return old;
        return { ...old, items: old.items.map((s) => (s.id === id ? { ...s, isActive: false } : s)) };
      });
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['subjects', debouncedSearch], ctx.prev);
      push('error', safeErrorMessage(err, t('common.error') || 'Error'));
    },
    onSuccess: () => {
      push('success', t('subjects.toast.archived') || 'Subject archived');
      // Undo affordance: re-activates the subject via the PATCH endpoint.
      push('info', t('subjects.toast.undoHint') || 'Archived by mistake? Re-activate it from the archived filter.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });

  /* â”€â”€ Handlers â”€â”€ */
  const handleOpenCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((s: Subject) => {
    setEditing(s);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const handleSubmit = useCallback(async (payload: { name: string; code: string; department: string }) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  }, [editing, updateMutation, createMutation]);

  const handleArchive = useCallback((s: Subject) => {
    archiveMutation.mutate(s.id);
  }, [archiveMutation]);

  /* â”€â”€ âŒ˜K search focus â”€â”€ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* â”€â”€ Loading â”€â”€ */
  if (isLoading && !subjects.length) {
    return (
      <div className="page-container space-y-5">
        <SubjectsSkeleton />
      </div>
    );
  }

  /* â”€â”€ Error â”€â”€ */
  if (isError) {
    return (
      <div className="page-container space-y-5">
        <ErrorState
          message={safeErrorMessage(error, t('common.error') || 'Error')}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const isModalPending = createMutation.isPending || updateMutation.isPending;

  /* â”€â”€ Render â”€â”€ */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container space-y-5"
    >
      {/* â”€â”€ HERO â”€â”€ */}
      <motion.div variants={cardVariants}>
        <LiquidGlass radius="2rem" className="p-6 sm:p-7" elevated>
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Animated icon */}
            <div className="relative" style={{ width: 88, height: 88 }}>
              {!reduced && (
                <motion.div
                  className="absolute inset-[-4px] rounded-full p-[3px]"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                >
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        'conic-gradient(from 0deg, #007AFF, #5856D6, #AF52DE, #FF2D55, #FF9500, #34C759, #007AFF)',
                    }}
                    aria-hidden
                  />
                </motion.div>
              )}

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={SPRING.smooth}
                className="relative flex h-full w-full items-center justify-center rounded-full text-white ring-2 ring-white/70 dark:ring-black/50"
                style={{
                  background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                  boxShadow: '0 12px 32px -8px rgba(0,122,255,0.5), inset 0 2px 0 rgba(255,255,255,0.4)',
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)' }}
                />
                <Icon paths={I.bookOpen} size={34} strokeWidth={2} className="relative" />
              </motion.div>
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-tight"
                  style={{
                    background: TONE.green.bg,
                    color: TONE.green.fg,
                    border: `1px solid ${TONE.green.border}`,
                    boxShadow: `0 4px 12px -6px ${TONE.green.glow}`,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: TONE.green.fg, boxShadow: `0 0 6px ${TONE.green.glow}` }}
                  />
                  {t('subjects.badge.activeCount', { count: stats.active })}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00000008] bg-[#00000004] px-2.5 py-1 text-[11px] font-semibold text-[#86868B] dark:border-[#ffffff10] dark:bg-[#ffffff06]">
                  <Icon paths={I.layers} size={10} strokeWidth={2.5} />
                  {t('subjects.badge.totalCount', { count: stats.total })}
                </span>
                {stats.departments > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{
                      background: TONE.purple.bg,
                      color: TONE.purple.fg,
                      border: `1px solid ${TONE.purple.border}`,
                    }}
                  >
                    <Icon paths={I.building} size={10} strokeWidth={2.5} />
                    {t('subjects.badge.deptCount', { count: stats.departments })}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('subjects.heroTitle')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('subjects.heroSubtitle')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <motion.button
                type="button"
                onClick={handleOpenCreate}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white outline-none"
                style={{
                  background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                  boxShadow: '0 8px 24px -8px rgba(0,122,255,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                {t('subjects.add')}
              </motion.button>
            </div>
          </div>
        </LiquidGlass>
      </motion.div>

      {/* â”€â”€ STATS â”€â”€ */}
      <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label={t('subjects.stat.total')}
          value={stats.total}
          icon={I.bookOpen}
          tone="blue"
          active={filterKey === 'ALL'}
          onClick={() => setFilterKey('ALL')}
        />
        <StatTile
          label={t('subjects.stat.active')}
          value={stats.active}
          icon={I.checkCircle}
          tone="green"
          active={filterKey === 'ACTIVE'}
          onClick={() => setFilterKey('ACTIVE')}
        />
        <StatTile
          label={t('subjects.stat.archived')}
          value={stats.archived}
          icon={I.archive}
          tone="slate"
          active={filterKey === 'ARCHIVED'}
          onClick={() => setFilterKey('ARCHIVED')}
        />
        <StatTile
          label={t('subjects.stat.departments')}
          value={stats.departments}
          icon={I.building}
          tone="purple"
        />
      </motion.div>

      {/* â”€â”€ TOOLBAR â”€â”€ */}
      <motion.div
        variants={cardVariants}
        className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <SegmentedFilter
          value={filterKey}
          onChange={setFilterKey}
          options={filterOptions}
          counts={counts}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]">
              <Icon paths={I.search} size={14} strokeWidth={2.2} />
            </span>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('subjects.searchPlaceholder')}
              className="w-full rounded-xl border border-[#00000010] bg-[#ffffff80] py-2.5 pl-9 pr-16 text-[13px] font-medium text-[#1D1D1F] outline-none backdrop-blur-xl transition-all placeholder:text-[#86868B] focus:border-[#007AFF]/40 focus:bg-white focus:shadow-[0_0_0_4px_rgba(0,122,255,0.1)] dark:border-[#ffffff10] dark:bg-[#1c1c1e80] dark:text-[#F5F5F7]"
              aria-label={t('subjects.searchAria')}
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <AnimatePresence>
                {search && (
                  <motion.button
                    type="button"
                    onClick={() => setSearch('')}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={SPRING.snappy}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[#86868B] outline-none hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                    aria-label={t('subjects.clearSearchAria')}
                  >
                    <Icon paths={I.x} size={12} strokeWidth={2.5} />
                  </motion.button>
                )}
              </AnimatePresence>
              <kbd className="hidden rounded-md border border-[#00000015] bg-[#00000005] px-1.5 py-0.5 text-[10px] font-bold text-[#86868B] sm:inline-block dark:border-[#ffffff20] dark:bg-[#ffffff10]">
                âŒ˜K
              </kbd>
            </div>
          </div>

          <SortDropdown value={sortKey} onChange={setSortKey} />
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </motion.div>

      {/* â”€â”€ LIST / GRID â”€â”€ */}
      <motion.div variants={cardVariants}>
        <LiquidGlass radius="1.5rem" className="p-3">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-[#00000008] px-2 pb-3 pt-1 dark:border-[#ffffff08]">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
              <Icon paths={I.bookOpen} size={15} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {t('subjects.listTitle')}
              </h2>
              <p className="text-[11px] font-medium text-[#86868B]">
                {t(sorted.length === 1 ? 'subjects.countOne' : 'subjects.countMany', { count: sorted.length })}
              </p>
            </div>
            {search && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold text-[#007AFF]">
                <Icon paths={I.search} size={10} strokeWidth={2.5} />
                {t('subjects.found', { count: sorted.length })}
              </span>
            )}
          </div>

          <div className="p-2">
            {subjects.length === 0 ? (
              <EmptyState
                icon={I.bookOpen}
                title={t('subjects.emptyTitle')}
                hint={t('subjects.emptyHint')}
                action={{
                  label: t('subjects.add'),
                  icon: I.plus,
                  onClick: handleOpenCreate,
                }}
              />
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={I.search}
                title={t('subjects.emptyFilteredTitle')}
                hint={t('subjects.emptyFilteredHint')}
                action={{
                  label: t('subjects.showAll'),
                  onClick: () => { setFilterKey('ALL'); setSearch(''); },
                }}
                secondaryAction={
                  search
                    ? {
                        label: t('subjects.clearSearch'),
                        onClick: () => setSearch(''),
                      }
                    : undefined
                }
              />
            ) : viewMode === 'grid' ? (
              <motion.div
                layout
                className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3"
              >
                <AnimatePresence mode="popLayout">
                  {sorted.map((subject, i) => (
                    <SubjectCard
                      key={subject.id}
                      subject={subject}
                      onEdit={handleOpenEdit}
                      onArchive={handleArchive}
                      isArchiving={archiveMutation.isPending && archiveMutation.variables === subject.id}
                      searchQuery={search}
                      index={i}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div layout className="space-y-2 pt-1">
                <AnimatePresence initial={false} mode="popLayout">
                  {sorted.map((subject) => (
                    <SubjectRow
                      key={subject.id}
                      subject={subject}
                      onEdit={handleOpenEdit}
                      onArchive={handleArchive}
                      isArchiving={archiveMutation.isPending && archiveMutation.variables === subject.id}
                      searchQuery={search}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </LiquidGlass>
      </motion.div>

      {/* â”€â”€ MODAL â”€â”€ */}
      <SubjectFormModal
        open={modalOpen}
        editing={editing}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        isPending={isModalPending}
      />
    </motion.div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * EMPTY STATE
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function EmptyState({
  icon, title, hint, action, secondaryAction,
}: {
  icon: string[];
  title: string;
  hint: string;
  action?: { label: string; icon?: string[]; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="flex flex-col items-center gap-3 px-6 py-12 text-center"
    >
      <motion.div
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-[#007AFF]"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon paths={icon} size={26} strokeWidth={2} />
      </motion.div>
      <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{title}</p>
      <p className="max-w-sm text-[12px] font-medium text-[#86868B]">{hint}</p>
      {(action || secondaryAction) && (
        <div className="mt-2 flex gap-2">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="rounded-xl border border-[#00000010] bg-[#00000004] px-3 py-2 text-[12px] font-semibold text-[#1D1D1F] outline-none transition-colors hover:bg-[#00000008] dark:border-[#ffffff10] dark:bg-[#ffffff06] dark:text-[#F5F5F7]"
            >
              {secondaryAction.label}
            </button>
          )}
          {action && (
            <motion.button
              type="button"
              onClick={action.onClick}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-semibold text-white outline-none"
              style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                boxShadow: '0 8px 24px -8px rgba(0,122,255,0.5)',
              }}
            >
              {action.icon && <Icon paths={action.icon} size={13} strokeWidth={2.5} />}
              {action.label}
            </motion.button>
          )}
        </div>
      )}
    </motion.div>
  );
}
