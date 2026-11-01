/**
 * GlassToast — Apple-premium toast system.
 *
 * Module-level store + subscribe, portal host per position, auto-dismiss
 * timers, progress bar, maxVisible with overflow counter.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn, usePrefersReducedMotion } from '@/lib/design';
import { useSafeI18n } from '@/i18n/I18nProvider';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  /** Auto-dismiss duration in ms (0 disables). Defaults to 5000. */
  duration?: number;
}

const TYPE_FG: Record<ToastType, string> = {
  success: 'var(--success)',
  error: 'var(--danger)',
  warning: 'var(--warning)',
  info: 'var(--info)',
};

const ICONS: Record<ToastType, ReactNode> = {
  success: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  error: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  warning: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  info: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
};

const CloseIcon = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/* ── Module-level store ─────────────────────────────────────── */

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let seq = 0;
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const l of listeners) l(toasts);
}

function addToast(t: Omit<ToastItem, 'id'>): string {
  const id = `toast-${++seq}`;
  toasts = [...toasts, { ...t, id }];
  emit();

  const duration = t.duration ?? 5000;
  if (duration > 0) {
    timers.set(id, setTimeout(() => removeToast(id), duration));
  }
  return id;
}

function removeToast(id: string) {
  if (!toasts.some((t) => t.id === id)) return;
  const handle = timers.get(id);
  if (handle) {
    clearTimeout(handle);
    timers.delete(id);
  }
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** @deprecated No-op — kept for API compatibility. */
export function setToastContext(_fn: (t: Omit<ToastItem, 'id'>) => void) {
  void _fn;
}

/* ── Hook ───────────────────────────────────────────────────── */

export interface UseToastResult {
  push: (
    typeOrObject:
      | ToastType
      | { type: ToastType; message: string; title?: string; duration?: number },
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
  typeOrObject:
    | ToastType
    | { type: ToastType; message: string; title?: string; duration?: number },
  titleOrMessage?: string,
  description?: string,
): string {
  if (typeof typeOrObject === 'object' && typeOrObject !== null) {
    const { type, message, title, duration } = typeOrObject;
    return addToast({ type, title: title ?? message, description, duration });
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

/* ── ToastItemView ──────────────────────────────────────────── */

export interface ToastItemViewProps {
  toast: ToastItem;
  onClose: (id: string) => void;
  /** @deprecated no-op */
  disableRefraction?: boolean;
  /** @deprecated no-op */
  disableMotion?: boolean;
  /** Kept for API parity — toggles the auto-dismiss progress bar. */
  autoProgress?: boolean;
}

export function ToastItemView({
  toast,
  onClose,
  autoProgress = true,
}: ToastItemViewProps) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();
  const duration = toast.duration ?? 5000;

  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(100);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = () => {
    if (leaving) return;
    setLeaving(true);
    leaveTimer.current = setTimeout(() => onClose(toast.id), reduced ? 0 : 200);
  };

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  const showProgress = autoProgress && duration > 0 && !reduced;
  useEffect(() => {
    if (!showProgress) return;
    const raf = requestAnimationFrame(() => setProgress(0));
    return () => cancelAnimationFrame(raf);
  }, [showProgress]);

  return (
    <div
      data-component="glass-toast"
      data-type={toast.type}
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={cn(
        'bg-white/90 dark:bg-surface-900/90 backdrop-blur-2xl backdrop-saturate-150 border border-black/[0.08] dark:border-white/[0.12] shadow-dropdown shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] rounded-2xl px-4 py-3',
        'relative flex w-full min-w-0 max-w-[calc(100vw-2rem)] sm:min-w-[18rem] sm:max-w-sm items-start gap-3 overflow-hidden box-border',
        reduced
          ? 'animate-none'
          : leaving
            ? 'opacity-0 transition-opacity duration-200'
            : 'animate-slide-up',
      )}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center"
        style={{ color: TYPE_FG[toast.type] }}
      >
        {ICONS[toast.type]}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-primary">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-snug text-secondary">{toast.description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={handleClose}
        className="flex h-7 w-7 sm:h-6 sm:w-6 min-h-[28px] min-w-[28px] flex-shrink-0 items-center justify-center rounded-lg text-tertiary transition-colors duration-150 hover:bg-black/[0.04] hover:text-secondary dark:hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label={t('a11y.dismiss') || 'Dismiss'}
      >
        <CloseIcon />
      </button>

      {showProgress && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5"
          style={{
            width: `${progress}%`,
            background: TYPE_FG[toast.type],
            transition: `width ${duration}ms linear`,
          }}
        />
      )}
    </div>
  );
}

/* ── ToastHost ──────────────────────────────────────────────── */

export interface ToastHostProps {
  /** Screen corner. Default `bottom-right`. */
  position?: ToastPosition;
  /** Max simultaneous visible toasts. Extras collapse into a counter. */
  maxVisible?: number;
  /** @deprecated no-op */
  disableRefraction?: boolean;
  /** @deprecated no-op */
  disableMotion?: boolean;
}

const POSITIONS: Record<ToastPosition, string> = {
  'top-right': 'top-4 sm:top-6 right-4 sm:right-6 items-end',
  'top-left': 'top-4 sm:top-6 left-4 sm:left-6 items-start',
  'bottom-right': 'bottom-4 sm:bottom-6 right-4 sm:right-6 items-end',
  'bottom-left': 'bottom-4 sm:bottom-6 left-4 sm:left-6 items-start',
  'top-center': 'top-4 sm:top-6 left-1/2 -translate-x-1/2 items-center',
  'bottom-center': 'bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 items-center',
};

export function ToastHost({
  position = 'bottom-right',
  maxVisible = 4,
}: ToastHostProps = {}) {
  const [items, setItems] = useState<ToastItem[]>(toasts);
  const { t } = useSafeI18n();

  useEffect(() => {
    const listener: Listener = (next) => setItems(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (items.length === 0 || typeof document === 'undefined') return null;

  const visible = items.slice(0, maxVisible);
  const overflow = items.length - visible.length;

  return createPortal(
    <div
      data-component="glass-toast-host"
      role="region"
      aria-label={t('a11y.notifications') || 'Notifications'}
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'pointer-events-none fixed z-[var(--z-toast,2000)] flex flex-col gap-3',
        POSITIONS[position],
      )}
    >
      {overflow > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-auto inline-flex items-center justify-center rounded-full border border-subtle bg-card px-2.5 py-1 text-[11px] font-medium tabular-nums text-secondary shadow-card"
        >
          +{overflow}
        </span>
      )}
      {visible.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastItemView toast={item} onClose={removeToast} />
        </div>
      ))}
    </div>,
    document.body,
  );
}

/** @deprecated No-op: <ToastHost /> in App.tsx renders toasts globally. */
export function ToastContainer(_props: {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}) {
  return null;
}

export default ToastItemView;
