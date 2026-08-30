import 'package:flutter/material.dart';

import '../../../design/design.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — ICON BUTTON (§11, §AC: ≥48×48dp interaction target)
/// ═══════════════════════════════════════════════════════════════════════

class AppIconButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;
  final double iconSize;
  final Color? color;
  final Color? backgroundColor;
  final double borderRadius;

  const AppIconButton({
    super.key,
    required this.icon,
    required this.tooltip,
    this.onPressed,
    this.iconSize = 24,
    this.color,
    this.backgroundColor,
    this.borderRadius = DsRadius.sm,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final effectiveColor = color ?? colors.accent;

    return Tooltip(
      message: tooltip,
      waitDuration: const Duration(milliseconds: 400),
      child: IconButton(
        onPressed: onPressed,
        icon: Icon(icon, size: iconSize),
        color: effectiveColor,
        splashRadius: 20,
        style: IconButton.styleFrom(
          minimumSize: const Size(48, 48),
          backgroundColor: backgroundColor,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
        ),
        focusColor: colors.accent.withValues(alpha: 0.12),
        hoverColor: colors.surfaceOverlay,
      ),
    );
  }
}
