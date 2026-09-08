/**
 * GlassToast — Toast notification system.
 *
 * Single global instance: any component can call `useToast()` and push a
 * toast; App.tsx renders <ToastHost /> once so toasts appear app-wide.
 *
 * Backward compatibility: pages historically used two shapes —
 *   const { push } = useToast();          push('success', 'Saved')
 *   const { success, error } = useToast(); success('Saved')
 * Both are supported.
 */
import { useEffect, useState, type ReactNode } from 'react';

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
      <circle cx="12" cy="12" r="10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="10"/>
      <path d="M15 9l-6 6M9 9l6 6"/>
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
      <path d="M12 9v4M12 17h.01"/>
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>
  ),
};

const TOAST_TYPE_COLOR: Record<ToastType, string> = {
  success: 'text-[var(--state-success)]',
  error:   'text-[var(--state-error)]',
  warning: 'text-[var(--state-warning)]',
  info:    'text-brand-700',
};

/* ────────────────────────────────────────────────────────────────────────
 * Global toast store — module-level so any component can push without
 * prop-drilling, and a single <ToastHost /> renders them.
 * ──────────────────────────────────────────────────────────────────────── */
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
  // Auto-dismiss after 5s
  setTimeout(() => removeToast(id), 5000);
  return id;
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/**
 * Legacy hook point kept for compatibility: legacy pages rendered
 * `{toastNode}` themselves. With the global store, ToastHost in App.tsx
 * renders everything, so this returns null — harmless.
 */
export function setToastContext(_fn: (t: Omit<ToastItem, 'id'>) => void) {
  // No-op: the global store replaced the context approach. Kept so any
  // legacy import keeps compiling.
  void _fn;
}

export interface UseToastResult {
  /** Legacy shape: push('success', 'Saved') or push({ type: 'success', message: 'Saved' }) */
  push: (
    typeOrObject: ToastType | { type: ToastType; message: string; title?: string },
    titleOrMessage?: string,
    description?: string,
  ) => string | void;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  /**
   * Legacy pages rendered `{toastNode}` inline. Toasts are now rendered by
   * the global <ToastHost />, so this is always null — kept so destructuring
   * `const { push, toastNode } = useToast()` keeps working.
   */
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
    error: (title, description) => addToast({ type: 'error', title, description }),
    warning: (title, description) => addToast({ type: 'warning', title, description }),
    info: (title, description) => addToast({ type: 'info', title, description }),
    toastNode: null,
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * Rendering
 * ──────────────────────────────────────────────────────────────────────── */
export function ToastItemView({ toast, onClose }: { toast: ToastItem; onClose: (id: string) => void }) {
  return (
    <div
      className={[
        'flex items-start gap-3',
        'w-full max-w-sm',
        'bg-[var(--bg-card)]',
        'backdrop-blur-2xl',
        'border border-[var(--border-glass)]',
        'rounded-2xl',
        'shadow-[var(--shadow-lg)]',
        'px-4 py-3.5',
        'animate-[slide-up_0.3s_cubic-bezier(.25,.46,.45,.94)_forwards]',
      ].join(' ')}
      role="alert"
      aria-live="assertive"
    >
      <span className={['flex-shrink-0 mt-0.5', TOAST_TYPE_COLOR[toast.type]].join(' ')}>
        {ToastIcon[toast.type]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5 rounded-lg"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}

/** Render all global toasts. Mount ONCE in App.tsx. */
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    const listener: Listener = (next) => setItems(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[300] flex flex-col gap-3"
      aria-label="Notifications"
    >
      {items.map((t) => (
        <ToastItemView key={t.id} toast={t} onClose={removeToast} />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Backward-compat exports
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * @deprecated Use <ToastHost /> in App.tsx instead. Kept because some
 * legacy pages render <ToastContainer toasts={[]} onRemove={() => {}} /> —
 * with the global store this renders nothing extra.
 */
export function ToastContainer(_props: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  return null;
}

export type { ToastItem };

export default ToastItemView;
