/**
 * ConfirmDialog — Shared confirmation modal for destructive / irreversible
 * actions. Replaces all native window.confirm() usage with a focus-trapped,
 * accessible design-system modal.
 */
import { GlassModal } from './GlassModal';
import { GlassButton } from './GlassButton';
import { useSafeI18n } from '@/i18n/I18nProvider';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Dialog title. Defaults to a localized generic title. */
  title?: string;
  /** Body description (the actual confirmation question). */
  description?: string;
  /** Optional secondary hint line under the description. */
  hint?: string;
  /** Confirm button label. Defaults to localized "Delete". */
  confirmLabel?: string;
  /** Cancel button label. Defaults to localized "Cancel". */
  cancelLabel?: string;
  /** Show loading spinner + disable buttons while the action is in flight. */
  loading?: boolean;
  /** Visual tone: danger (default) for destructive actions, primary otherwise. */
  tone?: 'danger' | 'primary';
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  hint,
  confirmLabel,
  cancelLabel,
  loading = false,
  tone = 'danger',
}: ConfirmDialogProps) {
  const { t } = useSafeI18n();

  const resolvedTitle = title ?? t('confirm.title');
  const resolvedDescription = description ?? t('confirm.description');
  const resolvedConfirm = confirmLabel ?? t('common.delete');
  const resolvedCancel = cancelLabel ?? t('common.cancel');

  return (
    <GlassModal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={resolvedTitle}
      footer={
        <>
          <GlassButton
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {resolvedCancel}
          </GlassButton>
          <GlassButton
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
          >
            {resolvedConfirm}
          </GlassButton>
        </>
      }
    >
      <div className="space-y-3" role="alertdialog" aria-describedby="confirm-dialog-desc">
        <p id="confirm-dialog-desc" className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
          {resolvedDescription}
        </p>
        {hint && (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{hint}</p>
        )}
      </div>
    </GlassModal>
  );
}

export default ConfirmDialog;
