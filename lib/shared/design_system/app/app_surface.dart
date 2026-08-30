import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../design/design.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — SURFACE (§14, §0.1)
/// ═══════════════════════════════════════════════════════════════════════

enum SurfaceType { glass, solid }

class AppSurface extends StatelessWidget {
  final Widget child;
  final SurfaceType type;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double borderRadius;
  final Color? tint;
  final Color? glow;
  final double blur;
  final bool enableBlur;
  final bool specular;
  final bool interactive;
  final VoidCallback? onTap;
  final int elevation;

  const AppSurface({
    super.key,
    required this.child,
    this.type = SurfaceType.glass,
    this.padding,
    this.margin,
    this.borderRadius = DsRadius.lg,
    this.tint,
    this.glow,
    this.blur = 16,
    this.enableBlur = true,
    this.specular = true,
    this.interactive = false,
    this.onTap,
    this.elevation = 1,
  });

  const AppSurface.glass({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.borderRadius = DsRadius.lg,
    this.tint,
    this.glow,
    this.blur = 16,
    this.enableBlur = true,
    this.specular = true,
    this.interactive = false,
    this.onTap,
    this.elevation = 1,
  }) : type = SurfaceType.glass;

  const AppSurface.solid({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.borderRadius = DsRadius.lg,
    this.tint,
    this.glow,
    this.specular = false,
    this.interactive = false,
    this.onTap,
    this.elevation = 1,
  })  : type = SurfaceType.solid,
        blur = 0,
        enableBlur = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final effectiveTint = tint ??
        (type == SurfaceType.glass ? colors.surface : colors.surface);

    final shadows = switch (elevation) {
      0 => <BoxShadow>[],
      1 => [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      2 => [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      _ => [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.12),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
    };

    if (glow != null) {
      shadows.add(BoxShadow(
        color: glow!.withValues(alpha: 0.25),
        blurRadius: 20,
        offset: const Offset(0, 6),
        spreadRadius: -2,
      ));
    }

    final borderColor = type == SurfaceType.glass
        ? colors.border
        : colors.border;

    Widget surface = Container(
      padding: padding,
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        color: effectiveTint,
        border: Border.all(
          color: borderColor,
          width: type == SurfaceType.glass ? 0.8 : 1,
        ),
        boxShadow: shadows,
      ),
      child: child,
    );

    if (specular && type == SurfaceType.glass && elevation > 0) {
      surface = ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: Stack(
          children: [
            surface,
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(borderRadius),
                  gradient: LinearGradient(
                    colors: [
                      Colors.white.withValues(alpha: isDark ? 0.45 : 0.9),
                      Colors.white.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (type == SurfaceType.glass && enableBlur && blur > 0) {
      surface = ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: surface,
        ),
      );
    }

    if (interactive || onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(borderRadius),
          child: surface,
        ),
      );
    }

    return surface;
  }
}
