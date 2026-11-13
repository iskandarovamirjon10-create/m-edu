import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { GlassButton } from '@/components/ui';
import { describeAiProposal, describeAiTool } from '@/lib/ai';
import type { AiActionResult, AiErrorInfo, AiPendingAction } from '@/types/ai';
import { useSafeI18n, type TranslateFn } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';

/* ==========================================================================
 * DESIGN SYSTEM — Calm Apple-inspired Liquid Glass
 * ========================================================================== */

type Tone = 'warning' | 'success' | 'danger';

const MOTION = {
  enter: { type: 'spring', stiffness: 360, damping: 32, mass: 0.85 },
  subtle: { type: 'spring', stiffness: 440, damping: 34 },
  exit: { duration: 0.18, ease: [0.4, 0, 1, 1] as const },
  details: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
} as const;

const TONES: Record<
  Tone,
  {
    foreground: string;
    border: string;
    surface: string;
    gradient: string;
    shadow: string;
    /** Calm, restrained confirm-button fill (Apple style) */
    confirmFrom: string;
    confirmTo: string;
    confirmShadow: string;
  }
> = {
  warning: {
    foreground: 'var(--ai-warning, #B97716)',
    border: 'rgba(217, 151, 45, 0.22)',
    surface: 'rgba(217, 151, 45, 0.075)',
    gradient: 'linear-gradient(145deg, #F7C66A, #D99A32)',
    shadow: 'rgba(217, 151, 45, 0.12)',
    confirmFrom: '#D0922E',
    confirmTo: '#B97D1F',
    confirmShadow: 'rgba(185, 125, 31, 0.45)',
  },
  success: {
    foreground: 'var(--ai-success, #168568)',
    border: 'rgba(30, 157, 119, 0.20)',
    surface: 'rgba(30, 157, 119, 0.065)',
    gradient: 'linear-gradient(145deg, #62CBA6, #219C79)',
    shadow: 'rgba(30, 157, 119, 0.12)',
    confirmFrom: '#1E9D7B',
    confirmTo: '#168568',
    confirmShadow: 'rgba(22, 133, 104, 0.42)',
  },
  danger: {
    foreground: 'var(--ai-danger, #C73030)',
    border: 'rgba(199, 48, 48, 0.20)',
    surface: 'rgba(199, 48, 48, 0.065)',
    gradient: 'linear-gradient(145deg, #E76868, #C73030)',
    shadow: 'rgba(199, 48, 48, 0.12)',
    confirmFrom: '#D63C3C',
    confirmTo: '#B92626',
    confirmShadow: 'rgba(185, 38, 38, 0.48)',
  },
};

/* ==========================================================================
 * TRANSLATIONS
 * ========================================================================== */

function translated(
  t: TranslateFn,
  key: string,
  fallback: string,
  options?: Record<string, string | number>,
): string {
  try {
    const result = options ? t(key, options) : t(key);
    return !result || result === key ? fallback : result;
  } catch {
    return fallback;
  }
}

/* ==========================================================================
 * HAPTICS — graceful Vibration API wrapper (mobile premium feel)
 * ========================================================================== */

const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

function haptic(pattern: 'tap' | 'success' | 'warning' | 'error'): void {
  if (!canVibrate()) return;
  try {
    switch (pattern) {
      case 'tap':
        navigator.vibrate(10);
        break;
      case 'success':
        navigator.vibrate([12, 40, 12]);
        break;
      case 'warning':
        navigator.vibrate([18, 50, 18]);
        break;
      case 'error':
        navigator.vibrate([40, 60, 40]);
        break;
    }
  } catch {
    /* Vibration can throw in some contexts — ignore. */
  }
}

/* ==========================================================================
 * FOCUS TRAP — real alertdialog behaviour (was missing)
 * ========================================================================== */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null); // skip hidden
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (activeEl === first || !container.contains(activeEl))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [containerRef, active]);
}

/* ==========================================================================
 * COUNTDOWN — optional expiry for pending actions
 * ========================================================================== */

function useCountdown(expiresAt?: number, onExpire?: () => void) {
  const [remaining, setRemaining] = useState<number>(() =>
    expiresAt ? Math.max(0, expiresAt - Date.now()) : 0,
  );
  const firedRef = useRef(false);

  useEffect(() => {
    if (!expiresAt) return;
    firedRef.current = false;

    const tick = () => {
      const next = Math.max(0, expiresAt - Date.now());
      setRemaining(next);
      if (next === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, onExpire]);

  return remaining;
}

/* ==========================================================================
 * ICONS
 * ========================================================================== */

const ICONS = {
  warning: [
    'M12 3 2.7 19a1.8 1.8 0 0 0 1.55 2.7h15.5a1.8 1.8 0 0 0 1.55-2.7L12 3Z',
    'M12 9v4',
    'M12 17h.01',
  ],
  alert: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
    'M12 8v4',
    'M12 16h.01',
  ],
  success: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'm22 4-10 10-3-3'],
  check: ['m20 6-11 11-5-5'],
  copy: [
    'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
  chevron: ['m6 9 6 6 6-6'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 11v5', 'M12 7h.01'],
  refresh: [
    'M21 12a9 9 0 1 1-2.64-6.36',
    'M21 3v6h-6',
  ],
  undo: ['M3 7v6h6', 'M21 17a9 9 0 0 0-15-6.7L3 13'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 6v6l4 2'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z'],
} satisfies Record<string, string[]>;

function Icon({
  name,
  size = 16,
  className,
  strokeWidth = 1.8,
}: {
  name: keyof typeof ICONS;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
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
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name].map((path, index) => (
        <path key={`${name}-${index}`} d={path} />
      ))}
    </svg>
  );
}

/* ==========================================================================
 * ANIMATED SUCCESS MARK — refined draw-in
 * ========================================================================== */

function SuccessMark({ tone }: { tone: string }) {
  const reduced = useReducedMotion();

  return (
    <motion.svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tone}
      strokeWidth={2.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="m5 12 4 4L19 6"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.svg>
  );
}

/* ==========================================================================
 * TOOLTIP — accessible replacement for `title` attribute
 * ========================================================================== */

function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex max-w-full"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="min-w-0 truncate">
        {children}
      </span>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 max-w-[260px] -translate-x-1/2 rounded-lg bg-[#1C1C1E] px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white shadow-lg"
          >
            <span className="block break-words">{label}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/* ==========================================================================
 * GLASS FRAME — refined with aria-busy & high-contrast support
 * ========================================================================== */

interface GlassFrameProps {
  children: ReactNode;
  tone: Tone;
  role: 'alertdialog' | 'status' | 'alert';
  testId: string;
  ariaProps?: Record<string, string | boolean | undefined>;
  busy?: boolean;
  frameRef?: React.RefObject<HTMLElement | null>;
}

function GlassFrame({
  children,
  tone,
  role,
  testId,
  ariaProps,
  busy,
  frameRef,
}: GlassFrameProps) {
  const reduced = useReducedMotion();
  const palette = TONES[tone];

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99, transition: MOTION.exit }}
      transition={reduced ? { duration: 0 } : MOTION.enter}
      className="relative isolate w-full"
    >
      {/* Ambient light — GPU-friendly radial, no big blur */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 -z-10 rounded-[30px] opacity-70"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${palette.shadow}, transparent 70%)`,
        }}
      />

      <section
        ref={frameRef as React.RefObject<HTMLElement>}
        role={role}
        data-testid={testId}
        aria-busy={busy || undefined}
        {...ariaProps}
        className={cn(
          'relative overflow-hidden rounded-[22px]',
          'border border-white/70 dark:border-white/[0.10]',
          'shadow-[0_10px_35px_-22px_rgba(20,30,50,0.25)]',
          'dark:shadow-[0_12px_36px_-20px_rgba(0,0,0,0.60)]',
          'backdrop-blur-2xl backdrop-saturate-150',
          'motion-safe:transition-[border-color,box-shadow] duration-300',
          'supports-[backdrop-filter:blur(0)]:bg-white/70',
          // High-contrast fallback
          'contrast-more:border-black contrast-more:bg-white dark:contrast-more:bg-[#1C1C1E]',
          'contrast-more:shadow-none',
        )}
        style={{
          background:
            'linear-gradient(145deg, rgba(255,255,255,0.91), rgba(248,249,252,0.79))',
          borderColor: palette.border,
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-0 hidden dark:block"
          style={{
            background:
              'linear-gradient(145deg, rgba(35,36,40,0.96), rgba(25,26,30,0.94))',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-white/45 blur-3xl dark:bg-white/[0.06]"
        />

        {/* Semantic accent bar */}
        <div
          aria-hidden="true"
          className="absolute inset-y-4 left-0 z-10 w-[3px] rounded-r-full"
          style={{
            background: palette.gradient,
            boxShadow: `0 0 14px ${palette.shadow}`,
          }}
        />

        <div className="relative z-10 p-4 pl-5 sm:p-5 sm:pl-6">{children}</div>
      </section>
    </motion.div>
  );
}

/* ==========================================================================
 * VISUAL PRIMITIVES
 * ========================================================================== */

function IconTile({ tone, icon }: { tone: Tone; icon: keyof typeof ICONS }) {
  const palette = TONES[tone];
  return (
    <div
      aria-hidden="true"
      className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[15px] text-white"
      style={{
        background: palette.gradient,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.45), 0 5px 14px -7px ${palette.shadow}`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
      <Icon name={icon} size={20} strokeWidth={2} className="relative" />
    </div>
  );
}

function StateLabel({
  tone,
  text,
  icon,
}: {
  tone: Tone;
  text: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.10em]"
      style={{
        color: TONES[tone].foreground,
        background: TONES[tone].surface,
        borderColor: TONES[tone].border,
      }}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}

function Heading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h4
      id={id}
      className="mt-2 text-[16px] font-semibold leading-snug tracking-[-0.025em] text-[#202124] dark:text-[#F5F5F7] sm:text-[17px] contrast-more:text-black"
    >
      {children}
    </h4>
  );
}

function Description({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p
      id={id}
      className="mt-1.5 break-words text-[13.5px] leading-[1.65] text-[#70747D] dark:text-[#B1B4BC] sm:text-[14px] contrast-more:text-black dark:contrast-more:text-white"
    >
      {children}
    </p>
  );
}

/* ==========================================================================
 * PARAMETERS — with tooltip + "copy all"
 * ========================================================================== */

interface Parameter {
  key?: string;
  label?: string;
  value?: string;
}

function Parameters({ items }: { items: Parameter[] }) {
  const { t } = useSafeI18n();
  const reduced = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copyAll = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      const text = items
        .map((item) => `${item.label ?? item.key ?? '—'}: ${item.value ?? '—'}`)
        .join('\n');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      haptic('tap');
    } catch {
      /* silent — no UI for failure here */
    }
    timerRef.current = setTimeout(() => setCopied(false), 1600);
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="mt-4 min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#858993] dark:text-[#A7AAB3]">
          {translated(t, 'ai.parameters', 'Parametrlar')}
        </span>
        <motion.button
          type="button"
          onClick={copyAll}
          whileTap={reduced ? undefined : { scale: 0.94 }}
          aria-label={translated(t, 'common.copyAll', 'Barchasini nusxalash')}
          className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[10.5px] font-medium text-[#858993] outline-none transition-colors hover:bg-black/[0.045] hover:text-[#383B42] focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-[#A7AAB3] dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          <Icon name={copied ? 'check' : 'copy'} size={11} />
          {copied
            ? translated(t, 'common.copied', 'Nusxalandi')
            : translated(t, 'common.copyAll', 'Barchasi')}
        </motion.button>
      </div>

      <dl className="overflow-hidden rounded-[15px] border border-black/[0.055] bg-white/45 dark:border-white/[0.075] dark:bg-white/[0.025]">
        {items.map((item, index) => {
          const label = item.label ?? item.key ?? '—';
          const value = item.value ?? '—';
          return (
            <div
              key={`${item.key ?? item.label ?? 'parameter'}-${index}`}
              className={cn(
                'grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 px-3.5 py-3',
                index > 0 && 'border-t border-black/[0.045] dark:border-white/[0.06]',
              )}
            >
              <dt className="min-w-0 break-words text-[12px] leading-relaxed text-[#858993] dark:text-[#A7AAB3]">
                {label}
              </dt>
              <dd className="min-w-0 text-right text-[12px] font-medium leading-relaxed text-[#303238] dark:text-[#ECECF0]">
                <Tooltip label={value}>
                  <span className="block truncate">{value}</span>
                </Tooltip>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/* ==========================================================================
 * COPYABLE TECHNICAL VALUE — rate-limited + wrap toggle
 * ========================================================================== */

function CodeLine({ code, label }: { code: string; label: string }) {
  const { t } = useSafeI18n();
  const reduced = useReducedMotion();
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const [wrap, setWrap] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCopyRef = useRef(0);

  const copy = useCallback(async () => {
    // Rate limit: 400ms between attempts.
    const now = Date.now();
    if (now - lastCopyRef.current < 400) return;
    lastCopyRef.current = now;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code);
      setCopyState('success');
      haptic('tap');
    } catch {
      setCopyState('error');
      haptic('error');
    }

    timerRef.current = setTimeout(() => {
      setCopyState('idle');
      timerRef.current = null;
    }, 1800);
  }, [code]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copyLabel =
    copyState === 'success'
      ? translated(t, 'common.copied', 'Nusxalandi')
      : copyState === 'error'
        ? translated(t, 'common.copyFailed', 'Nusxalab bo‘lmadi')
        : translated(t, 'common.copy', 'Nusxalash');

  return (
    <div className="mt-3.5 min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#858993] dark:text-[#A7AAB3]">
          {label}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWrap((w) => !w)}
            className="inline-flex h-7 shrink-0 items-center rounded-md px-1.5 text-[10px] font-medium uppercase tracking-wider text-[#858993] outline-none transition-colors hover:bg-black/[0.045] focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-[#A7AAB3] dark:hover:bg-white/[0.06]"
            aria-label={translated(t, 'common.toggleWrap', 'Qatorni almashtirish')}
          >
            {wrap
              ? translated(t, 'common.nowrap', 'Wrap')
              : translated(t, 'common.wrap', 'Wrap')}
          </button>
          <motion.button
            type="button"
            onClick={copy}
            whileTap={reduced ? undefined : { scale: 0.94 }}
            aria-label={copyLabel}
            className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium outline-none transition-colors hover:bg-black/[0.045] focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-white/[0.06]"
            style={{
              color:
                copyState === 'success'
                  ? TONES.success.foreground
                  : copyState === 'error'
                    ? TONES.danger.foreground
                    : 'var(--ai-text-muted, #777B84)',
            }}
          >
            <Icon
              name={copyState === 'success' ? 'check' : copyState === 'error' ? 'alert' : 'copy'}
              size={12}
            />
            {copyLabel}
          </motion.button>
        </div>
      </div>

      <pre className="max-h-64 overflow-auto rounded-[13px] border border-black/[0.045] bg-[#F3F4F6]/90 p-3.5 text-[11.5px] leading-[1.75] text-[#383B42] dark:border-white/[0.07] dark:bg-black/20 dark:text-[#E5E7EB]">
        <code
          className={cn(
            '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]',
            wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
          )}
        >
          {code}
        </code>
      </pre>
    </div>
  );
}

/* ==========================================================================
 * TECHNICAL DETAILS — CSS grid animation (no layout thrashing)
 * ========================================================================== */

function TechnicalDetails({
  backendMessage,
  rawArguments,
  raw,
}: {
  backendMessage?: string;
  rawArguments?: string;
  raw?: string;
}) {
  const { t } = useSafeI18n();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const hasDetails = Boolean(backendMessage || rawArguments || raw);

  if (!hasDetails) return null;

  return (
    <div className="mt-4 border-t border-black/[0.055] pt-3 dark:border-white/[0.07]">
      <button
        type="button"
        onClick={() => {
          setOpen((c) => !c);
          haptic('tap');
        }}
        aria-expanded={open}
        aria-controls={detailsId}
        className="group inline-flex min-h-9 items-center gap-2 rounded-lg pr-2 text-[12px] font-medium text-[#777B84] outline-none transition-colors hover:text-[#303238] focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-[#A7AAB3] dark:hover:text-white"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/[0.035] transition-colors group-hover:bg-black/[0.06] dark:bg-white/[0.045] dark:group-hover:bg-white/[0.08]">
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduced ? { duration: 0 } : MOTION.subtle}
            className="flex"
          >
            <Icon name="chevron" size={13} />
          </motion.span>
        </span>
        {translated(t, 'ai.technicalDetails', 'Texnik tafsilotlar')}
      </button>

      <div
        id={detailsId}
        className={cn(
          'grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="pt-2">
            {backendMessage && (
              <p className="break-words rounded-xl bg-black/[0.025] p-3 text-[12px] leading-relaxed text-[#747983] dark:bg-white/[0.035] dark:text-[#B1B4BC]">
                {backendMessage}
              </p>
            )}
            {rawArguments && (
              <CodeLine
                code={rawArguments}
                label={translated(t, 'ai.rawArguments', 'Argumentlar')}
              />
            )}
            {raw && (
              <CodeLine
                code={raw}
                label={translated(t, 'ai.rawResponse', 'Javob')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
 * DESTRUCTIVE ACTION DETECTION
 * ========================================================================== */

const DESTRUCTIVE_RE =
  /\b(delete|remove|drop|destroy|clear|reset|revoke|wipe|purge|truncate|erase|deactivate|disable|terminate|archive|ban|unlink)\b/;

function isDestructiveTool(toolName?: string): boolean {
  if (!toolName?.trim()) return false;
  const normalized = toolName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._:/-]+/g, ' ')
    .toLowerCase();
  return DESTRUCTIVE_RE.test(normalized);
}

/* ==========================================================================
 * CONFIRMATION KEYBOARD STACK
 * ========================================================================== */

const confirmationStack: string[] = [];

/* ==========================================================================
 * 1. AI ACTION CONFIRMATION — premium
 * ========================================================================== */

export interface AiActionConfirmationProps {
  action: AiPendingAction;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
  /** Optional: timestamp (ms) after which the confirmation auto-rejects. */
  expiresAt?: number;
  /** Optional: require the user to type this exact string to enable confirm. */
  confirmPhrase?: string;
  /** Optional: called when the confirm/cancel button is pressed with a reason. */
  onAnalytics?: (event: 'confirm' | 'reject' | 'expire') => void;
}

export function AiActionConfirmation({
  action,
  busy,
  onConfirm,
  onReject,
  expiresAt,
  confirmPhrase,
  onAnalytics,
}: AiActionConfirmationProps) {
  const { t } = useSafeI18n();
  const titleId = useId();
  const descriptionId = useId();
  const phraseId = useId();

  const frameRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const rejectRef = useRef(onReject);
  const busyRef = useRef(busy);
  const expireRef = useRef(onAnalytics);

  rejectRef.current = onReject;
  busyRef.current = busy;
  expireRef.current = onAnalytics;

  const [typed, setTyped] = useState('');
  const phraseOk = !confirmPhrase || typed.trim() === confirmPhrase;

  // Real focus trap
  useFocusTrap(frameRef, true);

  // Countdown (optional)
  const remaining = useCountdown(
    expiresAt,
    useCallback(() => {
      if (!busyRef.current) {
        expireRef.current?.('expire');
        rejectRef.current();
      }
    }, []),
  );

  // Escape + initial focus + focus restore
  useEffect(() => {
    const active = document.activeElement;
    previousFocusRef.current = active instanceof HTMLElement ? active : null;

    const stack = confirmationStack;
    stack.push(titleId);
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== titleId) return;

      // Escape → reject (unless busy). Must run even if page-level hotkey handler captured event.
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!busyRef.current) rejectRef.current();
        return;
      }

      if (event.defaultPrevented) return;

      // Cmd/Ctrl+Enter → confirm (only when phrase is satisfied)
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        if (!busyRef.current && phraseOk) {
          event.preventDefault();
          onConfirm();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      const index = stack.lastIndexOf(titleId);
      if (index >= 0) stack.splice(index, 1);
      const previous = previousFocusRef.current;
      if (previous?.isConnected) previous.focus();
    };
  }, [titleId, onConfirm, phraseOk]);

  const destructive = isDestructiveTool(action.toolName);
  const tone: Tone = destructive ? 'danger' : 'warning';
  const palette = TONES[tone];

  const tool = useMemo(() => describeAiTool(action.toolName || ''), [action.toolName]);
  const title = useMemo(() => describeAiProposal(action.toolName || ''), [action.toolName]);

  const description = tool.known
    ? translated(
        t,
        'ai.actionConfirmation.known',
        `AI "${tool.subject}" ustida amal bajarishni so'rayapti.`,
        { subject: tool.subject },
      )
    : translated(t, 'ai.actionConfirmation.unknown', 'AI tizim amalini bajarishni so\'rayapti.');

  const stateLabel = destructive
    ? translated(t, 'ai.destructiveRequired', 'Xavfli amal — tasdiqlash kerak')
    : translated(t, 'ai.confirmationRequired', 'Tasdiqlash kerak');

  const parameters = action.parameters ?? [];

  const handleConfirm = () => {
    if (busy || !phraseOk) return;
    haptic(destructive ? 'warning' : 'success');
    onAnalytics?.('confirm');
    onConfirm();
  };

  const handleReject = () => {
    if (busy) return;
    haptic('tap');
    onAnalytics?.('reject');
    onReject();
  };

  const confirmStyle: CSSProperties = {
    background: `linear-gradient(180deg, ${palette.confirmFrom}, ${palette.confirmTo})`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 22px -10px ${palette.confirmShadow}`,
  };

  return (
    <GlassFrame
      frameRef={frameRef}
      tone={tone}
      role="alertdialog"
      testId="ai-action-confirmation"
      busy={busy}
      ariaProps={{
        'aria-labelledby': titleId,
        'aria-describedby': descriptionId,
        'aria-keyshortcuts': 'Escape Meta+Enter Control+Enter',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3.5">
        <IconTile tone={tone} icon={destructive ? 'alert' : 'warning'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StateLabel
              tone={tone}
              text={stateLabel}
              icon={<Icon name={destructive ? 'alert' : 'info'} size={12} strokeWidth={2} />}
            />
            {expiresAt && remaining > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-medium text-[#858993] dark:bg-white/[0.06] dark:text-[#A7AAB3]">
                <Icon name="clock" size={10} />
                {Math.ceil(remaining / 1000)}
                {translated(t, 'common.secondsShort', 's')}
              </span>
            )}
          </div>
          <Heading id={titleId}>{title}</Heading>
          <Description id={descriptionId}>{description}</Description>
        </div>
      </div>

      {/* Destructive notice */}
      {destructive && (
        <div
          className="mt-4 flex items-start gap-2.5 rounded-[13px] border px-3.5 py-3"
          style={{ background: palette.surface, borderColor: palette.border }}
        >
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
          <p className="text-[12px] leading-relaxed text-[#676A70] dark:text-[#D2B9B9]">
            Bu amal muhim ma'lumotlarni o'zgartirishi yoki o'chirishi mumkin. Davom etishdan
            oldin parametrlarni tekshiring.
          </p>
        </div>
      )}

      {parameters.length > 0 && <Parameters items={parameters} />}

      <TechnicalDetails backendMessage={action.backendMessage} rawArguments={action.rawArguments} />

      {/* Type-to-confirm phrase */}
      {confirmPhrase && (
        <div className="mt-4">
          <label
            htmlFor={phraseId}
            className="block text-[11.5px] font-medium text-[#676A70] dark:text-[#B1B4BC]"
          >
            {translated(
              t,
              'ai.typeToConfirm',
              `Tasdiqlash uchun "${confirmPhrase}" deb yozing`,
              { phrase: confirmPhrase },
            )}
          </label>
          <input
            id={phraseId}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={busy}
            className={cn(
              'mt-1.5 h-9 w-full rounded-lg border bg-white/70 px-3 text-[12.5px] text-[#202124] outline-none transition-shadow',
              'focus:ring-2 focus:ring-blue-500/40',
              'dark:bg-white/[0.06] dark:text-white',
              phraseOk
                ? 'border-black/[0.08] dark:border-white/[0.10]'
                : 'border-red-400/40 dark:border-red-400/40',
            )}
            aria-invalid={!phraseOk && typed.length > 0}
          />
        </div>
      )}

      {/* Footer */}
      <div className="mt-5 flex flex-col-reverse gap-2.5 border-t border-black/[0.055] pt-4 dark:border-white/[0.07] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <GlassButton
            ref={cancelRef}
            variant="secondary"
            size="sm"
            onClick={handleReject}
            disabled={busy}
            data-testid="ai-reject"
            aria-keyshortcuts="Escape"
            className="rounded-xl border border-black/10 min-h-[44px] tap-extend transition-all active:scale-[0.97] hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
          >
            {translated(t, 'common.cancel', 'Bekor qilish')}
          </GlassButton>
          {!busy && (
            <kbd className="hidden rounded-md border border-black/[0.07] bg-black/[0.025] px-2 py-1 text-[10px] text-[#858993] dark:border-white/[0.08] dark:bg-white/[0.035] sm:inline-flex">
              Esc
            </kbd>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!busy && (
            <kbd className="hidden rounded-md border border-black/[0.07] bg-black/[0.025] px-2 py-1 text-[10px] text-[#858993] dark:border-white/[0.08] dark:bg-white/[0.035] sm:inline-flex">
              ⌘↵
            </kbd>
          )}
          <GlassButton
            variant={destructive ? 'danger' : 'warning'}
            size="sm"
            onClick={handleConfirm}
            loading={busy}
            disabled={busy || !phraseOk}
            data-testid="ai-confirm"
            aria-keyshortcuts="Meta+Enter Control+Enter"
            style={confirmStyle}
            className={cn(
              'rounded-xl font-semibold text-white min-h-[44px] tap-extend',
              'transition-[transform,filter] duration-150',
              'hover:brightness-110 active:scale-[0.97]',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100',
              'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70',
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {!busy && <Icon name={destructive ? 'alert' : 'check'} size={14} strokeWidth={2} />}
              {translated(t, 'common.confirm', 'Tasdiqlash')}
            </span>
          </GlassButton>
        </div>
      </div>
    </GlassFrame>
  );
}

/* ==========================================================================
 * 2. ACTION SUCCESS CARD — with undo hook
 * ========================================================================== */

export interface ActionResultCardProps {
  result: AiActionResult;
  /** Optional: show undo button + hook. */
  onUndo?: () => void;
}

export function ActionResultCard({ result, onUndo }: ActionResultCardProps) {
  const { t } = useSafeI18n();
  const reduced = useReducedMotion();
  const tone: Tone = 'success';
  const palette = TONES[tone];

  return (
    <GlassFrame
      tone={tone}
      role="status"
      testId="ai-action-result"
      ariaProps={{ 'aria-live': 'polite' }}
    >
      <div className="flex items-start gap-3.5">
        <IconTile tone={tone} icon="success" />
        <div className="min-w-0 flex-1">
          <StateLabel
            tone={tone}
            text={translated(t, 'ai.actionCompleted', 'Amal muvaffaqiyatli bajarildi')}
            icon={<SuccessMark tone={palette.foreground} />}
          />
          <Heading>{result.title}</Heading>
          {result.summary && <Description>{result.summary}</Description>}
        </div>
      </div>

      {result.fields && result.fields.length > 0 && <Parameters items={result.fields} />}

      <TechnicalDetails raw={result.raw} />

      {onUndo && (
        <div className="mt-4 flex justify-end border-t border-black/[0.055] pt-3 dark:border-white/[0.07]">
          <motion.button
            type="button"
            onClick={() => {
              haptic('tap');
              onUndo();
            }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-[#676A70] outline-none transition-colors hover:bg-black/[0.045] hover:text-[#202124] focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-[#B1B4BC] dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            <Icon name="undo" size={13} />
            {translated(t, 'common.undo', 'Orqaga qaytarish')}
          </motion.button>
        </div>
      )}
    </GlassFrame>
  );
}

/* ==========================================================================
 * 3. ACTION ERROR CARD — with retry
 * ========================================================================== */

export interface ActionErrorNoteProps {
  error: AiErrorInfo;
  onDismiss: () => void;
  /** Optional: retry button + hook. */
  onRetry?: () => void;
}

export function ActionErrorNote({ error, onDismiss, onRetry }: ActionErrorNoteProps) {
  const { t } = useSafeI18n();
  const reduced = useReducedMotion();
  const tone: Tone = 'danger';

  // Notify a11y stack
  useEffect(() => {
    haptic('error');
  }, []);

  return (
    <GlassFrame
      tone={tone}
      role="alert"
      testId="ai-action-error"
      ariaProps={{ 'aria-live': 'assertive' }}
    >
      <div className="flex items-start gap-3.5">
        <IconTile tone={tone} icon="alert" />
        <div className="min-w-0 flex-1">
          <StateLabel
            tone={tone}
            text={translated(t, 'ai.actionFailed', 'Amal bajarilmadi')}
            icon={<Icon name="alert" size={12} />}
          />
          <Heading>{translated(t, 'ai.confirmError', 'Amalni bajarishda xatolik')}</Heading>
          <Description>{error.message}</Description>
          {error.code && (
            <p className="mt-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[#858993] dark:text-[#A7AAB3]">
              {translated(t, 'common.errorCode', 'Kod')}: {error.code}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse items-stretch justify-end gap-2 border-t border-black/[0.055] pt-4 dark:border-white/[0.07] sm:flex-row">
        {onRetry && (
          <motion.button
            type="button"
            onClick={() => {
              haptic('tap');
              onRetry();
            }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            className={cn(
              'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4',
              'border border-black/[0.08] bg-white/70',
              'text-[12.5px] font-medium text-[#383B42]',
              'transition-colors hover:bg-white',
              'outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
              'dark:border-white/[0.10] dark:bg-white/[0.055] dark:text-[#F1F1F4] dark:hover:bg-white/[0.09]',
              'motion-reduce:transition-none',
            )}
          >
            <Icon name="refresh" size={13} />
            {translated(t, 'common.retry', 'Qayta urinish')}
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={() => {
            haptic('tap');
            onDismiss();
          }}
          whileTap={reduced ? undefined : { scale: 0.97 }}
          className={cn(
            'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4',
            'border border-black/[0.055] bg-white/60',
            'text-[12.5px] font-medium text-[#383B42]',
            'transition-colors hover:bg-white',
            'outline-none focus-visible:ring-2 focus-visible:ring-red-500/40',
            'dark:border-white/[0.08] dark:bg-white/[0.055]',
            'dark:text-[#F1F1F4] dark:hover:bg-white/[0.09]',
            'motion-reduce:transition-none',
          )}
        >
          {translated(t, 'common.gotIt', 'Tushundim')}
        </motion.button>
      </div>
    </GlassFrame>
  );
}