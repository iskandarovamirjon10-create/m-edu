import 'package:flutter/material.dart';

import '../../../core/theme/app_density.dart';
import '../../../design/design.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — TUGMA (brief §22 ACTION HIERARCHY)
/// ═══════════════════════════════════════════════════════════════════════

enum AppButtonType { primary, secondary, tertiary, destructive }
enum AppButtonSize { sm, md, lg }

class AppButton extends StatelessWidget {
  final AppButtonType type;
  final AppButtonSize size;
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool isLoading;

  const AppButton({
    super.key,
    this.type = AppButtonType.primary,
    this.size = AppButtonSize.md,
    required this.label,
    this.icon,
    this.onPressed,
    this.isLoading = false,
  });

  double _baseHeight() => switch (size) {
        AppButtonSize.sm => 40,
        AppButtonSize.md => 48,
        AppButtonSize.lg => 52,
      };

  Size _minimumSize(BuildContext context) {
    final density = context.appDensity;
    final base = _baseHeight();
    final height = switch (density) {
      AppDensity.compact => base - 6,
      AppDensity.comfortable => base,
      AppDensity.spacious => base + 6,
    };
    return Size(0, context.touchTargetFloor(height));
  }

  EdgeInsets get _padding => switch (size) {
        AppButtonSize.sm =>
          const EdgeInsets.symmetric(horizontal: DsSpacing.lg),
        AppButtonSize.md =>
          const EdgeInsets.symmetric(horizontal: DsSpacing.xxl),
        AppButtonSize.lg =>
          const EdgeInsets.symmetric(horizontal: DsSpacing.xxxl),
      };

  TextStyle get _textStyle => switch (size) {
        AppButtonSize.sm => DsType.bodyStrong(color: null),
        AppButtonSize.md =>
          DsType.body(color: null).copyWith(fontWeight: FontWeight.w600),
        AppButtonSize.lg =>
          DsType.body(color: null).copyWith(fontWeight: FontWeight.w600),
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    final fg = switch (type) {
      AppButtonType.primary => colors.accentOnAccent,
      AppButtonType.secondary => colors.accent,
      AppButtonType.tertiary => colors.accent,
      AppButtonType.destructive => colors.errorOnBg,
    };

    final bg = switch (type) {
      AppButtonType.primary => colors.accent,
      AppButtonType.secondary => colors.accent.withValues(alpha: 0.10),
      AppButtonType.tertiary => Colors.transparent,
      AppButtonType.destructive => colors.error,
    };

    final side = switch (type) {
      AppButtonType.primary => BorderSide.none,
      AppButtonType.secondary =>
        BorderSide(color: colors.accent.withValues(alpha: 0.35)),
      AppButtonType.tertiary => BorderSide.none,
      AppButtonType.destructive => BorderSide.none,
    };

    final style = ButtonStyle(
      minimumSize: WidgetStatePropertyAll(_minimumSize(context)),
      padding: WidgetStatePropertyAll(_padding),
      shape: WidgetStatePropertyAll(
        RoundedRectangleBorder(borderRadius: DsRadius.mdAll),
      ),
      backgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return bg.withValues(alpha: 0.4);
        }
        if (states.contains(WidgetState.hovered) ||
            states.contains(WidgetState.focused)) {
          if (type == AppButtonType.secondary) {
            return colors.accent.withValues(alpha: 0.16);
          }
          if (type == AppButtonType.tertiary) {
            return colors.accent.withValues(alpha: 0.08);
          }
        }
        return bg;
      }),
      foregroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return fg.withValues(alpha: 0.6);
        }
        return fg;
      }),
      side: WidgetStatePropertyAll(side),
      elevation: const WidgetStatePropertyAll(0),
      textStyle: WidgetStatePropertyAll(_textStyle),
    );

    final content = Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: DsSpacing.sm,
      runSpacing: DsSpacing.xs,
      children: [
        if (isLoading)
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2.2,
              color: fg.withValues(alpha: 0.9),
            ),
          )
        else if (icon != null)
          Icon(icon, size: 18),
        Text(
          label,
          textAlign: TextAlign.center,
          softWrap: true,
        ),
      ],
    );

    final button = switch (type) {
      AppButtonType.primary => FilledButton(
          onPressed: isLoading ? null : onPressed,
          style: style,
          child: content,
        ),
      AppButtonType.secondary => OutlinedButton(
          onPressed: isLoading ? null : onPressed,
          style: style,
          child: content,
        ),
      AppButtonType.tertiary => TextButton(
          onPressed: isLoading ? null : onPressed,
          style: style,
          child: content,
        ),
      AppButtonType.destructive => FilledButton(
          onPressed: isLoading ? null : onPressed,
          style: style,
          child: content,
        ),
    };

    return button;
  }
}
