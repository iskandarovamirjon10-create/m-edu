/**
 * M-EDU AiActionConfirmation — Apple Design Award Edition v2 "Trust Guard"
 *
 * Security-critical UX: the card shows only information the backend
 * actually returned (tool name, relayed arguments, backend message).
 * Nothing is inferred from the opaque actionId, and confirmation stays
 * strictly explicit — no automatic execution, no re-confirmation.
 *
 * ✨ SAFETY:
 *  - Default focus on CANCEL, not Confirm (Apple HIG for destructive)
 *  - Requires explicit click on Confirm
 *  - Escape → reject (safe)
 *  - Reduced-motion respected
 *
 * ✨ v2 CRAFT:
 *  - Custom SVG icons (SF Symbols proportions)
 *  - Framer Motion spring entrance
 *  - Tone-aware icon tiles with gradient + glow
 *  - Animated chevron + smooth details expand
 *  - Copy JSON to clipboard with feedback
 *  - Premium typography (tracking, weights)
 *  - Full i18n
 *  - WCAG AA compliant tap targets
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassButton } from '@/components/ui';
import { describeAiProposal, describeAiTool } from '@/lib/ai';
import type { AiActionResult, AiErrorInfo, AiPendingAction } from '@/types/ai';
import { useI18n } from '@/i18n/I18nProvider';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
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
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  check: ['M20 6 9 17l-5-5'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4',
    'M12 16h.01',
  ],
  chevronDown: ['M6 9l6 6 6-6'],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  ],
  shieldAlert: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M12 8v4',
    'M12 16h.01',
  ],
  copy: [
    'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  info: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 16v-4',
    'M12 8h.01',
  ],
  code: [
    'M16 18l6-6-6-6',
    'M8 6l-6 6 6 6',
  ],
  lock: [
    'M5 11h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z',
    'M7 11V7a5 5 0 0 1 10 0v4',
  ],
};

function Icon({
  paths, size = 16, className = '', strokeWidth = ICON_STROKE, ...rest
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

/* ============================================================================
 * TONE SYSTEM
 * ========================================================================== */

type Tone = 'warning' | 'success' | 'danger';

interface ToneConfig {
  fg: string;
  bg: string;
  border: string;
  glow: string;
  iconBg: string;
}

const TONE: Record<Tone, ToneConfig> = {
  warning: {
    fg: '#FF9500',
    bg: 'rgba(255,149,0,0.08)',
    border: 'rgba(255,149,0,0.30)',
    glow: 'rgba(255,149,0,0.28)',
    iconBg: 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)',
  },
  success: {
    fg: '#34C759',
    bg: 'rgba(52,199,89,0.08)',
    border: 'rgba(52,199,89,0.28)',
    glow: 'rgba(52,199,89,0.28)',
    iconBg: 'linear-gradient(135deg, #34C759 0%, #32ADE6 100%)',
  },
  danger: {
    fg: '#FF3B30',
    bg: 'rgba(255,59,48,0.08)',
    border: 'rgba(255,59,48,0.28)',
    glow: 'rgba(255,59,48,0.28)',
    iconBg: 'linear-gradient(135deg, #FF3B30 0%, #FF2D55 100%)',
  },
};

/* ============================================================================
 * TONE ICON TILE — 3D squircle with inset highlight
 * ========================================================================== */

function ToneIconTile({
  icon, tone, size = 40,
}: { icon: string[]; tone: Tone; size?: number }) {
  const c = TONE[tone];
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-xl"
      style={{
        width: size,
        height: size,
        background: c.iconBg,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.1), 0 6px 20px -8px ${c.glow}`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 55%)',
        }}
      />
      <Icon paths={icon} size={size * 0.45} strokeWidth={2} className="relative text-white" />
    </div>
  );
}

/* ============================================================================
 * CODE BLOCK — with copy button
 * ========================================================================== */

function CodeBlock({ code, label }: { code: string; label: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const reduced = usePrefersReducedMotion();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
  }, [code]);

  return (
    <div className="relative mt-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
          <Icon paths={I.code} size={10} strokeWidth={2.5} />
          {label}
        </span>
        <motion.button
          type="button"
          onClick={handleCopy}
          whileHover={reduced ? undefined : { scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={SPRING.snappy}
          aria-label={copied ? t('common.copied') || 'Copied' : t('common.copy') || 'Copy'}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#007AFF]/40"
          style={{
            color: copied ? '#34C759' : '#86868B',
            background: 'rgba(0,0,0,0.04)',
          }}
        >
          <Icon paths={copied ? I.check : I.copy} size={10} strokeWidth={2.4} />
          {copied ? t('common.copied') || 'Copied' : t('common.copy') || 'Copy'}
        </motion.button>
      </div>

      <pre
        className="overflow-x-auto rounded-xl border p-3 text-[11px] leading-5"
        style={{
          borderColor: 'rgba(0,0,0,0.08)',
          background: 'rgba(0,0,0,0.02)',
          color: '#1D1D1F',
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
 * COLLAPSIBLE TECHNICAL DETAILS
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
    <div className="mt-3">
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detailsId}
        whileHover={reduced ? undefined : { x: 2 }}
        transition={SPRING.snappy}
        className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-semibold text-[#86868B] outline-none transition-colors hover:bg-black/[0.03] hover:text-[#1D1D1F] focus-visible:ring-2 focus-visible:ring-[#007AFF]/40 dark:hover:bg-white/[0.04] dark:hover:text-[#F5F5F7]"
      >
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={SPRING.snappy}
          className="inline-flex"
        >
          <Icon paths={I.chevronDown} size={12} strokeWidth={2.4} />
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
            transition={SPRING.smooth}
            className="overflow-hidden"
          >
            <div className="pt-2">
              {backendMessage && (
                <p className="mb-2 text-[11px] leading-5 text-[#86868B]">
                  {backendMessage}
                </p>
              )}
              {rawArguments && (
                <CodeBlock
                  code={rawArguments}
                  label={t('ai.rawArguments') || 'Arguments'}
                />
              )}
              {raw && (
                <CodeBlock
                  code={raw}
                  label={t('ai.rawResponse') || 'Response'}
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
 * PARAMETER GRID — clean, labeled
 * ========================================================================== */

interface Parameter {
  key?: string;
  label?: string;
  value?: string;
}

function ParameterGrid({ parameters }: { parameters: Parameter[] }) {
  return (
    <dl
      className="mt-3 grid gap-2 rounded-2xl border p-3"
      style={{
        borderColor: 'rgba(0,0,0,0.08)',
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(8px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(8px) saturate(1.4)',
      }}
    >
      {parameters.map((parameter) => (
        <div
          key={parameter.key}
          className="flex flex-col gap-0.5 border-b pb-2 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:gap-3"
          style={{ borderColor: 'rgba(0,0,0,0.05)' }}
        >
          <dt className="w-full shrink-0 text-[11px] font-bold uppercase tracking-[0.1em] text-[#86868B] sm:w-28">
            {parameter.label}
          </dt>
          <dd className="min-w-0 break-words text-[13px] font-medium leading-5 text-[#1D1D1F]">
            {parameter.value}
          </dd>
        </div>
      ))}
    </dl>
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

  /* ✨ FIX #2 — Safe default: focus CANCEL, not Confirm (Apple HIG) */
  useEffect(() => {
    if (!busy) cancelRef.current?.focus();
  }, [busy]);

  const toolDescription = describeAiTool(action.toolName || '');
  const title = describeAiProposal(action.toolName || '');
  const description = toolDescription.known
    ? t('ai.actionConfirmation.known', {
        subject: toolDescription.subject,
      }) || `AI wants to perform an action on "${toolDescription.subject}". Please confirm before continuing.`
    : t('ai.actionConfirmation.unknown') ||
      'AI wants to perform a system action. Please confirm before continuing.';

  const parameters = action.parameters ?? [];
  const tone = TONE.warning;

  return (
    <motion.div
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="false"
      data-testid="ai-action-confirmation"
      initial={reduced ? false : { opacity: 0, y: 12, scale: 0.97, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ ...SPRING.smooth, filter: { duration: 0.25, ease: 'easeOut' } }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) {
          event.stopPropagation();
          onReject();
        }
      }}
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: tone.border,
        background: tone.bg,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 24px -12px ${tone.glow}`,
        backdropFilter: 'blur(16px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
      }}
    >
      {/* Top sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
        }}
      />

      {/* Left accent bar */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-4 left-0 w-[3px] rounded-r-full"
        style={{
          background: tone.fg,
          boxShadow: `0 0 10px ${tone.glow}`,
        }}
      />

      {/* Header */}
      <div className="flex items-start gap-3 pl-2">
        <ToneIconTile icon={I.shieldAlert} tone="warning" size={36} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: tone.fg }}
            >
              {t('ai.confirmationRequired') || 'Confirmation required'}
            </span>
          </div>

          <h4
            id={titleId}
            className="mt-1 text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]"
          >
            {title}
          </h4>

          <p
            id={descriptionId}
            className="mt-1 text-[12.5px] font-medium leading-relaxed text-[#86868B] dark:text-[#98989D]"
          >
            {description}
          </p>
        </div>
      </div>

      {/* Parameters */}
      {parameters.length > 0 && <ParameterGrid parameters={parameters} />}

      {/* Warning note */}
      <div
        className="mt-3 flex items-start gap-2 rounded-xl border px-3 py-2"
        style={{
          borderColor: 'rgba(255,149,0,0.20)',
          background: 'rgba(255,149,0,0.05)',
        }}
      >
        <Icon
          paths={I.alertTriangle}
          size={13}
          strokeWidth={2.2}
          className="mt-0.5 shrink-0"
          style={{ color: tone.fg }}
        />
        <p className="text-[11.5px] font-medium leading-5" style={{ color: '#8A5A00' }}>
          {t('ai.mutatesData') ||
            'This action may modify data in the system. Please confirm before continuing.'}
        </p>
      </div>

      {/* Technical details */}
      <TechnicalDetails
        backendMessage={action.backendMessage}
        rawArguments={action.rawArguments}
      />

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <motion.div whileHover={reduced ? undefined : { scale: 1.02 }} whileTap={{ scale: 0.98 }}>
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

        {/* Confirm with pulse ring */}
        <div className="relative">
          {!busy && !reduced && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl"
              style={{
                border: `2px solid ${tone.fg}40`,
              }}
              animate={{ scale: [1, 1.1], opacity: [0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          <motion.div whileHover={reduced ? undefined : { scale: 1.02 }} whileTap={{ scale: 0.98 }}>
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
    </motion.div>
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
    <motion.div
      role="status"
      aria-live="polite"
      data-testid="ai-action-result"
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.98, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ ...SPRING.smooth, filter: { duration: 0.25, ease: 'easeOut' } }}
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: tone.border,
        background: tone.bg,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 24px -12px ${tone.glow}`,
        backdropFilter: 'blur(16px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
      }}
    >
      {/* Top sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
        }}
      />

      {/* Left accent bar */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-4 left-0 w-[3px] rounded-r-full"
        style={{
          background: tone.fg,
          boxShadow: `0 0 10px ${tone.glow}`,
        }}
      />

      {/* Header */}
      <div className="flex items-start gap-3 pl-2">
        <motion.div
          initial={reduced ? false : { scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...SPRING.snappy, delay: 0.15 }}
        >
          <ToneIconTile icon={I.checkCircle} tone="success" size={36} />
        </motion.div>

        <div className="min-w-0 flex-1">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: tone.fg }}
          >
            {t('ai.actionCompleted') || 'Action completed'}
          </span>

          <h4 className="mt-1 text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {result.title}
          </h4>

          {result.summary && (
            <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-[#86868B] dark:text-[#98989D]">
              {result.summary}
            </p>
          )}
        </div>
      </div>

      {/* Fields */}
      {result.fields && result.fields.length > 0 && (
        <ParameterGrid parameters={result.fields} />
      )}

      {/* Technical details */}
      <TechnicalDetails raw={result.raw} />
    </motion.div>
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
    <motion.div
      role="alert"
      aria-live="assertive"
      data-testid="ai-action-error"
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.98, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ ...SPRING.smooth, filter: { duration: 0.25, ease: 'easeOut' } }}
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: tone.border,
        background: tone.bg,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 24px -12px ${tone.glow}`,
        backdropFilter: 'blur(16px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
      }}
    >
      {/* Top sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
        }}
      />

      {/* Left accent bar */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-4 left-0 w-[3px] rounded-r-full"
        style={{
          background: tone.fg,
          boxShadow: `0 0 10px ${tone.glow}`,
        }}
      />

      <div className="flex items-start gap-3 pl-2">
        <ToneIconTile icon={I.alertCircle} tone="danger" size={36} />

        <div className="min-w-0 flex-1">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: tone.fg }}
          >
            {t('ai.actionFailed') || 'Action failed'}
          </span>

          <h4 className="mt-1 text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('ai.confirmError') || 'Confirmation error'}
          </h4>

          <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-[#86868B] dark:text-[#98989D]">
            {error.message}
          </p>

          <motion.button
            type="button"
            onClick={onDismiss}
            whileHover={reduced ? undefined : { scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING.snappy}
            className="mt-3 inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#FF3B30]/40"
            style={{
              color: tone.fg,
              background: `${tone.fg}15`,
              border: `1px solid ${tone.fg}30`,
            }}
          >
            <Icon paths={I.x} size={12} strokeWidth={2.4} />
            {t('common.gotIt') || 'Got it'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}