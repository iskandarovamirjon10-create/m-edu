import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU DESIGN SYSTEM v3.2 — SPATIAL & TYPOGRAPHY TOKENS
///
/// v3.2 §2.3: 8pt grid asosida spacing
/// v3.2 §2.4: Border radius
/// v3.2 §2.5: Elevation / Shadow
/// v3.2 §2.2: Typography scale (Inter)
/// ═══════════════════════════════════════════════════════════════════════

/// SPACING — 8pt grid (v3.2 §2.3).
class AppSpacing {
  AppSpacing._();

  static const double xs = 4; // space.xs
  static const double sm = 8; // space.sm
  static const double md = 16; // space.md
  static const double lg = 24; // space.lg
  static const double xl = 32; // space.xl
  static const double xxl = 48; // space.2xl
  static const double xxxl = 32; // backward compatible
  static const double xxxxl = 40; // backward compatible
  static const double huge = 48; // backward compatible
  static const double giant = 64; // backward compatible

  /// Desktop kontent kengligi (v3.2 §8: max 1440px).
  static const double maxContentWidth = 1440;

  /// App padding (v3.2 §2.3): Desktop lg (24px), Mobile md (16px).
  static const EdgeInsets desktopPadding = EdgeInsets.symmetric(horizontal: 24);
  static const EdgeInsets mobilePadding = EdgeInsets.symmetric(horizontal: 16);

  /// Karta padding (v3.2 §4.4): sm=16px, lg=24px.
  static const EdgeInsets cardPadding = EdgeInsets.all(16);
  static const EdgeInsets cardPaddingLg = EdgeInsets.all(24);

  /// Row padding.
  static const EdgeInsets rowPadding =
      EdgeInsets.symmetric(horizontal: 16, vertical: 12);
}

/// RADIUS (v3.2 §2.4).
class AppRadius {
  AppRadius._();

  static const double sm = 8; // radius.sm — inputlar, nav items
  static const double md = 12; // radius.md — tugmalar, modallar
  static const double card = 16; // radius.card — kartalar (contract §6)
  static const double lg = 24; // radius.lg — hero elementlar
  static const double xl = 24; // backward compatible
  static const double pill = 100; // radius.pill — status chiplari

  static BorderRadius get smAll => BorderRadius.circular(sm);
  static BorderRadius get mdAll => BorderRadius.circular(md);
  static BorderRadius get lgAll => BorderRadius.circular(lg);
  static BorderRadius get pillAll => BorderRadius.circular(pill);
}

/// ELEVATION / SHADOW (v3.2 §2.5) — 6 daraja.
class AppShadow {
  AppShadow._();

  /// elevation.0 — none.
  static List<BoxShadow> get none => const [];

  /// elevation.1 — default karta: 0 1px 2px rgba(15,23,42,0.04).
  static List<BoxShadow> get level1 => const [
        BoxShadow(
          color: Color(0x0A0F172A),
          blurRadius: 2,
          offset: Offset(0, 1),
        ),
      ];

  /// elevation.2 — hover karta: 0 4px 12px rgba(15,23,42,0.08).
  static List<BoxShadow> get level2 => const [
        BoxShadow(
          color: Color(0x140F172A),
          blurRadius: 12,
          offset: Offset(0, 4),
        ),
      ];

  /// elevation.3 — dropdown, popover: 0 8px 24px rgba(15,23,42,0.10).
  static List<BoxShadow> get level3 => const [
        BoxShadow(
          color: Color(0x1A0F172A),
          blurRadius: 24,
          offset: Offset(0, 8),
        ),
      ];

  /// elevation.4 — modal, drawer: 0 16px 40px rgba(15,23,42,0.14).
  static List<BoxShadow> get level4 => const [
        BoxShadow(
          color: Color(0x240F172A),
          blurRadius: 40,
          offset: Offset(0, 16),
        ),
      ];

  /// elevation.5 — toast, overlay: 0 24px 64px rgba(15,23,42,0.18).
  static List<BoxShadow> get level5 => const [
        BoxShadow(
          color: Color(0x2E0F172A),
          blurRadius: 64,
          offset: Offset(0, 24),
        ),
      ];

  /// Backward compatible nomlar.
  static List<BoxShadow> surface() => level1;
  static List<BoxShadow> elevated() => level3;
  static List<BoxShadow> floating() => level4;

  /// Brand glow — faqat kerak joyda.
  static List<BoxShadow> glow(Color color, {double intensity = 0.35}) => [
        BoxShadow(
          color: color.withValues(alpha: intensity),
          blurRadius: 20,
          offset: const Offset(0, 6),
          spreadRadius: -2,
        ),
      ];
}

/// TIPOGRAFIYA SHKALASI (v3.2 §2.2) — Inter.
///
/// v3.2 qoidalari:
/// - display: 34px/700 — login/onboarding
/// - h1: 28px/700 — sahifa sarlavhasi
/// - h2: 18px/600 — karta sarlavhasi
/// - h3: 16px/600 — kichik bo'lim
/// - body: 14px/400 — asosiy matn
/// - body-strong: 14px/600 — urg'ulangan matn
/// - caption: 12px/500 — yordamchi
/// - overline: 11px/600 UPPERCASE — status label
/// - numeric-lg: 24-28px/700 — KPI raqamlari
class AppType {
  AppType._();

  static TextStyle _base({
    required double size,
    required FontWeight weight,
    double? height,
    double letterSpacing = 0,
  }) =>
      GoogleFonts.inter(
        fontSize: size,
        fontWeight: weight,
        height: height ?? 1.4,
        letterSpacing: letterSpacing,
      );

  /// Raqamlar uchun tabular figures.
  static TextStyle _tabular(TextStyle style) => style.copyWith(
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  // ─── v3.2 Typography Scale ───────────────────────────────────────────
  static TextStyle display({Color? color}) => _base(
        size: 34,
        weight: FontWeight.w700,
        height: 1.2,
        letterSpacing: -0.02,
      ).copyWith(color: color);

  static TextStyle h1({Color? color}) => _base(
        size: 28,
        weight: FontWeight.w700,
        height: 1.25,
        letterSpacing: -0.01,
      ).copyWith(color: color);

  static TextStyle h2({Color? color}) => _base(
        size: 18,
        weight: FontWeight.w600,
        height: 1.3,
      ).copyWith(color: color);

  static TextStyle h3({Color? color}) => _base(
        size: 16,
        weight: FontWeight.w600,
        height: 1.35,
      ).copyWith(color: color);

  static TextStyle body({Color? color}) => _base(
        size: 14,
        weight: FontWeight.w400,
        height: 1.5,
      ).copyWith(color: color);

  static TextStyle bodyStrong({Color? color}) => _base(
        size: 14,
        weight: FontWeight.w600,
        height: 1.5,
      ).copyWith(color: color);

  static TextStyle caption({Color? color}) => _base(
        size: 12,
        weight: FontWeight.w500,
        height: 1.4,
        letterSpacing: 0.01,
      ).copyWith(color: color);

  static TextStyle overline({Color? color}) => _base(
        size: 11,
        weight: FontWeight.w600,
        height: 1.3,
        letterSpacing: 0.06,
      ).copyWith(color: color);

  // ─── Raqamlar — TABULAR (v3.2 §2.2) ─────────────────────────────────
  static TextStyle statDisplay({Color? color}) =>
      _tabular(display(color: color));

  static TextStyle statValue({Color? color}) => _tabular(h1(color: color));

  static TextStyle mono({Color? color, double size = 13}) =>
      GoogleFonts.jetBrainsMono(
        fontSize: size,
        fontWeight: FontWeight.w600,
        height: 1.3,
        color: color,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  // ─── Backward compatible nomlar ──────────────────────────────────────
  static TextStyle title({Color? color}) => h2(color: color);
  static TextStyle label({Color? color}) => bodyStrong(color: color);
  static TextStyle bodySmall({Color? color}) => caption(color: color);
  static TextStyle bodyMedium({Color? color}) =>
      _base(size: 14, weight: FontWeight.w500, height: 1.5).copyWith(color: color);
}

/// BLUR byudjeti (v3.2 §3.4 — performance degradation).
class AppBlur {
  AppBlur._();

  static const double none = 0;
  static const double light = 10; // topBar glass
  static const double card = 8;
  static const double glass = 20; // modal
  static const double heavy = 24;
}
