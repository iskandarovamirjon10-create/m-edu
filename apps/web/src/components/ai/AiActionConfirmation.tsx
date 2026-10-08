/**
 * M-EDU AiActionConfirmation — Apple Design Award Edition v3 "Liquid Glass"
 *
 * Design philosophy: minimal, ChatGPT/Claude-grade restraint.
 *  - No gradient icon tiles. No sheens. No pulse rings. No left accent bars.
 *  - One accent color per state, applied to a single icon + label.
 *  - Typography carries the hierarchy. Whitespace carries the structure.
 *  - Glass is liquid: single backdrop layer + hairline border, no stacked effects.
 *  - Micro-interactions only on hover/focus — no ambient animation.
 *  - Preserves: all exports, props, safety defaults, i18n keys, a11y roles.
 *
 * ✨ SAFETY (unchanged):
 *  - Default focus on CANCEL, not Confirm (Apple HIG for destructive)
 *  - Escape → reject
 *  - Reduced-motion respected
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassButton } from '@/components/ui';
import { describeAiProposal, describeAiTool } from '@/lib/ai';
import type { AiActionResult, AiErrorInfo, AiPendingAction } from '@/types/ai';
import { useI18n } from '@/i18n/I18nProvider';

/* ============================================================================
 * MOTION — restrained. Only entrances and micro-interactions.
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 32, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
} as const;

/* ============================================================================
 * REDUCED MOTION
 * ========================================================================== */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
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
  x: ['M18 6 6 18', 'M6 6l12 12'],
};

function Icon({
  paths,
  size = 14,
  className = '',
  strokeWidth = ICON_STROKE,
  ...rest
}: {
  paths: string[];
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
      className={className}
      aria-hidden
      {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ============================================================================
 * TONES — single accent color per state
 * ========================================================================== */

type Tone = 'warning' | 'success' | 'danger';

const TONE: Record<Tone, { fg: string; label: string }> = {
  warning: { fg: 'var(--ai-warning, #FF9500)', label: 'warning' },
  success: { fg: 'var(--ai-success, #10B981)', label: 'success' },
  danger:  { fg: 'var(--ai-danger,  #FF3B30)', label: 'danger' },
};

/* ============================================================================
 * CARD SHELL — single reusable frame
 * ========================================================================== */

function GlassFrame({
  children,
  accent,
  role,
  ariaProps = {},
  testId,
  reduced,
}: {
  children: React.ReactNode;
  accent: string;
  role: 'alertdialog' | 'status' | 'alert';
  ariaProps?: Record<string, unknown>;
  testId: string;
  reduced: boolean;
}) {
  return (
    <motion.div
      role={role}
      aria-modal={role === 'alertdialog' ? false : undefined}
      data-testid={testId}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="relative overflow-hidden rounded-2xl border"
      style={{
        borderColor: 'var(--ai-border, rgba(0,0,0,0.08))',
        background: 'var(--ai-bg-glass, rgba(255,255,255,0.72))',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -16px rgba(0,0,0,0.14)',
      }}
      {...ariaProps}
    >
      {/* Left accent — the only color element in the card */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-3 left-0 w-[2px] rounded-r-full"
        style={{ background: accent }}
      />
      <div className="p-4 pl-5">{children}</div>
    </motion.div>
  );
}

/* ============================================================================
 * LABEL — small uppercase state label
 * ========================================================================== */

function StateLabel({ icon, tone, text }: { icon: string[]; tone: string; text: string }) {
  return (
    <div
      className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
      style={{ color: tone }}
    >
      <Icon paths={icon} size={11} strokeWidth={2.4} />
      <span>{text}</span>
    </div>
  );
}

/* ============================================================================
 * HEADING + DESCRIPTION
 * ========================================================================== */

function Heading({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h4
      id={id}
      className="mt-2 text-[15px] font-semibold leading-snug tracking-tight"
      style={{ color: 'var(--ai-text-primary, #1D1D1F)' }}
    >
      {children}
    </h4>
  );
}

function Description({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      id={id}
      className="mt-1 text-[13px] font-normal leading-relaxed"
      style={{ color: 'var(--ai-text-muted, #86868B)' }}
    >
      {children}
    </p>
  );
}

/* ============================================================================
 * PARAMETERS — clean key/value rows, no box, no borders
 * ========================================================================== */

interface Parameter {
  key?: string;
  label?: string;
  value?: string;
}

function Parameters({ items }: { items: Parameter[] }) {
  if (!items || items.length === 0) return null;

  return (
    <dl className="mt-4 space-y-2">
      {items.map((p, idx) => (
        <div
          key={p.key ?? idx}
          className="flex items-baseline justify-between gap-4 text-[13px] leading-tight"
        >
          <dt
            className="shrink-0 font-normal"
            style={{ color: 'var(--ai-text-muted, #86868B)' }}
          >
            {p.label}
          </dt>
          <dd
            className="min-w-0 truncate text-right font-medium tabular-nums"
            style={{ color: 'var(--ai-text-primary, #1D1D1F)' }}
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
 * CODE — minimal monospace, copy-on-hover
 * ========================================================================== */

function CodeLine({ code, label }: { code: string; label: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const reduced = usePrefersReducedMotion();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
  }, [code]);

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: 'var(--ai-text-muted, #86868B)' }}
        >
          {label}
        </span>
        <AnimatePresence>
          {(hovered || copied) && (
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={handleCopy}
              whileTap={reduced ? undefined : { scale: 0.94 }}
              aria-label={copied ? t('common.copied') : t('common.copy')}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ai-primary)]/40"
              style={{ color: copied ? 'var(--ai-success, #10B981)' : 'var(--ai-text-muted, #86868B)' }}
            >
              <Icon paths={copied ? I.check : I.copy} size={10} strokeWidth={2.4} />
              {copied ? t('common.copied') : t('common.copy')}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <pre
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="overflow-x-auto rounded-xl px-3 py-2.5 text-[11.5px] leading-[1.6]"
        style={{
          background: 'var(--ai-bg-hover, rgba(0,0,0,0.03))',
          color: 'var(--ai-text-primary, #1D1D1F)',
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
 * TECHNICAL DETAILS — collapsed by default, minimal disclosure
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
  const reduced = usePrefersReducedMotion();
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
        className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ai-primary)]/40"
        style={{ color: 'var(--ai-text-muted, #86868B)' }}
      >
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={SPRING.snappy}
          className="inline-flex"
        >
          <Icon paths={I.chevronDown} size={12} strokeWidth={2.2} />
        </motion.span>
        {t('ai.technicalDetails') || 'Technical details'}
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
                <p
                  className="mb-2 text-[12px] leading-relaxed"
                  style={{ color: 'var(--ai-text-muted, #86868B)' }}
                >
                  {backendMessage}
                </p>
              )}
              {rawArguments && (
                <CodeLine code={rawArguments} label={t('ai.rawArguments') || 'Arguments'} />
              )}
              {raw && <CodeLine code={raw} label={t('ai.rawResponse') || 'Response'} />}
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
  const reduced = usePrefersReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  /* Safe default: focus CANCEL, not Confirm (Apple HIG for destructive actions) */
  useEffect(() => {
    if (!busy) cancelRef.current?.focus();
  }, [busy]);

  const toolDescription = describeAiTool(action.toolName || '');
  const title = describeAiProposal(action.toolName || '');
  const description = toolDescription.known
    ? t('ai.actionConfirmation.known', { subject: toolDescription.subject }) ||
      `AI wants to perform an action on "${toolDescription.subject}".`
    : t('ai.actionConfirmation.unknown') ||
      'AI wants to perform a system action.';

  const parameters = action.parameters ?? [];
  const tone = TONE.warning;

  return (
    <GlassFrame
      role="alertdialog"
      accent={tone.fg}
      testId="ai-action-confirmation"
      ariaProps={{ 'aria-labelledby': titleId, 'aria-describedby': descriptionId }}
      reduced={reduced}
    >
      <div
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) {
            event.stopPropagation();
            onReject();
          }
        }}
      >
        <StateLabel
          icon={I.alertTriangle}
          tone={tone.fg}
          text={t('ai.confirmationRequired') || 'Confirmation required'}
        />

        <Heading id={titleId}>{title}</Heading>
        <Description id={descriptionId}>{description}</Description>

        {parameters.length > 0 && <Parameters items={parameters} />}

        <TechnicalDetails
          backendMessage={action.backendMessage}
          rawArguments={action.rawArguments}
        />

        <div className="mt-5 flex items-center justify-end gap-2">
          <motion.div whileTap={reduced ? undefined : { scale: 0.98 }}>
            <GlassButton
              ref={cancelRef}
              variant="secondary"
              size="sm"
              onClick={onReject}
              disabled={busy}
              data-testid="ai-reject"
            >
              {t('common.cancel') || 'Cancel'}
            </GlassButton>
          </motion.div>

          <motion.div whileTap={reduced ? undefined : { scale: 0.98 }}>
            <GlassButton
              variant="warning"
              size="sm"
              onClick={onConfirm}
              loading={busy}
              disabled={busy}
              data-testid="ai-confirm"
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon paths={I.check} size={13} strokeWidth={2.6} />
                {t('common.confirm') || 'Confirm'}
              </span>
            </GlassButton>
          </motion.div>
        </div>
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
  const reduced = usePrefersReducedMotion();
  const tone = TONE.success;

  return (
    <GlassFrame
      role="status"
      accent={tone.fg}
      testId="ai-action-result"
      ariaProps={{ 'aria-live': 'polite' }}
      reduced={reduced}
    >
      <StateLabel
        icon={I.checkCircle}
        tone={tone.fg}
        text={t('ai.actionCompleted') || 'Action completed'}
      />

      <Heading>{result.title}</Heading>

      {result.summary && <Description>{result.summary}</Description>}

      {result.fields && result.fields.length > 0 && <Parameters items={result.fields} />}

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
  const reduced = usePrefersReducedMotion();
  const tone = TONE.danger;

  return (
    <GlassFrame
      role="alert"
      accent={tone.fg}
      testId="ai-action-error"
      ariaProps={{ 'aria-live': 'assertive' }}
      reduced={reduced}
    >
      <StateLabel
        icon={I.alertCircle}
        tone={tone.fg}
        text={t('ai.actionFailed') || 'Action failed'}
      />

      <Heading>{t('ai.confirmError') || 'Confirmation error'}</Heading>
      <Description>{error.message}</Description>

      <div className="mt-4 flex justify-end">
        <motion.button
          type="button"
          onClick={onDismiss}
          whileTap={reduced ? undefined : { scale: 0.98 }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ai-danger)]/40"
          style={{
            color: 'var(--ai-text-primary, #1D1D1F)',
            background: 'var(--ai-bg-hover, rgba(0,0,0,0.04))',
          }}
        >
          {t('common.gotIt') || 'Got it'}
        </motion.button>
      </div>
    </GlassFrame>
  );
}