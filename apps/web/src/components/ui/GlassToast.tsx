/**
 * GlassToast V2 — Toast notification system.
 *
 * Single global instance: any component can call `useToast()` and push a
 * toast; App.tsx renders <ToastHost /> once so toasts appear app-wide.
 *
 * Backward compatibility: pages historically used two shapes:
 * const { push } = useToast(); push('success', 'Saved')
 * const { success, error } = useToast(); success('Saved')
 * Both are supported.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useSafeI18n } from '@/i18n/I18nProvider';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

const ToastIcon: Record<ToastType, ReactNode> = {
  success: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
};

const TOAST_TYPE_COLOR: Record<ToastType, string> = {
  success: 'text-[var(--success)]',
  error:   'text-[var(--danger)]',
  warning: 'text-[var(--warning)]',
  info:    'text-[var(--info)]',
};

const TOAST_TYPE_BG: Record<ToastType, string> = {
  success: 'border-l-[var(--success)]',
  error:   'border-l-[var(--danger)]',
  warning: 'border-l-[var(--warning)]',
  info:    'border-l-[var(--info)]',
};

/* ── Global toast store ─────────────────────────────────────── */
type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let seq = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

function addToast(t: Omit<ToastItem, 'id'>) {
  const id = `toast-${++seq}`;
  toasts = [...toasts, { ...t, id }];
  emit();
  setTimeout(() => removeToast(id), 5000);
  return id;
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function setToastContext(_fn: (t: Omit<ToastItem, 'id'>) => void) {
  void _fn;
}

export interface UseToastResult {
  push: (
    typeOrObject: ToastType | { type: ToastType; message: string; title?: string },
    titleOrMessage?: string,
    description?: string,
  ) => string | void;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  toastNode: null;
}

function normalizePush(
  typeOrObject: ToastType | { type: ToastType; message: string; title?: string },
  titleOrMessage?: string,
  description?: string,
): string {
  if (typeof typeOrObject === 'object' && typeOrObject !== null) {
    const { type, message, title } = typeOrObject;
    return addToast({ type, title: title ?? message, description });
  }
  return addToast({ type: typeOrObject, title: titleOrMessage ?? '', description });
}

export function useToast(): UseToastResult {
  return {
    push: normalizePush,
    success: (title, description) => addToast({ type: 'success', title, description }),
    error:   (title, description) => addToast({ type: 'error',   title, description }),
    warning: (title, description) => addToast({ type: 'warning', title, description }),
    info:    (title, description) => addToast({ type: 'info',    title, description }),
    toastNode: null,
  };
}

/* ── Rendering ──────────────────────────────────────────────── */
export function ToastItemView({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: (id: string) => void;
}) {
  const { t } = useSafeI18n();
  return (
    <div
      className={[
        'flex items-start gap-3',
        'w-full min-w-[18rem] max-w-sm',
        'bg-[var(--bg-card)]',
        'backdrop-blur-[20px] [-webkit-backdrop-filter:blur(20px)_saturate(1.5)]',
        'border border-[var(--border)] border-l-4',
        TOAST_TYPE_BG[toast.type],
        'rounded-[var(--radius-lg)]',
        'shadow-[var(--shadow-lg)]',
        'px-4 py-3.5',
      ].join(' ')}
      style={{ animation: 'slide-up var(--duration-normal) var(--ease-enter) both' }}
      role="alert"
      aria-live="assertive"
    >
      <span className={['flex-shrink-0 mt-0.5', TOAST_TYPE_COLOR[toast.type]].join(' ')}>
        {ToastIcon[toast.type]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[var(--text-body-sm)] font-semibold text-[var(--text-primary)] leading-snug">
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-[var(--text-caption)] text-[var(--text-secondary)] mt-0.5 leading-snug">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className={[
          'flex-shrink-0 mt-0.5',
          'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
          'transition-colors duration-[var(--duration-fast)]',
          'p-1 rounded-[var(--radius-sm)]',
          'focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]',
        ].join(' ')}
        aria-label={t('a11y.dismiss')}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/** Render all global toasts. Mount ONCE in App.tsx. */
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>(toasts);
  const { t } = useSafeI18n();

  useEffect(() => {
    const listener: Listener = (next) => setItems(next);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 flex flex-col gap-3"
      style={{ zIndex: 'var(--z-toast)' } as React.CSSProperties}
      aria-label={t('a11y.notifications')}
    >
      {items.map((item) => (
        <ToastItemView key={item.id} toast={item} onClose={removeToast} />
      ))}
    </div>
  );
}

/** @deprecated No-op: ToastHost in App.tsx renders toasts globally. */
export function ToastContainer(_props: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  return null;
}

export type { ToastItem };
export default ToastItemView;
