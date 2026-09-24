/**
 * GlassModal V2 — Focus-trapped modal with V2 animation and size system.
 * Sizes: sm | md | lg | xl | full
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GlassButton } from './GlassButton';
import { useSafeI18n } from '@/i18n/I18nProvider';

export type GlassModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: GlassModalSize;
  /** @deprecated use size="lg" */
  wide?: boolean;
  /** Prevent closing on backdrop click */
  persistent?: boolean;
}

const SIZE_CLASSES: Record<GlassModalSize, string> = {
  sm:   'max-w-sm',
  md:   'max-w-lg',
  lg:   'max-w-2xl',
  xl:   'max-w-4xl',
  full: 'max-w-[calc(100vw-2rem)]',
};

const CloseIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

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
}: GlassModalProps) {
  const { t } = useSafeI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  // Resolve size
  const size: GlassModalSize = sizeProp ?? (wide ? 'lg' : 'md');

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, [open]);

  // Focus trap + Escape
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = Array.from(
      el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    focusable[0]?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) { onClose(); return; }
      if (e.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      prevFocus.current?.focus();
    };
  }, [open, onClose, persistent]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 'var(--z-modal)' } as React.CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-[4px] [-webkit-backdrop-filter:blur(4px)]"
        style={{ animation: 'overlay-in var(--duration-normal) var(--ease-enter) both' }}
        aria-hidden
        onClick={!persistent ? onClose : undefined}
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className={[
          'relative z-10 w-full',
          SIZE_CLASSES[size],
          'bg-[var(--bg-card)]',
          'backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)_saturate(1.6)]',
          'border border-[var(--border)]',
          'rounded-[var(--radius-2xl)]',
          'shadow-[var(--shadow-xl)]',
          'max-h-[90dvh] flex flex-col',
        ].join(' ')}
        style={{ animation: 'modal-in var(--duration-slow) var(--ease-enter) both' }}
      >
        {/* Reflection */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] z-0"
          style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.12) 0%, transparent 50%)' }}
        />

        {/* Header */}
        {title && (
          <div className="relative flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0">
            <div>
              <h2 id="modal-title" className="text-[var(--text-h3)] font-semibold text-[var(--text-primary)] leading-tight">
                {title}
              </h2>
              {description && (
                <p id="modal-description" className="mt-1 text-[var(--text-body-sm)] text-[var(--text-secondary)]">
                  {description}
                </p>
              )}
            </div>
            <GlassButton
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label={t('a11y.closeModal')}
              className="flex-shrink-0 ml-4"
            >
              <CloseIcon />
            </GlassButton>
          </div>
        )}

        {/* Body */}
        <div className={['relative overflow-y-auto flex-1', title ? 'px-6 pb-4' : 'px-6 py-6'].join(' ')}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="relative flex items-center justify-end gap-3 px-6 pb-6 pt-2 flex-shrink-0 border-t border-[var(--border-subtle)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default GlassModal;
