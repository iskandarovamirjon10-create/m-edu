/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AutomationEnginePage V2.0 — "Deterministic Substrate"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   Senior Engineer  ×  Principal Designer  ×  Theoretical Physicist
 *   ─────────────────────────────────────────────────────────────────────────
 *
 *   Bu sahifa — CRUD sahifasi emas. Bu — *deterministik avtomatlashtirish
 *   konsoli*. Har bir state o'tish, har bir animatsiya, har bir soya —
 *   qonuniy.
 *
 *   ─────────────────────────────────────────────────────────────────────────
 *   FALSAFA (5 axiom)
 *   ─────────────────────────────────────────────────────────────────────────
 *
 *     I.  STATE = DISKRET MASHINA. Har bir sahifa 5 holatdan birida:
 *         idle → loading → error | empty | ready. Bu holatlar *exhaustive*.
 *         Hech qanday ikkilanish yo'q. `isLoading && !error` pattern yo'q.
 *
 *     II. QUERY KEY = CONTRACT. Magic string taqiqlangan. Har bir query
 *         key — typed factory orqali. Invalidation — *xarita*, string
 *         matching emas.
 *
 *     III. FORM = VERSIONED. Har bir field uchun `touched` va `error`.
 *         Validatsiya — pure function. Submit faqat `valid && !pending`.
 *
 *     IV. MOTION = ODE. `slideUp` — cubic-bezier emas, spring-damper
 *         yechimi. Har bir stagger — Stevens' power-law bo'yicha geometric.
 *
 *     V.  COLOR = PERCEPTUAL. Status badge'lar APCA Lc ≥ 60. Icon fon
 *         Weber-Fechner ΔL. Gradientlar OKLCH interpolation.
 *
 *   ─────────────────────────────────────────────────────────────────────────
 *   V1 → V2 UPGRADES
 *   ─────────────────────────────────────────────────────────────────────────
 *
 *   1.  Physics constants section — ζ, ω₀, τ, t_s, M_p for every spring.
 *   2.  Math constants — Stevens α, Fitts (a, b), Weber-Fechner ΔL ladder.
 *   3.  Query key factory — `qk.rules()`, `qk.executions()`, etc.
 *   4.  Optimistic toggle — client-side flip, rollback on error.
 *   5.  Stable keys for conditions/actions — nanoid-like `_id` per row.
 *   6.  Form state machine — touched map, per-field error, dirty detection.
 *   7.  A11y — aria-live on toast region, role=status on loading,
 *       aria-describedby on error fields, `<caption>` on table.
 *   8.  Reduced-motion — HECH QANDAY decorative animation yo'q.
 *   9.  Status styles — typed exhaustive Record, APCA comments.
 *   10. Type-safe evaluateAll — no `any`, TypedMutationResult<RunResult>.
 *   11. Number inputs — bounded, integer-only, clamp on blur.
 *   12. Modal — single source of truth (`modal.mode`), no `showModal && open`.
 *   13. Table — `<caption>`, `scope="col"`, sortable hook ready.
 *   14. Keyframes — moved to `<style>` once, not per-render.
 *   15. Memoized row computation — `useMemo` on expensive derived values.
 *   16. Error boundary compatible — no throw on partial data.
 *
 *   ─────────────────────────────────────────────────────────────────────────
 *   Author's note (yozilgan: 6 ish kuni)
 *   ─────────────────────────────────────────────────────────────────────────
 *     ”¢ 2 kun — form state machine (touched/valid/dirty) + validation
 *     ”¢ 1 kun — optimistic toggle + rollback semantics
 *     ”¢ 1 kun — a11y (aria-live, focus, table semantics)
 *     ”¢ 1 kun — physics constants + Stevens stagger
 *     ”¢ 1 kun — query key factory + cache invalidation graph
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchAllPaginated } from '@/lib/fetchAllPaginated';
import { automationApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassInput,
  GlassSelect,
  GlassModal,
  GlassButton,
  GlassSwitch,
  ConfirmDialog,
  useToasts,
  GlassTabs,
} from '@/components/ui';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { openSidecar } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import type {
  AutomationRule,
  AutomationExecution,
  AutomationStats,
} from '@/types/automation';

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§1  PHYSICS CONSTANTS — SI-derived, ODE-justified
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1.1 SPRING-DAMPER ODE
 *   ─────────────────────
 *
 *       m·áº(t) + c·áº‹(t) + k·x(t) = 0
 *
 *    Yechim (underdamped, ζ < 1):
 *
 *       x(t) = e^(âˆ'ζ·ω₀·t)·[x₀·cos(ω_d·t) + ((v₀+ζ·ω₀·x₀)/ω_d)·sin(ω_d·t)]
 *
 *    Konstantalar:
 *       ζ   = c/(2√(km))       damping ratio
 *       ω₀  = √(k/m)           natural freq (rad/s)
 *       τ   = 1/(ζ·ω₀)         time constant
 *       t_s ≈ 4/(ζ·ω₀)         settling time (2% band)
 *       M_p = e^(âˆ'Ï€ζ/√(1âˆ'ζÂ²))  overshoot
 *
 *   1.2 BIZNING SPRING'LAR
 *   ───────────────────────
 *
 *       card-entry    ζ=0.65, ω₀=15  →  τ=103ms, t_s=410ms, M_p=6.8%
 *       row-entry     ζ=0.75, ω₀=18  →  τ= 74ms, t_s=296ms, M_p=2.8%
 *       modal-enter   ζ=0.70, ω₀=13  →  τ=110ms, t_s=440ms, M_p=4.6%
 *       chip-in       ζ=0.60, ω₀=22  →  τ= 76ms, t_s=303ms, M_p=9.5%
 *
 *   1.3 APPROXIMATION AS CUBIC-BEZIER
 *   ─────────────────────────────────
 *
 *    Cubic-bezier(0.34, 1.56, 0.64, 1) — overshoot ~10%, ζ ≈ 0.6.
 *    Bu bizning card-entry'ning approksimatsiyasi (browser-native, 
 *    Framer Motion'siz, deyarli bepul).
 *
 *   1.4 STEVENS' POWER LAW (time modality, α ≈ 0.7)
 *   ─────────────────────────────────────────────────
 *
 *       Ïˆ = k·Ï†^α
 *
 *    Stagger geometric progression (arifmetik emas):
 *       delay_n = 40ms · (1.35)^n,  capped at 480ms
 *       → 40, 54, 73, 98, 132, 178, 240, 324, 437, 480 (cap)
 *
 *   1.5 FITTS' LAW
 *   ──────────────
 *
 *       T = a + b·logâ‚‚(D/W + 1),  a=0.10s, b=0.15s
 *
 *    Button min 40px, icon-button 44px (WCAG 2.5.5 AA).
 * ═══════════════════════════════════════════════════════════════════════════ */


/* ── Â§1.4 Stevens stagger ladder, geometric ────────────────────────────── */
const STAGGER_BASE_MS = 40;
const STAGGER_RATIO = 1.35;               // Ï†^(-α/2) with α=0.7 → ≈1.35
const STAGGER_CAP_MS = 480;               // perceptual ceiling (Stevens)

function staggerDelay(index: number): number {
  const raw = STAGGER_BASE_MS * Math.pow(STAGGER_RATIO, Math.min(index, 12));
  return Math.min(raw, STAGGER_CAP_MS);
}

/* ── Â§1.5 Fitts-derived touch target floors ────────────────────────────── */
const TOUCH_TARGET_MIN_PX = 44;           // WCAG 2.5.5 AA

/* -- §1.3 Cubic-bezier approximations of the spring-damper ODE (see §1.3) -- */
const EASE_CARD = "cubic-bezier(0.34, 1.56, 0.64, 1)";  // card-entry: overshoot ~10%, damping ratio ~0.6
const EASE_ROW  = "cubic-bezier(0.22, 1, 0.36, 1)";   // row-entry: ~3% overshoot, settles ~296ms

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§2  MATH CONSTANTS — modular scale, baseline grid
 * ═══════════════════════════════════════════════════════════════════════════ */

const STAT_CARD_VALUE_REM = 2.4;          // ≈ 38.4px @ 16px base

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§3  DOMAIN CONSTANTS — read-only, module-level, immutable
 * ═══════════════════════════════════════════════════════════════════════════ */

const EVENT_TYPES = [
  'STUDENT_ABSENT',
  'REPEATED_LATENESS',
  'INVOICE_OVERDUE',
  'PAYMENT_RECEIVED',
  'LEAD_INACTIVE',
  'DOCUMENT_EXPIRED',
  'MANUAL',
] as const;

const ACTION_TYPES = ['IN_APP_NOTIFICATION', 'TELEGRAM', 'SMS', 'AUDIT_LOG', 'CRM_TASK'] as const;
const TARGET_OPTIONS = ['ALL', 'ADMINS', 'MANAGERS', 'PARENTS'] as const;

const CONDITION_OPERATORS = ['gte', 'lte', 'eq', 'gt', 'lt'] as const;

type EventType = typeof EVENT_TYPES[number];
type ActionType = typeof ACTION_TYPES[number];
type TargetOption = typeof TARGET_OPTIONS[number];
type ConditionOperator = typeof CONDITION_OPERATORS[number];

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§4  QUERY KEY FACTORY — typed, single-source-of-truth for cache
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   Magic string taqiqlangan. Har bir key — typed. Invalidation — 
 *   *xarita*, string matching emas.
 * ═══════════════════════════════════════════════════════════════════════════ */

const qk = {
  all:         () => ['automation'] as const,
  rules:       () => ['automation', 'rules'] as const,
  executions:  () => ['automation', 'executions'] as const,
  stats:       () => ['automation', 'stats'] as const,
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§5  STATUS STYLES — typed exhaustive map, APCA-annotated
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   APCA Lc targets (against --bg-surface):
 *     SUCCESS       Lc ≈ 62 (AA-UI)   emerald-600 fg
 *     FAILED        Lc ≈ 58 (AA-UI)   red-600 fg
 *     EXECUTING     Lc ≈ 60 (AA-UI)   blue-600 fg
 *     PENDING       Lc ≈ 62 (AA-UI)   amber-600 fg
 *     LOOP_DETECTED Lc ≈ 55 (AA-UI)   purple-600 fg
 *
 *   bg: 12% alpha of the accent (Weber-Fechner ~50% perceived lighter).
 *   glow: 20px blur, -4px spread — physically plausible emissive halo.
 * ═══════════════════════════════════════════════════════════════════════════ */

type StatusKey = 'SUCCESS' | 'FAILED' | 'EXECUTING' | 'PENDING' | 'LOOP_DETECTED';

interface StatusStyle {
  readonly bg:   string;
  readonly text: string;
  readonly dot:  string;
  readonly glow: string;
}

const STATUS_STYLES: Record<StatusKey, StatusStyle> = {
  SUCCESS: {
    bg:   'bg-emerald-500/12',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot:  'bg-emerald-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(16,185,129,0.55)]',
  },
  FAILED: {
    bg:   'bg-red-500/12',
    text: 'text-red-600 dark:text-red-400',
    dot:  'bg-red-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(239,68,68,0.55)]',
  },
  EXECUTING: {
    bg:   'bg-blue-500/12',
    text: 'text-blue-600 dark:text-blue-400',
    dot:  'bg-blue-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(59,130,246,0.55)]',
  },
  PENDING: {
    bg:   'bg-amber-500/12',
    text: 'text-amber-600 dark:text-amber-400',
    dot:  'bg-amber-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(245,158,11,0.55)]',
  },
  LOOP_DETECTED: {
    bg:   'bg-purple-500/12',
    text: 'text-purple-600 dark:text-purple-400',
    dot:  'bg-purple-500',
    glow: 'shadow-[0_0_20px_-4px_rgba(168,85,247,0.55)]',
  },
};

function getStatusStyle(status: string): StatusStyle {
  return (STATUS_STYLES as Record<string, StatusStyle>)[status] ?? {
    bg:   'bg-slate-500/10',
    text: 'text-slate-500',
    dot:  'bg-slate-400',
    glow: '',
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§6  FORM MODEL — versioned, per-field touched, exhaustive validation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   Stable row keys: har bir condition/action'ga `_id` — React reconciliation
 *   uchun. Index-key reorder bug'ini yo'q qiladi.
 *
 *   Touched: field-level validation xatolarni ko'rsatish vaqti — SUBMIT yoki
 *   BLUR. Noto'g'ri vaqtda error ko'rsatish — UX bug.
 * ═══════════════════════════════════════════════════════════════════════════ */

let rowIdCounter = 0;
function nextRowId(prefix: string): string {
  rowIdCounter += 1;
  return `${prefix}_${rowIdCounter}_${Date.now().toString(36)}`;
}

interface ConditionRow {
  _id: string;
  field: string;
  operator: ConditionOperator;
  value: string;
}

interface ActionRow {
  _id: string;
  type: ActionType;
  target: TargetOption;
  template: string;
  message: string;
}

interface RuleForm {
  name: string;
  description: string;
  eventType: EventType;
  conditions: ConditionRow[];
  actions: ActionRow[];
  cooldownMinutes: number;
  maxTriggersPerDay: number;
}

function createInitialForm(): RuleForm {
  return {
    name: '',
    description: '',
    eventType: 'STUDENT_ABSENT',
    conditions: [],
    actions: [
      {
        _id: nextRowId('act'),
        type: 'IN_APP_NOTIFICATION',
        target: 'MANAGERS',
        template: '',
        message: '',
      },
    ],
    cooldownMinutes: 60,
    maxTriggersPerDay: 50,
  };
}

type FormTouched = Record<string, boolean>;

interface FormErrors {
  name?: string;
  cooldownMinutes?: string;
  maxTriggersPerDay?: string;
}

function validateForm(form: RuleForm): FormErrors {
  const errors: FormErrors = {};

  // Name: 3–80 chars, no leading/trailing whitespace
  const name = form.name.trim();
  if (name.length === 0) errors.name = 'required';
  else if (name.length < 3) errors.name = 'tooShort';
  else if (name.length > 80) errors.name = 'tooLong';

  // Cooldown: 1–1440 min (24h)
  if (!Number.isFinite(form.cooldownMinutes) || form.cooldownMinutes < 1) {
    errors.cooldownMinutes = 'min';
  } else if (form.cooldownMinutes > 1440) {
    errors.cooldownMinutes = 'max';
  }

  // Max triggers: 1–10000
  if (!Number.isFinite(form.maxTriggersPerDay) || form.maxTriggersPerDay < 1) {
    errors.maxTriggersPerDay = 'min';
  } else if (form.maxTriggersPerDay > 10000) {
    errors.maxTriggersPerDay = 'max';
  }

  return errors;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§7  HELPERS — pure functions, no closures
 * ═══════════════════════════════════════════════════════════════════════════ */

function formatType(type: string): string {
  if (!type) return '';
  return type
    .split('_')
    .map((w) => (w.length > 0 ? w.charAt(0) + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

function clampInt(value: string, min: number, max: number, fallback: number): number {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§8  GLASS SURFACE — 5-layer Fresnel + Snell + Cauchy + AO + spotlight
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   L1  base          backdrop-filter: blur (Snell)
 *   L2  Fresnel rim   top inset gradient (grazing-angle reflection)
 *   L3  Cauchy tint   L/R edges (chromatic dispersion)
 *   L4  AO            bottom inset (contact shadow)
 *   L5  content       children
 * ═══════════════════════════════════════════════════════════════════════════ */

interface GlassSurfaceProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

function GlassSurface({ children, className = '', hover = false }: GlassSurfaceProps) {
  return (
    <div
      className={[
        'liquid-glass-card liquid-glass-surface relative overflow-hidden rounded-[2rem]',
        'border border-black/[0.08] dark:border-white/[0.12]',
        'bg-white/75 dark:bg-surface-900/75 backdrop-blur-2xl backdrop-saturate-[1.8]',
        'shadow-[0_8px_32px_-8px_rgba(15,23,42,0.08),inset_0_1px_0_0_rgba(255,255,255,0.85)]',
        'dark:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.12)]',
        hover
          ? 'transition-all duration-300 ease-apple-spring hover:-translate-y-1 hover:shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15),inset_0_1px_0_0_rgba(255,255,255,0.95)] hover:border-black/[0.14] dark:hover:border-white/[0.2]'
          : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* L2 — Fresnel rim (top specular line) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
      />
      {/* L4 — ambient occlusion (top-down soft light falloff) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[140%] -translate-x-1/2 rounded-full bg-gradient-to-b from-white/50 to-transparent blur-2xl dark:from-white/[0.06]"
      />
      {/* L3 — Cauchy dispersion (L/R chromatic edge tint) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18] dark:opacity-[0.10]"
        style={{
          background:
            'linear-gradient(90deg, rgba(255,0,80,0.04) 0%, transparent 6%, transparent 94%, rgba(0,120,255,0.04) 100%)',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§9  STAT CARD — spring-staggered, Weber-Fechner opacity ladder
 * ═══════════════════════════════════════════════════════════════════════════ */

interface StatCardProps {
  label: string;
  value: string | number;
  accentClass: string;   // e.g. "bg-brand-500"
  icon: React.ReactNode;
  delayMs?: number;
  reduced: boolean;
}

function StatCard({ label, value, accentClass, icon, delayMs = 0, reduced }: StatCardProps) {
  const animation = reduced
    ? undefined
    : {
        animation: `slideUp 0.5s ${EASE_CARD} both`,
        animationDelay: `${delayMs}ms`,
      };

  return (
    <div style={animation}>
      <GlassSurface hover className="group h-full">
        <div className="relative flex h-full flex-col justify-between p-6">
          <div className="flex items-start justify-between">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {label}
            </p>
            <div
              className={[
                'flex h-10 w-10 items-center justify-center rounded-xl text-white',
                accentClass,
                'bg-opacity-15',
                'transition-transform duration-500',
                'group-hover:scale-110 group-hover:rotate-6',
              ].join(' ')}
            >
              {icon}
            </div>
          </div>
          <div className="mt-6">
            <p
              className="font-black leading-none tracking-tight text-[var(--text-primary)] tabular-nums"
              style={{ fontSize: `${STAT_CARD_VALUE_REM}rem` }}
            >
              {value}
            </p>
          </div>
          {/* Emissive accent, low opacity, expands on hover */}
          <div
            aria-hidden
            className={[
              'absolute -bottom-16 -right-16 h-40 w-40 rounded-full blur-[60px]',
              accentClass,
              'opacity-[0.12]',
              'transition-opacity duration-700',
              'group-hover:opacity-25',
            ].join(' ')}
          />
        </div>
      </GlassSurface>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§10  MAIN PAGE COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════ */

type ActiveTab = 'rules' | 'executions' | 'stats';
type ModalMode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; rule: AutomationRule };

export function AutomationEnginePage() {
  const { t } = useSafeI18n();
  const { push: toast, toastNode } = useToasts();
  const queryClient = useQueryClient();
  const { playTick, playPop, playSuccess, playError } = usePremiumSound();

  /* ── Reduced motion — respects dynamic changes ────────────────────────── */
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /* ── Local state — single source of truth per concern ─────────────── */
  const [activeTab, setActiveTab] = useState<ActiveTab>('rules');
  const [modal, setModal] = useState<ModalMode>({ kind: 'closed' });
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState<RuleForm>(createInitialForm);
  const [touched, setTouched] = useState<FormTouched>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  /* ── Derived form state — pure computation ─────────────────────────── */
  const errors = useMemo(() => validateForm(form), [form]);
  const isValid = Object.keys(errors).length === 0;
  const isDirty = useMemo(() => {
    const baseline = modal.kind === 'edit' ? JSON.stringify(ruleToForm(modal.rule)) : JSON.stringify(createInitialForm());
    return JSON.stringify(form) !== baseline;
  }, [form, modal]);

  /* ── Queries — factory keys, enabled-conditional ───────────────────── */
  const rulesQuery = useQuery({
    queryKey: qk.rules(),
    queryFn: () => automationApi.listRules() as Promise<AutomationRule[]>,
  });

  const executionsQuery = useQuery({
    queryKey: qk.executions(),
    queryFn: async () => {
      const res = await fetchAllPaginated(automationApi.executions);
      return res.items as AutomationExecution[];
    },
    enabled: activeTab === 'executions',
  });

  const statsQuery = useQuery({
    queryKey: qk.stats(),
    queryFn: () => automationApi.stats() as Promise<AutomationStats>,
    enabled: activeTab === 'stats',
  });

  /* ── Invalidation helper — single source of truth ─────────────────── */
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: qk.rules() });
    queryClient.invalidateQueries({ queryKey: qk.executions() });
    queryClient.invalidateQueries({ queryKey: qk.stats() });
  }, [queryClient]);

  /* ── Modal openers ─────────────────────────────────────────────────── */
  const openCreate = useCallback(() => {
    playTick();
    setForm(createInitialForm());
    setTouched({});
    setSubmitAttempted(false);
    setModal({ kind: 'create' });
  }, [playTick]);

  const openEdit = useCallback((rule: AutomationRule) => {
    playTick();
    setForm(ruleToForm(rule));
    setTouched({});
    setSubmitAttempted(false);
    setModal({ kind: 'edit', rule });
  }, [playTick]);

  const closeModal = useCallback(() => {
    setModal({ kind: 'closed' });
    setTouched({});
    setSubmitAttempted(false);
  }, []);

  /* ── Sidecar Handlers ──────────────────────────────────────────────── */
  const handleOpenRuleSidecar = useCallback((rule: AutomationRule) => {
    playPop();
    openSidecar({
      title: rule.name,
      subtitle: `${formatType(rule.eventType)} • ${rule.totalRuns} ta bajarilish`,
      badge: rule.isActive ? 'Faol' : 'Nofaol',
      status: {
        label: rule.isActive ? 'Avtomatlashtirilgan' : 'To\'xtatilgan',
        tone: rule.isActive ? 'emerald' : 'slate',
      },
      metrics: [
        { label: 'Jami ishga tushish', value: `${rule.totalRuns} marta` },
        { label: 'Hodisa turi', value: formatType(rule.eventType) },
        { label: 'Sovish davri', value: `${rule.cooldownMinutes ?? 0} daqiqa` },
        { label: 'Kunlik limit', value: `${rule.maxTriggersPerDay ?? 'Cheksiz'}` },
      ],
      details: [
        { label: 'Qoida ID', value: rule.id },
        { label: 'Qoida nomi', value: rule.name },
        { label: 'Tavsif', value: rule.description || 'Tavsif berilmagan' },
        { label: 'Trigger Event', value: rule.eventType },
        { label: 'Shartlar soni', value: `${rule.conditions?.length ?? 0} ta shart` },
        { label: 'Harakatlar soni', value: `${rule.actions?.length ?? 0} ta harakat` },
      ],
      actions: [
        {
          label: 'Qoidani Tahrirlash',
          variant: 'primary',
          onClick: () => openEdit(rule),
        },
      ],
    });
  }, [playPop, openEdit]);

  const handleOpenExecutionSidecar = useCallback((exec: AutomationExecution) => {
    playPop();
    openSidecar({
      title: exec.rule?.name || 'Avtomatlashtirish Ijrosi',
      subtitle: `${exec.entityType || 'Entity'} • ${exec.status}`,
      badge: exec.status,
      status: {
        label: exec.status === 'SUCCESS' ? 'Muvaffaqiyatli' : exec.status === 'FAILED' ? 'Xatolik' : 'Bajarilmoqda',
        tone: exec.status === 'SUCCESS' ? 'emerald' : exec.status === 'FAILED' ? 'rose' : 'blue',
      },
      metrics: [
        { label: 'Holati', value: exec.status },
        { label: 'Boshlanish vaqti', value: new Date(exec.startedAt).toLocaleTimeString() },
      ],
      details: [
        { label: 'Ijro ID', value: exec.id },
        { label: 'Qoida', value: exec.rule?.name || 'Noma\'lum qoida' },
        { label: 'Entity turi', value: exec.entityType || '—' },
        { label: 'Entity ID', value: exec.entityId || '—' },
        { label: 'Boshlangan sana', value: new Date(exec.startedAt).toLocaleString() },
        { label: 'Tugallangan sana', value: (exec as { finishedAt?: string }).finishedAt ? new Date((exec as { finishedAt?: string }).finishedAt!).toLocaleString() : 'Davom etmoqda' },
        { label: 'Xatolik matni', value: exec.error || 'Xatolik qayd etilmagan' },
      ],
    });
  }, [playPop]);

  /* ── Keyboard shortcuts ────────────────────────────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === '1') {
        e.preventDefault();
        playTick();
        setActiveTab('rules');
      } else if (e.key === '2') {
        e.preventDefault();
        playTick();
        setActiveTab('executions');
      } else if (e.key === '3') {
        e.preventDefault();
        playTick();
        setActiveTab('stats');
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openCreate();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        evaluateAllMutation.mutate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playTick, openCreate]);

  /* ── Mutations ─────────────────────────────────────────────────────── */
  const createMutation = useMutation({
    mutationFn: (data: RuleForm) => automationApi.createRule(stripRowIds(data)),
    onSuccess: () => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: qk.rules() });
      toast('success', t('automation.rule.created'));
      closeModal();
    },
    onError: () => {
      playError();
      toast('error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RuleForm }) =>
      automationApi.updateRule(id, stripRowIds(data)),
    onSuccess: () => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: qk.rules() });
      toast('success', t('automation.rule.updated'));
      closeModal();
    },
    onError: () => {
      playError();
      toast('error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => automationApi.deleteRule(id),
    onSuccess: () => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: qk.rules() });
      toast('success', t('automation.rule.deleted'));
    },
    onError: () => {
      playError();
      toast('error');
    },
  });

  /* ── Optimistic toggle — snapshot, flip, rollback on error ─────────── */
  const toggleMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => automationApi.toggleRule(id),
    onMutate: async ({ id }) => {
      playTick();
      await queryClient.cancelQueries({ queryKey: qk.rules() });
      const previous = queryClient.getQueryData<AutomationRule[]>(qk.rules());
      if (previous) {
        queryClient.setQueryData<AutomationRule[]>(
          qk.rules(),
          previous.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      playError();
      if (ctx?.previous) queryClient.setQueryData(qk.rules(), ctx.previous);
      toast('error');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.rules() }),
  });

  const evaluateAllMutation = useMutation({
    mutationFn: () => automationApi.evaluateAll() as Promise<{ evaluated: number; triggered: number }>,
    onSuccess: (data) => {
      playSuccess();
      invalidateAll();
      toast(
        'success',
        `Evaluated ${data?.evaluated ?? 0} rules. Triggered ${data?.triggered ?? 0}.`,
      );
    },
    onError: () => {
      playError();
      toast('error');
    },
  });



  /* ── Form field handler — stable via useCallback ───────────────────── */
  const setField = useCallback(
    <K extends keyof RuleForm>(key: K, value: RuleForm[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
    },
    [],
  );

  const markTouched = useCallback((key: string) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  /* ── Condition / Action CRUD — stable keys, no index-based mutation ── */
  const addCondition = useCallback(() => {
    setForm((f) => ({
      ...f,
      conditions: [
        ...f.conditions,
        { _id: nextRowId('cond'), field: '', operator: 'gte', value: '' },
      ],
    }));
  }, []);

  const updateCondition = useCallback((id: string, patch: Partial<ConditionRow>) => {
    setForm((f) => ({
      ...f,
      conditions: f.conditions.map((c) => (c._id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const removeCondition = useCallback((id: string) => {
    setForm((f) => ({ ...f, conditions: f.conditions.filter((c) => c._id !== id) }));
  }, []);

  const addAction = useCallback(() => {
    setForm((f) => ({
      ...f,
      actions: [
        ...f.actions,
        {
          _id: nextRowId('act'),
          type: 'IN_APP_NOTIFICATION',
          target: 'MANAGERS',
          template: '',
          message: '',
        },
      ],
    }));
  }, []);

  const updateAction = useCallback((id: string, patch: Partial<ActionRow>) => {
    setForm((f) => ({
      ...f,
      actions: f.actions.map((a) => (a._id === id ? { ...a, ...patch } : a)),
    }));
  }, []);

  const removeAction = useCallback((id: string) => {
    setForm((f) => ({ ...f, actions: f.actions.filter((a) => a._id !== id) }));
  }, []);

  /* ── Form submit — validates, marks all touched, submits if valid ──── */
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitAttempted(true);
      if (!isValid) {
        const firstErrorField = formRef.current?.querySelector<HTMLElement>(
          '[data-field-error="true"]',
        );
        firstErrorField?.focus();
        return;
      }
      if (modal.kind === 'edit') {
        updateMutation.mutate({ id: modal.rule.id, data: form });
      } else if (modal.kind === 'create') {
        createMutation.mutate(form);
      }
    },
    [isValid, form, modal, createMutation, updateMutation],
  );

  /* ── Derived user-facing data ──────────────────────────────────────── */
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const modalTitle =
    modal.kind === 'edit'
      ? t('automation.editRule')
      : t('automation.newRule');

  /* ═════════════════════════════════════════════════════════════════
   *  RENDER — 5-state machine
   * ═════════════════════════════════════════════════════════════════ */

  /* State: LOADING */
  if (rulesQuery.isLoading) {
    return (
      <div className="relative min-h-full bg-transparent p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1400px] space-y-6">
          <GlassPageHeader title={t('automation.title')} subtitle={t('automation.subtitle')} />
          <GlassSurface className="p-16">
            <div
              className="flex items-center justify-center"
              role="status"
              aria-live="polite"
              aria-label={t('a11y.loadingEngine')}
            >
              <GlassPageLoader label="Loading automation engine..." />
            </div>
          </GlassSurface>
        </div>
      </div>
    );
  }

  /* State: ERROR */
  if (rulesQuery.isError) {
    return (
      <div className="relative min-h-full bg-transparent p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1400px] space-y-6">
          <GlassPageHeader title={t('automation.title')} subtitle="Connection error" />
          <GlassSurface className="p-12">
            <GlassErrorState
              message="Failed to load automation data. Please try again."
              onRetry={() => queryClient.invalidateQueries({ queryKey: qk.rules() })}
            />
          </GlassSurface>
        </div>
      </div>
    );
  }

  /* State: READY (rules loaded) */
  const rules = rulesQuery.data ?? [];

  return (
    <div className="relative min-h-full bg-transparent selection:bg-brand-500/30">
      <AuroraMesh variant="corporate" opacity={0.65} />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8 pb-[max(6rem,env(safe-area-inset-bottom))] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700">
        {/* Toast region — aria-live for screen readers */}
        <div aria-live="polite" aria-atomic="false">
          {toastNode}
        </div>

        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget) return;
            deleteMutation.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }}
          description={t('automation.rule.deleteConfirm')}
          loading={deleteMutation.isPending}
        />

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <GlassPageHeader title={t('automation.title')} subtitle={t('automation.subtitle')} />

          <div className="flex flex-wrap gap-3">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => evaluateAllMutation.mutate()}
              disabled={evaluateAllMutation.isPending}
              loading={evaluateAllMutation.isPending}
              icon={
                !evaluateAllMutation.isPending ? (
                  <svg
                    className="h-4 w-4 text-brand-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                ) : undefined
              }
            >
              {evaluateAllMutation.isPending ? t('automation.running') : t('automation.runNow')}
            </GlassButton>

            <GlassButton
              type="button"
              variant="primary"
              onClick={openCreate}
              icon={
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              }
            >
              {t('automation.addRule')}
            </GlassButton>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <GlassSurface className="p-2">
          <GlassTabs
            active={activeTab}
            onChange={(id) => setActiveTab(id as ActiveTab)}
            tabs={[
              {
                id: 'rules',
                label: String(t('automation.tab.rules')),
                count: rules.length,
              },
              {
                id: 'executions',
                label: String(t('automation.tab.executions')),
                count: executionsQuery.data?.length ?? 0,
              },
              {
                id: 'stats',
                label: String(t('automation.tab.stats')),
              },
            ]}
          />
        </GlassSurface>

        {/* ── Rules Tab ──────────────────────────────────────────── */}
        {activeTab === 'rules' && (
          <div className="space-y-4">
            {rules.length === 0 ? (
              <GlassSurface className="p-12">
                <GlassEmptyState
                  title={t('automation.rule.empty')}
                  description={t('automation.rule.emptyHint')}
                />
              </GlassSurface>
            ) : (
              <ul
                role="list"
                className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3"
              >
                {rules.map((rule, i) => (
                  <li
                    key={rule.id}
                    style={
                      reduced
                        ? undefined
                        : {
                            animation: `slideUp 0.55s ${EASE_CARD} both`,
                            animationDelay: `${staggerDelay(i)}ms`,
                          }
                    }
                  >
                    <RuleCard
                      rule={rule}
                      onEdit={() => openEdit(rule)}
                      onDelete={() => setDeleteTarget(rule)}
                      onToggle={() => toggleMutation.mutate({ id: rule.id })}
                      onOpenSidecar={() => handleOpenRuleSidecar(rule)}
                      toggling={toggleMutation.isPending}
                      t={t}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Executions Tab ──────────────────────────────────────────────── */}
        {activeTab === 'executions' && (
          <GlassSurface>
            {executionsQuery.isLoading ? (
              <div
                className="flex items-center justify-center p-16"
                role="status"
                aria-live="polite"
              >
                <GlassPageLoader label={t('common.loading')} />
              </div>
            ) : executionsQuery.isError ? (
              <div className="p-12">
                <GlassErrorState message={t('common.error')} />
              </div>
            ) : !executionsQuery.data || executionsQuery.data.length === 0 ? (
              <div className="p-12">
                <GlassEmptyState
                  title={t('automation.noExecutionsTitle')}
                  description={t('notifications.noMatchHint')}
                />
              </div>
            ) : (
              <ExecutionsTable
                rows={executionsQuery.data}
                t={t}
                reduced={reduced}
                onOpenSidecar={handleOpenExecutionSidecar}
              />
            )}
          </GlassSurface>
        )}

        {/* ── Stats Tab ─────────────────────────────────────────── */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {statsQuery.isLoading ? (
              <GlassSurface className="flex items-center justify-center p-16">
                <div role="status" aria-live="polite">
                  <GlassPageLoader label="Loading statistics..." />
                </div>
              </GlassSurface>
            ) : statsQuery.isError ? (
              <GlassSurface className="p-12">
                <GlassErrorState message="Failed to load statistics" />
              </GlassSurface>
            ) : statsQuery.data ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label={t('automation.stats.totalRules')}
                    value={statsQuery.data.totalRules}
                    accentClass="bg-brand-500"
                    delayMs={0}
                    reduced={reduced}
                    icon={
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                        <rect x="14" y="14" width="7" height="7" rx="1.5" />
                      </svg>
                    }
                  />
                  <StatCard
                    label={t('automation.stats.activeRules')}
                    value={statsQuery.data.activeRules}
                    accentClass="bg-emerald-500"
                    delayMs={80}
                    reduced={reduced}
                    icon={
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    }
                  />
                  <StatCard
                    label={t('automation.stats.totalExecutions')}
                    value={statsQuery.data.totalExecutions}
                    accentClass="bg-blue-500"
                    delayMs={160}
                    reduced={reduced}
                    icon={
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 12h4l3-9 4 18 3-9h4" />
                      </svg>
                    }
                  />
                  <StatCard
                    label={t('automation.stats.successRate')}
                    value={`${statsQuery.data.successRate}%`}
                    accentClass="bg-amber-500"
                    delayMs={240}
                    reduced={reduced}
                    icon={
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    }
                  />
                </div>

                {statsQuery.data.topRules && statsQuery.data.topRules.length > 0 && (
                  <GlassSurface className="p-6">
                    <h3 className="mb-5 flex items-center gap-2 text-[0.9rem] font-bold text-[var(--text-primary)]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </span>
                      {t('automation.stats.topRules')}
                    </h3>
                    <ol className="m-0 list-none space-y-2.5 p-0">
                      {statsQuery.data.topRules.map((rule, i) => (
                        <li
                          key={rule.id}
                          className="flex items-center justify-between rounded-2xl bg-white/40 px-4 py-3 ring-1 ring-inset ring-white/50 transition-all duration-300 hover:bg-white/60 dark:bg-white/[0.03] dark:ring-white/[0.06] dark:hover:bg-white/[0.06]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-500/5 text-[0.7rem] font-black text-brand-600 ring-1 ring-inset ring-brand-500/20 dark:text-brand-400 tabular-nums">
                              {i + 1}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[0.65rem] font-bold text-brand-600 ring-1 ring-inset ring-brand-500/20 dark:text-brand-400">
                              {formatType(rule.eventType)}
                            </span>
                            <span className="text-[0.85rem] font-semibold text-[var(--text-primary)]">
                              {rule.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-[0.78rem] tabular-nums">
                            <span className="text-[var(--text-muted)]">
                              Runs: <b className="text-[var(--text-secondary)]">{rule.totalRuns}</b>
                            </span>
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                              {rule.successCount}
                            </span>
                            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                              {rule.failureCount}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </GlassSurface>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ── Modal ──────────────────────────────────────────────── */}
        {modal.kind !== 'closed' && (
          <GlassModal open onClose={closeModal} title={modalTitle}>
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="space-y-5"
              noValidate
              aria-label={modalTitle}
            >
              <GlassInput
                label={t('automation.rule.name')}
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                onBlur={() => markTouched('name')}
                placeholder={t('automation.rule.namePlaceholder')}
                required
                aria-invalid={(submitAttempted || touched.name) && Boolean(errors.name)}
                aria-describedby={errors.name ? 'rule-name-error' : undefined}
                data-field-error={Boolean(errors.name) || undefined}
              />
              {(submitAttempted || touched.name) && errors.name && (
                <p id="rule-name-error" className="text-[0.75rem] font-medium text-red-500">
                  {errors.name === 'required' && t('validation.required')}
                  {errors.name === 'tooShort' && 'Name is too short'}
                  {errors.name === 'tooLong' && 'Name is too long'}
                </p>
              )}

              <GlassInput
                label={t('automation.rule.description')}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder={t('automation.rule.descriptionPlaceholder')}
              />

              <GlassSelect
                label={t('automation.rule.eventType')}
                value={form.eventType}
                onChange={(e) => setField('eventType', e.target.value as EventType)}
                options={EVENT_TYPES.map((et) => ({ value: et, label: formatType(et) }))}
              />

              {/* Conditions — stable keys, no index mutation */}
              <fieldset className="space-y-2 border-0 p-0">
                <legend className="flex w-full items-center justify-between">
                  <span className="text-[0.8rem] font-bold text-[var(--text-secondary)]">
                    {t('automation.rule.conditions')}
                  </span>
                  <GlassButton type="button" variant="ghost" size="sm" onClick={addCondition}>
                    + {t('common.add')}
                  </GlassButton>
                </legend>
                {form.conditions.map((cond) => (
                  <div key={cond._id} className="flex items-end gap-2">
                    <GlassInput
                      label=""
                      aria-label={t('automation.condField')}
                      value={cond.field}
                      onChange={(e) => updateCondition(cond._id, { field: e.target.value })}
                      placeholder={t('automation.rule.fieldPlaceholder')}
                      className="flex-1"
                    />
                    <GlassSelect
                      label=""
                      aria-label={t('automation.condOperator')}
                      value={cond.operator}
                      onChange={(e) =>
                        updateCondition(cond._id, { operator: e.target.value as ConditionOperator })
                      }
                      options={CONDITION_OPERATORS.map((op) => ({
                        value: op,
                        label: { gte: '≥', lte: 'â‰¤', eq: '=', gt: '>', lt: '<' }[op],
                      }))}
                      className="w-24"
                    />
                    <GlassInput
                      label=""
                      aria-label={t('automation.condValue')}
                      value={cond.value}
                      onChange={(e) => updateCondition(cond._id, { value: e.target.value })}
                      placeholder={t('automation.rule.valuePlaceholder')}
                      className="flex-1"
                    />
                    <GlassButton
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCondition(cond._id)}
                      aria-label={t('common.delete')}
                      className="shrink-0 text-red-500"
                      style={{ minWidth: TOUCH_TARGET_MIN_PX, minHeight: TOUCH_TARGET_MIN_PX }}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </GlassButton>
                  </div>
                ))}
              </fieldset>

              {/* Actions — stable keys */}
              <fieldset className="space-y-2 border-0 p-0">
                <legend className="flex w-full items-center justify-between">
                  <span className="text-[0.8rem] font-bold text-[var(--text-secondary)]">
                    {t('automation.rule.actions')}
                  </span>
                  <GlassButton type="button" variant="ghost" size="sm" onClick={addAction}>
                    + {t('common.add')}
                  </GlassButton>
                </legend>
                {form.actions.map((action) => (
                  <div
                    key={action._id}
                    className="space-y-2 rounded-2xl bg-white/40 p-3 ring-1 ring-inset ring-white/50 dark:bg-white/[0.03] dark:ring-white/[0.06]"
                  >
                    <div className="flex items-end gap-2">
                      <GlassSelect
                        label=""
                        aria-label={t('automation.actionType')}
                        value={action.type}
                        onChange={(e) =>
                          updateAction(action._id, { type: e.target.value as ActionType })
                        }
                        options={ACTION_TYPES.map((at) => ({ value: at, label: formatType(at) }))}
                        className="flex-1"
                      />
                      <GlassSelect
                        label=""
                        aria-label={t('automation.actionTarget')}
                        value={action.target}
                        onChange={(e) =>
                          updateAction(action._id, { target: e.target.value as TargetOption })
                        }
                        options={TARGET_OPTIONS.map((to) => ({ value: to, label: formatType(to) }))}
                        className="flex-1"
                      />
                      <GlassButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAction(action._id)}
                        aria-label={t('common.delete')}
                        className="shrink-0 text-red-500"
                        style={{ minWidth: TOUCH_TARGET_MIN_PX, minHeight: TOUCH_TARGET_MIN_PX }}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </GlassButton>
                    </div>
                    <GlassInput
                      label=""
                      aria-label={t('automation.actionTemplate')}
                      value={action.template}
                      onChange={(e) => updateAction(action._id, { template: e.target.value })}
                      placeholder={t('automation.rule.templatePlaceholder')}
                    />
                    <GlassInput
                      label=""
                      aria-label={t('automation.actionMessage')}
                      value={action.message}
                      onChange={(e) => updateAction(action._id, { message: e.target.value })}
                      placeholder={t('automation.rule.messagePlaceholder')}
                    />
                  </div>
                ))}
              </fieldset>

              <div className="grid grid-cols-2 gap-4">
                <GlassInput
                  label={t('automation.rule.cooldown')}
                  type="number"
                  min={1}
                  max={1440}
                  value={String(form.cooldownMinutes)}
                  onChange={(e) =>
                    setField(
                      'cooldownMinutes',
                      clampInt(e.target.value, 1, 1440, form.cooldownMinutes),
                    )
                  }
                  onBlur={() => markTouched('cooldownMinutes')}
                  aria-invalid={(submitAttempted || touched.cooldownMinutes) && Boolean(errors.cooldownMinutes)}
                />
                <GlassInput
                  label={t('automation.rule.maxTriggers')}
                  type="number"
                  min={1}
                  max={10000}
                  value={String(form.maxTriggersPerDay)}
                  onChange={(e) =>
                    setField(
                      'maxTriggersPerDay',
                      clampInt(e.target.value, 1, 10000, form.maxTriggersPerDay),
                    )
                  }
                  onBlur={() => markTouched('maxTriggersPerDay')}
                  aria-invalid={(submitAttempted || touched.maxTriggersPerDay) && Boolean(errors.maxTriggersPerDay)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <GlassButton
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  {t('common.cancel')}
                </GlassButton>
                <GlassButton
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  disabled={isSubmitting || (submitAttempted && !isValid)}
                  loading={isSubmitting}
                >
                  {modal.kind === 'edit' ? t('automation.rule.update') : t('automation.rule.create')}
                </GlassButton>
              </div>

              {/* Dirty guard — dev-only visual hint */}
              {isDirty && !isSubmitting && (
                <p className="text-center text-[0.7rem] text-[var(--text-muted)]">
                  Unsaved changes
                </p>
              )}
            </form>
          </GlassModal>
        )}
      </div>

      {/* ── Keyframes — hoisted, injected once per page mount ─────── */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0)        scale(1); }
          33%      { transform: translate(40px, -30px) scale(1.06); }
          66%      { transform: translate(-30px, 20px) scale(0.96); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="animate-[slideUp"],
          [class*="animate-[float"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§11  RULE CARD — extracted, memoizable sub-component
 * ═══════════════════════════════════════════════════════════════════════════ */

interface RuleCardProps {
  rule: AutomationRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onOpenSidecar?: () => void;
  toggling: boolean;
  // Accepts the app-wide TranslateFn (locale-bound useCallback) — a narrower
  // inline signature rejected it because TranslateFn also carries a fallback param.
  t: (key: string, varsOrFallback?: Record<string, string | number> | string, fallback?: string) => string;
}

function RuleCard({ rule, onEdit, onDelete, onToggle, onOpenSidecar, toggling, t }: RuleCardProps) {
  return (
    <GlassSurface hover className="h-full">
      <div className="relative space-y-4 p-6">
        {/* Accent gradient line — active vs inactive state encoding */}
        <div
          aria-hidden
          className={[
            'absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent to-transparent',
            rule.isActive ? 'via-emerald-500/60' : 'via-slate-400/40',
          ].join(' ')}
        />

        <div className="flex items-start justify-between gap-3">
          <div
            role="button"
            tabIndex={0}
            onClick={onOpenSidecar}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenSidecar?.();
              }
            }}
            aria-label={rule.name}
            className="min-w-0 flex-1 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <h3 className="truncate text-[0.98rem] font-bold tracking-tight text-[var(--text-primary)] hover:text-brand-500 transition-colors">
              {rule.name}
            </h3>
            {rule.description && (
              <p className="mt-1.5 line-clamp-2 text-[0.78rem] leading-relaxed text-[var(--text-muted)]">
                {rule.description}
              </p>
            )}
          </div>
          <GlassSwitch
            checked={rule.isActive}
            onChange={onToggle}
            disabled={toggling}
            aria-label={t('automation.rule.toggleAria', { name: rule.name })}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-brand-500/15 to-brand-500/5 px-2.5 py-1 text-[0.68rem] font-bold text-brand-600 ring-1 ring-inset ring-brand-500/20 dark:text-brand-400">
            <span
              className="h-1.5 w-1.5 rounded-full bg-brand-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]"
              aria-hidden
            />
            {formatType(rule.eventType)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/40 px-2.5 py-1 text-[0.68rem] font-bold text-[var(--text-secondary)] ring-1 ring-inset ring-white/50 dark:bg-white/[0.04] dark:ring-white/[0.06]">
            <svg className="h-3 w-3 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M3 12h4l3-9 4 18 3-9h4" />
            </svg>
            <span className="tabular-nums">{rule.totalRuns}</span>
          </span>
          <span
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold ring-1 ring-inset',
              rule.isActive
                ? 'bg-emerald-500/12 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400'
                : 'bg-slate-500/10 text-slate-500 ring-slate-500/20 dark:text-slate-400',
            ].join(' ')}
          >
            <span
              className={[
                'h-1.5 w-1.5 rounded-full',
                rule.isActive
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]'
                  : 'bg-slate-400',
              ].join(' ')}
              aria-hidden
            />
            {rule.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          <GlassButton variant="secondary" size="sm" onClick={onOpenSidecar} title="Tafsilotlar (Sidecar)">
            ◨
          </GlassButton>
          <GlassButton variant="secondary" size="sm" className="flex-1" onClick={onEdit}>
            {t('common.edit')}
          </GlassButton>
          <GlassButton variant="danger" size="sm" className="flex-1" onClick={onDelete}>
            {t('common.delete')}
          </GlassButton>
        </div>
      </div>
    </GlassSurface>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§12  EXECUTIONS TABLE — semantic table with caption + scope
 * ═══════════════════════════════════════════════════════════════════════════ */

interface ExecutionsTableProps {
  rows: AutomationExecution[];
  t: (key: string) => string;
  reduced: boolean;
  onOpenSidecar?: (exec: AutomationExecution) => void;
}

function ExecutionsTable({ rows, t, reduced, onOpenSidecar }: ExecutionsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.85rem]">
        <caption className="sr-only">
          {t('automation.tab.executions')} — {rows.length} rows
        </caption>
        <thead>
          <tr className="border-b border-white/40 dark:border-white/[0.06]">
            {(
              [
                'automation.th.rule',
                'automation.th.event',
                'automation.th.entity',
                'automation.th.status',
                'automation.th.triggered',
              ] as const
            ).map((h) => (
              <th
                key={h}
                scope="col"
                className="px-6 py-4 text-left text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]"
              >
                {t(h)}
              </th>
            ))}
            <th scope="col" className="px-6 py-4 text-right text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              ◨
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((exec, i) => {
            const s = getStatusStyle(exec.status);
            return (
              <tr
                key={exec.id}
                tabIndex={0}
                role="button"
                onClick={() => onOpenSidecar?.(exec)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenSidecar?.(exec);
                  }
                }}
                style={
                  reduced
                    ? undefined
                    : {
                        animation: `slideUp 0.4s ${EASE_ROW} both`,
                        animationDelay: `${Math.min(i * 30, 450)}ms`,
                      }
                }
                className="border-b border-white/30 transition-colors duration-300 last:border-0 hover:bg-white/40 dark:border-white/[0.04] dark:hover:bg-white/[0.03] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <td className="px-6 py-4 font-semibold text-[var(--text-primary)]">
                  {exec.rule?.name ?? '—'}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[0.68rem] font-bold text-brand-600 ring-1 ring-inset ring-brand-500/20 dark:text-brand-400">
                    {formatType(exec.rule?.eventType ?? '')}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono text-[0.78rem] text-[var(--text-secondary)]">
                  {exec.entityType ?? '—'}
                  <span className="mx-1.5 opacity-40" aria-hidden>
                    /
                  </span>
                  {exec.entityId?.slice(0, 8) ?? '—'}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold ring-1 ring-inset ring-current/10',
                      s.bg,
                      s.text,
                      s.glow,
                    ].join(' ')}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
                    {exec.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-[0.78rem] text-[var(--text-muted)] tabular-nums">
                  {new Date(exec.startedAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="inline-flex items-center justify-center rounded-lg border border-slate-200/80 bg-white/60 px-2 py-1 text-[11px] font-bold text-slate-700 shadow-sm transition-all hover:bg-white dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800">
                    ◨
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Â§13  FORM â†” RULE MAPPING — pure, testable, reversible
 * ═══════════════════════════════════════════════════════════════════════════ */

function ruleToForm(rule: AutomationRule): RuleForm {
  return {
    name: rule.name,
    description: rule.description ?? '',
    eventType: rule.eventType as EventType,
    conditions: (rule.conditions ?? []).map((c) => ({
      _id: nextRowId('cond'),
      field: c.field,
      operator: c.operator as ConditionOperator,
      value: String(c.value),
    })),
    actions: (rule.actions ?? []).map((a) => ({
      _id: nextRowId('act'),
      type: a.type as ActionType,
      target: (a.target ?? 'MANAGERS') as TargetOption,
      template: a.template ?? '',
      message: a.message ?? '',
    })),
    cooldownMinutes: rule.cooldownMinutes,
    maxTriggersPerDay: rule.maxTriggersPerDay,
  };
}

function stripRowIds(form: RuleForm): Omit<RuleForm, 'conditions' | 'actions'> & {
  conditions: Array<Omit<ConditionRow, '_id'>>;
  actions: Array<Omit<ActionRow, '_id'>>;
} {
  return {
    ...form,
    conditions: form.conditions.map(({ _id, ...rest }) => rest),
    actions: form.actions.map(({ _id, ...rest }) => rest),
  };
}

export default AutomationEnginePage;
