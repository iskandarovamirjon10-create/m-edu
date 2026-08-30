import 'package:flutter/material.dart';

import 'liquid_glass_container.dart';

/// Liquid Glass Card — shisha kartochka komponenti.
///
/// Orqadagi aurora fonni xiralashtiradigan, tepasida yorug'lik aksi
/// bo'lgan iOS 26 uslubidagi suyuq shisha panel.
class LiquidGlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double borderRadius;
  final Color? tint;
  final Color? glow;
  final double blur;
  final bool specular;
  final Gradient? gradient;
  final VoidCallback? onTap;
  final BoxShadow? shadow;

  const LiquidGlassCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.borderRadius = 20,
    this.tint,
    this.glow,
    this.blur = 16,
    this.specular = true,
    this.gradient,
    this.onTap,
    this.shadow,
  });

  @override
  Widget build(BuildContext context) {
    return LiquidGlassContainer(
      padding: padding,
      margin: margin,
      borderRadius: borderRadius,
      tint: tint,
      glow: glow,
      blur: blur,
      specular: specular,
      gradient: gradient,
      onTap: onTap,
      shadow: shadow,
      child: child,
    );
  }
}
