/**
 * M-EDU SubjectsPage — v3 "Catalog Atelier · Editorial Shelf"
 *
 * 🎯 v2 → v3 Complete Visual Rearchitecture:
 *  ✅ Split-Pane Layout — Sticky filter rail (280px) + editorial canvas.
 *  ✅ Aurora Backdrop — Fixed atmospheric gradient + breathing orbs + grid.
 *  ✅ Floating Command Bar — Sticky: breadcrumb · count · view toggle · Add.
 *  ✅ Editorial Ghost Numerals — 32px display `01 → N` per subject.
 *  ✅ Zebra List View — Alternating rows with big ghost numerals.
 *  ✅ Bento Grid View — Cards with code-hero tiles + corner numerals.
 *  ✅ Rail Filters — Vertical list: filter / department / sort.
 *  ✅ Department Grouping — Auto-derived from subjects, single-select.
 *  ✅ Preserved — ALL queries, mutations, form, focus-trap, optimistic update.
 */

import React, {
  useState, useCallback, useMemo, useEffect, useRef,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { subjectsApi } from '../lib/api';
import { useI18n } from '../i18n/I18nProvider';
import { useToast } from '@/components/ui/GlassToast';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring', stiffness: 520, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
  pulse:  { type: 'spring', stiffness: 400, damping: 26, mass: 0.6 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ══════════════════════════════════════════════════════════════════════════
 * HOOKS (all preserved from v2)
 * ════════════════════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ════════════════════════════════════════════════════════════════════════ */

interface Subject {
  id: string;
  code: string;
  name: string;
  department?: string | null;
  isActive: boolean;
}

type FilterKey = 'ALL' | 'ACTIVE' | 'ARCHIVED';
type SortKey = 'name' | 'code' | 'department' | 'status';
type ViewMode = 'editorial' | 'bento';

/* ══════════════════════════════════════════════════════════════════════════
 * TONE PALETTE
 * ════════════════════════════════════════════════════════════════════════ */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate' | 'cyan' | 'emerald' | 'amber';

const TONE: Record<Tone, { fg: string; bg: string; glow: string; border: string; ring: string }> = {
  blue:    { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)',  glow: 'rgba(37,99,235,0.30)',  border: 'rgba(37,99,235,0.22)',  ring: 'rgba(37,99,235,0.45)'  },
  green:   { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.30)', border: 'rgba(16,185,129,0.22)', ring: 'rgba(16,185,129,0.45)' },
  orange:  { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.30)', border: 'rgba(245,158,11,0.22)', ring: 'rgba(245,158,11,0.45)' },
  red:     { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',  glow: 'rgba(239,68,68,0.30)',  border: 'rgba(239,68,68,0.22)',  ring: 'rgba(239,68,68,0.45)'  },
  purple:  { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)', glow: 'rgba(99,102,241,0.30)', border: 'rgba(99,102,241,0.22)', ring: 'rgba(99,102,241,0.45)' },
  slate:   { fg: '#64748B', bg: 'rgba(100,116,139,0.10)',glow: 'rgba(100,116,139,0.24)',border: 'rgba(100,116,139,0.20)',ring: 'rgba(100,116,139,0.35)'},
  cyan:    { fg: '#0284C7', bg: 'rgba(2,132,199,0.10)',  glow: 'rgba(2,132,199,0.30)',  border: 'rgba(2,132,199,0.22)',  ring: 'rgba(2,132,199,0.45)'  },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.30)', border: 'rgba(16,185,129,0.22)', ring: 'rgba(16,185,129,0.45)' },
  amber:   { fg: '#D97706', bg: 'rgba(217,119,6,0.10)',  glow: 'rgba(217,119,6,0.30)',  border: 'rgba(217,119,6,0.22)',  ring: 'rgba(217,119,6,0.45)'  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS
 * ════════════════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.8;

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
  chevronDown: ['M6 9l6 6 6-6'],
} as const;

function Icon({
  paths, size = 18, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: readonly string[]; size?: number; className?: string; strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className}`} aria-hidden {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * HELPERS
 * ════════════════════════════════════════════════════════════════════════ */

function codeHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const CODE_PALETTES: Tone[] = ['blue', 'purple', 'green', 'orange', 'red', 'cyan'];

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

/* ══════════════════════════════════════════════════════════════════════════
 * PRIMITIVES
 * ════════════════════════════════════════════════════════════════════════ */

function CountUp({
  value, duration = 0.9, suffix = '',
}: { value: number; duration?: number; suffix?: string }) {
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(reduced ? value : 0);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) { setN(value); prevRef.current = value; return; }
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
  }, [value, duration, reduced]);

  return <span className="tabular-nums">{Math.round(n).toLocaleString()}{suffix}</span>;
}

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      className={`skeleton-shimmer relative overflow-hidden border border-white/60 dark:border-white/[0.06] ${className}`}
      style={{ borderRadius: radius }}
    >
      {!reduced && (
        <motion.div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)' }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

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

/* ══════════════════════════════════════════════════════════════════════════
 * AURORA BACKDROP
 * ════════════════════════════════════════════════════════════════════════ */

function AuroraBackdrop() {
  const reduced = usePrefersReducedMotion();
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-[#04060C] dark:via-[#0A0F1A] dark:to-[#080A14]" />
      <div className="absolute -left-40 -top-40 h-[580px] w-[580px] rounded-full bg-blue-400/10 blur-[140px] dark:bg-sky-500/10" />
      <div className="absolute -right-32 top-1/3 h-[520px] w-[520px] rounded-full bg-violet-400/10 blur-[140px] dark:bg-violet-500/10" />
      <div className="absolute -bottom-32 left-1/3 h-[460px] w-[460px] rounded-full bg-emerald-400/08 blur-[140px] dark:bg-emerald-500/08" />
      {!reduced && (
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
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
 * GLASS SURFACE
 * ════════════════════════════════════════════════════════════════════════ */

function GlassSurface({
  children, className = '', elevated = false,
}: {
  children: React.ReactNode; className?: string; elevated?: boolean;
}) {
  return (
    <div
      className={[
        'liquid-glass-surface relative overflow-hidden rounded-2xl',
        'border border-black/[0.08] dark:border-white/[0.12]',
        'bg-white/75 dark:bg-surface-900/75 backdrop-blur-xl backdrop-saturate-150',
        elevated
          ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-12px_rgba(15,23,42,0.10)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.4),0_20px_48px_-14px_rgba(0,0,0,0.65)]'
          : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(15,23,42,0.03),0_8px_24px_-10px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.35),0_12px_28px_-10px_rgba(0,0,0,0.5)]',
        className,
      ].filter(Boolean).join(' ')}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.22]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-6 left-0 w-px bg-gradient-to-b from-transparent via-blue-400/10 to-transparent dark:via-sky-400/15"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-6 right-0 w-px bg-gradient-to-b from-transparent via-violet-400/10 to-transparent dark:via-violet-400/15"
      />
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * RAIL — filter section
 * ════════════════════════════════════════════════════════════════════════ */

function RailSection({
  title, children, action,
}: {
  title: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="px-2.5 pb-2.5 pt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

function RailFilterItem({
  label, count, active, icon, tone, onClick,
}: {
  label: string; count: number; active: boolean; icon: readonly string[]; tone: Tone; onClick: () => void;
}) {
  const c = TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors',
        active ? '' : 'hover:bg-slate-100/60 dark:hover:bg-white/[0.04]',
      ].join(' ')}
      style={active ? { background: c.bg } : undefined}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
        style={
          active
            ? { background: `${c.fg}20`, color: c.fg }
            : { background: 'rgba(0,0,0,0.035)', color: '#64748B' }
        }
      >
        <Icon paths={icon} size={11} strokeWidth={2.2} />
      </span>
      <span
        className={[
          'flex-1 truncate text-[12px] font-semibold transition-colors',
          active ? '' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]',
        ].join(' ')}
        style={active ? { color: c.fg } : undefined}
      >
        {label}
      </span>
      <span
        className="shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-black tabular-nums"
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

function RailDepartmentItem({
  label, count, active, onClick,
}: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors',
        active
          ? 'bg-[#6366F1]/10'
          : 'hover:bg-slate-100/60 dark:hover:bg-white/[0.04]',
      ].join(' ')}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full transition-colors"
        style={{ background: active ? '#6366F1' : '#CBD5E1' }}
      />
      <span
        className={[
          'flex-1 truncate text-[11.5px] font-medium',
          active ? 'text-[#6366F1] dark:text-[#A5B4FC]' : 'text-[var(--text-secondary)]',
        ].join(' ')}
      >
        {label}
      </span>
      <span className="shrink-0 text-[9.5px] font-black text-[var(--text-muted)] tabular-nums">
        {count}
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * SORT DROPDOWN (compact)
 * ════════════════════════════════════════════════════════════════════════ */

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
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
    { key: 'department', label: t('subjects.sort.department') || 'Dept' },
    { key: 'status',     label: t('subjects.sort.status') || 'Status' },
  ];
  const current = options.find((o) => o.key === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white/70 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--text-primary)] outline-none transition-colors hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
      >
        <span className="flex items-center gap-1.5">
          <Icon paths={I.arrowUpDown} size={11} strokeWidth={2.2} className="opacity-60" />
          <span className="truncate">{current?.label}</span>
        </span>
        <Icon
          paths={I.chevronDown}
          size={11}
          strokeWidth={2.4}
          className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
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
            className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-xl border border-black/[0.06] bg-white/95 p-1 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-surface-800/98"
          >
            {options.map((opt) => {
              const active = opt.key === value;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="menuitem"
                  onClick={() => { onChange(opt.key); setOpen(false); }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] font-medium text-[var(--text-primary)] outline-none transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                >
                  <span>{opt.label}</span>
                  {active && <Icon paths={I.check} size={11} strokeWidth={2.6} className="text-[#2563EB]" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * VIEW TOGGLE
 * ════════════════════════════════════════════════════════════════════════ */

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const { t } = useI18n();
  const options: { key: ViewMode; icon: readonly string[]; label: string }[] = [
    { key: 'editorial', icon: I.list, label: t('subjects.view.list') || 'Editorial' },
    { key: 'bento', icon: I.grid, label: t('subjects.view.grid') || 'Bento' },
  ];
  return (
    <div className="inline-flex w-full items-center gap-0.5 rounded-lg border border-slate-200/80 bg-white/70 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-label={opt.label}
            aria-pressed={active}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-bold transition-all ${
              active
                ? 'bg-white text-[var(--text-primary)] shadow-sm dark:bg-white/[0.12]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon paths={opt.icon} size={11} strokeWidth={2.2} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * CODE TILE — reusable hero tile
 * ════════════════════════════════════════════════════════════════════════ */

function CodeTile({
  code, name, size = 'md',
}: {
  code: string; name: string; size?: 'sm' | 'md' | 'lg';
}) {
  const tone = codeTone(code || name);
  const c = TONE[tone];
  const label = code && code.trim()
    ? code.toUpperCase().slice(0, 4)
    : name.charAt(0).toUpperCase() || '·';

  const dims = size === 'lg' ? 'h-16 w-16 text-[14px] rounded-2xl'
    : size === 'sm' ? 'h-10 w-10 text-[10px] rounded-xl'
    : 'h-12 w-12 text-[12px] rounded-xl';

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center font-black text-white ${dims}`}
      style={{
        background: `linear-gradient(135deg, ${c.fg} 0%, ${c.fg}CC 100%)`,
        boxShadow: `0 6px 16px -6px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)' }}
      />
      <span className="relative tracking-tight">{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * STATUS PILL
 * ════════════════════════════════════════════════════════════════════════ */

function StatusPill({ isActive }: { isActive: boolean }) {
  const { t } = useI18n();
  const tone: Tone = isActive ? 'green' : 'slate';
  const c = TONE[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[0.08em]"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <span
        className="h-1 w-1 rounded-full"
        style={{ background: c.fg, boxShadow: `0 0 4px ${c.fg}` }}
      />
      {isActive ? t('subjects.status.active') : t('subjects.status.archived')}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * ACTION BUTTONS
 * ════════════════════════════════════════════════════════════════════════ */

function SidecarButton({ onClick }: { onClick: () => void }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      whileHover={reduced ? undefined : { scale: 1.08 }}
      whileTap={reduced ? undefined : { scale: 0.92 }}
      transition={SPRING.pulse}
      aria-label="Split-view sidecar"
      title="Split-View Sidecar (Enter / Space)"
      className="flex h-7 w-7 items-center justify-center rounded-lg outline-none"
      style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.22)' }}
    >
      <span className="text-[12px] leading-none">◨</span>
    </motion.button>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduced ? undefined : { scale: 1.08 }}
      whileTap={reduced ? undefined : { scale: 0.92 }}
      transition={SPRING.pulse}
      aria-label={t('subjects.edit') || 'Edit'}
      title={t('subjects.edit') || 'Edit'}
      className="flex h-7 w-7 items-center justify-center rounded-lg outline-none"
      style={{ background: 'rgba(37,99,235,0.10)', color: '#2563EB', border: '1px solid rgba(37,99,235,0.22)' }}
    >
      <Icon paths={I.edit} size={12} strokeWidth={2.2} />
    </motion.button>
  );
}

function ArchiveButton({
  onClick, disabled, loading,
}: {
  onClick: () => void; disabled: boolean; loading: boolean;
}) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={reduced ? undefined : { scale: 1.08 }}
      whileTap={reduced ? undefined : { scale: 0.92 }}
      transition={SPRING.pulse}
      aria-label={t('subjects.deactivate')}
      title={t('subjects.deactivate')}
      className="flex h-7 w-7 items-center justify-center rounded-lg outline-none disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: disabled ? 'rgba(100,116,139,0.10)' : 'rgba(239,68,68,0.10)',
        color: disabled ? '#64748B' : '#EF4444',
        border: `1px solid ${disabled ? 'rgba(100,116,139,0.22)' : 'rgba(239,68,68,0.22)'}`,
      }}
    >
      {loading ? (
        <motion.span
          className="h-3 w-3 rounded-full border-2 border-current/30 border-t-current"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        />
      ) : (
        <Icon paths={I.archive} size={12} strokeWidth={2.2} />
      )}
    </motion.button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * EDITORIAL ROW — ghost numeral + code tile + status
 * ════════════════════════════════════════════════════════════════════════ */

function EditorialRow({
  subject, index, onEdit, onArchive, onSidecar, isArchiving, searchQuery,
}: {
  subject: Subject;
  index: number;
  onEdit: (s: Subject) => void;
  onArchive: (s: Subject) => void;
  onSidecar: (s: Subject) => void;
  isArchiving: boolean;
  searchQuery: string;
}) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
      transition={{ ...SPRING.smooth, delay: Math.min(index * 0.02, 0.2) }}
      whileHover={reduced ? undefined : { x: 2 }}
      className="group relative grid grid-cols-[48px_1fr_auto] sm:grid-cols-[48px_56px_1fr_auto_auto] items-center gap-2.5 sm:gap-4 rounded-xl px-2.5 sm:px-3 py-3 transition-colors hover:bg-white/60 dark:hover:bg-white/[0.03]"
    >
      {/* Ghost numeral */}
      <span
        className="hidden sm:block text-[28px] font-black leading-none tabular-nums tracking-tighter text-slate-900/[0.07] transition-colors group-hover:text-slate-900/[0.12] dark:text-white/[0.07] dark:group-hover:text-white/[0.12] sm:text-[32px]"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* Code tile */}
      <CodeTile code={subject.code} name={subject.name} size="md" />

      {/* Name + department */}
      <div className="min-w-0">
        <h3 className="truncate text-[13.5px] font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[#2563EB] dark:group-hover:text-[#38BDF8]">
          <Highlight text={subject.name} query={searchQuery} />
        </h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] font-medium text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <Icon paths={I.bookOpen} size={9} strokeWidth={2.2} className="opacity-70" />
            <span className="tabular-nums">
              <Highlight text={subject.code || '—'} query={searchQuery} />
            </span>
          </span>
          <span className="opacity-30">·</span>
          <span className="inline-flex items-center gap-1 truncate">
            <Icon paths={I.building} size={9} strokeWidth={2.2} className="opacity-70" />
            {subject.department
              ? <Highlight text={subject.department} query={searchQuery} />
              : <span className="opacity-60">{t('subjects.noDepartment')}</span>}
          </span>
        </div>
      </div>

      {/* Status pill */}
      <div className="hidden sm:block">
        <StatusPill isActive={subject.isActive} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 transition-opacity duration-150 sm:group-hover:opacity-100 focus-within:opacity-100">
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
}

/* ══════════════════════════════════════════════════════════════════════════
 * BENTO CARD — corner numeral + code hero
 * ════════════════════════════════════════════════════════════════════════ */

function BentoCard({
  subject, index, onEdit, onArchive, onSidecar, isArchiving, searchQuery,
}: {
  subject: Subject;
  index: number;
  onEdit: (s: Subject) => void;
  onArchive: (s: Subject) => void;
  onSidecar: (s: Subject) => void;
  isArchiving: boolean;
  searchQuery: string;
}) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ ...SPRING.smooth, delay: Math.min(index * 0.03, 0.25) }}
      whileHover={reduced ? undefined : { y: -4 }}
      className="liquid-glass-card group relative overflow-hidden rounded-2xl transition-all duration-200 hover:shadow-[0_12px_32px_-10px_rgba(15,23,42,0.15)]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.03), 0 8px 20px -10px rgba(15,23,42,0.06)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/[0.18]"
      />

      {/* Corner ghost numeral */}
      <span
        className="pointer-events-none absolute -top-1.5 right-3 select-none text-[48px] font-black leading-none tabular-nums tracking-tighter text-slate-900/[0.06] transition-colors group-hover:text-slate-900/[0.10] dark:text-white/[0.06] dark:group-hover:text-white/[0.10]"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="relative flex flex-col gap-3 p-4">
        {/* Top row: code tile + status */}
        <div className="flex items-start justify-between gap-2">
          <CodeTile code={subject.code} name={subject.name} size="md" />
          <StatusPill isActive={subject.isActive} />
        </div>

        {/* Name + department */}
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[14.5px] font-black leading-tight tracking-tight text-[var(--text-primary)] group-hover:text-[#2563EB] dark:group-hover:text-[#38BDF8]">
            <Highlight text={subject.name} query={searchQuery} />
          </h3>
          <div className="mt-1 flex flex-col gap-0.5 text-[10.5px] font-medium text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <Icon paths={I.bookOpen} size={9} strokeWidth={2.2} className="opacity-70" />
              <span className="tabular-nums">
                <Highlight text={subject.code || '—'} query={searchQuery} />
              </span>
            </span>
            <span className="inline-flex items-center gap-1 truncate">
              <Icon paths={I.building} size={9} strokeWidth={2.2} className="opacity-70" />
              {subject.department
                ? <Highlight text={subject.department} query={searchQuery} />
                : <span className="opacity-60">{t('subjects.noDepartment')}</span>}
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-1 border-t border-slate-200/60 pt-2.5 opacity-100 sm:opacity-70 sm:group-hover:opacity-100 transition-opacity dark:border-white/[0.06]">
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
}

/* ══════════════════════════════════════════════════════════════════════════
 * SUBJECT FORM MODAL (preserved, polished)
 * ════════════════════════════════════════════════════════════════════════ */

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
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-black/[0.06] bg-white/95 p-6 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-surface-900/95 shadow-2xl"
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 32px 80px -20px rgba(15,23,42,0.35)',
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
            />
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close') || 'Close'}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] outline-none transition-colors hover:bg-slate-200 dark:hover:bg-white/[0.08]"
            >
              <Icon paths={I.x} size={14} strokeWidth={2.4} />
            </button>

            <div className="flex items-center gap-3 rounded-xl border border-[#2563EB]/25 bg-[#2563EB]/[0.06] px-3.5 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/15 text-[#2563EB]">
                <Icon paths={I.sparkles} size={15} strokeWidth={2.2} />
              </div>
              <p className="text-[11.5px] font-medium leading-snug text-[var(--text-primary)]">
                {isEdit
                  ? (t('subjects.editHint') || 'Update the subject details.')
                  : t('subjects.createHint')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5" noValidate>
              <div>
                <label htmlFor="sf-name" className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {t('subjects.form.name')} <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  ref={nameRef}
                  id="sf-name"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
                  placeholder={t('subjects.form.namePlaceholder')}
                  aria-invalid={Boolean(errors.name)}
                  className="w-full rounded-xl border bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[#2563EB]/40 focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.1)] dark:bg-white/[0.04]"
                  style={{ borderColor: errors.name ? '#EF4444' : 'rgba(0,0,0,0.10)' }}
                />
                {errors.name && <p className="mt-1 text-[11px] font-medium text-[#EF4444]">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sf-code" className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {t('subjects.form.code')} <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    id="sf-code"
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setErrors((p) => ({ ...p, code: undefined })); }}
                    placeholder={t('subjects.form.codePlaceholder')}
                    aria-invalid={Boolean(errors.code)}
                    className="w-full rounded-xl border bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium uppercase tracking-tight text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[#2563EB]/40 focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.1)] dark:bg-white/[0.04]"
                    style={{ borderColor: errors.code ? '#EF4444' : 'rgba(0,0,0,0.10)' }}
                  />
                  {errors.code && <p className="mt-1 text-[11px] font-medium text-[#EF4444]">{errors.code}</p>}
                </div>
                <div>
                  <label htmlFor="sf-dept" className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {t('subjects.form.department')}
                  </label>
                  <input
                    id="sf-dept"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder={t('subjects.form.departmentPlaceholder')}
                    className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[#2563EB]/40 focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.1)] dark:border-white/[0.08] dark:bg-white/[0.04]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="rounded-xl border border-slate-200/80 bg-slate-100 px-4 py-2 text-[12.5px] font-semibold text-[var(--text-primary)] outline-none transition-colors hover:bg-slate-200/70 disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.10]"
                >
                  {t('common.cancel')}
                </button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING.snappy}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-bold text-white outline-none disabled:opacity-70"
                  style={{
                    background: 'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
                    boxShadow: '0 8px 24px -8px rgba(37,99,235,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
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
                      <Icon paths={isEdit ? I.check : I.plus} size={13} strokeWidth={2.6} />
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

/* ══════════════════════════════════════════════════════════════════════════
 * EMPTY STATE
 * ════════════════════════════════════════════════════════════════════════ */

function EmptyState({
  icon, title, hint, action, secondaryAction,
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
      className="flex flex-col items-center gap-3 px-6 py-12 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563EB]/10 text-[#2563EB]">
        <Icon paths={icon} size={24} strokeWidth={2} />
      </div>
      <p className="text-[14px] font-bold text-[var(--text-primary)]">{title}</p>
      <p className="max-w-sm text-[11.5px] font-medium text-[var(--text-muted)]">{hint}</p>
      {(action || secondaryAction) && (
        <div className="mt-2 flex gap-2">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="rounded-xl border border-slate-200/80 bg-slate-100 px-3.5 py-2 text-[11.5px] font-semibold text-[var(--text-primary)] outline-none transition-colors hover:bg-slate-200/70 dark:border-white/[0.08] dark:bg-white/[0.06]"
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
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-bold text-white outline-none"
              style={{
                background: 'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
                boxShadow: '0 8px 24px -8px rgba(37,99,235,0.5)',
              }}
            >
              {action.icon && <Icon paths={action.icon} size={12} strokeWidth={2.6} />}
              {action.label}
            </motion.button>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * ERROR STATE
 * ════════════════════════════════════════════════════════════════════════ */

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="flex flex-col items-center gap-4 rounded-2xl border p-10 text-center"
      style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}
      >
        <Icon paths={I.alertTriangle} size={24} strokeWidth={2} />
      </div>
      <div>
        <h3 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
          {t('subjects.loadErrorTitle')}
        </h3>
        <p className="mt-1 text-[12px] font-medium text-[var(--text-muted)]">{message}</p>
      </div>
      <motion.button
        type="button"
        onClick={onRetry}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={SPRING.snappy}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-white outline-none"
        style={{
          background: 'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
          boxShadow: '0 8px 24px -8px rgba(37,99,235,0.5)',
        }}
      >
        <Icon paths={I.refresh} size={13} strokeWidth={2.4} />
        {t('common.retry')}
      </motion.button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * SKELETON
 * ════════════════════════════════════════════════════════════════════════ */

function SubjectsSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="space-y-3">
        <Shimmer className="h-10 w-full" radius="0.75rem" />
        <Shimmer className="h-40 w-full" radius="1rem" />
        <Shimmer className="h-32 w-full" radius="1rem" />
      </div>
      <div className="space-y-3">
        <Shimmer className="h-14 w-full" radius="0.75rem" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Shimmer key={i} className="h-20 w-full" radius="0.75rem" />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN PAGE
 * ════════════════════════════════════════════════════════════════════════ */

export default function SubjectsPage() {
  const { t } = useI18n();
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

  /* ── Data ── */
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['subjects', debouncedSearch],
    queryFn: () => subjectsApi.list({ search: debouncedSearch || undefined }),
    placeholderData: (prev) => prev,
  });

  const subjects: Subject[] = useMemo(() => data?.items ?? [], [data]);

  /* ── Derived ── */
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
        case 'code':       return (a.code || '').localeCompare(b.code || '');
        case 'department': return (a.department || '').localeCompare(b.department || '');
        case 'status':     return Number(b.isActive) - Number(a.isActive);
        case 'name':
        default:           return a.name.localeCompare(b.name);
      }
    });
    return arr;
  }, [filtered, sortKey]);



  /* ── Mutations ── */
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
      push('info', t('subjects.toast.undoHint') || 'Archived by mistake? Re-activate it from the archived filter.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });

  /* ── Handlers ── */
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

  const clearAllFilters = useCallback(() => {
    setFilterKey('ALL');
    setDepartmentFilter('');
    setSearch('');
  }, []);

  const handleOpenSubjectSidecar = useCallback((subject: Subject) => {
    const data: QuickLookData = {
      id: subject.id,
      type: 'general',
      title: subject.name,
      subtitle: `${subject.code} · ${subject.department || t('subjects.noDepartment')}`,
      badge: {
        text: subject.isActive ? t('subjects.status.active') : t('subjects.status.archived'),
        tone: subject.isActive ? 'emerald' : 'slate',
      },
      avatar: {
        text: subject.code.slice(0, 3).toUpperCase(),
        color: '#6366F1',
      },
      metrics: [
        { label: 'Fan kodi', value: subject.code },
        { label: 'Kafedra', value: subject.department || '—' },
        { label: 'Holati', value: subject.isActive ? 'Faol' : 'Arxiv' },
      ],
      details: [
        { label: 'Fan ID', value: subject.id, copyable: true },
        { label: 'Nomi', value: subject.name },
        { label: 'Kodi', value: subject.code, copyable: true },
        { label: 'Kafedra', value: subject.department || 'Biriktirilmagan' },
      ],
      primaryAction: {
        label: t('subjects.edit') || 'Tahrirlash',
        onExecute: () => handleOpenEdit(subject),
      },
      secondaryAction: {
        label: subject.isActive ? t('subjects.deactivate') : 'Faollashtirish',
        onExecute: () => handleArchive(subject),
      },
    };
    openSidecar(data);
  }, [t, handleOpenEdit, handleArchive]);

  /* Keyboard shortcut 'c' to create */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
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
    onSelect: (s) => { playTick(); handleOpenSubjectSidecar(s); },
    onQuickLook: (s) => { playTick(); handleOpenSubjectSidecar(s); },
    onEdit: (s) => handleOpenEdit(s),
    onDelete: (sList) => { if (sList && sList[0]) handleArchive(sList[0]); },
  });

  /* ── ⌘K search focus ── */
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

  /* ── Loading ── */
  if (isLoading && !subjects.length) {
    return (
      <div className="relative min-h-screen pb-12">
        <AuroraBackdrop />
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="mb-6 h-16" />
          <SubjectsSkeleton />
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (isError) {
    return (
      <div className="relative min-h-screen pb-12">
        <AuroraBackdrop />
        <div className="mx-auto max-w-3xl px-4 pt-16 sm:px-6">
          <ErrorState
            message={safeErrorMessage(error, t('common.error') || 'Error')}
            onRetry={() => void refetch()}
          />
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="relative min-h-screen pb-12">
      <AuroraBackdrop />

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-5"
        >
          {/* ═══ FLOATING COMMAND BAR ═══ */}
          <motion.div variants={cardVariants} className="sticky top-4 z-30">
            <div
              className="liquid-glass-surface flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2.5"
              style={{
                boxShadow:
                  '0 8px 28px -10px rgba(15,23,42,0.15), 0 1px 0 rgba(255,255,255,0.95) inset',
              }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#6366F1] text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.5)]">
                <Icon paths={I.bookOpen} size={15} strokeWidth={2.2} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  <span>M-EDU</span>
                  <span className="opacity-50">/</span>
                  <span className="text-[#2563EB] dark:text-[#38BDF8]">Fanlar</span>
                </div>
                <h1 className="truncate text-[14px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
                  {t('subjects.heroTitle')}
                </h1>
              </div>

              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 py-1 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 tabular-nums">
                  <CountUp value={stats.active} /> Faol
                </span>
              </span>

              <motion.button
                type="button"
                onClick={handleOpenCreate}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-3 py-1.5 text-[11.5px] font-black text-white shadow-[0_4px_14px_-4px_rgba(0,122,255,0.5)] transition-colors hover:bg-[#0071E3]"
              >
                <Icon paths={I.plus} size={12} strokeWidth={2.6} />
                <span className="hidden sm:inline">{t('subjects.add')}</span>
              </motion.button>
            </div>
          </motion.div>

          {/* ═══ SPLIT PANE ═══ */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
            {/* ── LEFT RAIL ── */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <GlassSurface elevated>
                <div className="p-3">
                  {/* Search */}
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                      <Icon paths={I.search} size={12} strokeWidth={2.2} />
                    </span>
                    <input
                      ref={searchRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('subjects.searchPlaceholder') || 'Qidirish...'}
                      aria-label={t('subjects.searchAria')}
                      className="w-full rounded-lg border border-slate-200/80 bg-white/70 py-2 pl-8 pr-12 text-[12px] font-medium text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] placeholder:opacity-60 focus:border-[#2563EB]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] dark:border-white/[0.08] dark:bg-white/[0.04]"
                    />
                    <AnimatePresence>
                      {search ? (
                        <motion.button
                          type="button"
                          onClick={() => setSearch('')}
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-slate-200 dark:hover:bg-white/[0.08]"
                          aria-label={t('subjects.clearSearchAria')}
                        >
                          <Icon paths={I.x} size={10} strokeWidth={2.5} />
                        </motion.button>
                      ) : (
                        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 bg-white/70 px-1 py-0.5 text-[9px] font-bold text-[var(--text-muted)] sm:inline-block dark:border-white/[0.15] dark:bg-white/[0.06]">
                          ⌘K
                        </kbd>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Filters */}
                <div className="border-t border-slate-200/70 dark:border-white/[0.06]">
                  <RailSection title="FILTER">
                    <div className="space-y-0.5">
                      <RailFilterItem
                        label={t('subjects.filter.all')}
                        count={counts.ALL}
                        active={filterKey === 'ALL'}
                        icon={I.layers}
                        tone="blue"
                        onClick={() => setFilterKey('ALL')}
                      />
                      <RailFilterItem
                        label={t('subjects.filter.active')}
                        count={counts.ACTIVE}
                        active={filterKey === 'ACTIVE'}
                        icon={I.checkCircle}
                        tone="green"
                        onClick={() => setFilterKey('ACTIVE')}
                      />
                      <RailFilterItem
                        label={t('subjects.filter.archived')}
                        count={counts.ARCHIVED}
                        active={filterKey === 'ARCHIVED'}
                        icon={I.archive}
                        tone="slate"
                        onClick={() => setFilterKey('ARCHIVED')}
                      />
                    </div>
                  </RailSection>
                </div>

                {/* Departments */}
                {departmentCounts.length > 0 && (
                  <div className="border-t border-slate-200/70 dark:border-white/[0.06]">
                    <RailSection
                      title="DEPARTMENT"
                      action={
                        departmentFilter && (
                          <button
                            type="button"
                            onClick={() => setDepartmentFilter('')}
                            className="text-[9px] font-black uppercase tracking-wider text-[#2563EB] hover:text-[#0071E3] dark:text-[#38BDF8]"
                          >
                            Tozalash
                          </button>
                        )
                      }
                    >
                      <div className="space-y-0.5">
                        <RailDepartmentItem
                          label={t('subjects.allDepartments') || 'Barchasi'}
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

                {/* Sort + view */}
                <div className="border-t border-slate-200/70 dark:border-white/[0.06]">
                  <RailSection title="SORT">
                    <SortDropdown value={sortKey} onChange={setSortKey} />
                  </RailSection>
                  <div className="px-2.5 pb-3">
                    <ViewToggle value={viewMode} onChange={setViewMode} />
                  </div>
                </div>

                {/* Reset */}
                {hasActiveFilters && (
                  <div className="border-t border-slate-200/70 p-2.5 dark:border-white/[0.06]">
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#2563EB]/20 bg-[#2563EB]/[0.06] py-1.5 text-[10.5px] font-black text-[#2563EB] transition-colors hover:bg-[#2563EB]/10 dark:text-[#38BDF8]"
                    >
                      <Icon paths={I.x} size={10} strokeWidth={2.6} />
                      Tozalash
                    </button>
                  </div>
                )}
              </GlassSurface>
            </aside>

            {/* ── RIGHT CANVAS ── */}
            <div className="min-w-0">
              <GlassSurface elevated>
                {/* Editorial header */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3.5 dark:border-white/[0.06]">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="text-[22px] font-black leading-none tabular-nums tracking-[-0.02em] text-slate-900/15 dark:text-white/[0.12]"
                      style={{ fontFeatureSettings: '"tnum"' }}
                    >
                      {String(sorted.length).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[13.5px] font-bold tracking-tight text-[var(--text-primary)]">
                        {filterKey === 'ALL' ? 'Barcha fanlar'
                          : filterKey === 'ACTIVE' ? 'Faol fanlar'
                          : 'Arxivlangan fanlar'}
                      </h2>
                      <p className="text-[10px] font-medium text-[var(--text-muted)] tabular-nums">
                        {departmentFilter && `${departmentFilter} · `}
                        {search && `"${search}" · `}
                        {sorted.length} ta natija
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-2.5">
                  {subjects.length === 0 ? (
                    <EmptyState
                      icon={I.bookOpen}
                      title={t('subjects.emptyTitle')}
                      hint={t('subjects.emptyHint')}
                      action={{ label: t('subjects.add'), icon: I.plus, onClick: handleOpenCreate }}
                    />
                  ) : sorted.length === 0 ? (
                    <EmptyState
                      icon={I.search}
                      title={t('subjects.emptyFilteredTitle')}
                      hint={t('subjects.emptyFilteredHint')}
                      action={{ label: t('subjects.showAll'), onClick: clearAllFilters }}
                      secondaryAction={
                        search ? { label: t('subjects.clearSearch'), onClick: () => setSearch('') } : undefined
                      }
                    />
                  ) : viewMode === 'bento' ? (
                    <motion.div
                      layout
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
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
                            isArchiving={archiveMutation.isPending && archiveMutation.variables === subject.id}
                            searchQuery={search}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <motion.div layout className="space-y-0.5">
                      <AnimatePresence initial={false} mode="popLayout">
                        {sorted.map((subject, i) => (
                          <EditorialRow
                            key={subject.id}
                            subject={subject}
                            index={i}
                            onEdit={handleOpenEdit}
                            onArchive={handleArchive}
                            onSidecar={handleOpenSubjectSidecar}
                            isArchiving={archiveMutation.isPending && archiveMutation.variables === subject.id}
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

      {/* ═══ MODAL ═══ */}
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