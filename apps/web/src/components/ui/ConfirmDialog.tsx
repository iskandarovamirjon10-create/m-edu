/**
 * ConfirmDialog — Apple-premium confirmation modal.
 *
 * Keeps the full V2 API: type-to-confirm gate, tones, ⌘/Ctrl+Enter shortcut,
 * async `onConfirm` with double-submit guard + internal loading.
 * FIX: a rejected `onConfirm` is caught and rendered as an inline alert —
 * it never becomes an unhandled promise rejection.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  memo,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { GlassModal } from './GlassModal';
import { GlassButton } from './GlassButton';
import { cn, Icon, usePrefersReducedMotion } from '@/lib/design';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ══════════════════════════════════════════════════════════════════════
 * TYPES
 * ══════════════════════════════════════════════════════════════════════ */

export type ConfirmTone = 'danger' | 'warning' | 'primary' | 'default' | 'info';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Sync or async (Promise) — async triggers the internal loading state. */
  onConfirm: () => void | Promise<unknown>;
  /** Dialog title. Defaults to a localized generic title. */
  title?: string;
  /** Body description (the actual confirmation question). */
  description?: ReactNode;
  /** Optional secondary hint / warning callout under the description. */
  hint?: ReactNode;
  /** Optional name of the entity being affected (highlighted pill). */
  itemName?: string;
  /** When set, the user must type this exact text to unlock the confirm button. */
  confirmText?: string;
  /** Confirm button label. Defaults to "Delete" (or "Confirm" for primary tone). */
  confirmLabel?: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Show loading spinner + disable buttons while the action is in flight. */
  loading?: boolean;
  /** Visual tone: danger (default), warning or primary. */
  tone?: ConfirmTone;
}

/* ══════════════════════════════════════════════════════════════════════
 * TONE MAP
 * ══════════════════════════════════════════════════════════════════════ */

interface ToneStyle {
  icon: 'trash' | 'alert' | 'checkCircle';
  tile: string;
  badge: string;
  buttonVariant: 'danger' | 'primary';
}

const TONE_STYLES: Record<ConfirmTone, ToneStyle> = {
  danger: {
    icon: 'trash',
    tile: 'bg-apple-red/10 text-apple-red',
    badge: 'border-apple-red/25 bg-apple-red/10 text-apple-red',
    buttonVariant: 'danger',
  },
  warning: {
    icon: 'alert',
    tile: 'bg-apple-orange/10 text-apple-orange',
    badge: 'border-apple-orange/25 bg-apple-orange/10 text-apple-orange',
    buttonVariant: 'primary',
  },
  primary: {
    icon: 'checkCircle',
    tile: 'bg-apple-blue/10 text-apple-blue',
    badge: 'border-apple-blue/25 bg-apple-blue/10 text-apple-blue',
    buttonVariant: 'primary',
  },
  default: {
    icon: 'checkCircle',
    tile: 'bg-sunken text-secondary',
    badge: 'border-subtle bg-sunken text-secondary',
    buttonVariant: 'primary',
  },
  info: {
    icon: 'checkCircle',
    tile: 'bg-apple-blue/10 text-apple-blue',
    badge: 'border-apple-blue/25 bg-apple-blue/10 text-apple-blue',
    buttonVariant: 'primary',
  },
};

const FAILURE_MESSAGE = 'Something went wrong. Please try again.';

/* ══════════════════════════════════════════════════════════════════════
 * COMPONENT
 * ══════════════════════════════════════════════════════════════════════ */

export const ConfirmDialog = memo(function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  hint,
  itemName,
  confirmText,
  confirmLabel,
  cancelLabel,
  loading = false,
  tone = 'danger',
}: ConfirmDialogProps) {
  const { t } = useSafeI18n();
  const sound = usePremiumSound();
  const reduced = usePrefersReducedMotion();

  const uid = useId();
  const descId = `confirm-desc-${uid}`;
  const hintId = `confirm-hint-${uid}`;
  const inputId = `confirm-input-${uid}`;

  const [internalLoading, setInternalLoading] = useState(false);
  const [typedValue, setTypedValue] = useState('');
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const cancelWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isBusy = loading || internalLoading;
  const toneStyle = TONE_STYLES[tone] ?? TONE_STYLES.primary;

  /** Translate with an English fallback when the key is missing. */
  const tr = useCallback(
    (key: string, fallback: string) => {
      const value = t(key);
      return value && value !== key ? value : fallback;
    },
    [t],
  );

  const resolvedTitle =
    title ?? (tone === 'danger' ? tr('confirm.title', 'Confirm action') : tr('confirm.titlePrimary', 'Confirmation'));
  const resolvedDescription =
    description ?? tr('confirm.description', 'Are you sure you want to perform this action? This cannot be undone.');
  const resolvedConfirm =
    confirmLabel ?? (tone === 'danger' ? tr('common.delete', 'Delete') : tr('common.confirm', 'Confirm'));
  const resolvedCancel = cancelLabel ?? tr('common.cancel', 'Cancel');

  /* ── Type-to-confirm gate ───────────────────────────── */
  const requiresTyping = Boolean(confirmText && confirmText.trim().length > 0);
  const isMatch = useMemo(() => {
    if (!requiresTyping || !confirmText) return true;
    return typedValue.trim() === confirmText.trim();
  }, [requiresTyping, confirmText, typedValue]);

  /* ── Reset on open + initial focus ──────────────────── */
  useEffect(() => {
    if (!open) {
      setTypedValue('');
      setInternalLoading(false);
      setError(null);
      inFlightRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      if (requiresTyping && inputRef.current) {
        inputRef.current.focus();
      } else if (tone === 'danger' && cancelWrapRef.current) {
        cancelWrapRef.current.querySelector('button')?.focus();
      }
    }, 50);

    return () => window.clearTimeout(timer);
  }, [open, requiresTyping, tone]);

  /* ── Close is blocked while a confirm is in flight ──── */
  const handleSafeClose = useCallback(() => {
    if (isBusy || inFlightRef.current) return;
    sound.playPop?.();
    onClose();
  }, [isBusy, onClose, sound]);

  /* ── Async confirm: double-submit guard + caught errors ── */
  const handleExecuteConfirm = useCallback(async () => {
    if (isBusy || inFlightRef.current) return;

    if (!isMatch) {
      setShakeTrigger((prev) => prev + 1);
      inputRef.current?.focus();
      return;
    }

    if (tone === 'danger') {
      sound.playDelete?.();
    } else {
      sound.playTick?.();
    }
    setError(null);

    try {
      const maybePromise = onConfirm();
      if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
        inFlightRef.current = true;
        setInternalLoading(true);
        await maybePromise;
      }
    } catch (err) {
      // Caught here so a rejected promise never escapes as an unhandled rejection.
      console.error('[ConfirmDialog] onConfirm failed', err);
      sound.playError?.();
      setError(tr('confirm.failed', FAILURE_MESSAGE));
    } finally {
      inFlightRef.current = false;
      setInternalLoading(false);
    }
  }, [isBusy, isMatch, onConfirm, sound, tr, tone]);

  /* ── Power-user shortcut: ⌘/Ctrl + Enter ───────────── */
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleExecuteConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleExecuteConfirm]);

  return (
    <GlassModal
      open={open}
      onClose={handleSafeClose}
      title={resolvedTitle}
      footer={
        <div className="flex w-full items-center justify-between gap-3 sm:justify-end">
          <span
            aria-hidden="true"
            className="mr-auto hidden items-center gap-1.5 text-[11px] font-medium text-tertiary sm:inline-flex"
          >
            <kbd className="rounded-md border border-subtle bg-black/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-secondary dark:bg-white/[0.06]">
              Esc
            </kbd>
            <span>/</span>
            <kbd className="rounded-md border border-subtle bg-black/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-secondary dark:bg-white/[0.06]">
              ⌘↵
            </kbd>
          </span>

          <div ref={cancelWrapRef} className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <GlassButton className="w-full sm:w-auto" variant="secondary" onClick={handleSafeClose} disabled={isBusy}>
              {resolvedCancel}
            </GlassButton>
            <GlassButton
              className="w-full sm:w-auto"
              variant={toneStyle.buttonVariant}
              onClick={() => void handleExecuteConfirm()}
              loading={isBusy}
              disabled={isBusy || !isMatch}
            >
              {resolvedConfirm}
            </GlassButton>
          </div>
        </div>
      }
    >
      <div
        role="alertdialog"
        aria-describedby={hint ? `${descId} ${hintId}` : descId}
        aria-busy={isBusy}
        className="space-y-4"
      >
        {/* Tone emblem + question */}
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              toneStyle.tile,
            )}
          >
            <Icon name={toneStyle.icon} size={20} />
          </span>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  toneStyle.badge,
                )}
              >
                {tone === 'danger'
                  ? tr('confirm.badgeDanger', 'Irreversible action')
                  : tone === 'warning'
                    ? tr('confirm.badgeWarning', 'Warning')
                    : tr('confirm.badgePrimary', 'Confirmation')}
              </span>

              {itemName && (
                <span className="inline-flex max-w-[220px] truncate rounded-lg border border-subtle bg-black/[0.04] px-2 py-0.5 font-mono text-xs font-semibold text-primary dark:bg-white/[0.06]">
                  {itemName}
                </span>
              )}
            </div>

            <div id={descId} className="whitespace-pre-line text-sm leading-relaxed text-primary">
              {resolvedDescription}
            </div>
          </div>
        </div>

        {/* Secondary hint callout */}
        {hint && (
          <div
            id={hintId}
            className="flex items-start gap-2 rounded-xl border border-black/[0.06] bg-black/[0.02] px-3.5 py-2.5 text-xs leading-relaxed text-secondary dark:border-white/[0.08] dark:bg-white/[0.03]"
          >
            <Icon name="info" size={15} className="mt-px shrink-0" />
            <div className="min-w-0 flex-1">{hint}</div>
          </div>
        )}

        {/* Rejected onConfirm → inline alert (never an unhandled rejection) */}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-apple-red/30 bg-apple-red/10 px-3 py-2 text-xs font-medium text-apple-red"
          >
            {error}
          </p>
        )}

        {/* Type-to-confirm gate */}
        {requiresTyping && confirmText && (
          <motion.div
            key={shakeTrigger}
            initial={false}
            animate={shakeTrigger > 0 && !reduced ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.32 }}
            className="space-y-2 rounded-xl border border-black/[0.06] bg-black/[0.02] p-3.5 dark:border-white/[0.08] dark:bg-white/[0.03]"
          >
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={inputId} className="text-xs font-medium text-secondary">
                {tr('confirm.typePrompt', 'Type the phrase below to confirm:')}
              </label>

              <button
                type="button"
                onClick={() => {
                  setTypedValue(confirmText);
                  sound.playTick?.();
                  inputRef.current?.focus();
                }}
                disabled={isBusy}
                title={tr('confirm.clickToFill', 'Click to fill automatically')}
                className="inline-flex items-center rounded-lg border border-black/[0.08] bg-black/[0.04] px-2 py-0.5 font-mono text-xs font-semibold text-primary transition active:scale-[0.98] disabled:opacity-50 dark:border-white/[0.1] dark:bg-white/[0.06]"
              >
                {confirmText}
              </button>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                value={typedValue}
                onChange={(e) => setTypedValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isMatch) {
                    e.preventDefault();
                    void handleExecuteConfirm();
                  }
                }}
                disabled={isBusy}
                autoComplete="off"
                spellCheck={false}
                placeholder={confirmText}
                aria-invalid={!isMatch}
                className={cn(
                  'h-10 w-full rounded-xl border bg-white/70 dark:bg-white/[0.05] dark:focus:bg-surface-900/90 backdrop-blur-xl backdrop-saturate-150 px-3 pr-9 font-mono text-sm text-primary outline-none shadow-[inset_0_1px_1px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(0,0,0,0.2)]',
                  'transition-[border-color,box-shadow,background-color] duration-150 focus:border-focus',
                  'focus:shadow-[0_0_0_3px_var(--focus-ring)]',
                  isMatch
                    ? 'border-apple-green'
                    : 'border-black/[0.08] dark:border-white/[0.10]',
                )}
              />

              {isMatch && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-apple-green"
                >
                  <Icon name="check" size={16} strokeWidth={2.25} />
                </span>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </GlassModal>
  );
});

export default ConfirmDialog;
