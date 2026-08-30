import 'package:flutter/material.dart';

import '../tokens/tokens.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// DS CARD — Unified card component
///
/// Variants: flat (default), elevated, outlined
/// ═══════════════════════════════════════════════════════════════════════

enum DsCardVariant { flat, elevated, outlined }

class DsCard extends StatelessWidget {
  final DsCardVariant variant;
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final BorderRadius? borderRadius;

  const DsCard({
    super.key,
    this.variant = DsCardVariant.flat,
    required this.child,
    this.padding,
    this.margin,
    this.onTap,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    final bg = colors.card;
    final radius = borderRadius ?? DsRadius.lgAll;

    final border = switch (variant) {
      DsCardVariant.outlined => Border.all(color: colors.border),
      DsCardVariant.elevated => null,
      DsCardVariant.flat => Border.all(
          color: colors.divider,
          width: 0.5,
        ),
    };

    final shadows = switch (variant) {
      DsCardVariant.elevated => DsShadow.medium,
      _ => null,
    };

    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: radius,
        border: border,
        boxShadow: shadows,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: radius,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: Padding(
            padding: padding ?? DsSpacing.cardAll,
            child: child,
          ),
        ),
      ),
    );
  }
}
