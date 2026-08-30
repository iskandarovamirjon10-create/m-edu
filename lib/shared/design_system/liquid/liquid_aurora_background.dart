import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';

// Liquid Glass v3.1 (docs/LIQUID_GLASS_TOKENS.md): hardcoded ranglar
// yo'q — barcha qiymatlar AppColors tokenlaridan (yagona manba).
// Hero fon = gradient.hero_bg (#EEF1FF → #FAFAFC, 180°).

/// Liquid Glass (iOS 26 uslubi) — statik aurora fon.
///
/// Ekran orqasida loyqa rangli dog'lar (blobs) shisha panellarga rang va
/// chuqurlik beradi. Har qanday sahifa orqasiga qo'yiladi.
///
/// PERFORMANS ESLATMALARI:
/// Oldin dog'lar AnimationController bilan har kadrda harakatlanardi va har
/// biri `ImageFiltered` (sigma 70 gaussian blur) bilan qayta bo'yalardi —
/// arzon Android qurilmalarda butun ilova qotib qolardi. Endi:
///  - dog'lar joylashuvi bir marta hisoblanadi (animatsiya yo'q),
///  - qimmat blur o'rniga RadialGradient (allaqachon yumshoq) ishlatiladi,
///  - [RepaintBoundary] natijani keshlaydi — sahifalar sirpanayotganda yoki
///    animatsiyalanayotganda fon qayta bo'yalmaydi.
class LiquidAuroraBackground extends StatefulWidget {
  final Widget? child;

  const LiquidAuroraBackground({super.key, this.child});

  @override
  State<LiquidAuroraBackground> createState() => _LiquidAuroraBackgroundState();
}

class _LiquidAuroraBackgroundState extends State<LiquidAuroraBackground> {
  // static final (const emas): AppColors const ob'ektining maydoniga
  // const kontekstda kirish mumkin emas (const_eval_property_access).
  static final _blobs = <_AuroraBlob>[
    // (x, y) — ekranning nisbiy koordinatalari (0..1).
    // Ranglar AppColors.light (yagona manba) — dark rejim uchun ham
    // AppColors.dark.aurora* ishlatiladi (pastdagi builder'da tanlanadi).
    _AuroraBlob(color: AppColors.light.auroraBlue, size: 340, x: 0.08, y: 0.15),
    _AuroraBlob(
        color: AppColors.light.auroraViolet, size: 300, x: 0.68, y: 0.02),
    _AuroraBlob(color: AppColors.light.auroraPink, size: 280, x: 0.18, y: 0.62),
    _AuroraBlob(color: AppColors.light.auroraTeal, size: 260, x: 0.82, y: 0.38),
    _AuroraBlob(color: AppColors.light.auroraGold, size: 220, x: 0.45, y: 0.88),
  ];

  static final _darkBlobs = <_AuroraBlob>[
    _AuroraBlob(color: AppColors.dark.auroraBlue, size: 340, x: 0.08, y: 0.15),
    _AuroraBlob(
        color: AppColors.dark.auroraViolet, size: 300, x: 0.68, y: 0.02),
    _AuroraBlob(color: AppColors.dark.auroraPink, size: 280, x: 0.18, y: 0.62),
    _AuroraBlob(color: AppColors.dark.auroraTeal, size: 260, x: 0.82, y: 0.38),
    _AuroraBlob(color: AppColors.dark.auroraGold, size: 220, x: 0.45, y: 0.88),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    // Blob ranglari tema'ga mos: dark rejimda xiraroq aurora dog'lari.
    final blobs = isDark ? _darkBlobs : _blobs;
    // gradient.hero_bg (spec §2): #EEF1FF → #FAFAFC (180°); dark — derived.
    final heroTop = colors.heroBgTop;
    final heroBottom = colors.heroBgBottom;

    return RepaintBoundary(
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Asosiy pastel fon — hero_bg tokenlari (180° vertikal).
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [heroTop, heroBottom],
              ),
            ),
          ),
          // Statik rangli dog'lar — pozitsiya faqat build vaqtida hisoblanadi.
          LayoutBuilder(
            builder: (context, constraints) {
              final w = constraints.maxWidth;
              final h = constraints.maxHeight;
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  for (final blob in blobs) _buildBlob(blob, w, h, heroBottom),
                ],
              );
            },
          ),
          // Pastki qatlamni biroz "o'chirib", matn o'qilishini ta'minlash.
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.white.withValues(alpha: isDark ? 0.10 : 0.22),
                  Colors.white.withValues(alpha: isDark ? 0.02 : 0.10),
                ],
              ),
            ),
          ),
          if (widget.child != null) widget.child!,
        ],
      ),
    );
  }

  Widget _buildBlob(
    _AuroraBlob blob,
    double w,
    double h,
    Color baseColor,
  ) {
    final left = blob.x * w - blob.size / 2;
    final top = blob.y * h - blob.size / 2;

    return Positioned(
      left: left,
      top: top,
      width: blob.size,
      height: blob.size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              blob.color.withValues(alpha: 0.50),
              blob.color.withValues(alpha: 0.08),
              baseColor.withValues(alpha: 0.0),
            ],
          ),
        ),
      ),
    );
  }
}

class _AuroraBlob {
  final Color color;
  final double size;

  /// Ekranning nisbiy markaz koordinatalari (0..1).
  final double x;
  final double y;

  const _AuroraBlob({
    required this.color,
    required this.size,
    required this.x,
    required this.y,
  });
}
