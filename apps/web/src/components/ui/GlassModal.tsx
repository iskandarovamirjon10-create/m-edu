/**
 * GlassModal — Focus-trapped modal with glass aesthetic.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { GlassButton } from './GlassButton';

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function GlassModal({ open, onClose, title, children, footer, wide }: GlassModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      prevFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[rgba(15,25,45,0.50)] backdrop-blur-sm animate-[fade-in_0.2s_ease_forwards]"
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className={[
          'relative z-10 w-full',
          'bg-[var(--bg-card)]',
          'backdrop-blur-[28px] backdrop-saturate-[1.7]',
          'border border-[var(--border-glass)]',
          'rounded-3xl shadow-[var(--shadow-lg)]',
          'max-h-[90dvh] overflow-y-auto',
          'animate-[scale-in_0.28s_cubic-bezier(.25,.46,.45,.94)_forwards]',
        ].join(' ')}
        style={{ maxWidth: wide ? '680px' : '520px' }}
      >
        {/* Reflection sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.26) 0%, transparent 42%, rgba(148,234,239,0.04) 100%)',
          }}
        />

        {/* Header */}
        {title && (
          <div className="relative flex items-center justify-between px-6 pt-6 pb-0">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
            <GlassButton
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close modal"
              className="!p-1.5"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </GlassButton>
          </div>
        )}

        {/* Body */}
        <div className="relative px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="relative flex items-center justify-end gap-3 px-6 pb-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default GlassModal;
