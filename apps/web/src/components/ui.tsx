/**
 * M-EDU UI — Backward-compatible barrel re-export
 * Existing pages import from'@/components/ui'. We re-export the
 * new glass components and a few legacy helpers so nothing breaks
 * during migration.
 */
import { type ReactNode, forwardRef} from'react';
import { useEffect, useRef, useCallback} from'react';
import { createPortal } from 'react-dom';
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes} from'react';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { useToast } from './ui/GlassToast';

// Re-export new glass library (preferred)
export * from'./ui/index';

// ==================== Legacy aliases (back-compat) ====================
export { GlassButton as Button} from'./ui/index';
export { GlassInput as Input} from'./ui/index';
export { GlassTextArea as TextAreaNew} from'./ui/index';
export { GlassSelect as SelectNew} from'./ui/index';
export { GlassModal as ModalNew} from'./ui/index';
export { GlassTable as Table, GlassTHead as THead, GlassTBody as TBody, GlassTR as TR, GlassTH as TH, GlassTD as TD} from'./ui/index';
export { GlassCard as Card} from'./ui/index';
export { GlassStatCard as StatCard} from'./ui/index';
export { GlassPageHeader as PageHeader} from'./ui/index';
export { GlassEmptyState as EmptyState} from'./ui/index';
export { GlassErrorState as ErrorState} from'./ui/index';
export { GlassSpinner as Spinner} from'./ui/index';
export { GlassPageLoader as PageLoader} from'./ui/index';
export { GlassBadge as Badge} from'./ui/index';
export { GlassAvatar as Avatar} from'./ui/index';
export { GlassTabs as Tabs} from'./ui/index';

// ==================== Legacy aliases (back-compat) ====================
export { GlassPagination as Pagination} from'./ui/index';
export { GlassField as Field} from'./ui/index';
export { GlassSwitch as Switch} from'./ui/index';

// ==================== Legacy TextInput / TextArea / Select ====================
// forwardRef so pages can attach refs (e.g. autofocus on the search page).
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
 function TextInput(props, ref) {
 const { className ='', ...rest} = props;
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
        'focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)]',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        className,
      ].filter(Boolean).join(' ')}
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
        'focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)]',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        className,
      ].filter(Boolean).join(' ')}
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
        'focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)]',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        className,
      ].filter(Boolean).join(' ')}
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
  const { t } = useSafeI18n();

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    modalRef.current?.focus();

 const onKey = (e: KeyboardEvent) => {
 if (e.key ==='Escape') onClose();
 if (e.key ==='Tab' && modalRef.current) {
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

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[rgba(15,25,45,0.50)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={[
          'relative w-full',
          'bg-[var(--bg-card)] backdrop-blur-md',
          'border border-[var(--border-glass)] rounded-2xl',
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
            aria-label={t('a11y.closeDialog')}
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
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
    </div>,
    document.body
  );
}

// ==================== Legacy Pagination ====================
// (moved to ui/GlassPagination.tsx)

// ==================== Legacy statusColor ====================
export function statusColor(status: string | null | undefined):'success' |'error' |'warning' |'primary' |'muted' {
 if (!status) return'muted';
 const s = status.toUpperCase();
 if (['ACTIVE','PAID','PRESENT','WON','ACTIVATED','PASSED','SUCCESS','IDENTIFIED','MATCH_FOUND','CONFIRMED'].some(k => s.includes(k))) return'success';
 if (['INACTIVE','REVOKED','CANCELLED','ABSENT','LOST','FAILED','ERROR','REJECTED','UNIDENTIFIED','OVERDUE','SPOOF','BLOCKED'].some(k => s.includes(k))) return'error';
 if (['PENDING','LATE','CONTACTED','TRIAL','UNCERTAIN','STARTED'].some(k => s.includes(k))) return'warning';
 return'primary';
}

// ==================== Legacy useToasts ====================
interface LegacyToast {
 id: number;
 kind:'success' |'error' |'info';
 message: string;
}


export function useToasts() {
  const globalToast = useToast();

  const push = useCallback(
    (
      kindOrObject: LegacyToast['kind'] | { type: LegacyToast['kind']; message: string; title?: string },
      messageArg?: string,
    ) => {
      let type: 'success' | 'error' | 'warning' | 'info' = 'info';
      let message = '';
      let title = '';

      if (typeof kindOrObject === 'object' && kindOrObject !== null) {
        type = kindOrObject.type === 'error' ? 'error' : kindOrObject.type === 'success' ? 'success' : 'info';
        message = kindOrObject.message;
        title = kindOrObject.title || message;
      } else {
        type = kindOrObject === 'error' ? 'error' : kindOrObject === 'success' ? 'success' : 'info';
        message = messageArg || '';
        title = message;
      }

      globalToast.push(type, title);
    },
    [globalToast]
  );

  return { push, toastNode: null };
}




export { AuroraMesh, type AuroraMeshProps, type AuroraVariant } from './ui/AuroraMesh';
