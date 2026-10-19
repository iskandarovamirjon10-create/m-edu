/**
 * ============================================================================
 * AiActionConfirmation v4.0 — Liquid Glass + Destructive Detection
 * ============================================================================
 * Fixes:
 *  - aria-modal removed (absence = non-modal, explicit false was ambiguous)
 *  - whileTap wrappers removed (GlassButton already animates; the wrapper
 *    scale was never visible because the button consumed pointer events)
 *  - cancel focus: only on mount (was stealing focus on every busy change)
 *  - resolveTranslation — options-aware, no raw-key leaks (12 sites)
 *  - aria-hidden → aria-hidden="true"
 *  - custom usePrefersReducedMotion → framer-motion's useReducedMotion
 *  - TONE[x].label dead field removed
 *  - CodeLine setTimeout cleared on unmount
 *  - Copy button now visible on touch (was hover-only)
 *  - Icon: className no longer double-applied
 *  - Escape handler: document listener while pending (was div-scoped)
 *  - Destructive tool detection (delete/remove/drop/destroy/clear/reset)
 *    → danger tone instead of warning — safety UX
 * Design — Liquid Glass:
 *  - Ambient tone-aware glow behind card (pulses, motion-safe)
 *  - Gradient icon tile (32×32) — SF-Symbols proportions
 *  - 3px gradient accent bar with tone glow
 *  - Specular top edge + bottom bevel + corner lens flare
 *  - Parameters as glass rows with dividers
 *  - Success checkmark draws itself (pathLength animation)
 *  - ESC kbd hint chip next to Cancel
 *  - Mobile: buttons stack vertically (44px tap target)
 * ============================================================================
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GlassButton } from '@/components/ui';
import { describeAiProposal, describeAiTool } from '@/lib/ai';
import type { AiActionResult, AiErrorInfo, AiPendingAction } from '@/types/ai';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';

/* ============================================================================
 * MOTION
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 32, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
} as const;

/* ============================================================================
 * TRANSLATION HELPER
 * ========================================================================== */

function resolveTranslation(
  t: (key: string, opts?: any) => string,
  key: string,
  fallback: string,
  options?: Record<string, unknown>,
): string {
  try {
    const v = options ? t(key, options) : t(key);
    return !v || v === key ? fallback : v;
  } catch {
    return fallback;
  }
}

/* ============================================================================
 * ICONS — SF Symbols proportions
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4',
    'M12 16h.01',
  ],
  check: ['M20 6 9 17l-5-5'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  chevronDown: ['M6 9l6 6 6-6'],
  copy: [
    'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
};

function Icon({
  paths,
  size = 14,
  className,
  strokeWidth = ICON_STROKE,
}: {
  paths: string[];
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
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Animated checkmark — draws itself on mount. */
function AnimatedCheck({ size = 14, tone }: { size?: number; tone: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tone}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="M5 13l4 4L19 7"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}
      />
    </motion.svg>
  );
}

/* ============================================================================
 * TONES
 * ========================================================================== */

type Tone = 'warning' | 'success' | 'danger';

const TONE: Record<
  Tone,
  { fg: string; glow: string; bg: string; gradient: string }
> = {
  warning: {
    fg: 'var(--ai-warning, #FF9500)',
    glow: 'rgba(255,149,0,0.35)',
    bg: 'rgba(255,149,0,0.08)',
    gradient: 'linear-gradient(135deg, #FFB340 0%, #FF9500 100%)',
  },
  success: {
    fg: 'var(--ai-success, #10B981)',
    glow: 'rgba(16,185,129,0.35)',
    bg: 'rgba(16,185,129,0.08)',
    gradient: 'linear-gradient(135deg, #34D399 0%, #059669 100%)',
  },
  danger: {
    fg: 'var(--ai-danger, #FF3B30)',
    glow: 'rgba(255,59,48,0.35)',
    bg: 'rgba(255,59,48,0.08)',
    gradient: 'linear-gradient(135deg, #FF6961 0%, #D70015 100%)',
  },
};

/** Detect potentially destructive tools so we can flip to danger tone. */
function isDestructiveTool(toolName?: string): boolean {
  if (!toolName) return false;
  return /delete|remove|drop|destroy|clear|reset|revoke|wipe/i.test(toolName);
}

/* ============================================================================
 * GLASS FRAME — the card shell (used by all three exports)
 * ========================================================================== */

interface GlassFrameProps {
  children: ReactNode;
  tone: Tone;
  role: 'alertdialog' | 'status' | 'alert';
  ariaProps?: Record<string, string>;
  testId: string;
  reduced: boolean;
}

function GlassFrame({ children, tone, role, ariaProps, testId, reduced }: GlassFrameProps) {
  const t = TONE[tone];

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.smooth}
      className="relative"
    >
      {/* Ambient glow — tone-aware, pulses */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -inset-3 -z-10 rounded-3xl blur-2xl',
          !reduced && 'motion-safe:animate-[actionAmbient_6s_ease-in-out_infinite]'
        )}
        style={{
          background: `radial-gradient(ellipse at 30% 30%, ${t.glow}, transparent 65%)`,
          opacity: 0.55,
        }}
      />

      {/* Card surface — 4 layers of glass */}
      <div
        role={role}
        data-testid={testId}
        {...ariaProps}
        className={cn(
          'relative overflow-hidden rounded-2xl',
          'border border-white/55 dark:border-white/[0.08]',
          'backdrop-blur-2xl backdrop-saturate-150',
          'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.16)]',
          'dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),0_8px_24px_-16px_rgba(0,0,0,0.50)]'
        )}
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.55) 100%)',
        }}
      >
        {/* Dark-mode tint */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            background:
              'linear-gradient(135deg, rgba(28,28,30,0.70) 0%, rgba(28,28,30,0.50) 100%)',
          }}
        />

        {/* Specular top edge */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/85 to-transparent dark:via-white/20"
        />

        {/* Specular bottom bevel */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent dark:via-white/[0.06]"
        />

        {/* Corner lens flare */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-8 -top-8 h-20 w-20 rounded-full bg-white/35 blur-2xl dark:bg-white/[0.10]"
        />

        {/* Left accent bar — gradient + glow */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full"
          style={{
            background: `linear-gradient(180deg, ${t.fg}, ${t.fg}80)`,
            boxShadow: `0 0 12px ${t.glow}`,
          }}
        />

        <div className="relative p-4 pl-5 sm:p-5 sm:pl-6">{children}</div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * STATE LABEL — icon + uppercase label
 * ========================================================================== */

function StateLabel({
  iconPaths,
  customIcon,
  tone,
  text,
}: {
  iconPaths?: string[];
  customIcon?: ReactNode;
  tone: string;
  text: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
      style={{ color: tone }}
    >
      {customIcon ?? (iconPaths ? <Icon paths={iconPaths} size={11} strokeWidth={2.4} /> : null)}
      <span>{text}</span>
    </div>
  );
}

/* ============================================================================
 * ICON TILE — gradient tile for the top-left of the card
 * ========================================================================== */

function IconTile({ tone, icon }: { tone: Tone; icon: string[] }) {
  const t = TONE[tone];
  return (
    <div
      aria-hidden="true"
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
      style={{
        background: t.gradient,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.10), 0 4px 12px -4px ${t.glow}`,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
        }}
      />
      <span className="relative">
        <Icon paths={icon} size={18} strokeWidth={2} />
      </span>
    </div>
  );
}

/* ============================================================================
 * HEADING / DESCRIPTION
 * ========================================================================== */

function Heading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h4
      id={id}
      className="mt-1.5 text-[15.5px] font-semibold leading-snug tracking-tight text-[var(--ai-text-primary,#1D1D1F)] dark:text-[var(--ai-text-primary,#F5F5F7)]"
    >
      {children}
    </h4>
  );
}

function Description({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p
      id={id}
      className="mt-1 text-[13px] font-normal leading-relaxed text-[var(--ai-text-muted,#86868B)] dark:text-[var(--ai-text-muted,#A1A1A6)]"
    >
      {children}
    </p>
  );
}

/* ============================================================================
 * PARAMETERS — glass rows
 * ========================================================================== */

interface Parameter {
  key?: string;
  label?: string;
  value?: string;
}

function Parameters({ items }: { items: Parameter[] }) {
  if (!items || items.length === 0) return null;

  return (
    <dl
      className={cn(
        'mt-3.5 divide-y divide-black/[0.05] overflow-hidden rounded-xl',
        'border border-black/[0.05] bg-black/[0.02]',
        'dark:divide-white/[0.06] dark:border-white/[0.06] dark:bg-white/[0.03]'
      )}
    >
      {items.map((p, idx) => (
        <div
          key={p.key ?? idx}
          className="flex items-baseline justify-between gap-4 px-3 py-2 text-[12.5px] leading-tight sm:text-[13px]"
        >
          <dt className="shrink-0 font-normal text-[var(--ai-text-muted,#86868B)] dark:text-[var(--ai-text-muted,#A1A1A6)]">
            {p.label}
          </dt>
          <dd
            className="min-w-0 truncate text-right font-medium tabular-nums text-[var(--ai-text-primary,#1D1D1F)] dark:text-[var(--ai-text-primary,#F5F5F7)]"
            title={p.value}
          >
            {p.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ============================================================================
 * CODE LINE — monospace + always-visible copy button
 * ========================================================================== */

function CodeLine({ code, label }: { code: string; label: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  const reduced = useReducedMotion();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 1600);
    } catch {
      /* noop */
    }
  }, [code]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--ai-text-muted,#86868B)] dark:text-[var(--ai-text-muted,#A1A1A6)]">
          {label}
        </span>
        <motion.button
          type="button"
          onClick={handleCopy}
          whileTap={reduced ? undefined : { scale: 0.94 }}
          aria-label={copied ? resolveTranslation(t, 'common.copied', 'Nusxalandi') : resolveTranslation(t, 'common.copy', 'Nusxalash')}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium',
            'opacity-60 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100',
            'outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,122,255,0.4)]'
          )}
          style={{
            color: copied
              ? 'var(--ai-success, #10B981)'
              : 'var(--ai-text-muted, #86868B)',
          }}
        >
          <Icon paths={copied ? I.check : I.copy} size={10} strokeWidth={2.4} />
          {copied
            ? resolveTranslation(t, 'common.copied', 'Nusxalandi')
            : resolveTranslation(t, 'common.copy', 'Nusxalash')}
        </motion.button>
      </div>
      <pre
        className="overflow-x-auto rounded-xl px-3 py-2.5 text-[11.5px] leading-[1.6] text-[var(--ai-text-primary,#1D1D1F)] dark:text-[var(--ai-text-primary,#F5F5F7)]"
        style={{
          background: 'var(--ai-bg-hover, rgba(0,0,0,0.03))',
          fontFamily:
            "'SF Mono', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace",
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ============================================================================
 * TECHNICAL DETAILS — collapsed disclosure
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
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  const hasContent = Boolean(backendMessage || rawArguments || raw);
  if (!hasContent) return null;

  return (
    <div className="mt-4">
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detailsId}
        whileTap={reduced ? undefined : { scale: 0.98 }}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11.5px] font-medium',
          'text-[var(--ai-text-muted,#86868B)] transition-colors hover:text-[var(--ai-text-primary,#1D1D1F)]',
          'dark:text-[var(--ai-text-muted,#A1A1A6)] dark:hover:text-[var(--ai-text-primary,#F5F5F7)]',
          'outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,122,255,0.4)]'
        )}
      >
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={SPRING.snappy}
          className="inline-flex"
        >
          <Icon paths={I.chevronDown} size={12} strokeWidth={2.2} />
        </motion.span>
        {resolveTranslation(t, 'ai.technicalDetails', 'Texnik tafsilotlar')}
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={detailsId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              {backendMessage && (
                <p className="mb-2 text-[12px] leading-relaxed text-[var(--ai-text-muted,#86868B)] dark:text-[var(--ai-text-muted,#A1A1A6)]">
                  {backendMessage}
                </p>
              )}
              {rawArguments && (
                <CodeLine
                  code={rawArguments}
                  label={resolveTranslation(t, 'ai.rawArguments', 'Argumentlar')}
                />
              )}
              {raw && (
                <CodeLine
                  code={raw}
                  label={resolveTranslation(t, 'ai.rawResponse', 'Javob')}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================================
 * AI ACTION CONFIRMATION
 * ========================================================================== */

export interface AiActionConfirmationProps {
  action: AiPendingAction;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

export function AiActionConfirmation({
  action,
  busy,
  onConfirm,
  onReject,
}: AiActionConfirmationProps) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  // Safe default: focus Cancel on mount only (Apple HIG for destructive)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // ESC → reject (document-level so it works even if focus drifts)
  useEffect(() => {
    if (busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onReject();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onReject]);

  const destructive = isDestructiveTool(action.toolName);
  const tone: Tone = destructive ? 'danger' : 'warning';
  const tTone = TONE[tone];

  const toolDescription = describeAiTool(action.toolName || '');
  const title = describeAiProposal(action.toolName || '');
  const description = toolDescription.known
    ? resolveTranslation(
        t,
        'ai.actionConfirmation.known',
        `AI wants to perform an action on "${toolDescription.subject}".`,
        { subject: toolDescription.subject },
      )
    : resolveTranslation(
        t,
        'ai.actionConfirmation.unknown',
        'AI wants to perform a system action.',
      );

  const parameters = action.parameters ?? [];
  const stateLabel = destructive
    ? resolveTranslation(t, 'ai.destructiveRequired', 'Xavfli amal — tasdiqlang')
    : resolveTranslation(t, 'ai.confirmationRequired', 'Tasdiqlash kerak');

  return (
    <GlassFrame
      role="alertdialog"
      tone={tone}
      testId="ai-action-confirmation"
      ariaProps={{ 'aria-labelledby': titleId, 'aria-describedby': descriptionId }}
      reduced={!!reduced}
    >
      <div className="flex items-start gap-3.5">
        <IconTile tone={tone} icon={destructive ? I.alertCircle : I.alertTriangle} />
        <div className="min-w-0 flex-1">
          <StateLabel
            tone={tTone.fg}
            iconPaths={destructive ? I.alertCircle : I.alertTriangle}
            text={stateLabel}
          />
          <Heading id={titleId}>{title}</Heading>
          <Description id={descriptionId}>{description}</Description>
        </div>
      </div>

      {parameters.length > 0 && <Parameters items={parameters} />}

      <TechnicalDetails
        backendMessage={action.backendMessage}
        rawArguments={action.rawArguments}
      />

      {/* Actions */}
      <div className="mt-5 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center justify-center gap-1.5 sm:justify-start">
          <GlassButton
            ref={cancelRef}
            variant="secondary"
            size="sm"
            onClick={onReject}
            disabled={busy}
            data-testid="ai-reject"
          >
            {resolveTranslation(t, 'common.cancel', 'Bekor qilish')}
          </GlassButton>
          {!busy && (
            <kbd
              aria-hidden="true"
              className="hidden items-center rounded-md border border-black/[0.08] bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ai-text-muted,#86868B)] sm:inline-flex dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-[var(--ai-text-muted,#A1A1A6)]"
            >
              esc
            </kbd>
          )}
        </div>

        <GlassButton
          variant={destructive ? 'danger' : 'warning'}
          size="sm"
          onClick={onConfirm}
          loading={busy}
          disabled={busy}
          data-testid="ai-confirm"
        >
          <span className="inline-flex items-center gap-1.5">
            <Icon paths={I.check} size={13} strokeWidth={2.6} />
            {resolveTranslation(t, 'common.confirm', 'Tasdiqlash')}
          </span>
        </GlassButton>
      </div>
    </GlassFrame>
  );
}

/* ============================================================================
 * ACTION RESULT CARD
 * ========================================================================== */

export interface ActionResultCardProps {
  result: AiActionResult;
}

export function ActionResultCard({ result }: ActionResultCardProps) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const tone: Tone = 'success';
  const tTone = TONE[tone];

  return (
    <GlassFrame
      role="status"
      tone={tone}
      testId="ai-action-result"
      ariaProps={{ 'aria-live': 'polite' }}
      reduced={!!reduced}
    >
      <div className="flex items-start gap-3.5">
        <IconTile tone={tone} icon={I.checkCircle} />
        <div className="min-w-0 flex-1">
          <StateLabel
            tone={tTone.fg}
            customIcon={<AnimatedCheck size={13} tone={tTone.fg} />}
            text={resolveTranslation(t, 'ai.actionCompleted', 'Amal bajarildi')}
          />
          <Heading>{result.title}</Heading>
          {result.summary && <Description>{result.summary}</Description>}
        </div>
      </div>

      {result.fields && result.fields.length > 0 && (
        <Parameters items={result.fields} />
      )}

      <TechnicalDetails raw={result.raw} />
    </GlassFrame>
  );
}

/* ============================================================================
 * ACTION ERROR NOTE
 * ========================================================================== */

export interface ActionErrorNoteProps {
  error: AiErrorInfo;
  onDismiss: () => void;
}

export function ActionErrorNote({ error, onDismiss }: ActionErrorNoteProps) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const tone: Tone = 'danger';
  const tTone = TONE[tone];

  return (
    <GlassFrame
      role="alert"
      tone={tone}
      testId="ai-action-error"
      ariaProps={{ 'aria-live': 'assertive' }}
      reduced={!!reduced}
    >
      <div className="flex items-start gap-3.5">
        <IconTile tone={tone} icon={I.alertCircle} />
        <div className="min-w-0 flex-1">
          <StateLabel
            tone={tTone.fg}
            iconPaths={I.alertCircle}
            text={resolveTranslation(t, 'ai.actionFailed', 'Amal bajarilmadi')}
          />
          <Heading>{resolveTranslation(t, 'ai.confirmError', 'Tasdiqlashda xato')}</Heading>
          <Description>{error.message}</Description>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <motion.button
          type="button"
          onClick={onDismiss}
          whileTap={reduced ? undefined : { scale: 0.97 }}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium',
            'text-[var(--ai-text-primary,#1D1D1F)] dark:text-[var(--ai-text-primary,#F5F5F7)]',
            'bg-black/[0.05] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.10]',
            'transition-colors duration-150',
            'outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(255,69,58,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#1C1C1E]',
            'motion-reduce:transition-none motion-reduce:active:scale-100'
          )}
        >
          {resolveTranslation(t, 'common.gotIt', 'Tushundim')}
        </motion.button>
      </div>
    </GlassFrame>
  );
}

/* Scoped keyframes */
const STYLE_KEYFRAMES = `
  @keyframes actionAmbient {
    0%, 100% { opacity: 0.40; transform: scale(1); }
    50%      { opacity: 0.65; transform: scale(1.04); }
  }
`;

// Inject once
if (typeof document !== 'undefined') {
  const id = '__ai-action-ambient-kf';
  if (!document.getElementById(id)) {
    const styleEl = document.createElement('style');
    styleEl.id = id;
    styleEl.textContent = STYLE_KEYFRAMES;
    document.head.appendChild(styleEl);
  }
}