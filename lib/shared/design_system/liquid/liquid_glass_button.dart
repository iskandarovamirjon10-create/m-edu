import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// Liquid Glass Button — yaltiroq, suyuq shisha tugma.
///
/// Gradient to'ldirish, tepadagi yorug'lik aksi, bosganda siqilish va
/// yorug'lik "sweep" animatsiyasi bilan.
class LiquidGlassButton extends StatefulWidget {
  final Widget child;
  final VoidCallback? onPressed;
  final EdgeInsetsGeometry? padding;
  final double borderRadius;

  /// Tugma gradienti (berilmasa — [color] dan hosil qilinadi).
  final Gradient? gradient;
  final Color? color;

  final bool isLoading;
  final IconData? icon;

  const LiquidGlassButton({
    super.key,
    required this.child,
    this.onPressed,
    this.padding,
    this.borderRadius = 16,
    this.gradient,
    this.color,
    this.isLoading = false,
    this.icon,
  });

  @override
  State<LiquidGlassButton> createState() => _LiquidGlassButtonState();
}

class _LiquidGlassButtonState extends State<LiquidGlassButton>
    with TickerProviderStateMixin {
  late final AnimationController _press;
  late final AnimationController _shine;

  @override
  void initState() {
    super.initState();
    _press = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 140),
      lowerBound: 0.92,
      upperBound: 1.0,
      value: 1.0,
    );
    _shine = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
  }

  @override
  void dispose() {
    _press.dispose();
    _shine.dispose();
    super.dispose();
  }

  void _handleTap() {
    if (widget.onPressed == null || widget.isLoading) return;
    _shine.forward(from: 0);
    widget.onPressed!();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final baseColor = widget.color ?? AppTheme.primary;
    final gradient = widget.gradient ??
        LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.lerp(baseColor, Colors.white, 0.12)!,
            baseColor,
            Color.lerp(baseColor, Colors.black, 0.10)!,
          ],
        );
    final glowColor = baseColor;

    return GestureDetector(
      onTapDown: (_) => _press.forward(),
      onTapUp: (_) => _press.reverse(),
      onTapCancel: () => _press.reverse(),
      onTap: widget.isLoading ? null : _handleTap,
      child: ScaleTransition(
        scale: _press,
        child: Container(
          padding:
              widget.padding ?? const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            gradient: gradient,
            border: Border.all(
              color: Colors.white.withValues(alpha: isDark ? 0.25 : 0.45),
            ),
            boxShadow: [
              BoxShadow(
                color: glowColor.withValues(alpha: 0.35),
                blurRadius: 16,
                offset: const Offset(0, 8),
                spreadRadius: -2,
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            child: Stack(
              children: [
                // Tepadagi yorug'lik aksi.
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.white.withValues(alpha: isDark ? 0.55 : 0.9),
                          Colors.white.withValues(alpha: 0.0),
                        ],
                      ),
                    ),
                  ),
                ),
                // Bosilganda o'tib ketadigan yorug'lik to'lqini (sweep).
                AnimatedBuilder(
                  animation: _shine,
                  builder: (context, child) {
                    final t = Curves.easeInOut.transform(_shine.value);
                    return Positioned(
                      top: 0,
                      bottom: 0,
                      width: 90,
                      left: -90 + t * 400,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.white.withValues(alpha: 0.0),
                              Colors.white.withValues(alpha: 0.35),
                              Colors.white.withValues(alpha: 0.0),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
                Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (widget.icon != null) ...[
                        Icon(widget.icon, color: Colors.white, size: 18),
                        const SizedBox(width: 8),
                      ],
                      if (widget.isLoading)
                        const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      else
                        widget.child,
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
