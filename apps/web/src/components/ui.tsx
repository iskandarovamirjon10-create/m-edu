/**
 * M-EDU UI — Backward-compatible barrel re-export
 * Existing pages import from '@/components/ui'. We re-export the
 * new glass components and a few legacy helpers so nothing breaks
 * during migration.
 */
import { type ReactNode, forwardRef } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

// Re-export new glass library (preferred)
export * from './ui/index';

// ==================== Legacy aliases (back-compat) ====================
export { GlassButton as Button } from './ui/index';
export { GlassInput as Input } from './ui/index';
export { GlassTextArea as TextAreaNew } from './ui/index';
export { GlassSelect as SelectNew } from './ui/index';
export { GlassModal as ModalNew } from './ui/index';
export { GlassTable as Table, GlassTHead as THead, GlassTBody as TBody, GlassTR as TR, GlassTH as TH, GlassTD as TD } from './ui/index';
export { GlassCard as Card } from './ui/index';
export { GlassStatCard as StatCard } from './ui/index';
export { GlassPageHeader as PageHeader } from './ui/index';
export { GlassEmptyState as EmptyState } from './ui/index';
export { GlassErrorState as ErrorState } from './ui/index';
export { GlassSpinner as Spinner } from './ui/index';
export { GlassPageLoader as PageLoader } from './ui/index';
export { GlassBadge as Badge } from './ui/index';
export { GlassAvatar as Avatar } from './ui/index';
export { GlassTabs as Tabs } from './ui/index';

// ==================== Legacy aliases (back-compat) ====================
export { GlassPagination as Pagination } from './ui/index';
export { GlassField as Field } from './ui/index';
export { GlassSwitch as Switch } from './ui/index';

// ==================== Legacy TextInput / TextArea / Select ====================
// forwardRef so pages can attach refs (e.g. autofocus on the search page).
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput(props, ref) {
  const { className = '', ...rest } = props;
  return (
    <input
      ref={ref}
      className={[
        'w-full px-4 py-2.5',
        'bg-[var(--bg-glass)] backdrop-blur-xl',
        'border border-[var(--border-medium)] rounded-xl',
        'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
        'font-sans text-[0.9375rem] outline-none',
        'transition-[border-color,box-shadow] duration-200',
        'hover:border-[var(--border-strong)]',
        'focus:border-brand-700 focus:shadow-[0_0_0_3px_rgba(84,115,252,0.18)]',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        className,
      ].join(' ')}
      {...rest}
    />
  );
  },
);

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return (
    <textarea
      className={[
        'w-full px-4 py-2.5 min-h-[100px] resize-y',
        'bg-[var(--bg-glass)] backdrop-blur-xl',
        'border border-[var(--border-medium)] rounded-xl',
        'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
        'font-sans text-[0.9375rem] outline-none',
        'transition-[border-color,box-shadow] duration-200',
        'hover:border-[var(--border-strong)]',
        'focus:border-brand-700 focus:shadow-[0_0_0_3px_rgba(84,115,252,0.18)]',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        className,
      ].join(' ')}
      {...rest}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props;
  return (
    <select
      className={[
        'w-full px-4 py-2.5 pr-10',
        'bg-[var(--bg-glass)] backdrop-blur-xl',
        'border border-[var(--border-medium)] rounded-xl',
        'text-[var(--text-primary)] font-sans text-[0.9375rem] outline-none cursor-pointer',
        'appearance-none',
        'transition-[border-color,box-shadow] duration-200',
        'hover:border-[var(--border-strong)]',
        'focus:border-brand-700 focus:shadow-[0_0_0_3px_rgba(84,115,252,0.18)]',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        className,
      ].join(' ')}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238899A8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

// ==================== Legacy Modal ====================
// Accepts both `open` and the legacy `isOpen` prop name.
export function Modal({
  open: openProp,
  isOpen,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open?: boolean;
  /** Legacy alias for `open`. */
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const open = openProp ?? isOpen ?? false;
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    modalRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(15,25,45,0.50)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={[
          'relative w-full',
          'bg-[var(--bg-card)] backdrop-blur-2xl',
          'border border-[var(--border-glass)] rounded-3xl',
          'shadow-[var(--shadow-lg)]',
          'max-h-[90vh] overflow-y-auto',
          'animate-[scale-in_0.25s_cubic-bezier(.25,.46,.45,.94)_forwards]',
          wide ? 'max-w-3xl' : 'max-w-lg',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--state-hover)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Legacy Pagination ====================
// (moved to ui/GlassPagination.tsx)

// ==================== Legacy statusColor ====================
export function statusColor(status: string | null | undefined): 'success' | 'error' | 'warning' | 'primary' | 'muted' {
  if (!status) return 'muted';
  const s = status.toUpperCase();
  if (['ACTIVE', 'PAID', 'PRESENT', 'WON', 'ACTIVATED', 'PASSED', 'SUCCESS', 'IDENTIFIED', 'MATCH_FOUND', 'CONFIRMED'].some(k => s.includes(k))) return 'success';
  if (['INACTIVE', 'REVOKED', 'CANCELLED', 'ABSENT', 'LOST', 'FAILED', 'ERROR', 'REJECTED', 'UNIDENTIFIED', 'OVERDUE', 'SPOOF', 'BLOCKED'].some(k => s.includes(k))) return 'error';
  if (['PENDING', 'LATE', 'CONTACTED', 'TRIAL', 'UNCERTAIN', 'STARTED'].some(k => s.includes(k))) return 'warning';
  return 'primary';
}

// ==================== Legacy useToasts ====================
interface LegacyToast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}
let legacyToastCounter = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<LegacyToast[]>([]);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (
      kindOrObject: LegacyToast['kind'] | { type: LegacyToast['kind']; message: string; title?: string },
      messageArg?: string,
    ) => {
      const id = ++legacyToastCounter;
      // Both call shapes are supported:
      //   push('success', 'Saved')           — legacy positional
      //   push({ type: 'success', message }) — object form
      const kind = typeof kindOrObject === 'object' && kindOrObject !== null ? kindOrObject.type : kindOrObject;
      const message = typeof kindOrObject === 'object' && kindOrObject !== null ? kindOrObject.message : (messageArg ?? '');
      setToasts((prev) => [...prev, { id, kind, message }]);
      timers.current.push(window.setTimeout(() => dismiss(id), 5000));
    },
    [dismiss],
  );

  useEffect(() => () => {
    timers.current.forEach((t) => window.clearTimeout(t));
  }, []);

  const toastNode = toasts.length > 0 && (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            'pointer-events-auto flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm shadow-[var(--shadow-lg)]',
            'bg-[var(--bg-card)] backdrop-blur-2xl border border-[var(--border-glass)]',
            'animate-[slide-up_0.3s_cubic-bezier(.25,.46,.45,.94)_forwards]',
            toast.kind === 'success' ? 'text-emerald-700' :
            toast.kind === 'error'   ? 'text-red-600' :
            'text-[var(--text-primary)]',
          ].join(' ')}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );

  return { push, toastNode };
}
