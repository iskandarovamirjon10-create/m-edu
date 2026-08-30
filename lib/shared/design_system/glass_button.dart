import 'package:flutter/material.dart';

import 'liquid/liquid_glass_button.dart';

/// Crystal Air → Liquid Glass Button komponenti.
///
/// Yaltiroq suyuq shisha tugma — press animatsiyasi va yorug'lik
/// to'lqini (shine sweep) bilan.
class GlassButton extends StatelessWidget {
  final Widget child;
  final VoidCallback? onPressed;
  final EdgeInsetsGeometry? padding;
  final double borderRadius;
  final Color? backgroundColor;
  final bool isLoading;

  const GlassButton({
    super.key,
    required this.child,
    this.onPressed,
    this.padding,
    this.borderRadius = 14,
    this.backgroundColor,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return LiquidGlassButton(
      onPressed: onPressed,
      padding: padding,
      borderRadius: borderRadius,
      color: backgroundColor,
      isLoading: isLoading,
      child: child,
    );
  }
}
