/**
 * GlassEmptyState — Premium empty / error / not-found / permission states.
 *
 * Single-file, production-grade, backward-compatible with V2.
 */
import {
  forwardRef,
  useMemo,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { GlassButton } from './GlassButton';
import { useSafeI18n } from '@/i18n/I18nProvider';

/* ─────────────────────────────────────────────────────────────
 * Utilities
 * ───────────────────────────────────────────────────────────── */

type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue): void => {
    if (!v) return;
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') {
      for (const k in v) if (v[k]) out.push(k);
    }
  };
  inputs.forEach(walk);
  return out.join(' ');
}

/* ─────────────────────────────────────────────────────────────
 * Shared types
 * ───────────────────────────────────────────────────────────── */

export type EmptyStateTone =
  | 'neutral'
  | 'primary'
  | 'danger'
  | 'warning'
  | 'success';

export type EmptyStateSize = 'sm' | 'md' | 'lg';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

interface BaseStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: string;
  description?: string;
  /** Alias for `description` (V2 compatibility). */
  message?: string;
  icon?: ReactNode;
  action?: EmptyStateAction | ReactNode;
  /** Optional secondary action rendered next to `action`. */
  secondaryAction?: EmptyStateAction | ReactNode;
  tone?: EmptyStateTone;
  size?: EmptyStateSize;
  /** Extra class for the icon container. */
  iconClassName?: string;
  /** Extra class for the title element. */
  titleClassName?: string;
  /** Extra class for the description element. */
  descriptionClassName?: string;
}

/* ─────────────────────────────────────────────────────────────
 * Token maps
 * ───────────────────────────────────────────────────────────── */

const TONE_STYLES: Record<
  EmptyStateTone,
  { container: string; icon: string }
> = {
  neutral: {
    container: 'bg-[var(--surface-soft,rgba(0,0,0,0.04))]',
    icon: 'bg-[var(--surface-soft,rgba(0,0,0,0.04))] text-[var(--text-secondary,#4b5563)]',
  },
  primary: {
    container: 'bg-[var(--primary-soft,rgba(99,102,241,0.12))]',
    icon: 'bg-[var(--primary-soft,rgba(99,102,241,0.12))] text-[var(--primary,#6366f1)]',
  },
  danger: {
    container: 'bg-[var(--danger-soft,rgba(239,68,68,0.12))]',
    icon: 'bg-[var(--danger-soft,rgba(239,68,68,0.12))] text-[var(--danger,#ef4444)]',
  },
  warning: {
    container: 'bg-[var(--warning-soft,rgba(245,158,11,0.14))]',
    icon: 'bg-[var(--warning-soft,rgba(245,158,11,0.14))] text-[var(--warning,#f59e0b)]',
  },
  success: {
    container: 'bg-[var(--success-soft,rgba(16,185,129,0.14))]',
    icon: 'bg-[var(--success-soft,rgba(16,185,129,0.14))] text-[var(--success,#10b981)]',
  },
};

const SIZE_STYLES: Record<
  EmptyStateSize,
  {
    root: string;
    icon: string;
    iconInner: string;
    title: string;
    description: string;
    stack: string;
  }
> = {
  sm: {
    root: 'py-10 px-4 gap-3',
    icon: 'w-10 h-10 rounded-[var(--radius-lg,12px)]',
    iconInner: 'w-5 h-5',
    title: 'text-[length:var(--text-body,0.9375rem)]',
    description: 'text-[length:var(--text-caption,0.8125rem)]',
    stack: 'max-w-[16rem] gap-1',
  },
  md: {
    root: 'py-16 px-6 gap-4',
    icon: 'w-14 h-14 rounded-[var(--radius-xl,16px)]',
    iconInner: 'w-7 h-7',
    title: 'text-[length:var(--text-h4,1.125rem)]',
    description: 'text-[length:var(--text-body-sm,0.875rem)]',
    stack: 'max-w-xs gap-1.5',
  },
  lg: {
    root: 'py-24 px-8 gap-5',
    icon: 'w-16 h-16 rounded-[var(--radius-xl,16px)]',
    iconInner: 'w-8 h-8',
    title: 'text-[length:var(--text-h3,1.375rem)]',
    description: 'text-[length:var(--text-body,0.9375rem)]',
    stack: 'max-w-sm gap-2',
  },
};

/* ─────────────────────────────────────────────────────────────
 * Default icons
 * ───────────────────────────────────────────────────────────── */

interface IconProps {
  className?: string;
}

const DefaultEmptyIcon = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    shapeRendering="geometricPrecision"
    aria-hidden="true"
    focusable="false"
  >
    {/* Duotone subtle volume fill */}
    <path
      d="M22 13h-6l-2 2.5h-4L8 13H2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6z"
      fill="currentColor"
      fillOpacity="0.14"
      stroke="none"
    />
    {/* Crisp outline */}
    <path
      d="M5.45 5.11 2 12v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 13h-6l-2 2.5h-4L8 13H2"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DefaultErrorIcon = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    shapeRendering="geometricPrecision"
    aria-hidden="true"
    focusable="false"
  >
    {/* Duotone inner alert aura */}
    <path
      d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
      fill="currentColor"
      fillOpacity="0.12"
      stroke="none"
    />
    {/* Crisp outline */}
    <path
      d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="17" r="1" fill="currentColor" />
  </svg>
);

/* ─────────────────────────────────────────────────────────────
 * Internal helpers
 * ───────────────────────────────────────────────────────────── */

function isActionObject(value: unknown): value is EmptyStateAction {
  return (
    value != null &&
    typeof value === 'object' &&
    'label' in (value as Record<string, unknown>) &&
    typeof (value as { label: unknown }).label === 'string'
  );
}

interface ActionSlotProps {
  action?: EmptyStateAction | ReactNode;
  defaultVariant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

function ActionSlot({ action, defaultVariant = 'secondary' }: ActionSlotProps) {
  if (action == null) return null;

  if (isActionObject(action)) {
    return (
      <GlassButton
        variant={action.variant ?? defaultVariant}
        size="sm"
        onClick={action.onClick}
        disabled={action.disabled}
        loading={action.loading}
      >
        {action.label}
      </GlassButton>
    );
  }

  return <div className="inline-flex items-center gap-2">{action}</div>;
}

/* ─────────────────────────────────────────────────────────────
 * GlassEmptyState
 * ───────────────────────────────────────────────────────────── */

export interface GlassEmptyStateProps extends BaseStateProps {
  /** @deprecated Use `description` instead. Kept for V2 compatibility. */
  message?: string;
}

export const GlassEmptyState = forwardRef<HTMLDivElement, GlassEmptyStateProps>(
  function GlassEmptyState(
    {
      icon,
      title,
      description,
      message,
      action,
      secondaryAction,
      tone = 'primary',
      size = 'md',
      className,
      iconClassName,
      titleClassName,
      descriptionClassName,
      ...rest
    },
    ref,
  ) {
    const desc = description ?? message;
    const toneStyles = TONE_STYLES[tone];
    const sizeStyles = SIZE_STYLES[size];

    const hasActions = useMemo(
      () => action != null || secondaryAction != null,
      [action, secondaryAction],
    );

    return (
      <div
        ref={ref}
        data-component="glass-empty-state"
        data-tone={tone}
        data-size={size}
        className={cn(
          'flex flex-col items-center justify-center text-center',
          sizeStyles.root,
          className,
        )}
        {...rest}
      >
        <div
          aria-hidden="true"
          className={cn(
            'flex items-center justify-center shrink-0',
            'transition-transform duration-300 ease-out',
            'backdrop-blur-md border border-black/[0.04] dark:border-white/[0.06] shadow-xs',
            'motion-safe:hover:scale-[1.03]',
            sizeStyles.icon,
            toneStyles.icon,
            iconClassName,
          )}
        >
          <span className={cn('inline-flex', sizeStyles.iconInner)}>
            {icon ?? <DefaultEmptyIcon className="w-full h-full" />}
          </span>
        </div>

        <div
          className={cn(
            'flex flex-col items-center',
            sizeStyles.stack,
          )}
        >
          {title && (
            <h3
              className={cn(
                'font-semibold text-[color:var(--text-primary,#111827)]',
                'tracking-[-0.01em]',
                sizeStyles.title,
                titleClassName,
              )}
            >
              {title}
            </h3>
          )}

          {desc && (
            <p
              className={cn(
                'text-[color:var(--text-secondary,#4b5563)]',
                'leading-relaxed text-pretty',
                sizeStyles.description,
                descriptionClassName,
              )}
            >
              {desc}
            </p>
          )}
        </div>

        {hasActions && (
          <div className="mt-1 inline-flex flex-wrap items-center justify-center gap-2">
            <ActionSlot action={action} defaultVariant="secondary" />
            <ActionSlot action={secondaryAction} defaultVariant="ghost" />
          </div>
        )}
      </div>
    );
  },
);

GlassEmptyState.displayName = 'GlassEmptyState';

/* ─────────────────────────────────────────────────────────────
 * GlassErrorState
 * ───────────────────────────────────────────────────────────── */

export interface GlassErrorStateProps extends BaseStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const GlassErrorState = forwardRef<HTMLDivElement, GlassErrorStateProps>(
  function GlassErrorState(
    {
      title,
      message,
      description,
      onRetry,
      retryLabel,
      size = 'md',
      className,
      icon,
      iconClassName,
      titleClassName,
      descriptionClassName,
      action,
      secondaryAction,
      ...rest
    },
    ref,
  ) {
    const { t } = useSafeI18n();

    const finalTitle =
      title || t('common.error') || 'Something went wrong';
    const finalMessage = description ?? message;

    const retryAction: EmptyStateAction | undefined = onRetry
      ? {
          label: retryLabel || t('common.tryAgain') || 'Try again',
          onClick: onRetry,
          variant: 'secondary',
        }
      : undefined;

    return (
      <GlassEmptyState
        ref={ref}
        tone="danger"
        size={size}
        title={finalTitle}
        description={finalMessage}
        icon={icon ?? <DefaultErrorIcon className="w-full h-full" />}
        action={action ?? retryAction}
        secondaryAction={secondaryAction}
        className={className}
        iconClassName={iconClassName}
        titleClassName={titleClassName}
        descriptionClassName={descriptionClassName}
        role="alert"
        {...rest}
      />
    );
  },
);

GlassErrorState.displayName = 'GlassErrorState';

export default GlassEmptyState;