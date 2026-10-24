/**
 * GlassModal — Apple-premium dialog.
 *
 * Portal · focus trap · Escape · scroll lock · focus restore.
 * Restrained surface: card token + hairline border + `shadow-modal`,
 * backdrop `bg-black/40 backdrop-blur-sm`, entrance `animate-modal-in`.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn, usePrefersReducedMotion } from '@/lib/design';
import { GlassButton } from './GlassButton';
import { useSafeI18n } from '@/i18n/I18nProvider';

/* ─────────────────────────────────────────────────────────────
 * Public types
 * ───────────────────────────────────────────────────────────── */

export type GlassModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: GlassModalSize;
  /** @deprecated use size="lg" (kept as an alias) */
  wide?: boolean;
  /** Prevent closing on backdrop click. */
  persistent?: boolean;
  /** @deprecated no-op — the surface no longer renders an SVG filter. */
  disableRefraction?: boolean;
  /** Extra class for the panel. */
  className?: string;
}

const SIZE_CLASSES: Record<GlassModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[calc(100vw-2rem)]',
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* ─────────────────────────────────────────────────────────────
 * GlassModal
 * ───────────────────────────────────────────────────────────── */

export function GlassModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size: sizeProp,
  wide,
  persistent = false,
  className,
}: GlassModalProps) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const size: GlassModalSize = sizeProp ?? (wide ? 'lg' : 'md');

  /* ── Body scroll lock ──────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /* ── Focus trap + Escape + focus restore ───────────── */
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const el = dialogRef.current;
    if (!el) return;

    const focusables = () =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Never steal focus if focus is already inside the modal (e.g. typing in an input).
    // On open, prefer the first editable input/textarea instead of the close 'X' button.
    if (!el.contains(document.activeElement)) {
      const formInput = el.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
      );
      const closeLabel = t('a11y.closeModal', 'Close modal');
      const nonClose = focusables().find((b) => b.getAttribute('aria-label') !== closeLabel);
      const target = formInput ?? nonClose ?? focusables()[0];
      target?.focus();
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) {
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (active && !el.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      prevFocus.current?.focus();
    };
  }, [open, persistent]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex items-end justify-center p-3',
        'pt-[max(0.75rem,env(safe-area-inset-top,0px))]',
        'pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]',
        'sm:items-center sm:p-4',
        'z-[var(--z-modal,1000)]',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : 'Dialog'}
      aria-describedby={description ? descriptionId : undefined}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 bg-black/40 backdrop-blur-md backdrop-saturate-150',
          !reduced && 'animate-overlay-in',
        )}
        onClick={persistent ? undefined : onClose}
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className={cn(
          'relative z-10 flex max-h-[min(88dvh,100%)] w-full min-w-0 flex-col overflow-hidden',
          'rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/85 dark:bg-surface-900/85 backdrop-blur-2xl backdrop-saturate-150 shadow-modal shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
          'text-primary outline-none',
          !reduced && 'animate-modal-in',
          SIZE_CLASSES[size],
          className,
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] px-5 pt-5 pb-4 sm:px-6">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-base font-semibold leading-snug tracking-tight text-primary"
              >
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-secondary">
                  {description}
                </p>
              )}
            </div>
            <GlassButton
              type="button"
              tabIndex={-1}
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label={t('a11y.closeModal', 'Close modal')}
              className="flex-shrink-0"
            >
              <svg
                aria-hidden="true"
                focusable="false"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </GlassButton>
          </div>
        )}

        {/* Body */}
        <div
          className={cn(
            'min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6',
            title ? 'pb-5' : 'py-5 sm:py-6',
          )}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2 border-t border-black/[0.06] dark:border-white/[0.08] px-5 py-4 sm:gap-3 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default GlassModal;
