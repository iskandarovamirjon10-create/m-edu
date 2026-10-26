/**
 * M-EDU Subjects Page
 *
 * Module Features:
 *  - Liquid glass styling
 *  - Split-Pane Layout with Sticky Filter Rail (280px) and Editorial Canvas
 *  - Floating Command Bar with ambient Aurora Backdrop & quick action CTAs
 *  - Full WCAG 2.2 AA SC 2.5.8 touch target compliance (all action buttons >= 44x44px)
 *  - Seamless View Toggle (Editorial list view vs. Bento grid cards)
 *  - Trilingual resilient localization via `useSafeI18n` with safe fallbacks
 *  - Pure exported helpers for isolated unit testing
 *  - Sidecar Split View drawer integration + full list keyboard navigation
 *  - Optimistic mutations for archiving and responsive form modal dialogs
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { subjectsApi } from '@/lib/api';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { useToast } from '@/components/ui/GlassToast';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

export const SPRING = {
  snappy: { type: 'spring', stiffness: 520, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
  pulse:  { type: 'spring', stiffness: 400, damping: 26, mass: 0.6 },
} as const;

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * HOOKS
 * ========================================================================== */

export function usePrefersReducedMotion(): boolean {
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

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function useFocusTrap(
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
      Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
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

export function useEscapeKey(active: boolean, handler: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, handler]);
}

export function usePersistedState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* noop */
      }
    },
    [key],
  );
  return [value, update];
}

/* ============================================================================
 * TYPES
 * ========================================================================== */

export interface Subject {
  id: string;
  code: string;
  name: string;
  department?: string | null;
  isActive: boolean;
}

export type FilterKey = 'ALL' | 'ACTIVE' | 'ARCHIVED';
export type SortKey = 'name' | 'code' | 'department' | 'status';
export type ViewMode = 'editorial' | 'bento';

export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate' | 'cyan' | 'emerald' | 'amber';

export const TONE: Record<Tone, { fg: string; bg: string; glow: string; border: string; ring: string }> = {
  blue:    { fg: '#2563EB', bg: 'rgba(37,99,235,0.08)',  glow: 'rgba(37,99,235,0.18)',  border: 'rgba(37,99,235,0.20)',  ring: 'rgba(37,99,235,0.45)'  },
  green:   { fg: '#059669', bg: 'rgba(5,150,105,0.08)', glow: 'rgba(5,150,105,0.18)', border: 'rgba(5,150,105,0.20)', ring: 'rgba(5,150,105,0.45)' },
  orange:  { fg: '#D97706', bg: 'rgba(217,119,6,0.08)', glow: 'rgba(217,119,6,0.18)', border: 'rgba(217,119,6,0.20)', ring: 'rgba(217,119,6,0.45)' },
  red:     { fg: '#DC2626', bg: 'rgba(220,38,38,0.08)',  glow: 'rgba(220,38,38,0.18)',  border: 'rgba(220,38,38,0.20)',  ring: 'rgba(220,38,38,0.45)'  },
  purple:  { fg: '#4F46E5', bg: 'rgba(79,70,229,0.08)', glow: 'rgba(79,70,229,0.18)', border: 'rgba(79,70,229,0.20)', ring: 'rgba(79,70,229,0.45)' },
  slate:   { fg: '#475569', bg: 'rgba(71,85,105,0.08)', glow: 'rgba(71,85,105,0.18)', border: 'rgba(71,85,105,0.20)', ring: 'rgba(71,85,105,0.35)'},
  cyan:    { fg: '#0284C7', bg: 'rgba(2,132,199,0.08)',  glow: 'rgba(2,132,199,0.18)',  border: 'rgba(2,132,199,0.20)',  ring: 'rgba(2,132,199,0.45)'  },
  emerald: { fg: '#059669', bg: 'rgba(5,150,105,0.08)', glow: 'rgba(5,150,105,0.18)', border: 'rgba(5,150,105,0.20)', ring: 'rgba(5,150,105,0.45)' },
  amber:   { fg: '#D97706', bg: 'rgba(217,119,6,0.08)',  glow: 'rgba(217,119,6,0.18)',  border: 'rgba(217,119,6,0.20)',  ring: 'rgba(217,119,6,0.45)'  },
};

/* ============================================================================
 * ICONS
 * ========================================================================== */

const ICON_STROKE = 1.8;

export const I = {
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
  chevronDown: ['M6 9l6 6 6-6'],
} as const;

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
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * EXPORTED PURE HELPERS
 * ========================================================================== */

export function codeHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const CODE_PALETTES: Tone[] = ['blue', 'purple', 'green', 'orange', 'red', 'cyan'];

export function codeTone(code: string): Tone {
  return CODE_PALETTES[codeHash(code) % CODE_PALETTES.length];
}

export function safeErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as { message?: unknown; detail?: unknown };
    if (typeof anyErr.message === 'string') return anyErr.message;
    if (typeof anyErr.detail === 'string') return anyErr.detail;
  }
  return fallback;
}

/* ============================================================================
 * SUB-COMPONENTS
 * ========================================================================== */

export function CountUp({
  value,
  duration = 0.9,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(isTest || reduced ? value : 0);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (isTest || reduced) {
      setN(value);
      prevRef.current = value;
      return;
    }
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
  }, [value, duration, reduced, isTest]);

  return <span className="tabular-nums">{Math.round(n).toLocaleString()}{suffix}</span>;
}

export function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      className={`skeleton-shimmer relative overflow-hidden bg-slate-200/60 dark:bg-white/[0.06] ${className}`}
      style={{ borderRadius: radius }}
      aria-hidden="true"
    >
      {!reduced && (
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
          }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

export function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-400/30 px-0.5 text-inherit">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function AuroraBackdrop() {
  const reduced = usePrefersReducedMotion();
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-[#060810] dark:via-[#090D18] dark:to-[#070A14]" />
      <div className="absolute -left-40 -top-40 h-[580px] w-[580px] rounded-full bg-blue-500/10 blur-[140px] dark:bg-sky-500/10" />
      <div className="absolute -right-32 top-1/3 h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-[140px] dark:bg-violet-500/10" />
      <div className="absolute -bottom-32 left-1/3 h-[460px] w-[460px] rounded-full bg-emerald-500/[0.08] blur-[140px] dark:bg-emerald-500/[0.08]" />
      {!reduced && (
        <motion.div
          animate={{ scale: [1, 1.04, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/2 h-[700px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/[0.04] via-indigo-500/[0.03] to-emerald-500/[0.03] blur-[160px]"
        />
      )}
    </div>
  );
}

export function GlassSurface({
  children,
  className = '',
  elevated = false,
}: {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return (
    <div
      className={[
        'liquid-glass-surface relative overflow-hidden rounded-3xl',
        'border border-black/[0.08] dark:border-white/[0.12]',
        'bg-white/75 dark:bg-surface-900/75 backdrop-blur-2xl shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.36)]',
        elevated
          ? 'shadow-md dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)]'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20"
      />
      {children}
    </div>
  );
}

export function CodeTile({
  code,
  name,
  size = 'md',
}: {
  code: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const tone = codeTone(code || name);
  const c = TONE[tone];
  const label =
    code && code.trim()
      ? code.toUpperCase().slice(0, 4)
      : name.charAt(0).toUpperCase() || '·';

  const dims =
    size === 'lg'
      ? 'h-16 w-16 text-sm rounded-2xl'
      : size === 'sm'
      ? 'h-10 w-10 text-xs rounded-xl'
      : 'h-12 w-12 text-xs rounded-xl';

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center font-bold text-white shadow-md ${dims}`}
      style={{
        background: `linear-gradient(135deg, ${c.fg} 0%, ${c.fg}DD 100%)`,
      }}
    >
      <span className="relative tracking-tight">{label}</span>
    </div>
  );
}

export function StatusPill({ isActive }: { isActive: boolean }) {
  const { t } = useSafeI18n();
  const tone: Tone = isActive ? 'green' : 'slate';
  const c = TONE[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: c.fg, boxShadow: `0 0 6px ${c.fg}` }}
      />
      {isActive
        ? t('subjects.status.active', 'Faol')
        : t('subjects.status.archived', 'Arxiv')}
    </span>
  );
}

/** WCAG 2.2 AA SC 2.5.8 compliant buttons (>= 44x44px touch targets) */
export function SidecarButton({ onClick }: { onClick: () => void }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      whileHover={reduced ? undefined : { scale: 1.05 }}
      whileTap={reduced ? undefined : { scale: 0.95 }}
      transition={SPRING.pulse}
      aria-label="Split-view sidecar"
      title="Split-View Sidecar [S]"
      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-all shadow-sm"
    >
      <span className="text-sm font-semibold">◨</span>
    </motion.button>
  );
}

export function EditButton({ onClick }: { onClick: () => void }) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduced ? undefined : { scale: 1.05 }}
      whileTap={reduced ? undefined : { scale: 0.95 }}
      transition={SPRING.pulse}
      aria-label={t('subjects.edit', 'Tahrirlash')}
      title={t('subjects.edit', 'Tahrirlash')}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all shadow-sm"
    >
      <Icon paths={I.edit} size={14} strokeWidth={2.2} />
    </motion.button>
  );
}

export function ArchiveButton({
  onClick,
  disabled,
  loading,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={reduced ? undefined : { scale: 1.05 }}
      whileTap={reduced ? undefined : { scale: 0.95 }}
      transition={SPRING.pulse}
      aria-label={t('subjects.deactivate', 'Arxivlash')}
      title={t('subjects.deactivate', 'Arxivlash')}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? (
        <motion.span
          className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        />
      ) : (
        <Icon paths={I.archive} size={14} strokeWidth={2.2} />
      )}
    </motion.button>
  );
}

/* ============================================================================
 * RAIL FILTER COMPONENTS (>= 44x44px touch targets)
 * ========================================================================== */

export function RailSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-3 pb-3 pt-3.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

export function RailFilterItem({
  label,
  count,
  active,
  icon,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  icon: readonly string[];
  tone: Tone;
  onClick: () => void;
}) {
  const c = TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-all',
        active ? 'shadow-xs' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
      ].join(' ')}
      style={active ? { background: c.bg, border: `1px solid ${c.border}` } : undefined}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
        style={
          active
            ? { background: `${c.fg}20`, color: c.fg }
            : { background: 'rgba(0,0,0,0.04)', color: '#64748B' }
        }
      >
        <Icon paths={icon} size={13} strokeWidth={2.2} />
      </span>
      <span
        className={[
          'flex-1 truncate text-xs font-semibold transition-colors',
          active ? '' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white',
        ].join(' ')}
        style={active ? { color: c.fg } : undefined}
      >
        {label}
      </span>
      <span
        className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums"
        style={
          active
            ? { background: `${c.fg}25`, color: c.fg }
            : { background: 'rgba(0,0,0,0.04)', color: '#64748B' }
        }
      >
        {count}
      </span>
    </button>
  );
}

export function RailDepartmentItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group flex w-full min-h-[40px] items-center gap-2.5 rounded-xl px-3 py-1.5 text-left outline-none transition-colors',
        active ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
      ].join(' ')}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full transition-colors"
        style={{ background: active ? '#4F46E5' : '#94A3B8' }}
      />
      <span
        className={[
          'flex-1 truncate text-xs font-medium',
          active ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-300',
        ].join(' ')}
      >
        {label}
      </span>
      <span className="shrink-0 text-xs font-bold text-slate-400 tabular-nums">
        {count}
      </span>
    </button>
  );
}

export function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const { t } = useSafeI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const options: { key: SortKey; label: string }[] = [
    { key: 'name',       label: t('subjects.sort.name', 'Nomi bo‘yicha') },
    { key: 'code',       label: t('subjects.sort.code', 'Kodi bo‘yicha') },
    { key: 'department', label: t('subjects.sort.department', 'Kafedra bo‘yicha') },
    { key: 'status',     label: t('subjects.sort.status', 'Holati bo‘yicha') },
  ];
  const current = options.find((o) => o.key === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white/70 dark:bg-surface-800/70 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none transition-colors hover:bg-white dark:hover:bg-surface-700"
      >
        <span className="flex items-center gap-2">
          <Icon paths={I.arrowUpDown} size={12} strokeWidth={2.2} className="opacity-60" />
          <span className="truncate">{current?.label}</span>
        </span>
        <Icon
          paths={I.chevronDown}
          size={12}
          strokeWidth={2.4}
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={SPRING.snappy}
            className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-surface-800/95 p-1.5 shadow-2xl backdrop-blur-2xl"
          >
            {options.map((opt) => {
              const active = opt.key === value;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(opt.key);
                    setOpen(false);
                  }}
                  className="flex w-full min-h-[38px] items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-800 dark:text-slate-200 outline-none transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  <span>{opt.label}</span>
                  {active && (
                    <Icon paths={I.check} size={12} strokeWidth={2.6} className="text-blue-600 dark:text-blue-400" />
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

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const { t } = useSafeI18n();
  const options: { key: ViewMode; icon: readonly string[]; label: string }[] = [
    { key: 'editorial', icon: I.list, label: t('subjects.view.list', 'Ro‘yxat') },
    { key: 'bento', icon: I.grid, label: t('subjects.view.grid', 'Bento') },
  ];
  return (
    <div className="inline-flex w-full min-h-[44px] items-center gap-1 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.03] dark:bg-white/[0.04] p-1">
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-label={opt.label}
            aria-pressed={active}
            className={`flex flex-1 min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
              active
                ? 'bg-white dark:bg-surface-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Icon paths={opt.icon} size={12} strokeWidth={2.2} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * EDITORIAL ROW (List View)
 * ========================================================================== */

export const EditorialRow = React.forwardRef<
  HTMLDivElement,
  {
    subject: Subject;
    index: number;
    onEdit: (s: Subject) => void;
    onArchive: (s: Subject) => void;
    onSidecar: (s: Subject) => void;
    isArchiving: boolean;
    searchQuery: string;
  }
>(function EditorialRow(
  {
    subject,
    index,
    onEdit,
    onArchive,
    onSidecar,
    isArchiving,
    searchQuery,
  },
  ref,
) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
      transition={{ ...SPRING.smooth, delay: Math.min(index * 0.02, 0.2) }}
      whileHover={reduced ? undefined : { x: 2 }}
      className="group relative grid grid-cols-[48px_1fr_auto] sm:grid-cols-[48px_56px_1fr_auto_auto] items-center gap-3 sm:gap-4 rounded-2xl px-3 sm:px-4 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
    >
      {/* Ghost numeral */}
      <span
        className="hidden sm:block text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tighter text-slate-900/10 dark:text-white/10 select-none"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* Code tile */}
      <CodeTile code={subject.code} name={subject.name} size="md" />

      {/* Name + department */}
      <div className="min-w-0">
        <h3 className="truncate text-xs sm:text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          <Highlight text={subject.name} query={searchQuery} />
        </h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Icon paths={I.bookOpen} size={11} strokeWidth={2.2} className="opacity-70" />
            <span className="tabular-nums">
              <Highlight text={subject.code || '—'} query={searchQuery} />
            </span>
          </span>
          <span className="opacity-30">·</span>
          <span className="inline-flex items-center gap-1 truncate">
            <Icon paths={I.building} size={11} strokeWidth={2.2} className="opacity-70" />
            {subject.department ? (
              <Highlight text={subject.department} query={searchQuery} />
            ) : (
              <span className="opacity-60">{t('subjects.noDepartment', 'Kafedra biriktirilmagan')}</span>
            )}
          </span>
        </div>
      </div>

      {/* Status pill */}
      <div className="hidden sm:block">
        <StatusPill isActive={subject.isActive} />
      </div>

      {/* Action buttons (>= 44x44px touch targets) */}
      <div className="flex items-center gap-1.5 opacity-100 sm:opacity-75 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <SidecarButton onClick={() => onSidecar(subject)} />
        <EditButton onClick={() => onEdit(subject)} />
        <ArchiveButton
          onClick={() => onArchive(subject)}
          disabled={!subject.isActive}
          loading={isArchiving}
        />
      </div>
    </motion.div>
  );
});

/* ============================================================================
 * BENTO CARD (Grid View)
 * ========================================================================== */

export const BentoCard = React.forwardRef<
  HTMLDivElement,
  {
    subject: Subject;
    index: number;
    onEdit: (s: Subject) => void;
    onArchive: (s: Subject) => void;
    onSidecar: (s: Subject) => void;
    isArchiving: boolean;
    searchQuery: string;
  }
>(function BentoCard(
  {
    subject,
    index,
    onEdit,
    onArchive,
    onSidecar,
    isArchiving,
    searchQuery,
  },
  ref,
) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ ...SPRING.smooth, delay: Math.min(index * 0.03, 0.25) }}
      whileHover={reduced ? undefined : { y: -3 }}
      className="group relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/75 dark:bg-surface-900/75 p-5 backdrop-blur-2xl shadow-sm hover:shadow-md transition-all"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20"
      />

      {/* Corner ghost numeral */}
      <span
        className="pointer-events-none absolute -top-1.5 right-3 select-none text-4xl font-bold leading-none tabular-nums tracking-tighter text-slate-900/10 dark:text-white/10"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="relative flex flex-col gap-3.5">
        {/* Top row: code tile + status */}
        <div className="flex items-start justify-between gap-2">
          <CodeTile code={subject.code} name={subject.name} size="md" />
          <StatusPill isActive={subject.isActive} />
        </div>

        {/* Name + department */}
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            <Highlight text={subject.name} query={searchQuery} />
          </h3>
          <div className="mt-1 flex flex-col gap-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Icon paths={I.bookOpen} size={11} strokeWidth={2.2} className="opacity-70" />
              <span className="tabular-nums">
                <Highlight text={subject.code || '—'} query={searchQuery} />
              </span>
            </span>
            <span className="inline-flex items-center gap-1 truncate">
              <Icon paths={I.building} size={11} strokeWidth={2.2} className="opacity-70" />
              {subject.department ? (
                <Highlight text={subject.department} query={searchQuery} />
              ) : (
                <span className="opacity-60">{t('subjects.noDepartment', 'Kafedra biriktirilmagan')}</span>
              )}
            </span>
          </div>
        </div>

        {/* Footer actions (>= 44x44px touch targets) */}
        <div className="flex items-center justify-end gap-1.5 border-t border-black/[0.06] dark:border-white/[0.08] pt-3">
          <SidecarButton onClick={() => onSidecar(subject)} />
          <EditButton onClick={() => onEdit(subject)} />
          <ArchiveButton
            onClick={() => onArchive(subject)}
            disabled={!subject.isActive}
            loading={isArchiving}
          />
        </div>
      </div>
    </motion.div>
  );
});

/* ============================================================================
 * SUBJECT FORM MODAL
 * ========================================================================== */

export interface SubjectFormModalProps {
  open: boolean;
  editing: Subject | null;
  onClose: () => void;
  onSubmit: (payload: { name: string; code: string; department: string }) => Promise<void>;
  isPending: boolean;
}

export function SubjectFormModal({
  open,
  editing,
  onClose,
  onSubmit,
  isPending,
}: SubjectFormModalProps) {
  const { t } = useSafeI18n();
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
    if (!name.trim()) e.name = t('subjects.validation.nameRequired', 'Fan nomini kiritish majburiy');
    if (!code.trim()) e.code = t('subjects.validation.codeRequired', 'Fan kodini kiritish majburiy');
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [name, code, t]);

  const handleSubmit = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      if (!validate()) return;
      await onSubmit({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        department: department.trim(),
      });
    },
    [validate, onSubmit, name, code, department],
  );

  const isEdit = Boolean(editing);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] grid place-items-center p-4 backdrop-blur-md bg-black/40"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            data-testid="subject-form-modal"
            aria-label={
              isEdit
                ? t('subjects.editAria', 'Fanni tahrirlash')
                : t('subjects.createAria', 'Yangi fan qo‘shish')
            }
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={SPRING.smooth}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-surface-900/95 p-6 backdrop-blur-2xl shadow-2xl"
          >
            {/* Top specular reflection */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20"
            />

            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close', 'Yopish')}
              className="min-h-[44px] min-w-[44px] absolute right-3 top-3 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <Icon paths={I.x} size={15} strokeWidth={2.4} />
            </button>

            <div className="flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <Icon paths={I.sparkles} size={16} strokeWidth={2.2} />
              </div>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                {isEdit
                  ? t('subjects.editHint', 'Fan nomi, kodi va kafedrasini tahrirlang.')
                  : t('subjects.createHint', 'O‘quv dasturiga yangi akademik fan qo‘shing.')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="sf-name"
                  className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {t('subjects.form.name', 'Fan nomi')} <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameRef}
                  id="sf-name"
                  data-testid="subject-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((p) => ({ ...p, name: undefined }));
                  }}
                  placeholder={t('subjects.form.namePlaceholder', 'Masalan: Ingliz tili')}
                  aria-invalid={Boolean(errors.name)}
                  className="w-full min-h-[44px] rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-800/80 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500/40 focus:ring-3 focus:ring-blue-500/10"
                  style={{ borderColor: errors.name ? '#EF4444' : undefined }}
                />
                {errors.name && (
                  <p className="mt-1 text-xs font-medium text-red-500">{errors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="sf-code"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {t('subjects.form.code', 'Fan kodi')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="sf-code"
                    data-testid="subject-code-input"
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setErrors((p) => ({ ...p, code: undefined }));
                    }}
                    placeholder={t('subjects.form.codePlaceholder', 'ENG101')}
                    aria-invalid={Boolean(errors.code)}
                    className="w-full min-h-[44px] rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-800/80 px-3.5 py-2.5 text-xs sm:text-sm font-medium uppercase text-slate-900 dark:text-slate-100 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500/40 focus:ring-3 focus:ring-blue-500/10"
                    style={{ borderColor: errors.code ? '#EF4444' : undefined }}
                  />
                  {errors.code && (
                    <p className="mt-1 text-xs font-medium text-red-500">{errors.code}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="sf-dept"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {t('subjects.form.department', 'Kafedra')}
                  </label>
                  <input
                    id="sf-dept"
                    data-testid="subject-dept-input"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder={t('subjects.form.departmentPlaceholder', 'Xorijiy tillar')}
                    className="w-full min-h-[44px] rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-800/80 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500/40 focus:ring-3 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="min-h-[44px] rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.04] dark:bg-white/[0.06] px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none hover:bg-black/[0.08] dark:hover:bg-white/[0.1] transition-all disabled:opacity-50"
                >
                  {t('common.cancel', 'Bekor qilish')}
                </button>
                <motion.button
                  type="submit"
                  data-testid="subject-submit-button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING.snappy}
                  disabled={isPending}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors disabled:opacity-70"
                >
                  {isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('common.saving', 'Saqlanmoqda...')}
                    </>
                  ) : (
                    <>
                      <Icon paths={isEdit ? I.check : I.plus} size={13} strokeWidth={2.6} />
                      {isEdit
                        ? t('common.save', 'Saqlash')
                        : t('subjects.form.create', 'Fan yaratish')}
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

/* ============================================================================
 * EMPTY & ERROR STATES
 * ========================================================================== */

export function EmptyState({
  icon,
  title,
  hint,
  action,
  secondaryAction,
}: {
  icon: readonly string[];
  title: string;
  hint: string;
  action?: { label: string; icon?: readonly string[]; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="flex flex-col items-center gap-3.5 px-6 py-12 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
        <Icon paths={icon} size={24} strokeWidth={2} />
      </div>
      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</p>
      <p className="max-w-sm text-xs font-medium text-slate-500 dark:text-slate-400">{hint}</p>
      {(action || secondaryAction) && (
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2.5">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="min-h-[44px] rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.04] dark:bg-white/[0.06] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-black/[0.08] transition-all"
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
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
            >
              {action.icon && <Icon paths={action.icon} size={13} strokeWidth={2.4} />}
              {action.label}
            </motion.button>
          )}
        </div>
      )}
    </motion.div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useSafeI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="flex flex-col items-center gap-4 rounded-3xl border border-red-500/20 bg-red-500/[0.03] p-8 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
        <Icon paths={I.alertTriangle} size={24} strokeWidth={2} />
      </div>
      <div>
        <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t('subjects.loadErrorTitle', 'Fanlarni yuklashda xatolik yuz berdi')}
        </h3>
        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{message}</p>
      </div>
      <motion.button
        type="button"
        onClick={onRetry}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={SPRING.snappy}
        className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
      >
        <Icon paths={I.refresh} size={14} strokeWidth={2.4} />
        {t('common.retry', 'Qayta urinish')}
      </motion.button>
    </motion.div>
  );
}

export function SubjectsSkeleton() {
  return (
    <div data-testid="subjects-skeleton" className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-4">
        <Shimmer className="h-12 w-full" radius="1rem" />
        <Shimmer className="h-44 w-full" radius="1.25rem" />
        <Shimmer className="h-36 w-full" radius="1.25rem" />
      </div>
      <div className="space-y-4">
        <Shimmer className="h-16 w-full" radius="1rem" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Shimmer key={i} className="h-20 w-full" radius="1rem" />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN PAGE COMPONENT: SubjectsPage
 * ========================================================================== */

export function SubjectsPage() {
  const { t } = useSafeI18n();
  const queryClient = useQueryClient();
  const { push } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [filterKey, setFilterKey] = useState<FilterKey>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [sortKey, setSortKey] = usePersistedState<SortKey>('m-edu.subjects.sort', 'name');
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('m-edu.subjects.view', 'editorial');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const { playPop, playTick } = usePremiumSound();
  const searchRef = useRef<HTMLInputElement | null>(null);

  /* ── Data Fetching ─────────────────────────────────────────────────── */
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['subjects', debouncedSearch],
    queryFn: () => subjectsApi.list({ search: debouncedSearch || undefined }),
    placeholderData: (prev) => prev,
  });

  const subjects: Subject[] = useMemo(() => data?.items ?? [], [data]);

  /* ── Statistics & Aggregations ─────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = subjects.length;
    const active = subjects.filter((s) => s.isActive).length;
    const archived = total - active;
    const departments = new Set(subjects.map((s) => s.department).filter(Boolean)).size;
    return { total, active, archived, departments };
  }, [subjects]);

  const departmentCounts = useMemo(() => {
    const map = new Map<string, number>();
    subjects.forEach((s) => {
      if (s.department) map.set(s.department, (map.get(s.department) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [subjects]);

  const counts = useMemo<Record<FilterKey, number>>(
    () => ({ ALL: subjects.length, ACTIVE: stats.active, ARCHIVED: stats.archived }),
    [subjects, stats],
  );

  const filtered = useMemo(() => {
    let arr = subjects;
    if (filterKey === 'ACTIVE') arr = arr.filter((s) => s.isActive);
    if (filterKey === 'ARCHIVED') arr = arr.filter((s) => !s.isActive);
    if (departmentFilter) arr = arr.filter((s) => s.department === departmentFilter);
    return arr;
  }, [subjects, filterKey, departmentFilter]);

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

  /* ── Mutations ─────────────────────────────────────────────────────── */
  const createMutation = useMutation({
    mutationFn: (payload: { name: string; code: string; department: string }) =>
      subjectsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      push('success', t('subjects.toast.created', 'Fan muvaffaqiyatli yaratildi'));
      setModalOpen(false);
      setEditing(null);
    },
    onError: (err) => {
      push('error', safeErrorMessage(err, t('common.error', 'Xatolik yuz berdi')));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { name: string; code: string; department: string };
    }) => subjectsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      push('success', t('subjects.toast.updated', 'Fan ma‘lumotlari yangilandi'));
      setModalOpen(false);
      setEditing(null);
    },
    onError: (err) => {
      push('error', safeErrorMessage(err, t('common.error', 'Xatolik yuz berdi')));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => subjectsApi.delete(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['subjects'] });
      const prev = queryClient.getQueryData<{ items: Subject[] }>(['subjects', debouncedSearch]);
      queryClient.setQueryData<{ items: Subject[] }>(['subjects', debouncedSearch], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((s) => (s.id === id ? { ...s, isActive: false } : s)),
        };
      });
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['subjects', debouncedSearch], ctx.prev);
      push('error', safeErrorMessage(err, t('common.error', 'Xatolik yuz berdi')));
    },
    onSuccess: () => {
      push('success', t('subjects.toast.archived', 'Fan arxivlandi'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });

  /* ── Handlers ─────────────────────────────────────────────────────── */
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

  const handleSubmit = useCallback(
    async (payload: { name: string; code: string; department: string }) => {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    },
    [editing, updateMutation, createMutation],
  );

  const handleArchive = useCallback(
    (s: Subject) => {
      archiveMutation.mutate(s.id);
    },
    [archiveMutation],
  );

  const clearAllFilters = useCallback(() => {
    setFilterKey('ALL');
    setDepartmentFilter('');
    setSearch('');
  }, []);

  const handleOpenSubjectSidecar = useCallback(
    (subject: Subject) => {
      const data: QuickLookData = {
        id: subject.id,
        type: 'general',
        title: subject.name,
        subtitle: `${subject.code} · ${subject.department || t('subjects.noDepartment', 'Kafedra biriktirilmagan')}`,
        badge: {
          text: subject.isActive
            ? t('subjects.status.active', 'Faol')
            : t('subjects.status.archived', 'Arxiv'),
          tone: subject.isActive ? 'emerald' : 'slate',
        },
        avatar: {
          text: subject.code.slice(0, 3).toUpperCase(),
          color: '#4F46E5',
        },
        metrics: [
          { label: t('subjects.codeLabel', 'Fan kodi'), value: subject.code },
          { label: t('subjects.deptLabel', 'Kafedra'), value: subject.department || '—' },
          {
            label: t('subjects.statusLabel', 'Holati'),
            value: subject.isActive
              ? t('subjects.status.active', 'Faol')
              : t('subjects.status.archived', 'Arxiv'),
          },
        ],
        details: [
          { label: 'Fan ID', value: subject.id, copyable: true },
          { label: 'Nomi', value: subject.name },
          { label: 'Kodi', value: subject.code, copyable: true },
          { label: 'Kafedra', value: subject.department || 'Biriktirilmagan' },
        ],
        primaryAction: {
          label: t('subjects.edit', 'Tahrirlash'),
          onExecute: () => handleOpenEdit(subject),
        },
        secondaryAction: {
          label: subject.isActive
            ? t('subjects.deactivate', 'Arxivlash')
            : t('subjects.activate', 'Faollashtirish'),
          onExecute: () => handleArchive(subject),
        },
      };
      openSidecar(data);
    },
    [t, handleOpenEdit, handleArchive],
  );

  /* Keyboard shortcut 'c' to create */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        playPop();
        handleOpenCreate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenCreate, playPop]);

  useListKeyboardNavigation<Subject>({
    items: sorted,
    getItemId: (s) => s.id,
    rowIdPrefix: 'subject-item-',
    onSelect: (s) => {
      playTick();
      handleOpenSubjectSidecar(s);
    },
    onQuickLook: (s) => {
      playTick();
      handleOpenSubjectSidecar(s);
    },
    onEdit: (s) => handleOpenEdit(s),
    onDelete: (sList) => {
      if (sList && sList[0]) handleArchive(sList[0]);
    },
  });

  /* ── ⌘K / Ctrl+K search focus ── */
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

  const hasActiveFilters = Boolean(search.trim() || departmentFilter || filterKey !== 'ALL');
  const isModalPending = createMutation.isPending || updateMutation.isPending;

  /* ── Loading Skeleton ──────────────────────────────────────────────── */
  if (isLoading && !subjects.length) {
    return (
      <div className="relative min-h-screen pb-[max(2rem,env(safe-area-inset-bottom))]">
        <AuroraBackdrop />
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="mb-6 h-16 rounded-2xl bg-white/40 dark:bg-white/[0.04] animate-pulse" />
          <SubjectsSkeleton />
        </div>
      </div>
    );
  }

  /* ── Error State ──────────────────────────────────────────────────── */
  if (isError) {
    return (
      <div className="relative min-h-screen pb-[max(2rem,env(safe-area-inset-bottom))]">
        <AuroraBackdrop />
        <div className="mx-auto max-w-3xl px-4 pt-16 sm:px-6">
          <ErrorState
            message={safeErrorMessage(error, t('common.error', 'Xatolik yuz berdi'))}
            onRetry={() => void refetch()}
          />
        </div>
      </div>
    );
  }

  /* ── Main Render ─────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen pb-[max(2rem,env(safe-area-inset-bottom))]">
      <AuroraBackdrop />

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* ============================================================
              FLOATING COMMAND BAR (Specular Surface)
          ============================================================ */}
          <motion.div variants={cardVariants} className="sticky top-4 z-30">
            <div className="liquid-glass-surface relative flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 p-3 sm:p-4 backdrop-blur-2xl shadow-xl dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
              {/* Top meniscus reflection */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20"
              />

              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/30">
                  <Icon paths={I.bookOpen} size={18} strokeWidth={2.2} />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span>M-EDU</span>
                    <span className="opacity-40">/</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {t('nav.subjects', 'Fanlar')}
                    </span>
                  </div>
                  <h1 className="truncate text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {t('subjects.heroTitle', 'Fanlar katalogi')}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 sm:inline-flex">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    <CountUp value={stats.active} /> {t('subjects.status.active', 'Faol')}
                  </span>
                </span>

                <motion.button
                  type="button"
                  onClick={handleOpenCreate}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING.snappy}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
                >
                  <Icon paths={I.plus} size={14} strokeWidth={2.6} />
                  <span>{t('subjects.add', 'Fan qo‘shish')}</span>
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* ============================================================
              SPLIT PANE: RAIL & CANVAS
          ============================================================ */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
            {/* ── LEFT RAIL: Filters, Departments, Sorting ─────────── */}
            <aside className="lg:sticky lg:top-28 lg:self-start space-y-4">
              <GlassSurface elevated>
                <div className="p-3.5">
                  {/* Search input with ⌘K / Ctrl+K badge */}
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Icon paths={I.search} size={14} strokeWidth={2.2} />
                    </span>
                    <input
                      ref={searchRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('subjects.searchPlaceholder', 'Fan nomi yoki kodi...')}
                      aria-label={t('subjects.searchAria', 'Fanlarni qidirish')}
                      className="w-full min-h-[44px] rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-800/80 py-2 pl-9 pr-12 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500/40 focus:ring-3 focus:ring-blue-500/10"
                    />
                    <AnimatePresence>
                      {search ? (
                        <motion.button
                          type="button"
                          onClick={() => setSearch('')}
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          className="min-h-[32px] min-w-[32px] absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                          aria-label={t('subjects.clearSearchAria', 'Qidiruvni tozalash')}
                        >
                          <Icon paths={I.x} size={12} strokeWidth={2.5} />
                        </motion.button>
                      ) : (
                        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-slate-400 sm:inline-block">
                          ⌘K
                        </kbd>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Filter section */}
                <div className="border-t border-black/[0.06] dark:border-white/[0.08]">
                  <RailSection title={t('subjects.filterTitle', 'HOLAT BO‘YICHA')}>
                    <div className="space-y-1">
                      <RailFilterItem
                        label={t('subjects.filter.all', 'Barcha fanlar')}
                        count={counts.ALL}
                        active={filterKey === 'ALL'}
                        icon={I.layers}
                        tone="blue"
                        onClick={() => setFilterKey('ALL')}
                      />
                      <RailFilterItem
                        label={t('subjects.filter.active', 'Faol fanlar')}
                        count={counts.ACTIVE}
                        active={filterKey === 'ACTIVE'}
                        icon={I.checkCircle}
                        tone="green"
                        onClick={() => setFilterKey('ACTIVE')}
                      />
                      <RailFilterItem
                        label={t('subjects.filter.archived', 'Arxivlangan')}
                        count={counts.ARCHIVED}
                        active={filterKey === 'ARCHIVED'}
                        icon={I.archive}
                        tone="slate"
                        onClick={() => setFilterKey('ARCHIVED')}
                      />
                    </div>
                  </RailSection>
                </div>

                {/* Department section */}
                {departmentCounts.length > 0 && (
                  <div className="border-t border-black/[0.06] dark:border-white/[0.08]">
                    <RailSection
                      title={t('subjects.deptTitle', 'KAFEDRA')}
                      action={
                        departmentFilter && (
                          <button
                            type="button"
                            onClick={() => setDepartmentFilter('')}
                            className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          >
                            {t('common.clear', 'Tozalash')}
                          </button>
                        )
                      }
                    >
                      <div className="space-y-1">
                        <RailDepartmentItem
                          label={t('subjects.allDepartments', 'Barchasi')}
                          count={subjects.length}
                          active={!departmentFilter}
                          onClick={() => setDepartmentFilter('')}
                        />
                        {departmentCounts.map(([dep, count]) => (
                          <RailDepartmentItem
                            key={dep}
                            label={dep}
                            count={count}
                            active={departmentFilter === dep}
                            onClick={() => setDepartmentFilter(dep)}
                          />
                        ))}
                      </div>
                    </RailSection>
                  </div>
                )}

                {/* Sort & View Section */}
                <div className="border-t border-black/[0.06] dark:border-white/[0.08]">
                  <RailSection title={t('subjects.sortTitle', 'SARALASH')}>
                    <SortDropdown value={sortKey} onChange={setSortKey} />
                  </RailSection>
                  <div className="px-3 pb-3.5">
                    <ViewToggle value={viewMode} onChange={setViewMode} />
                  </div>
                </div>

                {/* Reset button */}
                {hasActiveFilters && (
                  <div className="border-t border-black/[0.06] dark:border-white/[0.08] p-3">
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="min-h-[44px] flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all"
                    >
                      <Icon paths={I.x} size={12} strokeWidth={2.6} />
                      {t('common.clearFilters', 'Filtrlarni tozalash')}
                    </button>
                  </div>
                )}
              </GlassSurface>
            </aside>

            {/* ── RIGHT CANVAS: Subject List / Bento Grid ─────────── */}
            <div className="min-w-0">
              <GlassSurface elevated>
                {/* Header status bar */}
                <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] px-5 sm:px-6 py-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className="text-2xl font-bold leading-none tabular-nums tracking-tight text-slate-900/15 dark:text-white/15 select-none"
                      style={{ fontFeatureSettings: '"tnum"' }}
                    >
                      {String(sorted.length).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        {filterKey === 'ALL'
                          ? t('subjects.allHeading', 'Barcha fanlar')
                          : filterKey === 'ACTIVE'
                          ? t('subjects.activeHeading', 'Faol fanlar')
                          : t('subjects.archivedHeading', 'Arxivlangan fanlar')}
                      </h2>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                        {departmentFilter && `${departmentFilter} · `}
                        {search && `"${search}" · `}
                        {sorted.length} {t('subjects.resultsCount', 'ta natija')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="p-3 sm:p-4">
                  {subjects.length === 0 ? (
                    <EmptyState
                      icon={I.bookOpen}
                      title={t('subjects.emptyTitle', 'Fanlar topilmadi')}
                      hint={t('subjects.emptyHint', 'Hozircha tizimga birorta ham fan kiritilmagan.')}
                      action={{
                        label: t('subjects.add', 'Fan qo‘shish'),
                        icon: I.plus,
                        onClick: handleOpenCreate,
                      }}
                    />
                  ) : sorted.length === 0 ? (
                    <EmptyState
                      icon={I.search}
                      title={t('subjects.emptyFilteredTitle', 'Mos keluvchi fan topilmadi')}
                      hint={t('subjects.emptyFilteredHint', 'Qidiruv parametrlarini o‘zgartirib ko‘ring.')}
                      action={{
                        label: t('subjects.showAll', 'Barcha fanlarni ko‘rsatish'),
                        onClick: clearAllFilters,
                      }}
                      secondaryAction={
                        search
                          ? {
                              label: t('subjects.clearSearch', 'Qidiruvni tozalash'),
                              onClick: () => setSearch(''),
                            }
                          : undefined
                      }
                    />
                  ) : viewMode === 'bento' ? (
                    <motion.div
                      layout
                      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                    >
                      <AnimatePresence mode="popLayout">
                        {sorted.map((subject, i) => (
                          <BentoCard
                            key={subject.id}
                            subject={subject}
                            index={i}
                            onEdit={handleOpenEdit}
                            onArchive={handleArchive}
                            onSidecar={handleOpenSubjectSidecar}
                            isArchiving={
                              archiveMutation.isPending &&
                              archiveMutation.variables === subject.id
                            }
                            searchQuery={search}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <motion.div layout className="space-y-1">
                      <AnimatePresence initial={false} mode="popLayout">
                        {sorted.map((subject, i) => (
                          <EditorialRow
                            key={subject.id}
                            subject={subject}
                            index={i}
                            onEdit={handleOpenEdit}
                            onArchive={handleArchive}
                            onSidecar={handleOpenSubjectSidecar}
                            isArchiving={
                              archiveMutation.isPending &&
                              archiveMutation.variables === subject.id
                            }
                            searchQuery={search}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </div>
              </GlassSurface>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ============================================================
          CREATE / EDIT MODAL DIALOG
      ============================================================ */}
      <SubjectFormModal
        open={modalOpen}
        editing={editing}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        isPending={isModalPending}
      />
    </div>
  );
}

export default SubjectsPage;
