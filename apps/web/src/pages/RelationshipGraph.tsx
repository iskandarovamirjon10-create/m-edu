/**
 * M-EDU RelationshipGraphPage — v2 "Entity Observatory · Editorial Graph"
 *
 * 🎯 v1 → v2 Complete Visual Rearchitecture:
 *  ✅ Split-Pane Observatory — Sticky entity-type rail (280px) + editorial canvas.
 *  ✅ Aurora Backdrop — Fixed atmospheric gradient + breathing orbs + grid.
 *  ✅ Floating Command Bar — Sticky: breadcrumb · status badge · counts.
 *  ✅ Entity Type Rail — 7 vertical items with tone colors + icons.
 *  ✅ Root Entity Hero — Compact summary card with type/id/counts.
 *  ✅ Bento Node Grid — Cards with tone-aware type badges + ghost numerals.
 *  ✅ Editorial Edge Flows — Horizontal flow chips with arrows + labels.
 *  ✅ Debounced Query — 400ms debounce to prevent over-fetching on paste/type.
 *  ✅ Preserved — ALL API calls, GraphData contract, i18n, empty/error/loading.
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlassErrorState,
  GlassEmptyState,
  GlassInput,
} from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getErrorMessage } from '@/lib/errorMessages';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { relationshipsApi } from '@/lib/api';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 520, damping: 30, mass: 0.7 },
  smooth: { type: 'spring' as const, stiffness: 340, damping: 30, mass: 0.9 },
  pulse:  { type: 'spring' as const, stiffness: 400, damping: 26, mass: 0.6 },
} as const;

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ════════════════════════════════════════════════════════════════════════ */

interface GraphNode {
  id: string;
  label: string;
  type: string;
  subLabel?: string;
  href?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootType: string;
  rootId: string;
}

/* ══════════════════════════════════════════════════════════════════════════
 * TONE PALETTE
 * ════════════════════════════════════════════════════════════════════════ */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'slate' | 'emerald' | 'amber';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string; ring: string }> = {
  blue:    { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)',  glow: 'rgba(37,99,235,0.30)',  border: 'rgba(37,99,235,0.22)',  ring: 'rgba(37,99,235,0.45)'  },
  green:   { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.30)', border: 'rgba(16,185,129,0.22)', ring: 'rgba(16,185,129,0.45)' },
  orange:  { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.30)', border: 'rgba(245,158,11,0.22)', ring: 'rgba(245,158,11,0.45)' },
  red:     { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',  glow: 'rgba(239,68,68,0.30)',  border: 'rgba(239,68,68,0.22)',  ring: 'rgba(239,68,68,0.45)'  },
  purple:  { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)', glow: 'rgba(99,102,241,0.30)', border: 'rgba(99,102,241,0.22)', ring: 'rgba(99,102,241,0.45)' },
  cyan:    { fg: '#0284C7', bg: 'rgba(2,132,199,0.10)',  glow: 'rgba(2,132,199,0.30)',  border: 'rgba(2,132,199,0.22)',  ring: 'rgba(2,132,199,0.45)'  },
  slate:   { fg: '#64748B', bg: 'rgba(100,116,139,0.10)',glow: 'rgba(100,116,139,0.24)',border: 'rgba(100,116,139,0.20)',ring: 'rgba(100,116,139,0.35)'},
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.30)', border: 'rgba(16,185,129,0.22)', ring: 'rgba(16,185,129,0.45)' },
  amber:   { fg: '#D97706', bg: 'rgba(217,119,6,0.10)',  glow: 'rgba(217,119,6,0.30)',  border: 'rgba(217,119,6,0.22)',  ring: 'rgba(217,119,6,0.45)'  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS
 * ════════════════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.8;

const I = {
  network: [
    'M9 3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h.5v6H9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-.5v-6H11a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
    'M16.5 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2z',
    'M3 15h.01',
  ],
  userCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M6.2 18.4c.9-1.4 2.4-2.4 5.8-2.4s4.9 1 5.8 2.4',
  ],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  award: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
  target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  wallet: [
    'M20 12V8H6a2 2 0 0 1 0-4h12v4',
    'M4 6v12c0 1.1.9 2 2 2h14v-4',
    'M18 12a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  ],
  building: [
    'M4 22h16',
    'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18',
    'M10 6h4', 'M10 10h4', 'M10 14h4', 'M10 18h4',
  ],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  arrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  copy: [
    'M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2z',
    'M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2',
  ],
  check: ['M20 6 9 17l-5-5'],
  externalLink: [
    'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    'M15 3h6v6',
    'M10 14 21 3',
  ],
  nodes: ['M12 2v6', 'M12 22v-6', 'M4.93 4.93l4.24 4.24', 'M14.83 14.83l4.24 4.24', 'M2 12h6', 'M22 12h-6', 'M4.93 19.07l4.24-4.24', 'M14.83 9.17l4.24-4.24'],
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
 * ENTITY META — type → { tone, icon, labelKey }
 * ════════════════════════════════════════════════════════════════════════ */

const ENTITY_META: Record<string, { tone: Tone; icon: readonly string[]; labelKey: string }> = {
  STUDENT:  { tone: 'blue',    icon: I.userCircle, labelKey: 'enum.badge.STUDENT'  },
  TEACHER:  { tone: 'purple',  icon: I.award,      labelKey: 'enum.badge.TEACHER'  },
  GROUP:    { tone: 'cyan',    icon: I.users,      labelKey: 'enum.badge.GROUP'    },
  COURSE:   { tone: 'emerald', icon: I.book,       labelKey: 'enum.badge.COURSE'   },
  LEAD:     { tone: 'amber',   icon: I.target,     labelKey: 'enum.badge.LEAD'     },
  PAYMENT:  { tone: 'green',   icon: I.wallet,     labelKey: 'enum.badge.PAYMENT'  },
  EMPLOYEE: { tone: 'orange',  icon: I.building,   labelKey: 'enum.badge.EMPLOYEE' },
};

const ENTITY_TYPES = ['STUDENT', 'TEACHER', 'GROUP', 'COURSE', 'LEAD', 'PAYMENT', 'EMPLOYEE'] as const;

function getEntityMeta(type: string) {
  return ENTITY_META[type] ?? { tone: 'slate' as Tone, icon: I.network, labelKey: '' };
}

/* ══════════════════════════════════════════════════════════════════════════
 * HOOKS
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

/* ══════════════════════════════════════════════════════════════════════════
 * AURORA BACKDROP
 * ════════════════════════════════════════════════════════════════════════ */

function AuroraBackdrop() {
  return <AuroraMesh variant="corporate" />;
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
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * ENTITY TYPE RAIL ITEM
 * ════════════════════════════════════════════════════════════════════════ */

function EntityTypeItem({
  type, label, active, onClick,
}: {
  type: string; label: string; active: boolean; onClick: () => void;
}) {
  const meta = getEntityMeta(type);
  const c = TONES[meta.tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
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
            ? { background: `${c.fg}22`, color: c.fg }
            : { background: 'rgba(0,0,0,0.035)', color: '#64748B' }
        }
      >
        <Icon paths={meta.icon} size={11} strokeWidth={2.2} />
      </span>
      <span
        className={[
          'flex-1 truncate text-[11.5px] font-semibold transition-colors',
          active ? '' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]',
        ].join(' ')}
        style={active ? { color: c.fg } : undefined}
      >
        {label}
      </span>
      {active && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: c.fg, boxShadow: `0 0 6px ${c.fg}` }}
        />
      )}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * NODE CARD — bento with ghost numeral + tone badge
 * ════════════════════════════════════════════════════════════════════════ */

function NodeCard({
  node, index, isRoot, t, onOpenSidecar,
}: {
  node: GraphNode; index: number; isRoot: boolean; t: (k: string) => string; onOpenSidecar?: (node: GraphNode) => void;
}) {
  const meta = getEntityMeta(node.type);
  const c = TONES[meta.tone];
  const reduced = usePrefersReducedMotion();
  const isLink = Boolean(node.href) && !isRoot;

  const Inner = (
    <motion.div
      layout
      initial={reduced ? false : { opacity: 0, scale: 0.98, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.98 }}
      transition={{ ...SPRING.smooth, delay: Math.min(index * 0.03, 0.25) }}
      whileHover={reduced ? undefined : { y: -3 }}
      className={[
        'group relative flex h-full flex-col gap-2.5 overflow-hidden rounded-2xl border p-3.5 transition-shadow duration-200',
        isRoot
          ? 'border-slate-300/70 bg-gradient-to-br from-slate-50/90 via-white/85 to-slate-50/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_16px_-6px_rgba(15,23,42,0.10)] dark:border-white/[0.14] dark:from-white/[0.06] dark:via-white/[0.04] dark:to-white/[0.03]'
          : 'border-black/[0.06] bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.03),0_8px_20px_-10px_rgba(15,23,42,0.06)] hover:shadow-[0_12px_28px_-10px_rgba(15,23,42,0.15)] dark:border-white/[0.08] dark:bg-surface-900/80',
      ].join(' ')}
    >
      {/* Specular top rim */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/[0.18]"
      />

      {/* Corner ghost numeral */}
      <span
        className="pointer-events-none absolute -top-1 right-2 select-none text-[36px] font-black leading-none tabular-nums tracking-tighter text-slate-900/[0.06] transition-colors group-hover:text-slate-900/[0.10] dark:text-white/[0.06] dark:group-hover:text-white/[0.10]"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* Top row: type badge */}
      <div className="relative flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em]"
          style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
        >
          <Icon paths={meta.icon} size={9} strokeWidth={2.4} />
          {node.type}
        </span>
        {isRoot && (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#2563EB] px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-[0.08em] text-white">
            ROOT
          </span>
        )}
      </div>

      {/* Label + sublabel */}
      <div className="relative min-w-0 flex-1">
        <h4 className="line-clamp-2 text-[12.5px] font-black leading-tight tracking-tight text-[var(--text-primary)] group-hover:text-[#2563EB] dark:group-hover:text-[#38BDF8]">
          {node.label || '—'}
        </h4>
        {node.subLabel && (
          <p className="mt-0.5 line-clamp-1 text-[10px] font-medium text-[var(--text-muted)]">
            {node.subLabel}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="relative flex items-center justify-between border-t border-slate-200/60 pt-2 dark:border-white/[0.06]">
        <span className="truncate font-mono text-[9px] text-[var(--text-muted)] opacity-70">
          {node.id.slice(0, 8)}
        </span>
        <div className="flex items-center gap-1.5">
          {onOpenSidecar && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenSidecar(node);
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
              title="Sidecar"
            >
              <span>◨</span>
              <span>Sidecar</span>
            </button>
          )}
          {isLink && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider text-[#2563EB] opacity-0 transition-opacity group-hover:opacity-100 dark:text-[#38BDF8]">
              {t('common.open') || 'Ochish'}
              <Icon paths={I.externalLink} size={8} strokeWidth={2.6} />
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );

  if (isLink) {
    return (
      <a href={node.href} className="block outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-2xl">
        {Inner}
      </a>
    );
  }
  return Inner;
}

/* ══════════════════════════════════════════════════════════════════════════
 * EDGE FLOW CHIP
 * ════════════════════════════════════════════════════════════════════════ */

function EdgeFlow({
  edge, index,
}: {
  edge: GraphEdge; index: number;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      layout
      initial={reduced ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING.smooth, delay: Math.min(index * 0.02, 0.3) }}
      className="group flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2 backdrop-blur-md transition-colors hover:border-slate-300/90 hover:bg-white/85 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
    >
      {/* Ghost numeral */}
      <span
        className="w-6 shrink-0 text-[14px] font-black tabular-nums tracking-tighter text-slate-900/[0.15] dark:text-white/[0.15]"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* From */}
      <span
        className="truncate rounded-md bg-slate-500/[0.08] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-[var(--text-muted)] dark:bg-white/[0.05]"
        title={edge.from}
      >
        {edge.from.slice(0, 8)}…
      </span>

      {/* Arrow + label */}
      <div className="flex flex-1 items-center justify-center gap-1 min-w-0">
        <Icon paths={I.arrowRight} size={9} strokeWidth={2.6} className="shrink-0 text-[#2563EB] dark:text-[#38BDF8]" />
        <span className="truncate rounded-md bg-[#2563EB]/10 px-1.5 py-0.5 text-[9.5px] font-black text-[#2563EB] dark:bg-[#38BDF8]/15 dark:text-[#38BDF8]">
          {edge.label || edge.type}
        </span>
        <Icon paths={I.arrowRight} size={9} strokeWidth={2.6} className="shrink-0 text-[#2563EB] dark:text-[#38BDF8]" />
      </div>

      {/* To */}
      <span
        className="truncate rounded-md bg-slate-500/[0.08] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-[var(--text-muted)] dark:bg-white/[0.05]"
        title={edge.to}
      >
        {edge.to.slice(0, 8)}…
      </span>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * ROOT ENTITY HERO
 * ════════════════════════════════════════════════════════════════════════ */

function RootEntityCard({
  graph, rootNode, t,
}: {
  graph: GraphData; rootNode: GraphNode | null; t: (k: string) => string;
}) {
  const meta = getEntityMeta(graph.rootType);
  const c = TONES[meta.tone];

  return (
    <GlassSurface elevated>
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.4)]"
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
            <Icon paths={meta.icon} size={20} strokeWidth={2.2} className="relative" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em]"
                style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
              >
                {graph.rootType}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-500/[0.08] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)] dark:bg-white/[0.05]">
                ROOT
              </span>
            </div>
            <h2 className="mt-1.5 truncate text-[16px] font-black tracking-tight text-[var(--text-primary)]">
              {rootNode?.label || graph.rootType}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-medium text-[var(--text-muted)]">
              {rootNode?.subLabel && (
                <span className="truncate">{rootNode.subLabel}</span>
              )}
              <span className="inline-flex items-center gap-1 truncate font-mono">
                {graph.rootId.slice(0, 12)}…
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-slate-200/80 bg-white/60 p-2 text-center dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="text-[18px] font-black leading-none tabular-nums text-[var(--text-primary)]">
              {graph.nodes.length}
            </div>
            <div className="mt-1 text-[8.5px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
              {t('relationshipGraph.entitiesLabel') || 'Entities'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-white/60 p-2 text-center dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="text-[18px] font-black leading-none tabular-nums text-[var(--text-primary)]">
              {graph.edges.length}
            </div>
            <div className="mt-1 text-[8.5px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
              {t('relationshipGraph.connectionsLabel') || 'Edges'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-white/60 p-2 text-center dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="text-[18px] font-black leading-none tabular-nums text-[var(--text-primary)]">
              {new Set(graph.nodes.map((n) => n.type)).size}
            </div>
            <div className="mt-1 text-[8.5px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
              {t('relationshipGraph.typesLabel') || 'Types'}
            </div>
          </div>
        </div>
      </div>
    </GlassSurface>
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

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN PAGE
 * ════════════════════════════════════════════════════════════════════════ */

export function RelationshipGraphPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('relationshipGraph.title') || 'Entity Relationship Graph');
  const { playPop } = usePremiumSound();

  const [entityType, setEntityType] = useState('STUDENT');
  const [entityId, setEntityId] = useState('');
  const debouncedEntityId = useDebouncedValue(entityId.trim(), 400);

  const handleOpenNodeSidecar = (node: GraphNode) => {
    playPop();
    const meta = getEntityMeta(node.type);
    const metaLabel = t(meta.labelKey) || node.type;
    const sidecarData: QuickLookData = {
      id: node.id,
      type: 'general',
      title: node.label,
      subtitle: `${metaLabel} · ${node.subLabel || node.id}`,
      badge: {
        text: metaLabel,
        tone: (meta.tone === 'orange' ? 'amber' : meta.tone === 'red' ? 'rose' : meta.tone) as 'amber' | 'rose' | 'emerald' | 'blue' | 'purple' | 'slate',
      },
      metrics: [
        { label: 'Turi', value: metaLabel },
        { label: 'Tizim kodi', value: node.type },
        { label: 'Tavsif', value: node.subLabel || '—' },
      ],
      details: [
        { label: 'Node ID', value: node.id, copyable: true },
        { label: 'Entity turi', value: node.type },
        { label: 'Nomi', value: node.label },
        { label: 'Qo\'shimcha', value: node.subLabel || 'Mavjud emas' },
      ],
      primaryAction: node.href ? {
        label: t('common.open') || 'Ochish',
        onExecute: () => {
          window.location.href = node.href!;
        },
      } : undefined,
    };
    openSidecar(sidecarData);
  };

  const graphQuery = useQuery({
    queryKey: ['relationship-graph', entityType, debouncedEntityId],
    queryFn: () =>
      debouncedEntityId
        ? (relationshipsApi.graph(entityType, debouncedEntityId) as Promise<GraphData>)
        : Promise.resolve(null),
    enabled: !!debouncedEntityId,
  });

  const graph = graphQuery.data;

  /* ── Derived root node ── */
  const rootNode = useMemo(
    () => graph?.nodes.find((n) => n.id === graph.rootId) ?? null,
    [graph],
  );

  const hasGraph = Boolean(graph && (graph.nodes.length > 0 || graph.edges.length > 0));
  const isIdle = !debouncedEntityId;
  const isLoading = graphQuery.isLoading;
  const isError = graphQuery.isError;

  /* ═══ Render ═══ */
  return (
    <div className="relative min-h-full pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraBackdrop />

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="space-y-5">
          {/* ═══ FLOATING COMMAND BAR ═══ */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING.smooth}
            className="sticky top-4 z-30"
          >
            <div
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-black/[0.06] bg-white/80 px-3 py-2.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
              style={{
                boxShadow:
                  '0 8px 28px -10px rgba(15,23,42,0.15), 0 1px 0 rgba(255,255,255,0.95) inset',
              }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#6366F1] text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.5)]">
                <Icon paths={I.network} size={16} strokeWidth={2.2} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  <span>M-EDU</span>
                  <span className="opacity-50">/</span>
                  <span className="text-[#2563EB] dark:text-[#38BDF8]">Graph</span>
                </div>
                <h1 className="truncate text-[14px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
                  {t('relationshipGraph.title') || 'Entity Relationship Graph'}
                </h1>
              </div>

              {hasGraph && (
                <div className="hidden items-center gap-1.5 sm:flex">
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/[0.08] px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-blue-700 tabular-nums dark:text-blue-300">
                    {graph!.nodes.length} N
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-violet-700 tabular-nums dark:text-violet-300">
                    {graph!.edges.length} E
                  </span>
                </div>
              )}

              {isLoading && debouncedEntityId && (
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#2563EB]/25 bg-[#2563EB]/[0.08] px-2.5 py-1"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] shadow-[0_0_6px_#2563EB]" />
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-[#2563EB] dark:text-[#38BDF8]">
                    {t('relationshipGraph.loading') || 'Traversing…'}
                  </span>
                </motion.span>
              )}
            </div>
          </motion.div>

          {/* ═══ SPLIT PANE ═══ */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
            {/* ── LEFT RAIL ── */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <GlassSurface elevated>
                {/* Entity type picker */}
                <div className="p-2.5">
                  <p className="mb-1.5 px-1 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {t('communication.entityType') || 'Entity Type'}
                  </p>
                  <div className="space-y-0.5">
                    {ENTITY_TYPES.map((type) => (
                      <EntityTypeItem
                        key={type}
                        type={type}
                        label={t(getEntityMeta(type).labelKey) || type}
                        active={entityType === type}
                        onClick={() => setEntityType(type)}
                      />
                    ))}
                  </div>
                </div>

                {/* Entity ID input */}
                <div className="border-t border-slate-200/70 p-2.5 dark:border-white/[0.06]">
                  <p className="mb-1.5 px-1 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {t('dg.entityId') || 'Entity ID'}
                  </p>
                  <GlassInput
                    type="text"
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    placeholder={t('relationshipGraph.idPlaceholder') || 'Paste UUID…'}
                    aria-label={t('dg.entityId') || 'Entity ID'}
                  />
                  {entityId && !debouncedEntityId && (
                    <p className="mt-1 px-1 text-[9.5px] font-medium text-[var(--text-muted)]">
                      {t('relationshipGraph.debouncing') || 'Kutilmoqda…'}
                    </p>
                  )}
                </div>

                {/* Clear + metadata */}
                {hasGraph && (
                  <div className="border-t border-slate-200/70 p-2.5 dark:border-white/[0.06]">
                    <p className="mb-1.5 px-1 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {t('relationshipGraph.metadata') || 'Metadata'}
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-medium text-[var(--text-muted)]">Root</span>
                        <span className="font-bold text-[var(--text-primary)]">{graph!.rootType}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-medium text-[var(--text-muted)]">Nodes</span>
                        <span className="font-bold tabular-nums text-[var(--text-primary)]">{graph!.nodes.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-medium text-[var(--text-muted)]">Edges</span>
                        <span className="font-bold tabular-nums text-[var(--text-primary)]">{graph!.edges.length}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reset */}
                {entityId && (
                  <div className="border-t border-slate-200/70 p-2.5 dark:border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setEntityId('')}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/60 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:bg-white hover:text-[var(--text-primary)] dark:border-white/[0.08] dark:bg-white/[0.04]"
                    >
                      <Icon paths={I.copy} size={10} strokeWidth={2.4} />
                      {t('common.clear') || 'Clear'}
                    </button>
                  </div>
                )}
              </GlassSurface>
            </aside>

            {/* ── RIGHT CANVAS ── */}
            <div className="min-w-0 space-y-4">
              {/* Idle: no ID yet */}
              {isIdle && (
                <GlassSurface elevated>
                  <div className="px-6 py-16">
                    <GlassEmptyState
                      title={t('relationshipGraph.emptyTitle') || 'Select an Entity'}
                      message={
                        t('relationshipGraph.emptyMessage') ||
                        'Choose an entity type and provide an ID above to map relational vertices.'
                      }
                    />
                  </div>
                </GlassSurface>
              )}

              {/* Loading skeleton */}
              {!isIdle && isLoading && (
                <div className="space-y-4">
                  <Shimmer className="h-32 w-full" radius="1rem" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Shimmer key={i} className="h-32" radius="1rem" />
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {!isIdle && isError && (
                <GlassSurface elevated className="p-8">
                  <GlassErrorState
                    message={getErrorMessage(graphQuery.error)}
                    onRetry={() => graphQuery.refetch()}
                  />
                </GlassSurface>
              )}

              {/* No results */}
              {!isIdle && !isLoading && !isError && graph && !hasGraph && (
                <GlassSurface elevated>
                  <div className="px-6 py-16">
                    <GlassEmptyState
                      title={t('relationshipGraph.noResultsTitle') || 'No Connections Found'}
                      message={
                        t('relationshipGraph.noResultsMessage') ||
                        'This entity does not have any active edges in the knowledge graph.'
                      }
                    />
                  </div>
                </GlassSurface>
              )}

              {/* Graph content */}
              {!isIdle && !isLoading && !isError && hasGraph && graph && (
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={`${graph.rootType}-${graph.rootId}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={SPRING.smooth}
                    className="space-y-4"
                  >
                    {/* Root hero */}
                    <RootEntityCard graph={graph} rootNode={rootNode} t={t} />

                    {/* Nodes bento grid */}
                    {graph.nodes.length > 0 && (
                      <GlassSurface elevated>
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3.5 dark:border-white/[0.06]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="text-[22px] font-black leading-none tabular-nums tracking-[-0.02em] text-slate-900/15 dark:text-white/[0.12]"
                              style={{ fontFeatureSettings: '"tnum"' }}
                            >
                              {String(graph.nodes.length).padStart(2, '0')}
                            </span>
                            <div className="min-w-0">
                              <h3 className="truncate text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
                                {t('relationshipGraph.entities', { n: graph.nodes.length }) ||
                                  `Connected Entities (${graph.nodes.length})`}
                              </h3>
                              <p className="text-[10px] font-medium text-[var(--text-muted)]">
                                {t('relationshipGraph.entitiesHint') || 'Entities linked to the root'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="p-3">
                          <motion.div
                            layout
                            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
                          >
                            {graph.nodes.map((node, i) => (
                              <NodeCard
                                key={node.id}
                                node={node}
                                index={i}
                                isRoot={node.id === graph.rootId}
                                t={t}
                                onOpenSidecar={handleOpenNodeSidecar}
                              />
                            ))}
                          </motion.div>
                        </div>
                      </GlassSurface>
                    )}

                    {/* Edges flow list */}
                    {graph.edges.length > 0 && (
                      <GlassSurface elevated>
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3.5 dark:border-white/[0.06]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="text-[22px] font-black leading-none tabular-nums tracking-[-0.02em] text-slate-900/15 dark:text-white/[0.12]"
                              style={{ fontFeatureSettings: '"tnum"' }}
                            >
                              {String(graph.edges.length).padStart(2, '0')}
                            </span>
                            <div className="min-w-0">
                              <h3 className="truncate text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
                                {t('relationshipGraph.connections', { n: graph.edges.length }) ||
                                  `Relational Edges (${graph.edges.length})`}
                              </h3>
                              <p className="text-[10px] font-medium text-[var(--text-muted)]">
                                {t('relationshipGraph.connectionsHint') || 'How entities reference each other'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1.5 p-3">
                          <AnimatePresence initial={false}>
                            {graph.edges.map((edge, i) => (
                              <EdgeFlow key={`${edge.from}-${edge.to}-${i}`} edge={edge} index={i} />
                            ))}
                          </AnimatePresence>
                        </div>
                      </GlassSurface>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RelationshipGraphPage;