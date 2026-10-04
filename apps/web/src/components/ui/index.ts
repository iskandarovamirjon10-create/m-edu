/**
 * M-EDU Glass UI Library — barrel export
 * All glass primitive components.
 */

export { GlassButton, type GlassButtonVariant, type GlassButtonSize} from'./GlassButton';
export { GlassInput, GlassTextArea} from'./GlassInput';
export { GlassSelect} from'./GlassSelect';
export { GlassModal} from'./GlassModal';
export { ConfirmDialog, type ConfirmDialogProps} from'./ConfirmDialog';
export { GlassTable, GlassTHead, GlassTBody, GlassTR, GlassTH, GlassTD} from'./GlassTable';
export { GlassBadge, type GlassBadgeVariant} from'./GlassBadge';
export { GlassAvatar, type GlassAvatarSize} from'./GlassAvatar';
export { GlassSpinner, type GlassSpinnerSize} from'./GlassSpinner';
export { GlassSkeleton, GlassPageLoader} from'./GlassSkeleton';
export { GlassTabs} from'./GlassTabs';
export { GlassTooltip} from'./GlassTooltip';
export { GlassCard} from'./GlassCard';
export { GlassStatCard} from'./GlassStatCard';
export { GlassEmptyState, GlassErrorState} from'./GlassEmptyState';
export { GlassPageHeader} from'./GlassPageHeader';
export { GlassDivider} from'./GlassDivider';
export { GlassSwitch} from'./GlassSwitch';
export { GlassSurface, type GlassElevation, type GlassTone} from'./Glass';

// Toast API
export { useToast, setToastContext, ToastContainer, ToastHost, ToastItemView, type ToastType, type ToastItem} from'./GlassToast';

// GlassField and GlassPagination — extracted to avoid circular import
export { GlassField} from'./GlassField';
export { GlassPagination} from'./GlassPagination';

// Backward-compatibility aliases for legacy page imports — note that
// `ui.tsx` provides a richer set of legacy aliases (TextInput, Modal,
// Pagination, useToasts, statusColor, etc.) and is the file pages import
// from via `@/components/ui`. We only add the ones that are missing.
export * from'./GlassAsyncSelect';
