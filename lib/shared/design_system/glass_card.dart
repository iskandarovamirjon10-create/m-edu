import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'liquid/liquid_glass_container.dart';

/// Crystal Air → Liquid Glass Card komponenti.
///
/// Orqadagi fonni xiralashtiruvchi, tepasida yorug'lik aksi bo'lgan
/// suyuq shisha kartochka (spec §2 — iOS 26 Liquid Glass uslubi).
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double borderRadius;
  final Color? backgroundColor;
  final Border? border;
  final List<BoxShadow>? boxShadow;
  final Gradient? gradient;
  final VoidCallback? onTap;
  final Color? glow;

  const GlassCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.borderRadius = 20,
    this.backgroundColor,
    this.border,
    this.boxShadow,
    this.gradient,
    this.onTap,
    this.glow,
  });

  @override
  Widget build(BuildContext context) {
    // Aniq (opaque) fon berilganda BackdropFilter ishlamaydi —
    // shunda oddiy gradient/fonli kartochka ko'rsatamiz.
    final opaque = backgroundColor?.a == 1.0;

    if (opaque) {
      return Container(
        margin: margin,
        padding: padding ?? const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(borderRadius),
          gradient: gradient,
          color: backgroundColor ?? Colors.white,
          border: border ??
              Border.all(color: AppTheme.separator.withValues(alpha: 0.5)),
          boxShadow: boxShadow ??
              [
                BoxShadow(
                  color: context.appColors.separator.withValues(alpha: 0.25),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                  spreadRadius: -6,
                ),
              ],
        ),
        child: child,
      );
    }

    return LiquidGlassContainer(
      padding: padding,
      margin: margin,
      borderRadius: borderRadius,
      tint: backgroundColor,
      glow: glow,
      gradient: gradient,
      onTap: onTap,
      shadow: boxShadow?.firstOrNull,
      child: child,
    );
  }
}

/// Glass Card — Gradient variant.
class GlassCardGradient extends StatelessWidget {
  final Widget child;
  final Gradient gradient;
  final EdgeInsetsGeometry? padding;
  final double borderRadius;

  const GlassCardGradient({
    super.key,
    required this.child,
    required this.gradient,
    this.padding,
    this.borderRadius = 20,
  });

  @override
  Widget build(BuildContext context) {
    return LiquidGlassContainer(
      padding: padding,
      borderRadius: borderRadius,
      gradient: gradient,
      blur: 8,
      specular: true,
      shadow: BoxShadow(
        color: Colors.black.withValues(alpha: 0.12),
        blurRadius: 24,
        offset: const Offset(0, 10),
      ),
      child: child,
    );
  }
}
