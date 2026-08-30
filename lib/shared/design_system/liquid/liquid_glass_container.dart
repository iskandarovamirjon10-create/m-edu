import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// Liquid Glass (iOS 26 uslubi) — asosiy shisha panel.
///
/// Shisha "muz" qatlami, gradient qirra, tepadagi yorug'lik aksi
/// (specular) va ixtiyoriy rangli glow effektidan iborat.
///
/// Eslatma: avval BackdropFilter (real-time blur) ishlatilardi — bu har
/// kadrda butun ekranni xiralashtirib, scroll'da qattiq lag yaratardi.
/// Endi shisha effekt shaffof rang + gradient bilan taqlid qilinadi:
/// vizual deyarli bir xil, lekin rendering 10+ marta tezroq.
class LiquidGlassContainer extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double borderRadius;

  /// Shisha "muz" qatlami rangi (shaffof).
  final Color? tint;

  /// Aktsent glow rangi (masalan, yashil — muvaffaqiyat uchun).
  final Color? glow;

  /// Orqadagi fonga beriladigan blur kuchi.
  ///
  /// Saqlanib qolgan — API mosligi uchun, endi BackdropFilter
  /// ishlatilmaydi (perfomance sababli).
  final double blur;

  /// Tepadagi yorug'lik aksini ko'rsatish.
  final bool specular;

  /// Ixtiyoriy gradient (ayniqsa gradient fonli kartalar uchun).
  final Gradient? gradient;

  /// Kontentni bosish imkoniyati (InkWell o'rnini bosadi).
  final VoidCallback? onTap;

  final BoxShadow? shadow;

  const LiquidGlassContainer({
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final radius = BorderRadius.circular(borderRadius);
    final effectiveTint = tint ??
        (isDark ? AppTheme.liquidFrostDark : AppTheme.liquidFrostLight);

    Widget panel = ClipRRect(
      borderRadius: radius,
      child: Stack(
        children: [
          // 1. Muzlagan shisha qatlami — shaffof rang + aurora ranglari
          //    bilan blend (blur'siz — tez).
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(color: effectiveTint),
            ),
          ),
          // 2. Yuqoridan tushadigan yumshoq yorug'lik (chuqurlik).
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: gradient ??
                    LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.white.withValues(alpha: isDark ? 0.10 : 0.45),
                        Colors.white.withValues(alpha: 0.02),
                      ],
                    ),
              ),
            ),
          ),
          // 3. Yorug' shisha qirrasi.
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: radius,
                border: Border.all(
                  color: isDark
                      ? AppTheme.liquidEdgeDark
                      : AppTheme.liquidEdgeLight,
                  width: 0.9,
                ),
              ),
            ),
          ),
          // 4. Tepadagi specular aks (yaltiroq chiziq).
          if (specular)
            Positioned(
              top: 1,
              left: 14,
              right: 14,
              height: 1.4,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(1),
                  gradient: LinearGradient(
                    colors: [
                      Colors.white.withValues(alpha: isDark ? 0.5 : 0.85),
                      Colors.white.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
          // 5. Kontent.
          Padding(padding: padding ?? const EdgeInsets.all(16), child: child),
        ],
      ),
    );

    if (onTap != null) {
      panel = GestureDetector(onTap: onTap, child: panel);
    }

    return Container(
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: [
          if (shadow != null)
            shadow!
          else
            BoxShadow(
              color: AppTheme.liquidShadow.withValues(alpha: 0.9),
              blurRadius: 24,
              offset: const Offset(0, 10),
              spreadRadius: -8,
            ),
          if (glow != null)
            BoxShadow(
              color: glow!.withValues(alpha: 0.28),
              blurRadius: 30,
              offset: const Offset(0, 8),
            ),
        ],
      ),
      child: panel,
    );
  }
}
