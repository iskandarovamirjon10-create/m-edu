import 'package:flutter/material.dart';

import '../tokens/tokens.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// DS BUTTON — Unified button component
///
/// Variants: primary, secondary, ghost, destructive
/// Sizes: sm (36h), md (44h), lg (48h)
/// States: normal, hover, pressed, disabled, loading
/// ═══════════════════════════════════════════════════════════════════════

enum DsButtonVariant { primary, secondary, ghost, destructive }
enum DsButtonSize { sm, md, lg }

class DsButton extends StatelessWidget {
  final DsButtonVariant variant;
  final DsButtonSize size;
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool isLoading;

  const DsButton({
    super.key,
    this.variant = DsButtonVariant.primary,
    this.size = DsButtonSize.md,
    required this.label,
    this.icon,
    this.onPressed,
    this.isLoading = false,
  });

  double get _height => switch (size) {
        DsButtonSize.sm => 36,
        DsButtonSize.md => 44,
        DsButtonSize.lg => 48,
      };

  EdgeInsets get _padding => switch (size) {
        DsButtonSize.sm =>
          const EdgeInsets.symmetric(horizontal: DsSpacing.lg),
        DsButtonSize.md =>
          const EdgeInsets.symmetric(horizontal: DsSpacing.xl),
        DsButtonSize.lg =>
          const EdgeInsets.symmetric(horizontal: DsSpacing.xxl),
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final enabled = onPressed != null && !isLoading;

    final (bg, fg, border) = switch (variant) {
      DsButtonVariant.primary => (
          enabled ? colors.accent : colors.accent.withValues(alpha: 0.4),
          colors.accentOnAccent,
          BorderSide.none,
        ),
      DsButtonVariant.secondary => (
          enabled
              ? colors.accentSoft
              : colors.fill,
          enabled ? colors.accent : colors.textDisabled,
          BorderSide(
            color: enabled
                ? colors.accent.withValues(alpha: 0.3)
                : colors.border,
          ),
        ),
      DsButtonVariant.ghost => (
          Colors.transparent,
          enabled ? colors.accent : colors.textDisabled,
          BorderSide.none,
        ),
      DsButtonVariant.destructive => (
          enabled ? colors.error : colors.error.withValues(alpha: 0.4),
          enabled ? colors.errorOnBg : colors.errorOnBg.withValues(alpha: 0.6),
          BorderSide.none,
        ),
    };

    final textStyle = switch (size) {
      DsButtonSize.sm => DsType.caption(color: fg).copyWith(fontWeight: FontWeight.w600),
      DsButtonSize.md => DsType.body(color: fg).copyWith(fontWeight: FontWeight.w600),
      DsButtonSize.lg => DsType.bodyStrong(color: fg),
    };

    final content = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (isLoading)
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: fg.withValues(alpha: 0.8),
            ),
          )
        else if (icon != null)
          Icon(icon, size: 18, color: fg),
        if (icon != null || isLoading) const SizedBox(width: DsSpacing.sm),
        Flexible(
          child: Text(
            label,
            style: textStyle,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );

    return SizedBox(
      height: _height,
      child: switch (variant) {
        DsButtonVariant.primary || DsButtonVariant.destructive =>
          FilledButton(
            onPressed: enabled ? onPressed : null,
            style: FilledButton.styleFrom(
              backgroundColor: bg,
              foregroundColor: fg,
              disabledBackgroundColor: bg,
              disabledForegroundColor: fg,
              minimumSize: Size(0, _height),
              padding: _padding,
              shape: RoundedRectangleBorder(borderRadius: DsRadius.smAll),
              elevation: 0,
              textStyle: textStyle,
            ),
            child: content,
          ),
        DsButtonVariant.secondary =>
          OutlinedButton(
            onPressed: enabled ? onPressed : null,
            style: OutlinedButton.styleFrom(
              foregroundColor: fg,
              disabledForegroundColor: fg,
              minimumSize: Size(0, _height),
              padding: _padding,
              shape: RoundedRectangleBorder(borderRadius: DsRadius.smAll),
              side: border,
              textStyle: textStyle,
              elevation: 0,
            ),
            child: content,
          ),
        DsButtonVariant.ghost =>
          TextButton(
            onPressed: enabled ? onPressed : null,
            style: TextButton.styleFrom(
              foregroundColor: fg,
              disabledForegroundColor: fg,
              minimumSize: Size(0, _height),
              padding: _padding,
              shape: RoundedRectangleBorder(borderRadius: DsRadius.smAll),
              textStyle: textStyle,
            ),
            child: content,
          ),
      },
    );
  }
}
